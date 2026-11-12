// GPU-instanced grass with a vertex-shader wind (TSL). Blades are placed on
// the lawns (dense) and the meadow outside town (sparse); the instance list
// is sorted by distance from the square so lower tiers simply draw fewer.
import * as THREE from 'three';
import { positionLocal, time, sin, float, vec3, uv, mix, hash, instanceIndex, color, transformNormalToView } from 'three/tsl';
import { PROOF } from '../config.js';

const G = PROOF.grass;

function bladeGeometry(h) {
  // 3-segment tapered blade, slight forward curve, double-sided
  const segs = 3, w = 0.055;
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = t * h, ww = w * (1 - t * 0.85), bend = t * t * 0.06;
    pos.push(-ww, y, bend, ww, y, bend); uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Grass {
  constructor(scene, lawns, meadow) {
    const spots = [];
    const rnd = mulberry(7);
    for (const L of lawns) {
      const n = Math.round((L.x1 - L.x0) * (L.z1 - L.z0) * G.density * (L.outer ? 0.35 : 1));
      for (let i = 0; i < n; i++) spots.push([L.x0 + 0.25 + rnd() * (L.x1 - L.x0 - 0.5), L.z0 + 0.25 + rnd() * (L.z1 - L.z0 - 0.5), 1]);
    }
    for (const Mw of meadow) {
      const n = Math.round((Mw.x1 - Mw.x0) * (Mw.z1 - Mw.z0) * G.density * 0.035);
      for (let i = 0; i < n; i++) spots.push([Mw.x0 + rnd() * (Mw.x1 - Mw.x0), Mw.z0 + rnd() * (Mw.z1 - Mw.z0), 1.4]);
    }
    spots.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
    this.total = spots.length;

    const mat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
    const phase = hash(instanceIndex).mul(6.283);
    const hgt = uv().y;
    const sway = sin(time.mul(G.windSpeed).add(phase).add(positionLocal.x.mul(0.35)).add(positionLocal.z.mul(0.25))).mul(hgt.mul(hgt)).mul(G.windAmp);
    const gust = sin(time.mul(0.37).add(positionLocal.x.mul(0.08))).mul(0.5).add(0.5);
    mat.positionNode = positionLocal.add(vec3(sway.mul(gust.add(0.4)), float(0), sway.mul(0.45)));
    // soft green gradient dark at the root, per-blade variation, faces up for lighting
    const shade = hash(instanceIndex.add(97)).mul(0.25).add(0.8);
    const base = color(0x3a6e2c), tip = color(0x8dbf5e);
    mat.colorNode = mix(base, tip, hgt).mul(shade);
    mat.normalNode = transformNormalToView(vec3(0.0, 1.0, 0.0));

    const geo = bladeGeometry(G.bladeHeight);
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    spots.forEach(([x, z, sc], i) => {
      const k = (0.75 + rnd() * 0.6) * sc;
      p.set(x, 0.02, z); s.set(k, k, k); q.setFromEuler(e.set(0, rnd() * 6.283, (rnd() - 0.5) * 0.25));
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
    this.mesh = mesh;
    scene.add(mesh);
  }
  setDensity(k) { this.mesh.count = Math.max(0, Math.round(this.total * k)); }
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
