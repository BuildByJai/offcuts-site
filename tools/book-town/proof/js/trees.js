// Trees and hedges. Trunks are tapered bark-textured cylinders with a couple
// of branches; canopies are clusters of leaf cards (alpha-tested, painted on
// a canvas) with normals bent outward so they light like a soft volume, and a
// gentle wind sway in the vertex shader. Hedges are bevelled blocks with a
// leafy material. All trees merge into one mesh per material.
import * as THREE from 'three';
import { positionLocal, positionWorld, time, sin, vec3, float } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { pbr, uvFromBox, tintGeometry, canvasTexture } from './materials.js';

function leafTexture() {
  return canvasTexture(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    const cols = ['#4f8f3c', '#5fa347', '#6cb552', '#3f7a2f', '#7cc45f', '#58a04a'];
    for (let i = 0; i < 70; i++) {
      const x = 128 + (Math.random() - 0.5) * 200, y = 128 + (Math.random() - 0.5) * 200;
      if (Math.hypot(x - 128, y - 128) > 118) continue;
      const r = 14 + Math.random() * 16, a = Math.random() * Math.PI * 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.7, -r * 0.2, 0, r); ctx.quadraticCurveTo(-r * 0.7, -r * 0.2, 0, -r); ctx.fill();
      ctx.strokeStyle = 'rgba(30,60,20,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8); ctx.stroke();
      ctx.restore();
    }
  });
}

export class Trees {
  constructor(scene, spots, hedges) {
    this.scene = scene;
    const bark = pbr('bark_brown_02', { size: 1.2, vertexColors: true });
    const leafMat = new THREE.MeshStandardNodeMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, vertexColors: true });
    leafMat.map.anisotropy = 4;
    // sway: slow, keyed off world position so neighbouring trees differ
    const ph = positionWorld.x.mul(0.6).add(positionWorld.z.mul(0.4));
    const sw = sin(time.mul(1.1).add(ph)).mul(0.5).add(sin(time.mul(2.3).add(ph.mul(1.7))).mul(0.25));
    leafMat.positionNode = positionLocal.add(vec3(sw.mul(0.08), sw.mul(0.03), sw.mul(0.06)));

    const trunks = [], leaves = [];
    const rnd = mulberry(11);
    const up = new THREE.Vector3(0, 1, 0);
    for (const t of spots) {
      const s = t.s || 1, H = 3.2 * s, R = 1.9 * s;
      const trunk = new THREE.CylinderGeometry(0.16 * s, 0.3 * s, H, 10, 1);
      uvFromBox(trunk, 1.2); tintGeometry(trunk, 0xffffff); trunk.translate(t.x, H / 2, t.z);
      trunks.push(trunk);
      for (let b = 0; b < 3; b++) {
        const a = b / 3 * Math.PI * 2 + rnd(), len = 1.4 * s;
        const br = new THREE.CylinderGeometry(0.05 * s, 0.11 * s, len, 7, 1);
        uvFromBox(br, 1.2); tintGeometry(br, 0xffffff);
        const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(Math.cos(a), 1.1, Math.sin(a)).normalize());
        br.applyQuaternion(q); br.translate(t.x + Math.cos(a) * len * 0.3, H * 0.72, t.z + Math.sin(a) * len * 0.3);
        trunks.push(br);
      }
      // canopy: a dark low-poly core so gaps between cards don't show sky, then cards on a flattened sphere
      const cy = H + R * 0.35, n = t.far ? 10 : 22;
      const core = new THREE.IcosahedronGeometry(R * 0.45, 1); core.scale(1, 0.8, 1); core.translate(t.x, cy, t.z);
      uvFromBox(core, 1.2); tintGeometry(core, 0x4a7a3a); trunks.push(core);
      for (let i = 0; i < n; i++) {
        const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
        const r = R * (0.45 + rnd() * 0.55);
        const px = t.x + Math.sin(v) * Math.cos(u) * r, py = cy + Math.cos(v) * r * 0.75, pz = t.z + Math.sin(v) * Math.sin(u) * r;
        const card = new THREE.PlaneGeometry(R * (0.9 + rnd() * 0.5), R * (0.9 + rnd() * 0.5));
        const e = new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
        card.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
        card.translate(px, py, pz);
        // bend normals outward from the canopy centre for soft volume lighting
        const nrm = card.attributes.normal, pos = card.attributes.position, c = new THREE.Vector3(t.x, cy, t.z), vv = new THREE.Vector3();
        for (let k = 0; k < nrm.count; k++) { vv.set(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(c).normalize().lerp(up, 0.25).normalize(); nrm.setXYZ(k, vv.x, vv.y, vv.z); }
        const shade = 0.78 + rnd() * 0.3;
        tintGeometry(card, new THREE.Color(shade, shade * (0.95 + rnd() * 0.1), shade * 0.9));
        leaves.push(card.toNonIndexed());
      }
    }
    const tm = new THREE.Mesh(mergeGeometries(trunks.map((g) => g.toNonIndexed())), bark);
    tm.castShadow = true; tm.receiveShadow = true;
    const lm = new THREE.Mesh(mergeGeometries(leaves), leafMat);
    lm.castShadow = true; lm.receiveShadow = true;
    scene.add(tm, lm);
    this.trunkMesh = tm; this.leafMesh = lm;

    // hedges
    const hedgeMat = pbr('Grass004', { size: 0.6, color: 0x7fa65a, roughness: 1, vertexColors: true });
    const hg = [];
    for (const h of hedges) {
      const w = h.x1 - h.x0, d = h.z1 - h.z0;
      const g = new RoundedBoxGeometry(w, 0.9, d, 3, 0.18);
      uvFromBox(g, 0.9); tintGeometry(g, 0xdfe6c8);
      g.translate((h.x0 + h.x1) / 2, 0.45, (h.z0 + h.z1) / 2);
      hg.push(g.toNonIndexed());
    }
    if (hg.length) { const hm = new THREE.Mesh(mergeGeometries(hg), hedgeMat); hm.castShadow = true; hm.receiveShadow = true; scene.add(hm); this.hedgeMesh = hm; }
  }
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
