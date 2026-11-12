// Shared rendering: renderer setup (ACES + sRGB), quality tiers with an FPS
// auto-pick / auto-drop, toon materials, inverted-hull outlines, a gradient
// sky dome with sun/moon/stars + drifting clouds, the day/night cycle and the
// optional post-processing stack (bloom, grade, vignette, FXAA).
//
// Every scene that uses the shared player controller (town, tower, study)
// creates its renderer through createGfx() so tiers and tone mapping match.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { Save } from './save.js';

const G = CONFIG.graphics;
export const TIERS = ['low', 'medium', 'high'];
export const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

// Uniforms shared by every animated shader (wind, water, shine sweeps, …).
export const U = {
  time: { value: 0 },
  night: { value: 0 },
  wind: { value: 1 }
};

/* =============== toon materials =============== */
let _grad = null;
export function toonGradient() {
  if (_grad) return _grad;
  const steps = G.toonSteps;
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { const c = Math.round(v * 255); data.set([c, c, c, 255], i * 4); });
  _grad = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}
// flatShading isn't a toon option — faceted looks come from non-indexed geometry.
export function toon(params = {}) {
  const p = Object.assign({ gradientMap: toonGradient() }, params);
  delete p.flatShading;
  return new THREE.MeshToonMaterial(p);
}
// Non-indexed copy with per-face normals (low-poly faceted look).
export function faceted(g) {
  const n = g.index ? g.toNonIndexed() : g;
  n.computeVertexNormals();
  return n;
}

/* =============== inverted-hull outlines ===============
   Works on the box-built meshes used everywhere here: each mesh gets a
   back-face twin scaled out by a constant world thickness. */
const outlineMats = new Map();
export function outlineMaterial(color = G.outlineColor) {
  if (!outlineMats.has(color)) {
    outlineMats.set(color, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  }
  return outlineMats.get(color);
}
const _bb = new THREE.Box3(), _sz = new THREE.Vector3(), _ctr = new THREE.Vector3(), _ws = new THREE.Vector3();
export function addOutline(root, { width = G.outlineWidth, color = G.outlineColor, skip = null } = {}) {
  const mat = outlineMaterial(color);
  const added = [];
  root.updateMatrixWorld(true);
  const targets = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.outline || o.isInstancedMesh) return;
    if (skip && skip(o)) return;
    if (o.material && (o.material.transparent || o.material.isMeshBasicMaterial)) return;
    targets.push(o);
  });
  for (const o of targets) {
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    _bb.copy(g.boundingBox); _bb.getSize(_sz); _bb.getCenter(_ctr);
    o.getWorldScale(_ws);
    const sx = 1 + (2 * width / Math.max(1e-3, _sz.x * _ws.x));
    const sy = 1 + (2 * width / Math.max(1e-3, _sz.y * _ws.y));
    const sz = 1 + (2 * width / Math.max(1e-3, _sz.z * _ws.z));
    const hull = new THREE.Mesh(g, mat);
    hull.scale.set(sx, sy, sz);
    hull.position.set(_ctr.x * (1 - sx), _ctr.y * (1 - sy), _ctr.z * (1 - sz));
    hull.userData.outline = true;
    hull.castShadow = false; hull.receiveShadow = false;
    hull.raycast = () => {};
    o.add(hull);
    added.push(hull);
  }
  return added;
}

