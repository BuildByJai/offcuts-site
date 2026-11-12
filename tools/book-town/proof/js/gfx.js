// Rendering for the proof: WebGPURenderer (falls back to WebGL2 on its own),
// AgX/ACES tone mapping, HDRI image-based lighting with the sun direction
// read off the HDRI, cascaded soft shadows (CSMShadowNode), light haze, and a
// TSL post stack: GTAO, bloom, colour grade, vignette, SMAA/FXAA and a soft
// depth of field when the camera is zoomed out. Quality tiers switch all of it.
import * as THREE from 'three';
import { pass, mrt, output, normalView, uniform, vec3, vec4, float, screenUV, smoothstep, mix, dot, Fn } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { PROOF } from '../config.js';

export const TIERS = ['low', 'medium', 'high'];
export const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const R = PROOF.render;
const _snap = new THREE.Vector3();

export class Gfx {
  constructor({ canvas, scene, camera }) {
    this.canvas = canvas; this.scene = scene; this.camera = camera;
    this.tier = null; this.tierCfg = null; this.listeners = [];
    this.preset = null; this.presetKey = null;
    this.hdris = {};
    this.post = null;
    this.toggles = { ao: true, bloom: true, dof: true, aa: true, grade: true, shadows: true, fog: true };
    this.focus = uniform(8); this.aperture = uniform(0); this.maxBlur = uniform(R.dof.maxBlur);
    this.vignette = uniform(R.grade.vignette);
    this.sunDir = new THREE.Vector3(0.5, 0.75, 0.4);
    this.onAutoDrop = null;
    this.fpsWindow = { t: 0, n: 0 }; this.lowFor = 0; this.probe = null;
    const sm = new URLSearchParams(location.search).get('shadow');
    this.shadowMode = sm === 'single' || sm === 'csm' ? sm : PROOF.shadow.mode;
  }

  async init() {
    const renderer = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    await renderer.init();
    this.renderer = renderer;
    this.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = R.toneMapping === 'aces' ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
    renderer.toneMappingExposure = R.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // sun + cascaded shadows
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 220;
    sun.shadow.bias = PROOF.shadow.bias; sun.shadow.normalBias = PROOF.shadow.normalBias;
    sun.shadow.radius = 4;
    sun.shadow.intensity = PROOF.shadow.intensity || 1;
    this.sun = sun;
    this.scene.add(sun, sun.target);
    this.hemi = new THREE.HemisphereLight(0xdfe9f3, 0x8a9a74, 0.9);   // a little extra ground bounce
    this.scene.add(this.hemi);

    this.scene.fog = new THREE.Fog(R.fogColor, R.fogNear, R.fogFar);

    // tier: saved → url → probe
    const params = new URLSearchParams(location.search);
    let saved = null; try { saved = localStorage.getItem('bookTown.proof.quality'); } catch (e) { /* ignore */ }
    const forced = params.get('quality');
    if (forced && PROOF.tiers[forced]) this.setTier(forced, false);
    else if (saved && PROOF.tiers[saved]) this.setTier(saved, false);
    else { this.setTier(isCoarse ? 'medium' : 'high', false); this.probe = { t: 0, n: 0, skip: 1.0 }; }

    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
  }

