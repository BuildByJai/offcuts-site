// Town detail + ambient life. Everything repeated is instanced so the town
// stays cheap: swaying trees, bushes, flower beds, grass tufts, bunting,
// pigeons that scatter when you run at them, butterflies, a wandering cat,
// NPCs walking set loops, the fountain's spray and night-time lamp pools.
// Density follows the quality tier (setTier).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { toon, addWind, U, faceted } from './gfx.js';
import { buildCharacter } from './player.js';
import { Particles } from './fx.js';
import { canvasTexture } from './world.js';
import { Sfx } from './audio.js';

const P = CONFIG.palette;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const rnd = (() => { let s = 1234567; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

function inst(geo, mat, n, { cast = true, receive = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.castShadow = cast; m.receiveShadow = receive;
  m.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  return m;
}
function place(im, i, x, y, z, s = 1, ry = 0, sy = s) {
  _p.set(x, y, z); _s.set(s, sy, s); _q.setFromEuler(_e.set(0, ry, 0));
  im.setMatrixAt(i, _m.compose(_p, _q, _s));
}

export class TownLife {
  constructor({ scene, world, player, gfx, lamps = [], trees = [], lawns = [], planters = [] }) {
    this.scene = scene; this.world = world; this.player = player; this.gfx = gfx;
    this.t = 0;
    this.lamps = lamps;
    this._buildTrees(trees);
    this._buildLawnDetail(lawns, planters);
    this._buildBunting();
    this._buildLampPools();
    this._buildFountain();
    this._buildBirds();
    this._buildButterflies(planters);
    this._buildCat();
    this._buildNPCs();
  }

  /* ---------- trees + bushes ---------- */
  _buildTrees(spots) {
    this._treeSpots = spots;
    const trunkGeo = new THREE.BoxGeometry(0.7, 1, 0.7); trunkGeo.translate(0, 0.5, 0);
    const parts = [];
    [[0, 0, 0, 1.6], [0.9, -0.3, 0.3, 1.1], [-0.8, -0.2, -0.5, 1.15], [0.2, 0.75, -0.2, 1.05], [-0.3, 0.1, 0.9, 1.0]].forEach(([x, y, z, r]) => {
      const g = new THREE.IcosahedronGeometry(r, 0); g.translate(x, y, z); parts.push(faceted(g));
    });
    const canopyGeo = mergeGeometries(parts); canopyGeo.computeVertexNormals();
    canopyGeo.translate(0, 0, 0);
    const trunkMat = toon({ color: 0x7a5532 });
    const canopyMat = addWind(toon({ color: 0xffffff, flatShading: true }), { amp: 0.06, speed: 1.3 });
    const n = spots.length;
    this.trunks = inst(trunkGeo, trunkMat, n);
    this.canopies = inst(canopyGeo, canopyMat, n);
    const greens = [P.leaf, 0x4f9a46, 0x63ad52, P.deepLeaf, 0x6cb85a];
    spots.forEach((t, i) => {
      const s = t.s || 1;
      place(this.trunks, i, t.x, 0, t.z, s, 0, 2.6 * s);
      // canopy: origin at its base so the wind shader sways the top more
      _p.set(t.x, 2.6 * s + 1.0 * s, t.z); _s.setScalar(s * 1.15); _q.setFromEuler(_e.set(0, t.x * 1.7 + t.z, 0));
      this.canopies.setMatrixAt(i, _m.compose(_p, _q, _s));
      this.canopies.setColorAt(i, _c.set(greens[(i * 7) % greens.length]));
    });
    this.scene.add(this.trunks, this.canopies);
  }

  /* ---------- lawns: grass tufts, bushes, flowers ---------- */
  _buildLawnDetail(lawns, planters) {
    // grass tuft: three crossed blades, origin at the root
    const blade = new THREE.PlaneGeometry(0.16, 0.45, 1, 2); blade.translate(0, 0.225, 0);
    const blades = [0, 1, 2].map((i) => { const g = blade.clone(); g.rotateY(i * Math.PI / 3); return g; });
    const tuftGeo = mergeGeometries(blades);
    const tuftMat = addWind(toon({ color: 0xffffff, side: THREE.DoubleSide }), { amp: 0.35, speed: 2.2, heightScale: 2.2 });
    const tufts = [];
    for (const L of lawns) {
      const area = (L.x1 - L.x0) * (L.z1 - L.z0);
      const n = Math.round(area * 0.9);
      for (let i = 0; i < n; i++) tufts.push([L.x0 + 0.3 + rnd() * (L.x1 - L.x0 - 0.6), L.z0 + 0.3 + rnd() * (L.z1 - L.z0 - 0.6)]);
    }
    for (const t of (this._treeSpots || []).filter((t) => t.bed)) {
      for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, r = 0.6 + rnd() * 1.4; tufts.push([t.x + Math.cos(a) * r, t.z + Math.sin(a) * r]); }
    }
    this.tufts = inst(tuftGeo, tuftMat, tufts.length, { cast: false });
    const gc = [0x6cb85a, 0x5aa24f, 0x7cc06a, 0x8acb6a];
    tufts.forEach(([x, z], i) => {
      place(this.tufts, i, x, 0.02, z, 0.8 + rnd() * 0.7, rnd() * 6.28);
      this.tufts.setColorAt(i, _c.set(gc[i % gc.length]));
    });
    this.tuftCount = tufts.length;
    this.scene.add(this.tufts);

    // bushes along lawn edges
    const bushGeo = new THREE.IcosahedronGeometry(0.7, 0); bushGeo.scale(1.2, 0.85, 1.2); bushGeo.translate(0, 0.45, 0); faceted(bushGeo);
    const bushMat = addWind(toon({ color: 0xffffff, flatShading: true }), { amp: 0.04, speed: 1.4 });
    const bushes = [];
    for (const L of lawns) {
      if (L.bushes === false) continue;
      const along = (L.x1 - L.x0) > (L.z1 - L.z0);
      const len = along ? L.x1 - L.x0 : L.z1 - L.z0;
      for (let d = 0.8; d < len - 0.6; d += 1.9) {
        if (along) bushes.push([L.x0 + d, L.z0 + 0.7]); else bushes.push([L.x0 + 0.7, L.z0 + d]);
      }
    }
    this.bushes = inst(bushGeo, bushMat, bushes.length);
    bushes.forEach(([x, z], i) => { place(this.bushes, i, x, 0, z, 0.8 + rnd() * 0.5, rnd() * 6); this.bushes.setColorAt(i, _c.set([P.deepLeaf, 0x4f9a46, P.leaf][i % 3])); });
    this.scene.add(this.bushes);

    // flower beds: little coloured heads on stalks
    const flowerGeo = (() => {
      const stalk = new THREE.BoxGeometry(0.04, 0.35, 0.04); stalk.translate(0, 0.175, 0);
      const head = new THREE.IcosahedronGeometry(0.11, 0); head.translate(0, 0.38, 0);
      const g = mergeGeometries([stalk.toNonIndexed(), faceted(head)]);
      return g;
    })();
    const flowerMat = addWind(toon({ color: 0xffffff, flatShading: true }), { amp: 0.25, speed: 2.6, heightScale: 2 });
    const flowers = [];
    for (const [x, z] of planters) for (let i = 0; i < 9; i++) flowers.push([x - 1.0 + (i % 5) * 0.5, 0.55, z - 0.2 + Math.floor(i / 5) * 0.35]);
    for (const L of lawns) {
      if (!L.flowers) continue;
      for (let i = 0; i < 24; i++) flowers.push([L.x0 + 0.5 + rnd() * (L.x1 - L.x0 - 1), 0.02, L.z0 + 0.5 + rnd() * (L.z1 - L.z0 - 1)]);
    }
    this.flowers = inst(flowerGeo, flowerMat, flowers.length, { cast: false });
    const fc = [P.coral, P.butter, 0xb06ad9, 0xffffff, 0xff8a3c];
    flowers.forEach(([x, y, z], i) => { place(this.flowers, i, x, y, z, 0.9 + rnd() * 0.4, rnd() * 6); this.flowers.setColorAt(i, _c.set(fc[i % fc.length])); });
    this.scene.add(this.flowers);
  }

  /* ---------- bunting between the lamp posts round the fountain ---------- */
  _buildBunting() {
    const runs = [
      [[-10, 4.35, -10], [10, 4.35, -10]], [[10, 4.35, -10], [10, 4.35, 10]],
      [[10, 4.35, 10], [-10, 4.35, 10]], [[-10, 4.35, 10], [-10, 4.35, -10]],
      [[-6, 4.35, 29], [6, 4.35, 29]]
    ];
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.42, 0], 3));
    tri.computeVertexNormals();
    const mat = toon({ color: 0xffffff, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = instanceMatrix[3][0] * 0.9 + instanceMatrix[3][2] * 0.7;
          transformed.z += sin(uTime * 4.0 + ph) * 0.14 * (-position.y);`);
    };
    const flags = [];
    const lines = [];
    for (const [a, b] of runs) {
      const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
      const len = A.distanceTo(Bv), n = Math.floor(len / 0.62);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const p = A.clone().lerp(Bv, k); p.y -= Math.sin(k * Math.PI) * 0.7;
        pts.push(p);
        if (i > 0 && i < n) flags.push({ p, ry: Math.atan2(Bv.x - A.x, Bv.z - A.z) - Math.PI / 2 });
      }
      lines.push(pts);
    }
    this.bunting = inst(tri, mat, flags.length, { cast: false });
    const cols = [P.coral, P.butter, P.teal, 0xffffff, P.violet, 0x3fae5c];
    flags.forEach((f, i) => { place(this.bunting, i, f.p.x, f.p.y, f.p.z, 1, f.ry); this.bunting.setColorAt(i, _c.set(cols[i % cols.length])); });
    this.scene.add(this.bunting);
    const lmat = new THREE.LineBasicMaterial({ color: 0x3a2a20 });
    for (const pts of lines) this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lmat));
  }

  /* ---------- soft light pools under lamps (night only) ---------- */
  _buildLampPools() {
    const tex = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,214,140,0.9)'); g.addColorStop(0.5, 'rgba(255,190,110,0.35)'); g.addColorStop(1, 'rgba(255,180,100,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    });
    this.poolMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    const geo = new THREE.PlaneGeometry(7, 7); geo.rotateX(-Math.PI / 2);
    this.pools = inst(geo, this.poolMat, Math.max(1, this.lamps.length), { cast: false, receive: false });
    this.lamps.forEach(([x, z], i) => place(this.pools, i, x, 0.04, z));
    this.pools.renderOrder = 2;
    this.scene.add(this.pools);
    // halo sprites around each lamp head
    const haloTex = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,230,170,1)'); g.addColorStop(0.3, 'rgba(255,200,120,0.4)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    });
    this.haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    this.halos = this.lamps.map(([x, z]) => { const s = new THREE.Sprite(this.haloMat); s.position.set(x, 4.25, z); s.scale.set(2.6, 2.6, 1); this.scene.add(s); return s; });
  }

  /* ---------- fountain spray ---------- */
  _buildFountain() {
    this.water = new Particles(this.scene, { capacity: 220 });
    this.splash = 0;
  }

  /* ---------- pigeons ---------- */
  _buildBirds() {
    const bodyGeo = (() => {
      const b = new THREE.BoxGeometry(0.22, 0.2, 0.36).toNonIndexed();
      const h = new THREE.BoxGeometry(0.14, 0.14, 0.14); h.translate(0, 0.14, 0.19);
      const beak = new THREE.BoxGeometry(0.05, 0.04, 0.08); beak.translate(0, 0.12, 0.29);
      const tail = new THREE.BoxGeometry(0.16, 0.04, 0.16); tail.translate(0, 0.04, -0.24);
      const parts = [b, h.toNonIndexed(), beak.toNonIndexed(), tail.toNonIndexed()];
      const cols = [0x8a8f9a, 0x6a7a8a, 0xe0a040, 0x6a6f7a];
      parts.forEach((g, i) => { const c = new THREE.Color(cols[i]); const a = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = c.r; a[k + 1] = c.g; a[k + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); });
      return mergeGeometries(parts);
    })();
    const wingGeo = new THREE.BoxGeometry(0.3, 0.03, 0.22); wingGeo.translate(0.15, 0, 0);
    const bodyMat = toon({ vertexColors: true }), wingMat = toon({ color: 0x9aa0aa });
    this.birds = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = 0.12; body.castShadow = true;
      const wl = new THREE.Mesh(wingGeo, wingMat), wr = new THREE.Mesh(wingGeo, wingMat);
      wl.position.set(0.08, 0.17, 0); wr.position.set(-0.08, 0.17, 0); wr.rotation.y = Math.PI;
      g.add(body, wl, wr);
      const spot = this._birdSpot();
      g.position.set(spot.x, 0, spot.z);
      this.scene.add(g);
      this.birds.push({ g, body, wl, wr, state: 'ground', t: rnd() * 3, vel: new THREE.Vector3(), hop: 0, home: spot, peck: 0 });
    }
  }
  _birdSpot() {
    for (let k = 0; k < 20; k++) {
      const a = rnd() * Math.PI * 2, r = 5.5 + rnd() * 10;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(Math.abs(x) - 9) < 1 && Math.abs(z) < 1.5) continue;
      return { x, z };
    }
    return { x: 6, z: 12 };
  }

  /* ---------- butterflies (one instanced mesh of wings) ---------- */
  _buildButterflies(planters) {
    const wing = new THREE.PlaneGeometry(0.18, 0.14); wing.translate(0.09, 0, 0);
    this.bfly = inst(wing, toon({ color: 0xffffff, side: THREE.DoubleSide }), 16, { cast: false });
    this.bflyData = [];
    const cols = [0xffd23f, 0xff8ac0, 0x8ad8ff, 0xffffff, 0xff9a3c, 0xc0a8ff, 0xffd23f, 0x8ad8ff];
    const homes = planters.concat([[-24, -14], [24, 22], [-7, 35], [7, 35]]);
    for (let i = 0; i < 8; i++) {
      const h = homes[i % homes.length];
      this.bflyData.push({ x: h[0], z: h[1], ph: rnd() * 10, sp: 0.6 + rnd() * 0.5, c: cols[i] });
      this.bfly.setColorAt(i * 2, _c.set(cols[i])); this.bfly.setColorAt(i * 2 + 1, _c.set(cols[i]));
    }
    this.bfly.frustumCulled = false;
    this.scene.add(this.bfly);
  }

  /* ---------- the cat ---------- */
  _buildCat() {
    const fur = toon({ color: 0xe0904a }), dark = toon({ color: 0x8a4a20 }), white = toon({ color: 0xfbf7ee });
    const g = new THREE.Group();
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
    box(0.32, 0.28, 0.62, fur, 0, 0.36, 0);
    const head = new THREE.Group(); head.position.set(0, 0.56, 0.34); g.add(head);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.26), fur); head.add(hb);
    [-0.09, 0.09].forEach((x) => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), dark); e.position.set(x, 0.17, 0); head.add(e); });
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), white); muzzle.position.set(0, -0.05, 0.14); head.add(muzzle);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
    [-0.07, 0.07].forEach((x) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), eyeM); e.position.set(x, 0.03, 0.135); head.add(e); });
    const legs = [[-0.1, 0.22], [0.1, 0.22], [-0.1, -0.22], [0.1, -0.22]].map(([x, z]) => {
      const l = new THREE.Group(); l.position.set(x, 0.24, z); g.add(l);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.08), fur); m.position.y = -0.12; m.castShadow = true; l.add(m);
      return l;
    });
    const tail = new THREE.Group(); tail.position.set(0, 0.45, -0.3); g.add(tail);
    const tm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.45), dark); tm.position.z = -0.22; tail.add(tm);
    g.position.set(-6, 0, 6);
    this.scene.add(g);
    this.cat = { g, head, legs, tail, target: new THREE.Vector3(-6, 0, 6), state: 'walk', t: 0, facing: 0, step: 0, purr: 0 };
    this.catSpots = [[-6, 6], [6, 7], [8, -6], [-7, -7], [-14, 2], [14, -2], [3, 15], [-4, 20], [12, 18], [-12, -16], [6, -18]];
    this._catNext();
  }
  _catNext() {
    const s = this.catSpots[Math.floor(rnd() * this.catSpots.length)];
    this.cat.target.set(s[0] + (rnd() - 0.5) * 2, 0, s[1] + (rnd() - 0.5) * 2);
    this.cat.state = 'walk';
  }
  // The town makes the cat interactable ("Pet the cat").
  petCat() {
    const c = this.cat;
    c.state = 'purr'; c.t = 3; c.purr = 3;
    Sfx.combo(4); setTimeout(() => Sfx.combo(8), 120);
    if (this.onPet) this.onPet(c.g.position);
  }

  /* ---------- NPCs ---------- */
  _buildNPCs() {
    const looks = [
      { shirt: 0xd8452f, pants: 0x34495e, hair: 0x1b1b1b, skin: 0xc68642 },
      { shirt: 0x2f7fd6, pants: 0x5a4a3a, hair: 0xd8b26a, skin: 0xf0c08a },
      { shirt: 0xe9a23b, pants: 0x2b3442, hair: 0x6a3a1a, skin: 0x8d5524 },
      { shirt: 0x6a5acd, pants: 0x3a3a3a, hair: 0xa0522d, skin: 0xffdbac },
      { shirt: 0x2f9e9a, pants: 0x4a3a2a, hair: 0x2a2a2a, skin: 0xe0ac69 },
      { shirt: 0xe94f6a, pants: 0x2f3b4a, hair: 0xf2d38a, skin: 0xf1c27d }
    ];
    const circle = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; circle.push([Math.cos(a) * 7.6, Math.sin(a) * 7.6]); }
    const paths = [
      circle,
      [[-20, -19], [12, -19], [20, -12], [20, 12], [13, 22], [-12, 21], [-19.5, 12], [-20, -12]],
      [[0, 38], [0, 12], [0, 38]],
      [[-4, -6], [-18, -26.5], [-4, -6]],
      [[19, 18], [19.5, -14], [19, 18]],
      [[-18.5, 17], [-21, -16], [-18.5, 17]]
    ];
    this.npcs = looks.map((look, i) => {
      const rig = buildCharacter(look);
      rig.root.scale.setScalar(0.8);
      rig.blob.scale.setScalar(0.9);
      this.scene.add(rig.root, rig.blob);
      const path = paths[i].map(([x, z]) => new THREE.Vector3(x, 0, z));
      if (path[0].distanceTo(path[path.length - 1]) > 0.01) path.push(path[0].clone());   // close loops
      const n = { rig, path, seg: i % (path.length - 1), k: rnd(), speed: 1.4 + rnd() * 0.8, phase: rnd() * 6, facing: 0, wait: 0 };
      return n;
    });
  }

  setTier(cfg) {
    this.tufts.count = Math.round(this.tuftCount * cfg.grass);
    this.npcs.forEach((n, i) => { const on = i < cfg.npcs; n.rig.root.visible = on; n.rig.blob.visible = on; });
    const birds = Math.max(3, Math.round(8 * cfg.props));
    this.birds.forEach((b, i) => { b.g.visible = i < birds; });
  }

  update(dt) {
    this.t += dt;
    const t = this.t, night = U.night.value, pl = this.player;

    // lamps
    this.poolMat.opacity = Math.max(0, night - 0.2) * 0.9;
    this.haloMat.opacity = Math.max(0, night - 0.2);

    // fountain spray: arcs from the top basin into the pool
    const w = this.water;
    for (let i = 0; i < 3; i++) {
      if (Math.random() < dt * 40) {
        const a = Math.random() * Math.PI * 2, s = 1.6 + Math.random() * 0.8;
        w.emit(Math.cos(a) * 0.2, 2.9, Math.sin(a) * 0.2, { vx: Math.cos(a) * s, vy: 3.4 + Math.random() * 1.2, vz: Math.sin(a) * s, color: 0xcfeeff, size: 0.18, size1: 0.12, life: 0.95, alpha: 0.8, gravity: 9.8, drag: 0.1 });
      }
    }
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2, r = 1.7 + Math.random() * 1.2;
      w.emit(Math.cos(a) * r, 0.45, Math.sin(a) * r, { vy: 1.4, color: 0xffffff, size: 0.14, size1: 0.3, life: 0.4, alpha: 0.6, gravity: 6, drag: 0.5, spread: 0.8 });
    }
    w.update(dt, this.gfx.camera, this.gfx.renderer);

    // birds
    const pspeed = pl.speedH;
    for (const b of this.birds) {
      if (!b.g.visible) continue;
      const dx = b.g.position.x - pl.pos.x, dz = b.g.position.z - pl.pos.z, dy = b.g.position.y - pl.pos.y;
      const d = Math.hypot(dx, dz);
      if (b.state === 'ground') {
        b.t -= dt;
        if (b.t <= 0) { b.t = 0.5 + rnd() * 2; b.hop = 0.25; b.g.rotation.y += (rnd() - 0.5) * 2; b.peck = rnd() < 0.5 ? 0.4 : 0; }
        if (b.hop > 0) { b.hop -= dt; b.g.position.x += Math.sin(b.g.rotation.y) * dt * 0.8; b.g.position.z += Math.cos(b.g.rotation.y) * dt * 0.8; b.g.position.y = Math.sin(b.hop / 0.25 * Math.PI) * 0.06; }
        if (b.peck > 0) { b.peck -= dt; b.body.rotation.x = Math.sin(b.peck * 30) > 0 ? 0.5 : 0; } else b.body.rotation.x = 0;
        b.wl.rotation.z = b.wr.rotation.z = 0;
        if ((d < 4.5 && Math.abs(dy) < 3 && (pspeed > 5 || !pl.grounded)) || d < 1.4) {
          b.state = 'fly'; b.t = 6 + rnd() * 6;
          const a = Math.atan2(dx, dz) + (rnd() - 0.5) * 1.2;
          b.vel.set(Math.sin(a) * 6, 7 + rnd() * 3, Math.cos(a) * 6);
          b.g.rotation.y = a;
          if (Math.random() < 0.4) Sfx.click();
        }
      } else if (b.state === 'fly') {
        b.t -= dt;
        // climb, then circle high above the square
        b.vel.y += (b.g.position.y < 14 ? 4 : -2) * dt;
        b.vel.y *= 0.98;
        const cx = -b.g.position.z, cz = b.g.position.x;   // tangential steer
        b.vel.x += cx * dt * 0.06; b.vel.z += cz * dt * 0.06;
        const hs = Math.hypot(b.vel.x, b.vel.z); if (hs > 8) { b.vel.x *= 8 / hs; b.vel.z *= 8 / hs; }
        b.g.position.addScaledVector(b.vel, dt);
        b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z);
        const flap = Math.sin(t * 28 + b.home.x) * 0.9;
        b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
        if (b.t <= 0) { b.state = 'land'; b.home = this._birdSpot(); }
      } else {
        // glide down to the new spot
        const tx = b.home.x - b.g.position.x, tz = b.home.z - b.g.position.z, ty = -b.g.position.y;
        const dist = Math.hypot(tx, ty, tz);
        if (dist < 0.3) { b.state = 'ground'; b.g.position.set(b.home.x, 0, b.home.z); b.t = 1; continue; }
        const sp = Math.min(7, dist * 1.5 + 1);
        b.g.position.x += tx / dist * sp * dt; b.g.position.y += ty / dist * sp * dt; b.g.position.z += tz / dist * sp * dt;
        b.g.rotation.y = Math.atan2(tx, tz);
        const flap = Math.sin(t * 20) * 0.5;
        b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
      }
    }

    // butterflies
    for (let i = 0; i < this.bflyData.length; i++) {
      const f = this.bflyData[i], tt = t * f.sp + f.ph;
      const x = f.x + Math.sin(tt) * 1.6 + Math.sin(tt * 2.3) * 0.5, z = f.z + Math.cos(tt * 0.8) * 1.4, y = 0.9 + Math.sin(tt * 3.1) * 0.35 + 0.3;
      const heading = Math.atan2(Math.cos(tt) * 1.6, -Math.sin(tt * 0.8) * 1.1);
      const flap = 0.2 + Math.abs(Math.sin(t * 18 + f.ph)) * 1.2;
      for (let s = 0; s < 2; s++) {
        _p.set(x, y, z); _s.setScalar(1);
        _q.setFromEuler(_e.set(0, heading, 0, 'YXZ'));
        const wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s ? Math.PI : 0, s ? -flap : flap, 'YXZ'));
        _q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.2, 0, 0))).multiply(wq);
        this.bfly.setMatrixAt(i * 2 + s, _m.compose(_p, _q, _s));
      }
    }
    this.bfly.instanceMatrix.needsUpdate = true;

    // cat
    const c = this.cat, cg = c.g;
    const pd = Math.hypot(pl.pos.x - cg.position.x, pl.pos.z - cg.position.z);
    if (c.state === 'walk') {
      const tx = c.target.x - cg.position.x, tz = c.target.z - cg.position.z, d = Math.hypot(tx, tz);
      if (d < 0.2) { c.state = 'sit'; c.t = 3 + rnd() * 5; }
      else {
        const want = Math.atan2(tx, tz);
        let df = want - c.facing; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
        c.facing += df * Math.min(1, dt * 4);
        const sp = 1.1;
        cg.position.x += Math.sin(c.facing) * sp * dt; cg.position.z += Math.cos(c.facing) * sp * dt;
        c.step += dt * 10;
      }
      if (pd < 1.6 && pl.speedH > 5) { c.state = 'sit'; c.t = 1.5; }
    } else if (c.state === 'sit' || c.state === 'purr') {
      c.t -= dt;
      if (pd < 4) {
        const want = Math.atan2(pl.pos.x - cg.position.x, pl.pos.z - cg.position.z);
        let df = want - c.facing; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
        c.facing += df * Math.min(1, dt * 2);
      }
      if (c.t <= 0) this._catNext();
    }
    cg.rotation.y = c.facing;
    const walking = c.state === 'walk';
    c.legs.forEach((l, i) => { l.rotation.x = walking ? Math.sin(c.step + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI : 0)) * 0.6 : 0; });
    c.tail.rotation.x = -0.6 + Math.sin(t * (c.state === 'purr' ? 8 : 2)) * 0.25;
    c.tail.rotation.y = Math.sin(t * 1.3) * 0.4;
    c.head.rotation.x = c.state === 'sit' ? -0.15 : 0;
    cg.children[0].position.y = c.state === 'walk' ? 0.36 : 0.3;

    // NPCs
    for (const n of this.npcs) {
      if (!n.rig.root.visible) continue;
      const a = n.path[n.seg], b = n.path[n.seg + 1];
      const len = a.distanceTo(b) || 1;
      const px = a.x + (b.x - a.x) * n.k, pz = a.z + (b.z - a.z) * n.k;
      const near = Math.hypot(pl.pos.x - px, pl.pos.z - pz) < 1.3 && Math.abs(pl.pos.y) < 1.5;
      if (!near) {
        n.k += n.speed * dt / len;
        if (n.k >= 1) { n.k = 0; n.seg = (n.seg + 1) % (n.path.length - 1); }
      }
      const r = n.rig;
      r.root.position.set(px, 0, pz);
      const want = Math.atan2(b.x - a.x, b.z - a.z);
      let df = want - n.facing; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
      n.facing += df * Math.min(1, dt * 6);
      r.root.rotation.y = near ? n.facing + Math.sin(t * 1.5) * 0.2 : n.facing;
      n.phase += dt * (near ? 0 : n.speed * 4.2);
      const s = near ? 0 : Math.sin(n.phase) * 0.7;
      r.legL.rotation.x = s; r.legR.rotation.x = -s; r.armL.rotation.x = -s * 0.8; r.armR.rotation.x = s * 0.8;
      r.body.position.y = near ? 0 : Math.abs(Math.cos(n.phase)) * 0.04;
      if (near) { r.armR.rotation.x = -2.2 + Math.sin(t * 8) * 0.3; }    // wave hello
      // turn the head to watch the player when they're close and in front-ish
      const dpx = pl.pos.x - px, dpz = pl.pos.z - pz, dist = Math.hypot(dpx, dpz);
      let hy = 0;
      if (dist < 4.5 && Math.abs(pl.pos.y) < 2.5) {
        hy = Math.atan2(dpx, dpz) - r.root.rotation.y;
        while (hy > Math.PI) hy -= Math.PI * 2; while (hy < -Math.PI) hy += Math.PI * 2;
        hy = Math.abs(hy) < 1.9 ? Math.max(-0.9, Math.min(0.9, hy)) : 0;
      }
      r.head.rotation.y += (hy - r.head.rotation.y) * Math.min(1, dt * 5);
      r.blob.position.set(px, 0.02, pz);
    }
  }
}