/* =============== wind sway for instanced foliage =============== */
// amp: metres of sway at 1 m above the instance origin.
export function addWind(material, { amp = 0.12, speed = 1.6, heightScale = 1 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.time;
    shader.uniforms.uWind = U.wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 ip = vec3(0.0);
          #endif
          float hh = max(0.0, position.y) * ${heightScale.toFixed(3)};
          float ph = ip.x * 0.37 + ip.z * 0.23;
          float sw = sin(uTime * ${speed.toFixed(3)} + ph) * 0.7 + sin(uTime * ${(speed * 2.3).toFixed(3)} + ph * 1.7) * 0.3;
          transformed.x += sw * ${amp.toFixed(3)} * hh * uWind;
          transformed.z += cos(uTime * ${(speed * 0.8).toFixed(3)} + ph) * ${(amp * 0.6).toFixed(3)} * hh * uWind;
        }`);
  };
  material.customProgramCacheKey = () => `wind-${amp}-${speed}-${heightScale}`;
  return material;
}

/* =============== renderer + quality =============== */
export function createGfx({ canvas, scene, camera, sun = null, extraShadowLights = [], exposure = G.exposure, post = true }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isCoarse, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const listeners = [];
  const gfx = {
    renderer, scene, camera, sun,
    tier: null,
    tierCfg: null,
    composer: null,
    _bloom: null, _fxaa: null, _postLoading: false,
    onTier(fn) { listeners.push(fn); if (this.tier) fn(this.tier, this.tierCfg); },
    setTier(t, { save = true } = {}) {
      if (!G.tiers[t]) t = 'medium';
      const changed = t !== this.tier;
      this.tier = t;
      this.tierCfg = G.tiers[t];
      if (save) Save.setQuality(t);
      applyTier();
      if (changed) listeners.forEach((fn) => fn(t, this.tierCfg));
    },
    resize,
    // Debug-panel overrides (null = follow the tier). Not saved.
    overrides: { shadows: null, post: null },
    get postOn() { return this.overrides.post !== null ? this.overrides.post : this.tierCfg.post; },
    refresh() { applyTier(); },
    render() {
      if (this.composer && this.postOn) this.composer.render();
      else renderer.render(scene, camera);
    },
    // Called every frame with real dt; active = the player is in control.
    monitor(dt, active) { monitorFps(dt, active); },
    onAutoDrop: null
  };

  function applyTier() {
    const c = gfx.tierCfg;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, c.pixelRatio));
    const lights = [sun, ...extraShadowLights].filter(Boolean);
    const shadowSize = c.shadows > 0 ? c.shadows : 1024;   // a debug override can turn shadows on for Low
    const shadowsOn = gfx.overrides.shadows !== null ? gfx.overrides.shadows : c.shadows > 0;
    for (const l of lights) {
      const size = l.isPointLight ? Math.min(1024, shadowSize / 2) : shadowSize;
      l.castShadow = shadowsOn;
      if (shadowsOn && l.shadow.mapSize.x !== size) {
        if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
        l.shadow.mapSize.set(size, size);
      }
    }
    if ((c.post || gfx.overrides.post) && post && !gfx.composer && !gfx._postLoading) buildPost();
    resize();
  }

  async function buildPost() {
    gfx._postLoading = true;
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }, { FXAAShader }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/ShaderPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/shaders/FXAAShader.js')
      ]);
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const b = G.bloom;
      const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), b.strength, b.radius, b.threshold);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      composer.addPass(new ShaderPass({
        uniforms: { tDiffuse: { value: null }, vignette: { value: G.vignette } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; varying vec2 vUv;
          void main(){
            vec4 c = texture2D(tDiffuse, vUv);
            vec3 col = c.rgb;
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(l), col, 1.1);                 // a touch more saturation
            col = col * vec3(1.025, 1.0, 0.97);            // warm grade
            col = (col - 0.5) * 1.04 + 0.5;               // gentle contrast
            float d = distance(vUv, vec2(0.5));
            col *= 1.0 - vignette * smoothstep(0.38, 0.9, d);
            gl_FragColor = vec4(col, c.a);
          }`
      }));
      const fxaa = new ShaderPass(FXAAShader);
      composer.addPass(fxaa);
      gfx.composer = composer; gfx._bloom = bloom; gfx._fxaa = fxaa;
      resize();
    } catch (e) {
      console.warn('Post-processing unavailable', e);
    }
    gfx._postLoading = false;
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (gfx.composer) {
      const pr = renderer.getPixelRatio();
      gfx.composer.setPixelRatio(pr);
      gfx.composer.setSize(innerWidth, innerHeight);
      if (gfx._fxaa) gfx._fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    }
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));

  /* ---------- FPS: first-load auto pick + auto drop ---------- */
  let probe = null;               // { t, frames } while auto-picking
  let win = { t: 0, frames: 0 }, lowFor = 0;
  const saved = Save.quality();
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced && G.tiers[forced]) gfx.setTier(forced, { save: false });
  else if (saved && G.tiers[saved]) gfx.setTier(saved, { save: false });
  else { gfx.setTier(isCoarse ? 'medium' : 'high', { save: false }); probe = { t: 0, frames: 0, skip: 0.6 }; }

  function monitorFps(dt, active) {
    if (document.hidden || !active || dt <= 0) return;
    if (probe) {
      if (probe.skip > 0) { probe.skip -= dt; return; }
      probe.t += dt; probe.frames++;
      if (probe.t >= 2.5) {
        const fps = probe.frames / probe.t;
        let pick = gfx.tier;
        if (fps < 34) pick = 'low';
        else if (fps < 50) pick = gfx.tier === 'high' ? 'medium' : 'low';
        probe = null;
        gfx.setTier(pick);
      }
      return;
    }
    win.t += dt; win.frames++;
    if (win.t >= 1) {
      const fps = win.frames / win.t;
      win = { t: 0, frames: 0 };
      if (fps < G.autoDrop.belowFps) lowFor++; else lowFor = 0;
      if (lowFor >= G.autoDrop.forSec && gfx.tier !== 'low') {
        lowFor = 0;
        const next = TIERS[TIERS.indexOf(gfx.tier) - 1];
        gfx.setTier(next);
        if (gfx.onAutoDrop) gfx.onAutoDrop(next);
      }
    }
  }

  return gfx;
}