  /* ---------- tiers ---------- */
  onTier(fn) { this.listeners.push(fn); if (this.tier) fn(this.tier, this.tierCfg); }
  setTier(t, save = true) {
    if (!PROOF.tiers[t]) t = 'medium';
    const changed = t !== this.tier;
    this.tier = t; this.tierCfg = PROOF.tiers[t];
    if (save) { try { localStorage.setItem('bookTown.proof.quality', t); } catch (e) { /* ignore */ } }
    this._applyTier();
    if (changed) this.listeners.forEach((fn) => fn(t, this.tierCfg));
  }
  _applyTier() {
    const c = this.tierCfg, r = this.renderer;
    if (!r) return;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, c.pixelRatio));
    this._applyShadows();
    this.buildPost();
    this.resize();
  }
  _applyShadows() {
    const c = this.tierCfg, sun = this.sun;
    const on = c.shadows && this.toggles.shadows;
    this.renderer.shadowMap.enabled = on;
    sun.castShadow = on;
    if (on) {
      if (sun.shadow.mapSize.x !== c.shadowMap) {
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        sun.shadow.mapSize.set(c.shadowMap, c.shadowMap);
      }
      const mode = this.shadowMode;
      if (mode === 'csm') {
        if (!this.csm || this.csm.cascades !== c.cascades) {
          this.csm = new CSMShadowNode(sun, { cascades: c.cascades, maxFar: PROOF.shadow.maxFar, mode: 'practical', lightMargin: PROOF.shadow.lightMargin });
          // bind to the main camera now, so the cascades aren't derived from whichever pass builds the node first
          this.csm.init({ camera: this.camera, renderer: this.renderer });
          sun.shadow.shadowNode = this.csm;
          sun.shadow.needsUpdate = true;
        }
      } else {
        // one soft map that follows the player (frustum snapped to texels)
        this.csm = null;
        sun.shadow.shadowNode = undefined;   // three treats null as a custom node; undefined = built-in shadow
        const r = PROOF.shadow.singleRange;
        Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 260 });
        sun.shadow.camera.updateProjectionMatrix();
        sun.shadow.needsUpdate = true;
      }
    }
  }

  /* ---------- post-processing ---------- */
  buildPost() {
    const c = this.tierCfg, T = this.toggles;
    const r = this.renderer;
    const pp = new THREE.PostProcessing(r);
    const scenePass = pass(this.scene, this.camera);
    const useAO = c.ao && T.ao;
    if (useAO) scenePass.setMRT(mrt({ output, normal: normalView }));
    let color = useAO ? scenePass.getTextureNode('output') : scenePass.getTextureNode();
    if (useAO) {
      const aoPass = ao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), this.camera);
      aoPass.radius.value = R.ao.radius; aoPass.scale.value = R.ao.scale; aoPass.thickness.value = R.ao.thickness;
      aoPass.distanceExponent.value = R.ao.distanceExponent; aoPass.distanceFallOff.value = R.ao.distanceFallOff;
      this.aoPass = aoPass;
      color = aoPass.getTextureNode().mul(color);
    }
    if (c.bloom && T.bloom) {
      const b = R.bloom;
      color = color.add(bloom(color, b.strength, b.radius, b.threshold));
    }
    if (c.dof && T.dof && R.dof.enabled) {
      color = dof(color, scenePass.getViewZNode(), this.focus, this.aperture, this.maxBlur);
    }
    if (T.grade) {
      const g = R.grade, src = color;
      color = Fn(() => {
        const col = vec3(src.rgb);
        const l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        let out = mix(vec3(l), col, float(g.saturation));
        out = out.mul(vec3(1 + g.warmth, 1.0, 1 - g.warmth * 0.9)).add(vec3(g.lift, g.lift * 0.95, g.lift * 0.85));
        out = out.sub(0.18).mul(float(g.contrast || 1)).add(0.18);
        const d = screenUV.sub(0.5).length();
        out = out.mul(float(1).sub(this.vignette.mul(smoothstep(0.4, 0.95, d))));
        return vec4(out, 1.0);
      })();
    }
    if (T.aa) color = c.aa === 'smaa' ? smaa(color) : fxaa(color);
    pp.outputNode = color;
    this.post = pp;
  }

  /* ---------- presets (time of day) ---------- */
  async setPreset(key) {
    const p = PROOF.presets[key];
    if (!p) return;
    this.presetKey = key; this.preset = p;
    let env = this.hdris[p.hdri];
    if (!env) {
      const loader = new RGBELoader();
      loader.setDataType(THREE.FloatType);
      const tex = await loader.loadAsync(p.hdri);
      const sunDir = findSun(tex);
      // the sun disc can exceed the half-float range the GPU texture uses (65504) → NaN lighting; clamp it
      const d = tex.image.data; for (let i = 0; i < d.length; i++) if (d[i] > 60000) d[i] = 60000;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      // Lighting copy: the HDRI has the sun baked in, and an environment map can't cast shadows, so the
      // sun would light everything unshadowed and wash the real shadows out. Clamp the lighting copy to
      // sky brightness; the DirectionalLight (with shadows) is the sun. The full-range copy stays as the sky.
      const cap = p.envClamp || R.envClamp;
      const ed = new Float32Array(d.length); for (let i = 0; i < d.length; i++) ed[i] = Math.min(d[i], cap);
      const { width, height } = tex.image;
      const envTex = new THREE.DataTexture(ed, width, height, tex.format, THREE.FloatType);
      envTex.mapping = THREE.EquirectangularReflectionMapping; envTex.colorSpace = THREE.LinearSRGBColorSpace;
      envTex.flipY = tex.flipY; envTex.needsUpdate = true;
      env = { tex, envTex, sun: sunDir };
      this.hdris[p.hdri] = env;
    }
    const s = this.scene;
    s.environment = env.envTex;
    s.background = env.tex;
    s.environmentIntensity = p.env * R.envIntensity;
    s.backgroundIntensity = p.sky;
    s.backgroundBlurriness = 0.0;
    this.renderer.toneMappingExposure = R.exposure * p.exposure;
    this.sunDir.copy(env.sun);
    this.sun.color.set(p.sun.color);
    this.sun.intensity = p.sun.intensity;
    this.hemi.color.set(p.fog).lerp(new THREE.Color(0xffffff), 0.4);
    s.fog.color.set(p.fog);
    s.fog.near = p.fogNear; s.fog.far = p.fogFar;
    this.updateSun(new THREE.Vector3());
    if (this.csm && this.csm.camera) this.csm.updateFrustums();
  }
  // Keep the sun pointed at the player so the cascades stay centred.
  updateSun(target) {
    if (this.shadowMode === 'single' && this.sun.castShadow) {
      // snap to shadow texels so the map doesn't shimmer as the player moves
      const texel = (PROOF.shadow.singleRange * 2) / this.sun.shadow.mapSize.x;
      _snap.set(Math.round(target.x / texel) * texel, Math.round(target.y / texel) * texel, Math.round(target.z / texel) * texel);
      target = _snap;
    }
    this.sun.position.copy(target).addScaledVector(this.sunDir, 120);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
  }

  /* ---------- per frame ---------- */
  setFocus(dist, zoomedOut) {
    // DoF only once the camera is pulled back: aperture eases in past minDistance
    const k = THREE.MathUtils.clamp((dist - R.dof.minDistance) / 8, 0, 1);
    this.focus.value = dist;
    this.aperture.value = R.dof.aperture * k * (zoomedOut ? 1 : 0);
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  render() {
    if (this.post) this.post.render(); else this.renderer.render(this.scene, this.camera);
  }
  // FPS probe on first load + auto-drop while playing.
  monitor(dt, active) {
    if (document.hidden || !active || dt <= 0) return;
    if (this.probe) {
      if (this.probe.skip > 0) { this.probe.skip -= dt; return; }
      this.probe.t += dt; this.probe.n++;
      if (this.probe.t >= 2.5) {
        const fps = this.probe.n / this.probe.t;
        let pick = this.tier;
        if (fps < 26) pick = 'low'; else if (fps < 45) pick = this.tier === 'high' ? 'medium' : 'low';
        this.probe = null;
        if (pick !== this.tier) this.setTier(pick);
      }
      return;
    }
    const w = this.fpsWindow; w.t += dt; w.n++;
    if (w.t >= 1) {
      const fps = w.n / w.t; w.t = 0; w.n = 0;
      this.fps = fps;
      if (fps < PROOF.autoDrop.belowFps) this.lowFor++; else this.lowFor = 0;
      if (this.lowFor >= PROOF.autoDrop.forSec && this.tier !== 'low') {
        this.lowFor = 0;
        const next = TIERS[TIERS.indexOf(this.tier) - 1];
        this.setTier(next);
        if (this.onAutoDrop) this.onAutoDrop(next);
      }
    }
  }
  get info() {
    const i = this.renderer.info;
    return { calls: i.render.drawCalls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, fps: this.fps || 0, backend: this.backend };
  }
}

