// Fountain water: a physical material with transmission (refraction of the
// basin floor), environment reflection, two scrolling normal layers for
// ripples, plus a jet and splash made of instanced droplets.
import * as THREE from 'three';
import { PROOF } from '../config.js';
import { canvasTexture } from './materials.js';

function noiseNormal(size = 256) {
  // tileable value-noise height field → normal map
  const n = size, h = new Float32Array(n * n);
  const g = 8, grid = new Float32Array(g * g);
  for (let i = 0; i < g * g; i++) grid[i] = Math.random();
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < 3; o++) {
      const gx = (x / n) * g * f, gy = (y / n) * g * f;
      const x0 = Math.floor(gx) % g, y0 = Math.floor(gy) % g, x1 = (x0 + 1) % g, y1 = (y0 + 1) % g;
      const tx = smooth(gx - Math.floor(gx)), ty = smooth(gy - Math.floor(gy));
      const a = grid[y0 * g + x0], b = grid[y0 * g + x1], c = grid[y1 * g + x0], d = grid[y1 * g + x1];
      v += ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) * amp; tot += amp; amp *= 0.5; f *= 2;
    }
    h[y * n + x] = v / tot;
  }
  return canvasTexture(n, n, (ctx) => {
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = h[y * n + (x + 1) % n] - h[y * n + (x + n - 1) % n], dy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x];
      const nx = -dx * 6, ny = -dy * 6, l = Math.hypot(nx, ny, 1);
      const i = (y * n + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false });
}

export class Fountain {
  constructor(scene, { level = 0.52, bowlLevel = 2.05, radius = 4.15 } = {}) {
    const W = PROOF.water;
    const nrm = noiseNormal(); nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(3, 3);
    const nrm2 = nrm.clone(); nrm2.repeat.set(5.3, 5.3); nrm2.needsUpdate = true;
    this.mat = new THREE.MeshPhysicalMaterial({
      color: W.color, roughness: 0.06, metalness: 0, transmission: 0.78, thickness: 0.6, ior: 1.33, attenuationColor: new THREE.Color(W.deep), attenuationDistance: 1.2,
      normalMap: nrm, normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.2, clearcoat: 0.6, clearcoatRoughness: 0.08, clearcoatNormalMap: nrm2, clearcoatNormalScale: new THREE.Vector2(0.3, 0.3)
    });
    this.nrm = nrm; this.nrm2 = nrm2;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), this.mat);
    pool.rotation.x = -Math.PI / 2; pool.position.y = level; pool.receiveShadow = true;
    const bowl = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), this.mat);
    bowl.rotation.x = -Math.PI / 2; bowl.position.y = bowlLevel;
    scene.add(pool, bowl);
    this.level = level; this.bowlLevel = bowlLevel;

    // droplets: instanced small spheres, CPU simulated
    const N = 260;
    this.n = N;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, roughness: 0.1, transmission: 0.5, thickness: 0.05, transparent: true, opacity: 0.85 }), N);
    this.drops.castShadow = false; this.drops.frustumCulled = false;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.life = new Float32Array(N);
    for (let i = 0; i < N; i++) this.life[i] = -Math.random() * 1.5;
    scene.add(this.drops);
    this._m = new THREE.Matrix4(); this._s = new THREE.Vector3();
    // the jet itself: a slim translucent column with a wobble
    this.jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 1.1, 10, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, thickness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    this.jet.position.set(0, 3.15 + 0.5, 0);
    scene.add(this.jet);
  }
  update(dt, t) {
    this.nrm.offset.set(t * 0.012, t * 0.02);
    this.nrm2.offset.set(-t * 0.017, t * 0.011);
    this.jet.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 6) * 0.04, 1 + Math.cos(t * 7) * 0.08);
    const P = this.p, V = this.v, L = this.life;
    for (let i = 0; i < this.n; i++) {
      L[i] -= dt;
      if (L[i] <= 0) {
        // respawn: most from the top jet, some splashing off the bowl rim
        const fromJet = Math.random() < 0.7;
        const a = Math.random() * Math.PI * 2, s = fromJet ? 0.6 + Math.random() * 0.9 : 1.2 + Math.random() * 0.8;
        if (fromJet) { P[i * 3] = Math.cos(a) * 0.05; P[i * 3 + 1] = 4.0; P[i * 3 + 2] = Math.sin(a) * 0.05; V[i * 3] = Math.cos(a) * s; V[i * 3 + 1] = 1.6 + Math.random() * 1.6; V[i * 3 + 2] = Math.sin(a) * s; }
        else { P[i * 3] = Math.cos(a) * 1.5; P[i * 3 + 1] = this.bowlLevel + 0.05; P[i * 3 + 2] = Math.sin(a) * 1.5; V[i * 3] = Math.cos(a) * s * 0.8; V[i * 3 + 1] = 0.6 + Math.random(); V[i * 3 + 2] = Math.sin(a) * s * 0.8; }
        L[i] = 1.4 + Math.random() * 0.6;
      }
      V[i * 3 + 1] -= 9.8 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const r = Math.hypot(P[i * 3], P[i * 3 + 2]);
      // splash into the bowl or the pool
      if ((r < 1.5 && P[i * 3 + 1] < this.bowlLevel) || P[i * 3 + 1] < this.level) L[i] = 0;
      const k = Math.min(1, L[i] * 3) * (0.8 + 0.4 * Math.random());
      this._s.setScalar(L[i] > 0 ? k : 0);
      this._m.makeScale(this._s.x, this._s.y, this._s.z).setPosition(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      this.drops.setMatrixAt(i, this._m);
    }
    this.drops.instanceMatrix.needsUpdate = true;
  }
}