// Builds a 3-way Low / Medium / High picker into a container element.
export function qualityPicker(container, gfx) {
  container.innerHTML = '';
  container.classList.add('seg');
  const btns = TIERS.map((t) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seg-btn'; b.textContent = t[0].toUpperCase() + t.slice(1);
    b.addEventListener('click', () => { gfx.setTier(t); sync(); });
    container.appendChild(b);
    return b;
  });
  function sync() { btns.forEach((b, i) => b.classList.toggle('on', TIERS[i] === gfx.tier)); }
  sync();
  gfx.onTier(sync);
  return sync;
}

/* =============== sky dome, stars, clouds =============== */
export class Sky {
  constructor(scene, { radius = 360 } = {}) {
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      groundColor: { value: new THREE.Color(0x6f8f60) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      night: U.night
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 topColor, horizonColor, groundColor, sunDir, sunColor; uniform float night; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(h, 0.5)) : mix(horizonColor, groundColor, pow(min(1.0, -h * 4.0), 0.6));
          vec3 sd = normalize(sunDir);
          float s = dot(d, sd);
          float disc = smoothstep(0.9988, 0.9993, s);
          float glow = pow(max(s, 0.0), 80.0) * 0.6 + pow(max(s, 0.0), 6.0) * 0.16;
          col += sunColor * (disc * 2.2 + glow) * (1.0 - night);
          float m = dot(d, normalize(vec3(-sd.x, abs(sd.y) * 0.8 + 0.25, -sd.z)));
          col += vec3(0.95, 0.97, 1.0) * smoothstep(0.9989, 0.9993, m) * night * 1.4;
          col += vec3(0.5, 0.6, 0.9) * pow(max(m, 0.0), 40.0) * night * 0.25;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // stars
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.05;
      const th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * radius * 0.95, y * radius * 0.95, Math.sin(th) * r * radius * 0.95], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // instanced low-poly clouds
    const parts = [];
    [[0, 0, 0, 1.0], [1.3, -0.2, 0.3, 0.75], [-1.2, -0.25, -0.2, 0.8], [0.4, 0.35, -0.5, 0.65], [-0.5, 0.2, 0.6, 0.6]].forEach(([x, y, z, s]) => {
      const g = new THREE.IcosahedronGeometry(s, 0);
      g.scale(1.3, 0.75, 1); g.translate(x, y, z);
      parts.push(g);
    });
    const cg = mergeGeometries(parts.map((g) => faceted(g)));
    cg.computeVertexNormals();
    this.cloudMat = toon({ color: 0xffffff, flatShading: true });
    this.cloudMat.fog = false;
    const count = 16;
    this.clouds = new THREE.InstancedMesh(cg, this.cloudMat, count);
    this.clouds.frustumCulled = false;
    this.cloudData = [];
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996, r = 60 + ((i * 37) % 120);
      this.cloudData.push({ x: Math.cos(a) * r, y: 48 + (i % 5) * 6, z: Math.sin(a) * r, s: 5 + (i % 4) * 2.2, sp: 0.8 + (i % 3) * 0.35 });
    }
    scene.add(this.clouds);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.radius = radius;
  }
  update(dt, cameraPos) {
    this.dome.position.copy(cameraPos);
    this.stars.position.copy(cameraPos);
    this.stars.rotation.y += dt * 0.004;
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      c.x += c.sp * dt;
      if (c.x > 190) c.x = -190;
      this._v.set(c.x, c.y, c.z);
      this._s.set(c.s, c.s * 0.8, c.s);
      this._q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, i * 1.3);
      this._m.compose(this._v, this._q, this._s);
      this.clouds.setMatrixAt(i, this._m);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }
}