// Brightest texel of an equirectangular HDRI → world direction (three.js convention).
function findSun(tex) {
  const { data, width, height } = tex.image;
  const ch = data.length / (width * height);
  let best = -1, bx = 0, by = 0;
  const step = Math.max(1, Math.floor(width / 512));
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * ch;
    const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    if (l > best) { best = l; bx = x; by = y; }
  }
  const u = (bx + 0.5) / width;
  // row 0 of the decoded data is the top of the image (RGBELoader sets flipY so it displays upright)
  const v = 1 - (by + 0.5) / height;
  const el = (v - 0.5) * Math.PI, az = (u - 0.5) * Math.PI * 2;
  const d = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  if (d.y < 0.08) d.y = 0.08;   // keep the shadow light above the horizon
  return d.normalize();
}

export function qualityPicker(container, gfx) {
  container.innerHTML = '';
  const btns = TIERS.map((t) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seg-btn'; b.textContent = t[0].toUpperCase() + t.slice(1);
    b.addEventListener('click', () => gfx.setTier(t));
    container.appendChild(b);
    return b;
  });
  const sync = () => btns.forEach((b, i) => b.classList.toggle('on', TIERS[i] === gfx.tier));
  sync(); gfx.onTier(sync);
}
export function presetPicker(container, gfx, onPick) {
  container.innerHTML = '';
  const keys = Object.keys(PROOF.presets);
  const btns = keys.map((k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seg-btn'; b.textContent = PROOF.presets[k].label;
    b.addEventListener('click', async () => { await onPick(k); sync(); });
    container.appendChild(b);
    return b;
  });
  const sync = () => btns.forEach((b, i) => b.classList.toggle('on', keys[i] === gfx.presetKey));
  sync();
  return sync;
}