/* =============== day / night cycle =============== */
// Keyframes by hour. Colours are sRGB hex and are blended in linear space.
const KEYS = [
  { h: 0,    top: 0x0a1430, hor: 0x1c2848, sun: 0x8aa0e0, sunI: 0.45, sky: 0x3a4a78, gnd: 0x1c1c28, hemiI: 0.62, cloud: 0x5a6688, night: 1 },
  { h: 5.0,  top: 0x0a1430, hor: 0x1c2848, sun: 0x8aa0e0, sunI: 0.45, sky: 0x3a4a78, gnd: 0x1c1c28, hemiI: 0.62, cloud: 0x5a6688, night: 1 },
  { h: 6.3,  top: 0x46679f, hor: 0xf0a47c, sun: 0xffb27a, sunI: 1.0,  sky: 0xa8b8d8, gnd: 0x6a5a4a, hemiI: 0.85, cloud: 0xffc8b0, night: 0.45 },
  { h: 7.6,  top: 0x5c9fe0, hor: 0xcfe5f4, sun: 0xffe4bc, sunI: 2.1,  sky: 0xd6ecff, gnd: 0x7a8a5a, hemiI: 1.05, cloud: 0xffffff, night: 0 },
  { h: 12,   top: 0x3f8fe0, hor: 0xbfe0f5, sun: 0xfff4e2, sunI: 2.5,  sky: 0xdff1ff, gnd: 0x7a8a5a, hemiI: 1.15, cloud: 0xffffff, night: 0 },
  { h: 16.6, top: 0x4a8fd6, hor: 0xd6e5ee, sun: 0xffeccb, sunI: 2.3,  sky: 0xe6eef6, gnd: 0x7a845a, hemiI: 1.05, cloud: 0xfffaf0, night: 0 },
  { h: 18.4, top: 0x5a78bc, hor: 0xffc286, sun: 0xffa456, sunI: 2.0,  sky: 0xffd8ac, gnd: 0x6a5a40, hemiI: 0.95, cloud: 0xffd6a8, night: 0 },
  { h: 19.4, top: 0x2c3c76, hor: 0xe57f68, sun: 0xff7a4a, sunI: 0.9,  sky: 0x8070a8, gnd: 0x3a3040, hemiI: 0.72, cloud: 0xd88a90, night: 0.5 },
  { h: 20.6, top: 0x0a1430, hor: 0x1c2848, sun: 0x8aa0e0, sunI: 0.45, sky: 0x3a4a78, gnd: 0x1c1c28, hemiI: 0.62, cloud: 0x5a6688, night: 1 },
  { h: 24,   top: 0x0a1430, hor: 0x1c2848, sun: 0x8aa0e0, sunI: 0.45, sky: 0x3a4a78, gnd: 0x1c1c28, hemiI: 0.62, cloud: 0x5a6688, night: 1 }
];
const lin = (hex) => new THREE.Color(hex);   // THREE.Color(hex) converts sRGB → linear working space
const KEYC = KEYS.map((k) => ({ ...k, topC: lin(k.top), horC: lin(k.hor), sunC: lin(k.sun), skyC: lin(k.sky), gndC: lin(k.gnd), cloudC: lin(k.cloud) }));

export class DayCycle {
  constructor({ scene, sun, hemi, sky, fog }) {
    this.scene = scene; this.sun = sun; this.hemi = hemi; this.sky = sky; this.fog = fog;
    const q = new URLSearchParams(location.search).get('time');
    this.locked = q !== null && q !== '' ? parseFloat(q) : G.lockHour;
    this.hour = this.locked != null && !isNaN(this.locked) ? this.locked : G.startHour;
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.night = 0;
    this._c = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), sky: new THREE.Color(), gnd: new THREE.Color(), cloud: new THREE.Color() };
    this.update(0);
  }
  setHour(h) { this.hour = ((h % 24) + 24) % 24; this.update(0); }
  // Freeze the clock at an hour (null = let the day run).
  setLock(h) {
    this.locked = h == null ? null : ((h % 24) + 24) % 24;
    if (this.locked != null) this.hour = this.locked;
    this.update(0);
  }
  get isLive() { return this.locked == null || isNaN(this.locked); }
  update(dt) {
    if (this.locked == null || isNaN(this.locked)) this.hour = (this.hour + dt * 24 / G.dayLengthSec) % 24;
    const h = this.hour;
    let i = 0;
    while (i < KEYC.length - 2 && KEYC[i + 1].h <= h) i++;
    const a = KEYC[i], b = KEYC[i + 1];
    const t = THREE.MathUtils.smoothstep(h, a.h, b.h);
    const c = this._c;
    c.top.copy(a.topC).lerp(b.topC, t);
    c.hor.copy(a.horC).lerp(b.horC, t);
    c.sun.copy(a.sunC).lerp(b.sunC, t);
    c.sky.copy(a.skyC).lerp(b.skyC, t);
    c.gnd.copy(a.gndC).lerp(b.gndC, t);
    c.cloud.copy(a.cloudC).lerp(b.cloudC, t);
    this.night = a.night + (b.night - a.night) * t;
    U.night.value = this.night;

    // sun path: rises in the east (+x) at 6:00, sets in the west at 18:00
    const ang = (h - 6) / 12 * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang) * 0.9, 0.42).normalize();
    // the shadow light follows the sun by day and a high moon by night
    if (this.sunDir.y > 0.02) this.lightDir.copy(this.sunDir);
    else this.lightDir.set(-this.sunDir.x * 0.6, 0.85, -0.35).normalize();
    this.lightDir.y = Math.max(this.lightDir.y, 0.22);
    this.lightDir.normalize();

    const sunI = a.sunI + (b.sunI - a.sunI) * t;
    const hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
    if (this.sun) { this.sun.color.copy(c.sun); this.sun.intensity = sunI; }
    if (this.hemi) { this.hemi.color.copy(c.sky); this.hemi.groundColor.copy(c.gnd); this.hemi.intensity = hemiI; }
    if (this.sky) {
      const u = this.sky.uniforms;
      u.topColor.value.copy(c.top); u.horizonColor.value.copy(c.hor);
      u.sunColor.value.copy(c.sun); u.sunDir.value.copy(this.sunDir);
      u.groundColor.value.copy(c.hor).lerp(c.gnd, 0.6);
      this.sky.starMat.opacity = Math.max(0, this.night - 0.25) / 0.75;
      this.sky.cloudMat.color.copy(c.cloud);
    }
    if (this.scene.fog) this.scene.fog.color.copy(c.hor);
    if (this.scene.background && this.scene.background.isColor) this.scene.background.copy(c.hor);
  }
  get label() {
    const h = this.hour;
    if (h < 5 || h >= 20.6) return 'night';
    if (h < 7.6) return 'morning';
    if (h < 16.6) return 'midday';
    if (h < 19.4) return 'golden hour';
    return 'dusk';
  }
}

// Keeps a directional light's shadow frustum tight around a target.
const _snap = new THREE.Vector3();
export function followShadow(light, target, dir, range, dist = 80) {
  if (!light.castShadow || !range) {
    light.position.copy(target).addScaledVector(dir, dist);
    light.target.position.copy(target);
    return;
  }
  const cam = light.shadow.camera;
  if (cam.right !== range) {
    Object.assign(cam, { left: -range, right: range, top: range, bottom: -range, near: 1, far: dist + range * 2 });
    cam.updateProjectionMatrix();
  }
  // snap to whole shadow texels to stop shimmering as the player moves
  const texel = (range * 2) / light.shadow.mapSize.x;
  _snap.set(Math.round(target.x / texel) * texel, Math.round(target.y / texel) * texel, Math.round(target.z / texel) * texel);
  light.position.copy(_snap).addScaledVector(dir, dist);
  light.target.position.copy(_snap);
  light.target.updateMatrixWorld();
}
