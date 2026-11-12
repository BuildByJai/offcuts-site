// The town square, re-dressed: textured paving and lawns with kerbs, 6–8
// modular buildings with bevelled trims, window frames, sills, shutters,
// porches, gutters, flower boxes and signs; the fountain; props from CC0
// scans (benches, lamps, bins, café set, planters); ad frames. Everything
// static is merged per material. Returns colliders for the physics world and
// placement lists for grass, trees, flowers and ambient life.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PROOF } from '../config.js';
import { Batch, pbr, plain, signMesh, canvasTexture, uvFromBox, tintGeometry } from './materials.js';

const TOWN = PROOF.town;
const S = PROOF.styles;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.lawns = [];        // { x0, x1, z0, z1 }
    this.meadow = [];       // low-density grass areas outside the square
    this.treeSpots = [];    // { x, z, s }
    this.hedges = [];
    this.flowerBeds = [];   // { x, z, w, d }
    this.lamps = [];        // [x, z]
    this.props = {};        // name -> transforms[]
    this.windows = [];      // glow cards (emissive) for later night work
    this.signs = [];
    this.waterCenter = new THREE.Vector3(0, 0.45, 0);
    this.B = new Batch();
    this.mats = {};
  }
  mat(name, opts) {
    const key = name + JSON.stringify(opts || {});
    if (!this.mats[key]) this.mats[key] = pbr(name, opts);
    return this.mats[key];
  }

  build() {
    this._ground();
    this._kerbs();
    for (const b of TOWN.buildings) this._building(b);
    this._fountain();
    this._marketStall();
    this._adFrames();
    this._propsLayout();
    this._bounds();
    this.meshes = this.B.build(this.scene);
    for (const s of this.signs) this.scene.add(s);
    return this;
  }

  /* ---------- ground ---------- */
  _ground() {
    const B = this.B;
    const paving = this.mat('precast_stone_paving', { size: 1.5 });
    const deco = this.mat('patterned_paving_02', { size: 2.2 });
    const flags = this.mat('rectangular_paving', { size: 1.8 });
    const grass = this.mat('Grass004', { size: 2.6, roughness: 1 });
    const cobble = this.mat('cobblestone_floor_08', { size: 1.6 });
    const meadow = this.mat('Grass004', { size: 4, color: 0xc9d6a8 });
    // meadow beyond the town
    B.box(meadow, 0, -0.06, 0, 420, 0.1, 420, { bevel: 0, cast: false, collide: false });
    // pavements for the whole block
    B.box(flags, 0, -0.03, 0, 92, 0.08, 92, { bevel: 0, cast: false, tint: new THREE.Color(1.2, 1.17, 1.1) });
    // the square: interlocking paving with a ring of cobbles round the fountain
    B.box(paving, 0, 0, 0, 58, 0.06, 58, { bevel: 0, cast: false, tint: new THREE.Color(1.45, 1.38, 1.24) });
    B.geom(deco, new THREE.RingGeometry(4.6, 9.5, 64).rotateX(-Math.PI / 2).translate(0, 0.036, 0), { tint: new THREE.Color(1.25, 1.2, 1.12), tile: 2.2, cast: false });
    // paths from the square to the doors
    const path = (x0, x1, z0, z1) => B.span(cobble, x0, x1, 0.0, 0.07, z0, z1, { bevel: 0, cast: false, tint: 0xd8cfbd });
    path(-19.6, -16.4, -30, -29); path(1.6, 4.4, -30, -29); path(29, 30, -11.6, -8.4); path(29, 30, 9.4, 12.6); path(-30, -29, -17.6, -14.4); path(-30, -29, 12.4, 15.6);
    path(-1.6, 1.6, 29, 40);
    // lawns (grass texture + a kerb; blades are added by grass.js)
    const lawns = [
      { x0: -12, x1: -3, z0: 31, z1: 39.5, flowers: true }, { x0: 3, x1: 12, z0: 31, z1: 39.5, flowers: true },
      { x0: -28.6, x1: -20.5, z0: -20, z1: -8 }, { x0: 20.5, x1: 28.6, z0: 17.5, z1: 28 },
      { x0: -28.6, x1: -20.5, z0: 8, z1: 20 }, { x0: 20.5, x1: 28.6, z0: -28, z1: -14 },
      { x0: -44, x1: -30.4, z0: 30, z1: 44.5, outer: true }, { x0: 30.4, x1: 44, z0: 30, z1: 44.5, outer: true }
    ];
    for (const L of lawns) {
      B.span(grass, L.x0, L.x1, 0.0, 0.1, L.z0, L.z1, { bevel: 0.03, cast: false, tint: 0xd3dfb0 });
      this.lawns.push(L);
      if (!L.outer) {
        const K = this.mat('precast_stone_paving', { size: 1.2 });
        const k = 0.18, h = 0.16;
        B.span(K, L.x0 - k, L.x1 + k, 0, h, L.z0 - k, L.z0, { bevel: 0.02, tint: 0xe6e0d4, cast: false });
        B.span(K, L.x0 - k, L.x1 + k, 0, h, L.z1, L.z1 + k, { bevel: 0.02, tint: 0xe6e0d4, cast: false });
        B.span(K, L.x0 - k, L.x0, 0, h, L.z0, L.z1, { bevel: 0.02, tint: 0xe6e0d4, cast: false });
        B.span(K, L.x1, L.x1 + k, 0, h, L.z0, L.z1, { bevel: 0.02, tint: 0xe6e0d4, cast: false });
        this.hedges.push({ x0: L.x0 + 0.4, x1: L.x1 - 0.4, z0: L.z0 + 0.35, z1: L.z0 + 0.95 });
      }
      if (L.flowers) this.flowerBeds.push({ x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2 + 1.5, w: L.x1 - L.x0 - 2.5, d: 2.2 });
    }
    this.meadow.push({ x0: -46, x1: 46, z0: 46, z1: 110 }, { x0: -46, x1: 46, z0: -110, z1: -46 }, { x0: -110, x1: -46, z0: -110, z1: 110 }, { x0: 46, x1: 110, z0: -110, z1: 110 });
  }
  _kerbs() {
    const B = this.B, K = this.mat('precast_stone_paving', { size: 1.2 });
    const r = 29.2;
    for (const [x0, x1, z0, z1] of [[-r, r, -r, -r + 0.35], [-r, r, r - 0.35, r], [-r, -r + 0.35, -r, r], [r - 0.35, r, -r, r]]) {
      B.span(K, x0, x1, 0, 0.13, z0, z1, { bevel: 0.02, tint: 0xe6e0d4, cast: false });
    }
  }

  /* ---------- buildings ---------- */
  _building(b) {
    const B = this.B;
    const st = S[b.style] || S.house;
    const tint0 = PROOF.houseTints[b.id] || st.tint;
    const tint = /plaster|wall_001/i.test(st.wall) ? new THREE.Color(tint0).multiplyScalar(st.brighten || 1.3) : tint0;
    const wall = this.mat(st.wall, { size: st.wall.includes('Brick') || st.wall.includes('brick') ? 2.4 : 3 });
    const roof = this.mat(st.roof, { size: 1.8 });
    const trim = plain(st.trim, { roughness: 0.55, vertexColors: true });
    const accent = plain(st.accent, { roughness: 0.6, vertexColors: true });
    const wood = this.mat('weathered_brown_planks', { size: 1.6 });
    const glass = this.glassMat || (this.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c6, roughness: 0.05, metalness: 0.1, transmission: 0.35, thickness: 0.1, envMapIntensity: 1.3, vertexColors: true }));
    const glow = this.glowMat || (this.glowMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xffd9a0, emissiveIntensity: 0.45, roughness: 1, vertexColors: true }));
    const { x0, x1, z0, z1, h } = b;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const F = facade(b);

    // body (bevelled) + plinth + collider
    B.box(wall, cx, h / 2, cz, w, h, d, { bevel: 0.06, tint, collide: true });
    B.box(this.mat('precast_stone_paving', { size: 1.2 }), cx, 0.25, cz, w + 0.3, 0.5, d + 0.3, { bevel: 0.03, tint: 0xcfc6b6 });
    // cornice under the roof
    B.box(trim, cx, h - 0.15, cz, w + 0.36, 0.3, d + 0.36, { bevel: 0.05, tint: st.trim });
    // roof
    if (st.pitched) this._pitchedRoof(b, roof, trim, st);
    else this._flatRoof(b, roof, trim, st);

    // windows on the front (and sides for corner buildings)
    const doorAt = b.door ? b.door.at : null;
    const rows = []; for (let y = 1.6; y + 1.6 < h - 0.4; y += 2.6) rows.push(y);
    const step = 3.0;
    for (const y of rows) for (let u = F.u0 + 1.8; u <= F.u1 - 1.8; u += step) {
      if (doorAt !== null && Math.abs(u - doorAt) < (b.style === 'library' ? 7 : 2.2)) continue;
      if (b.style === 'cinema' && y > 2 && Math.abs(u - doorAt) < 5.5) continue;
      if (overlapsAd(F, b, u - 0.8, u + 0.8, y - 0.2, y + 1.6)) continue;
      this._window(F, u, y, { trim, glass, glow, accent, wood, tint, ground: y < 2, shutters: b.style === 'house' || b.style === 'cafe', box: (b.style === 'house' || b.style === 'cafe') && y < 2 });
    }
    // gutter along the front eave + downpipe
    const g = F.pt(F.u0 + 0.05, h + 0.05, 0.25), g2 = F.pt(F.u1 - 0.05, h + 0.05, 0.25);
    this._pipe(trim, g, g2, 0.07, st.trim);
    this._pipe(trim, F.pt(F.u0 + 0.3, h, 0.2), F.pt(F.u0 + 0.3, 0.3, 0.2), 0.05, st.trim);

    if (b.style === 'hall') this._hallFront(b, F, trim, st);
    if (!b.door) return;
    // door + frame + step
    const db = b.style === 'library' ? 0.6 : 0;
    const door = F.pt(doorAt, db + 1.2, 0.04);
    B.box(wood, door[0], door[1], door[2], ...F.wd(1.7, 2.4, 0.12), { bevel: 0.015, tint: st.accent, rot: F.rot3 });
    const fr = F.pt(doorAt, db + 1.25, 0.1);
    B.box(trim, fr[0], fr[1] + 1.25, fr[2], ...F.wd(2.2, 0.18, 0.2), { tint: st.trim, rot: F.rot3 });
    [-1.0, 1.0].forEach((du) => { const p = F.pt(doorAt + du, db + 1.25, 0.1); B.box(trim, p[0], p[1], p[2], ...F.wd(0.18, 2.5, 0.2), { tint: st.trim, rot: F.rot3 }); });
    const knob = F.pt(doorAt + 0.6, db + 1.1, 0.14); B.box(plain(0xd4a017, { metalness: 0.9, roughness: 0.3 }), knob[0], knob[1], knob[2], 0.08, 0.08, 0.08, { bevel: 0.03 });
    const stp = F.pt(doorAt, 0.08, 0.6); B.box(this.mat('precast_stone_paving', { size: 1.2 }), stp[0], stp[1], stp[2], ...F.wd(2.6, 0.16, 1.2), { bevel: 0.03, tint: 0xd8d0c0, rot: F.rot3, collide: true });
    // porch canopy over the door (not for the library — it gets a portico)
    if (b.style !== 'library') {
      const c = F.pt(doorAt, db + 2.75, 0.55);
      B.box(roof, c[0], c[1], c[2], ...F.wd(2.8, 0.14, 1.1), { bevel: 0.02, tint: st.roofTint, rot: F.rot3, collide: true });
      [-1.2, 1.2].forEach((du) => { const p = F.pt(doorAt + du, db + 2.4, 0.95); B.box(trim, p[0], p[1], p[2], ...F.wd(0.1, 0.1, 0.9), { tint: st.trim, rot: [F.rot3[0] + (F.face === 'west' || F.face === 'east' ? 0 : 0.5), F.rot3[1], F.rot3[2] + (F.face === 'west' || F.face === 'east' ? 0.5 : 0)] }); });
    }
    if (b.style === 'library') this._portico(b, F, trim, st);
    if (b.style === 'cafe') this._awning(b, F);
    if (b.style === 'shop' || b.style === 'cafe' || b.style === 'cinema') this._shopfront(b, F, glass, trim, st, tint);
    // sign
    const sign = signMesh(b.sign || b.name, { w: Math.min(6.5, Math.max(3, (b.sign || b.name).length * 0.5)), h: 0.85, bg: hex(st.accent), fg: hex(st.trim), serif: b.style !== 'shop' });
    const sp = F.pt(doorAt, db + 3.55, 0.12);
    sign.position.set(sp[0], sp[1], sp[2]); sign.rotation.y = F.rot;
    this.signs.push(sign);
    // lantern either side of the door
    [-1.5, 1.5].forEach((du) => { const p = F.pt(doorAt + du, db + 2.2, 0.3); this.prop('Lantern_01', p[0], p[1] - 0.2, p[2], F.rot + Math.PI, 1.0); });
  }

  _window(F, u, y, o) {
    const B = this.B, W = 1.3, H = 1.5;
    const p = (dy, off) => F.pt(u, y + dy, off);
    // recess: dark glass + warm interior card
    const gl = p(H / 2, 0.02); B.box(o.glass, gl[0], gl[1], gl[2], ...F.wd(W, H, 0.04), { bevel: 0, tint: 0xffffff, rot: F.rot3, cast: false });
    const in_ = p(H / 2, -0.06); B.box(o.glow, in_[0], in_[1], in_[2], ...F.wd(W - 0.1, H - 0.1, 0.02), { bevel: 0, tint: 0xffffff, rot: F.rot3, cast: false });
    // frame + mullions + sill + lintel
    const fw = 0.1;
    [[-W / 2 - fw / 2, H / 2, fw, H + fw * 2], [W / 2 + fw / 2, H / 2, fw, H + fw * 2], [0, H + fw / 2, W, fw], [0, -fw / 2, W, fw]].forEach(([du, dy, ww, hh]) => {
      const q = F.pt(u + du, y + dy, 0.07); B.box(o.trim, q[0], q[1], q[2], ...F.wd(ww, hh, 0.12), { bevel: 0.02, tint: 0xffffff, rot: F.rot3 });
    });
    const m1 = p(H / 2, 0.06); B.box(o.trim, m1[0], m1[1], m1[2], ...F.wd(0.05, H, 0.06), { bevel: 0.01, tint: 0xffffff, rot: F.rot3 });
    const m2 = p(H * 0.58, 0.06); B.box(o.trim, m2[0], m2[1], m2[2], ...F.wd(W, 0.05, 0.06), { bevel: 0.01, tint: 0xffffff, rot: F.rot3 });
    const sill = p(-0.12, 0.14); B.box(o.trim, sill[0], sill[1], sill[2], ...F.wd(W + 0.4, 0.1, 0.3), { bevel: 0.02, tint: 0xf2eee4, rot: F.rot3 });
    if (o.shutters) {
      [-W / 2 - 0.42, W / 2 + 0.42].forEach((du) => { const q = F.pt(u + du, y + H / 2, 0.05); B.box(o.wood, q[0], q[1], q[2], ...F.wd(0.55, H + 0.1, 0.06), { bevel: 0.01, tint: o.accent.color.getHex(), rot: F.rot3 }); });
    }
    if (o.box) {
      const fb = p(-0.3, 0.3); B.box(o.wood, fb[0], fb[1], fb[2], ...F.wd(W + 0.1, 0.32, 0.34), { bevel: 0.02, tint: 0x8a5a3a, rot: F.rot3 });
      const soil = p(-0.16, 0.3); B.box(plain(0x3a2a1c, { roughness: 1 }), soil[0], soil[1], soil[2], ...F.wd(W - 0.05, 0.05, 0.26), { bevel: 0, rot: F.rot3 });
      for (let i = -1; i <= 1; i++) { const q = F.pt(u + i * 0.4, y - 0.14, 0.3); this.prop(i === 0 ? 'flower_heliophila' : 'celandine_01', q[0], q[1], q[2], Math.random() * 6, 0.55); }
    }
  }
  _pitchedRoof(b, roof, trim, st) {
    const B = this.B;
    const { x0, x1, z0, z1, h } = b;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const alongX = w >= d;
    const span = alongX ? d : w, len = (alongX ? w : d) + 0.8;
    const rise = span * 0.42, overhang = 0.5;
    const slopeLen = Math.hypot(span / 2 + overhang, rise);
    const ang = Math.atan2(rise, span / 2 + overhang);
    // two slabs
    for (const side of [-1, 1]) {
      const off = (span / 2 + overhang) / 2 * side, yy = h + rise / 2 + 0.05;
      const sx = alongX ? cx : cx + off, sz = alongX ? cz + off : cz;
      const rot = alongX ? [ang * -side, 0, 0] : [0, 0, ang * side];
      B.box(roof, sx, yy, sz, alongX ? len : slopeLen, 0.16, alongX ? slopeLen : len, { bevel: 0.02, tint: st.roofTint, rot, collide: true });
      // fascia board
      const fx = alongX ? cx : cx + (span / 2 + overhang) * side, fz = alongX ? cz + (span / 2 + overhang) * side : cz;
      B.box(trim, fx, h + 0.02, fz, alongX ? len : 0.08, 0.22, alongX ? 0.08 : len, { bevel: 0.01, tint: st.trim });
    }
    // gable ends
    const gable = new THREE.Shape();
    gable.moveTo(-span / 2, 0); gable.lineTo(span / 2, 0); gable.lineTo(0, rise); gable.closePath();
    const gg = new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false });
    const wallMat = this.mat(st.wall, { size: 3 });
    for (const side of [-1, 1]) {
      const m = new THREE.Matrix4();
      const gx = alongX ? cx + (w / 2 - 0.1) * side : cx, gz = alongX ? cz : cz + (d / 2 - 0.1) * side;
      m.makeRotationY(alongX ? Math.PI / 2 : 0); m.setPosition(gx - (alongX ? 0.1 * side : 0), h, gz - (alongX ? 0 : 0.1 * side));
      const g = gg.clone(); uvFromBox(g, 3); g.applyMatrix4(m);
      this.B.add(wallMat, tintGeometry(g, PROOF.houseTints[b.id] || st.tint));
    }
    // ridge cap + chimney
    B.box(trim, cx, h + rise + 0.08, cz, alongX ? len : 0.3, 0.12, alongX ? 0.3 : len, { bevel: 0.03, tint: st.roofTint });
    const chx = alongX ? x0 + 2.5 : cx + span * 0.22, chz = alongX ? cz + span * 0.22 : z0 + 2.5;
    B.box(this.mat('Bricks059', { size: 1.6 }), chx, h + rise * 0.7 + 0.6, chz, 0.9, 1.9, 0.9, { bevel: 0.02, tint: 0xd8b8a0, collide: true });
    B.box(trim, chx, h + rise * 0.7 + 1.6, chz, 1.05, 0.14, 1.05, { bevel: 0.03, tint: 0xd7d0c2 });
  }
  _flatRoof(b, roof, trim, st) {
    const B = this.B;
    const { x0, x1, z0, z1, h } = b;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    B.box(roof, cx, h + 0.1, cz, w + 0.5, 0.2, d + 0.5, { bevel: 0.03, tint: st.roofTint, collide: true });
    // parapet
    const pw = 0.3, ph = 0.6;
    B.span(trim, x0 - 0.25, x1 + 0.25, h + 0.2, h + 0.2 + ph, z0 - 0.25, z0 - 0.25 + pw, { bevel: 0.02, tint: st.trim, collide: true });
    B.span(trim, x0 - 0.25, x1 + 0.25, h + 0.2, h + 0.2 + ph, z1 + 0.25 - pw, z1 + 0.25, { bevel: 0.02, tint: st.trim, collide: true });
    B.span(trim, x0 - 0.25, x0 - 0.25 + pw, h + 0.2, h + 0.2 + ph, z0 - 0.25, z1 + 0.25, { bevel: 0.02, tint: st.trim, collide: true });
    B.span(trim, x1 + 0.25 - pw, x1 + 0.25, h + 0.2, h + 0.2 + ph, z0 - 0.25, z1 + 0.25, { bevel: 0.02, tint: st.trim, collide: true });
    if (b.style === 'tower') {
      // the Habit Tower: a tall stair-stepped tower behind the base
      const tx0 = -40, tx1 = -32, tz0 = -20, tz1 = -12;
      for (let i = 0; i < 4; i++) {
        const y0 = h + 0.3 + i * 8.5, y1 = y0 + 8.5, ins = i * 0.15;
        B.span(this.mat(st.wall, { size: 3 }), tx0 + ins, tx1 - ins, y0, y1, tz0 + ins, tz1 - ins, { bevel: 0.05, tint: i % 2 ? 0xe8e2d4 : 0xf3efe6, collide: i === 0 });
        B.span(trim, tx0 - 0.2 + ins, tx1 + 0.2 - ins, y1 - 0.4, y1, tz0 - 0.2 + ins, tz1 + 0.2 - ins, { bevel: 0.04, tint: [0x5a7fb0, 0xd9a24a, 0x5c9a6a, 0xb3524a][i] });
        for (let y = y0 + 2; y < y1 - 2; y += 3.2) for (let u = -2.4; u <= 2.4; u += 2.4) {
          B.box(this.glassMat, tx1 - ins + 0.02, y + 0.7, -16 + u, 0.05, 1.4, 0.9, { bevel: 0, cast: false });
          B.box(this.glassMat, tx0 + ins - 0.02, y + 0.7, -16 + u, 0.05, 1.4, 0.9, { bevel: 0, cast: false });
          B.box(trim, tx1 - ins + 0.04, y - 0.05, -16 + u, 0.16, 0.08, 1.1, { tint: st.trim });
        }
      }
      B.span(roof, tx0 - 0.4, tx1 + 0.4, h + 0.3 + 34, h + 0.3 + 34.5, tz0 - 0.4, tz1 + 0.4, { bevel: 0.05, tint: st.roofTint });
      this.colliders.push({ type: 'box', x: -36, y: h + 17.5, z: -16, w: 8, h: 35, d: 8 });
    }
  }
  _portico(b, F, trim, st) {
    const B = this.B, at = b.door.at, h = b.h;
    const stone = this.mat('white_plaster_02', { size: 2 });
    // steps
    B.box(stone, ...F.pt(at, 0.15, 1.1), ...F.wd(9.5, 0.3, 2.2), { bevel: 0.03, tint: 0xe9e2d2, rot: F.rot3, collide: true });
    B.box(stone, ...F.pt(at, 0.45, 0.7), ...F.wd(8.5, 0.3, 1.4), { bevel: 0.03, tint: 0xefe9db, rot: F.rot3, collide: true });
    // columns + entablature
    const colGeo = new THREE.CylinderGeometry(0.34, 0.38, h - 1.6, 20);
    [-6.2, -3.4, 3.4, 6.2].forEach((du) => {
      const p = F.pt(at + du, 0.6 + (h - 1.6) / 2, 0.8);
      B.geom(stone, colGeo, { tint: new THREE.Color(1.35, 1.32, 1.25), matrix: new THREE.Matrix4().setPosition(p[0], p[1], p[2]), tile: 2 });
      B.box(trim, ...F.pt(at + du, h - 0.95, 0.8), 0.9, 0.18, 0.9, { bevel: 0.04, tint: st.trim });
      B.box(trim, ...F.pt(at + du, 0.68, 0.8), 0.9, 0.16, 0.9, { bevel: 0.04, tint: st.trim });
      this.colliders.push({ type: 'box', x: p[0], y: p[1], z: p[2], w: 0.75, h: h - 1.6, d: 0.75 });
    });
    B.box(stone, ...F.pt(at, h - 0.55, 0.8), ...F.wd(14, 0.7, 1.4), { bevel: 0.04, tint: new THREE.Color(1.35, 1.32, 1.25), rot: F.rot3, collide: true });
    // pediment (triangle)
    const sh = new THREE.Shape(); sh.moveTo(-7.2, 0); sh.lineTo(7.2, 0); sh.lineTo(0, 1.9); sh.closePath();
    const pg = new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: false });
    const pm = new THREE.Matrix4().makeRotationY(F.rot); const pp = F.pt(at, h - 0.2, 1.55); pm.setPosition(pp[0], pp[1], pp[2]);
    uvFromBox(pg, 2); B.geom(stone, pg, { tint: new THREE.Color(1.35, 1.32, 1.25), matrix: pm });
    // big arched window over the door with a book display behind it
    const arch = new THREE.Shape(); arch.absarc(0, 0, 1.4, Math.PI, 0, true); arch.lineTo(1.4, -1.6); arch.lineTo(-1.4, -1.6); arch.closePath();
    const ag = new THREE.ExtrudeGeometry(arch, { depth: 0.06, bevelEnabled: false });
    const am = new THREE.Matrix4().makeRotationY(F.rot); const ap = F.pt(at, 4.9, 0.02); am.setPosition(ap[0], ap[1], ap[2]);
    B.geom(this.glassMat, ag, { tint: 0xffffff, matrix: am, cast: false });
    const frame = new THREE.Shape(); frame.absarc(0, 0, 1.55, Math.PI, 0, true); frame.lineTo(1.55, -1.7); frame.lineTo(-1.55, -1.7); frame.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, 1.4, Math.PI, 0, true); hole.lineTo(1.4, -1.6); hole.lineTo(-1.4, -1.6); hole.closePath(); frame.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(frame, { depth: 0.16, bevelEnabled: false });
    const fm = new THREE.Matrix4().makeRotationY(F.rot); const fp = F.pt(at, 4.9, 0.1); fm.setPosition(fp[0], fp[1], fp[2]);
    B.geom(trim, fg, { tint: st.trim, matrix: fm });
    // books on display (coloured spines) behind the glass
    const spines = [0x8a3a3a, 0x3a6b4a, 0x35507a, 0xb08a3a, 0x6a4a80, 0xc0583f];
    for (let i = -3; i <= 3; i++) { const q = F.pt(at + i * 0.34, 3.75, -0.12); B.box(plain(spines[(i + 3) % spines.length], { roughness: 0.7 }), q[0], q[1], q[2], ...F.wd(0.26, 0.42 + (i % 2) * 0.08, 0.2), { bevel: 0.01, rot: F.rot3 }); }
    const shelf = F.pt(at, 3.5, -0.1); B.box(this.mat('weathered_brown_planks', { size: 1.6 }), shelf[0], shelf[1], shelf[2], ...F.wd(2.8, 0.06, 0.36), { bevel: 0.01, rot: F.rot3, tint: 0x8a5a3a });
  }
  _awning(b, F) {
    const B = this.B, fab = this.mat('Fabric086', { size: 0.8, side: THREE.DoubleSide });
    const z0 = 3.5, z1 = 14.5, x = 30;
    const g = new THREE.CylinderGeometry(2.2, 2.2, z1 - z0, 24, 1, true, 0, Math.PI * 0.42);
    uvFromBox(g, 0.8);
    const m = new THREE.Matrix4().makeRotationZ(-Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(0));
    const mm = new THREE.Matrix4().makeRotationX(Math.PI / 2).multiply(new THREE.Matrix4().makeRotationY(-Math.PI * 0.21));
    mm.setPosition(x, 2.5, (z0 + z1) / 2);
    B.geom(fab, g, { tint: 0xd8452f, matrix: mm, cast: true });
    this.colliders.push({ type: 'box', x: x - 1.1, y: 2.7, z: (z0 + z1) / 2, w: 2.2, h: 0.2, d: z1 - z0 });
    // café tables + chairs under it
    [[27.3, 5.5], [27.3, 9.0], [27.3, 12.6]].forEach(([tx, tz], i) => this.prop('outdoor_table_chair_set_01', tx, 0.1, tz, i * 1.1, 1));
  }
  _shopfront(b, F, glass, trim, st, tint) {
    const B = this.B, at = b.door.at;
    // big display windows either side of the door with a low stall-riser
    [-3.4, 3.4].forEach((du) => {
      const g = F.pt(at + du, 1.5, 0.02); B.box(glass, g[0], g[1], g[2], ...F.wd(3.2, 2.0, 0.04), { bevel: 0, tint: 0xffffff, rot: F.rot3, cast: false });
      const in_ = F.pt(at + du, 1.5, -0.08); B.box(this.glowMat, in_[0], in_[1], in_[2], ...F.wd(3.0, 1.8, 0.02), { bevel: 0, tint: 0xffffff, rot: F.rot3, cast: false });
      const fr = [[0, 2.55, 3.5, 0.12], [0, 0.45, 3.5, 0.12], [-1.7, 1.5, 0.12, 2.2], [1.7, 1.5, 0.12, 2.2]];
      fr.forEach(([dx, dy, ww, hh]) => { const q = F.pt(at + du + dx, dy, 0.08); B.box(trim, q[0], q[1], q[2], ...F.wd(ww, hh, 0.14), { bevel: 0.02, tint: st.accent, rot: F.rot3 }); });
      const riser = F.pt(at + du, 0.22, 0.08); B.box(this.mat('weathered_brown_planks', { size: 1.6 }), riser[0], riser[1], riser[2], ...F.wd(3.5, 0.44, 0.14), { bevel: 0.02, tint: st.accent, rot: F.rot3 });
    });
    // fascia board above
    const fas = F.pt(at, 3.05, 0.1); B.box(trim, fas[0], fas[1], fas[2], ...F.wd(10.2, 0.6, 0.18), { bevel: 0.03, tint: st.accent, rot: F.rot3 });
  }
  _hallFront(b, F, trim, st) {
    const B = this.B, h = b.h;
    // pilasters and a clock
    for (let u = F.u0 + 3; u < F.u1 - 2; u += 4) { const p = F.pt(u, h / 2, 0.15); B.box(trim, p[0], p[1], p[2], ...F.wd(0.6, h - 0.4, 0.3), { bevel: 0.04, tint: st.trim, rot: F.rot3 }); }
    const band = F.pt((F.u0 + F.u1) / 2, h - 0.9, 0.22); B.box(trim, band[0], band[1], band[2], ...F.wd(F.u1 - F.u0 - 2, 0.5, 0.26), { bevel: 0.04, tint: st.trim, rot: F.rot3 });
    const sign = signMesh('TOWN HALL', { w: 6, h: 0.8, bg: hex(st.trim), fg: hex(st.accent), serif: true, border: hex(st.accent) });
    const sp = F.pt(28, h - 1.7, 0.33); sign.position.set(sp[0], sp[1], sp[2]); sign.rotation.y = F.rot; this.signs.push(sign);
    // flag pole
    const fp = F.pt(17, h + 2.2, -2);
    B.geom(plain(0x9aa3ad, { metalness: 0.8, roughness: 0.35 }), new THREE.CylinderGeometry(0.05, 0.07, 4.4, 10), { matrix: new THREE.Matrix4().setPosition(fp[0], fp[1], fp[2]) });
  }
  _pipe(mat, a, b, r, tint) {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
    const len = A.distanceTo(Bv);
    const g = new THREE.CylinderGeometry(r, r, len, 10);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize());
    m.makeRotationFromQuaternion(q); m.setPosition(A.clone().add(Bv).multiplyScalar(0.5));
    this.B.geom(mat, g, { tint, matrix: m });
  }

  /* ---------- square furniture ---------- */
  _fountain() {
    const B = this.B;
    const stone = this.mat('white_plaster_02', { size: 1.6 });
    const basinR = 4.2;
    // ring wall (segmented so the top can be sat on) + collider ring
    const ring = new THREE.CylinderGeometry(basinR + 0.5, basinR + 0.6, 0.7, 48, 1, false);
    const inner = new THREE.CylinderGeometry(basinR, basinR, 0.72, 48, 1, true);
    uvFromBox(ring, 1.6); B.geom(stone, ring, { tint: new THREE.Color(1.35, 1.32, 1.25), matrix: new THREE.Matrix4().setPosition(0, 0.35, 0) });
    const cap = new THREE.TorusGeometry(basinR + 0.3, 0.22, 10, 48); uvFromBox(cap, 1.6);
    B.geom(stone, cap, { tint: 0xeee8da, matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.72, 0) });
    const floor = new THREE.CircleGeometry(basinR, 48); uvFromBox(floor.rotateX(-Math.PI / 2), 1.6);
    B.geom(this.mat('cobblestone_floor_08', { size: 1.2 }), floor, { tint: 0x9fb6c0, matrix: new THREE.Matrix4().setPosition(0, 0.12, 0), cast: false });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; this.colliders.push({ type: 'box', x: Math.cos(a) * (basinR + 0.3), y: 0.4, z: Math.sin(a) * (basinR + 0.3), w: 1.1, h: 0.8, d: 1.8, rot: [0, -a, 0] }); }
    // centre: plinth, bowl, finial
    const ped = new THREE.CylinderGeometry(0.55, 0.75, 1.6, 20); uvFromBox(ped, 1.6);
    B.geom(stone, ped, { tint: new THREE.Color(1.25, 1.22, 1.15), matrix: new THREE.Matrix4().setPosition(0, 0.9, 0) });
    const bowl = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(1.7, 0.1), new THREE.Vector2(1.85, 0.4), new THREE.Vector2(1.6, 0.5), new THREE.Vector2(0.9, 0.35), new THREE.Vector2(0, 0.3)], 40);
    uvFromBox(bowl, 1.6); B.geom(stone, bowl, { tint: new THREE.Color(1.3, 1.27, 1.2), matrix: new THREE.Matrix4().setPosition(0, 1.7, 0) });
    const fin = new THREE.CylinderGeometry(0.16, 0.3, 1.1, 16); uvFromBox(fin, 1.6);
    B.geom(stone, fin, { tint: new THREE.Color(1.25, 1.22, 1.15), matrix: new THREE.Matrix4().setPosition(0, 2.6, 0) });
    this.colliders.push({ type: 'box', x: 0, y: 1.6, z: 0, w: 1.6, h: 3.2, d: 1.6 });
    this.waterLevel = 0.52; this.bowlLevel = 2.05;
  }
  _marketStall() {
    const B = this.B, wood = this.mat('weathered_brown_planks', { size: 1.6 }), fab = this.mat('Fabric086', { size: 0.8, side: THREE.DoubleSide });
    const x = -22.5, z = 23;
    B.box(wood, x, 0.5, z, 2.4, 1.0, 2.0, { bevel: 0.02, tint: 0xc98d4c, collide: true });
    [[-1.3, -1.1], [-1.3, 1.1], [1.3, -1.1], [1.3, 1.1]].forEach(([dx, dz]) => B.box(wood, x + dx, 1.25, z + dz, 0.12, 2.5, 0.12, { bevel: 0.02, tint: 0x6b4a2e }));
    const roofG = new THREE.CylinderGeometry(1.9, 1.9, 3.2, 24, 1, true, Math.PI * 0.12, Math.PI * 0.76); uvFromBox(roofG, 0.8);
    B.geom(fab, roofG, { tint: 0x3f7fd6, matrix: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(x, 1.5, z) });
    this.colliders.push({ type: 'box', x, y: 2.9, z, w: 3.2, h: 0.3, d: 3.6 });
    this.prop('wooden_crate_01', x + 1.9, 0, z - 0.8, 0.3, 1); this.prop('wooden_crate_01', x + 1.9, 0, z + 0.4, -0.2, 1); this.prop('Barrel_01', x - 1.9, 0, z + 0.6, 0, 1);
    const sign = signMesh('MARKET', { w: 2.2, h: 0.55, bg: '#3f7fd6', fg: '#ffffff', serif: false });
    sign.position.set(x, 2.35, z + 1.05); this.signs.push(sign);
  }
  _adFrames() {
    const B = this.B, metal = plain(0x2a2d31, { metalness: 0.85, roughness: 0.35, vertexColors: true });
    const loader = new THREE.TextureLoader();
    this.ads = [];
    for (const slot of TOWN.adSlots.filter((a) => !a.scene || a.scene === 'town')) {
      const [w, h] = slot.size, ry = slot.rotationY || 0, [px, py, pz] = slot.position;
      const nx = Math.sin(ry), nz = Math.cos(ry), tx = Math.cos(ry), tz = -Math.sin(ry);
      const tex = loader.load('../' + slot.image); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2 }));
      poster.position.set(px + nx * 0.03, py, pz + nz * 0.03); poster.rotation.y = ry; poster.receiveShadow = true;
      this.scene.add(poster); this.ads.push(poster);
      const fr = 0.12, dep = 0.18;
      const bar = (u, v, bw, bh) => B.box(metal, px + tx * u + nx * (dep / 2 - 0.02), py + v, pz + tz * u + nz * (dep / 2 - 0.02), Math.abs(tx) * bw + Math.abs(nx) * dep, bh, Math.abs(tz) * bw + Math.abs(nz) * dep, { bevel: 0.03, tint: 0xffffff });
      bar(0, h / 2 + fr / 2, w + fr * 2, fr); bar(0, -h / 2 - fr / 2, w + fr * 2, fr); bar(-w / 2 - fr / 2, 0, fr, h); bar(w / 2 + fr / 2, 0, fr, h);
      // backing panel + two spotlight heads on an arm above
      B.box(metal, px - nx * 0.06, py, pz - nz * 0.06, Math.abs(tx) * (w + 0.3) + Math.abs(nx) * 0.1, h + 0.3, Math.abs(tz) * (w + 0.3) + Math.abs(nz) * 0.1, { bevel: 0.02, tint: 0xffffff });
      [-0.3, 0.3].forEach((k) => { const u = k * w; B.box(metal, px + tx * u + nx * 0.55, py + h / 2 + 0.3, pz + tz * u + nz * 0.55, 0.28, 0.16, 0.28, { bevel: 0.05, tint: 0xffffff }); B.box(metal, px + tx * u + nx * 0.3, py + h / 2 + 0.32, pz + tz * u + nz * 0.3, Math.abs(nx) * 0.55 + 0.05, 0.05, Math.abs(nz) * 0.55 + 0.05, { bevel: 0.02, tint: 0xffffff }); });
    }
  }
  _propsLayout() {
    const P = (name, x, z, ry = 0, s = 1, y = 0) => this.prop(name, x, y, z, ry, s);
    // benches (picnic tables as park seating) + bins + lamps
    [[9.5, 0, Math.PI / 2], [-9.5, 0, Math.PI / 2], [0, -10.5, 0], [-14, -26, 0], [18, 28, 0]].forEach(([x, z, r]) => P('wooden_picnic_table', x, z, r));
    [[-10, -10], [10, -10], [-10, 10], [10, 10], [-24, 0], [24, 0], [-6, 29], [6, 29], [-26, -27], [14, -27], [-26, 27], [26, -1]].forEach(([x, z]) => { P('street_lamp_01', x, z, Math.atan2(-x, -z)); this.lamps.push([x, z]); this.colliders.push({ type: 'box', x, y: 2, z, w: 0.3, h: 4, d: 0.3 }); });
    [[-38, 0.9], [36.5, -2.2], [-27, 3], [13, 24], [-13, 24]].forEach(([x, z]) => { P('metal_trash_can', x, z, Math.random() * 6); this.colliders.push({ type: 'box', x, y: 0.5, z, w: 0.7, h: 1, d: 0.7 }); });
    [[-20, 28.6], [20, 28.6], [28.6, 24], [-28.6, -24], [-12, -28.6], [12, 28.6], [27.5, -7], [-27.5, 6]].forEach(([x, z], i) => { P(i % 2 ? 'potted_plant_02' : 'potted_plant_04', x, z, Math.random() * 6, 1.1); this.colliders.push({ type: 'box', x, y: 0.4, z, w: 0.8, h: 0.8, d: 0.8 }); });
    P('concrete_cat_statue', -6.2, 6.2, 0.6, 1); P('CoffeeCart_01', 23.5, 8.5, -Math.PI / 2, 1);
    this.colliders.push({ type: 'box', x: 23.5, y: 0.8, z: 8.5, w: 1.2, h: 1.6, d: 2.2 });
    // bike rack: simple hoops
    const metal = plain(0x3a3f45, { metalness: 0.8, roughness: 0.4, vertexColors: true });
    for (let i = 0; i < 3; i++) { const g = new THREE.TorusGeometry(0.4, 0.03, 8, 20, Math.PI); this.B.geom(metal, g, { matrix: new THREE.Matrix4().setPosition(16 + i * 0.9, 0.4, 24.5) }); }
    this.colliders.push({ type: 'box', x: 16.9, y: 0.4, z: 24.5, w: 3, h: 0.8, d: 0.2 });
    // noticeboard
    this.B.box(this.mat('weathered_brown_planks', { size: 1.6 }), 4, 1.4, 29.2, 2.6, 2.6, 0.14, { bevel: 0.02, tint: 0x8a5a3a, collide: true });
    const board = canvasTexture(512, 320, (ctx) => {
      ctx.fillStyle = '#b89067'; ctx.fillRect(0, 0, 512, 320);
      [['#fff8c4', 30, 24, -0.05], ['#d6f0ff', 270, 36, 0.06], ['#ffd6e0', 80, 170, 0.04], ['#e0ffd6', 300, 184, -0.07]].forEach(([c, nx, ny, r]) => { ctx.save(); ctx.translate(nx + 90, ny + 60); ctx.rotate(r); ctx.fillStyle = c; ctx.fillRect(-90, -60, 180, 120); ctx.fillStyle = '#666'; for (let i = 0; i < 4; i++) ctx.fillRect(-70, -30 + i * 22, 120 - i * 20, 5); ctx.restore(); });
    });
    const nb = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), new THREE.MeshStandardMaterial({ map: board, roughness: 0.8 })); nb.position.set(4, 1.75, 29.28); this.scene.add(nb);
    // trees + hedges + flower beds + shrubs
    [[-16, -6, 1.1], [16, -16, 1.0], [-16, 16, 1.2], [16, 16, 1.0], [-20, 26, 0.9], [20, 26, 1.1], [-22, -24, 1.0], [10, 24, 0.9], [24.5, 22.5, 1.0], [-24.5, -13.5, 1.1], [-7, 35, 0.9], [7, 35, 0.9], [-24.5, 14, 1.0], [24.5, -21, 1.0]].forEach(([x, z, s]) => { this.treeSpots.push({ x, z, s }); this.colliders.push({ type: 'box', x, y: 1.5, z, w: 0.6, h: 3, d: 0.6 }); });
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = 54 + (i % 3) * 6; this.treeSpots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1.2 + (i % 4) * 0.25, far: true }); }
    for (const L of this.lawns) { if (L.outer) continue; for (let i = 0; i < 5; i++) P(['shrub_04', 'shrub_01', 'shrub_sorrel_01'][i % 3], L.x0 + 0.8 + Math.random() * (L.x1 - L.x0 - 1.6), L.z1 - 0.9 - Math.random() * 0.8, Math.random() * 6, 0.9 + Math.random() * 0.4); }
    for (const fb of this.flowerBeds) for (let i = 0; i < 22; i++) P(['celandine_01', 'flower_heliophila', 'dandelion_01'][i % 3], fb.x + (Math.random() - 0.5) * fb.w, fb.z + (Math.random() - 0.5) * fb.d, Math.random() * 6, 0.8 + Math.random() * 0.5);
    // trees standing on paving get a round grass bed with a stone edge; tufts stay inside it
    const bedGrass = this.mat('Grass004', { size: 2.6, roughness: 1 }), edge = this.mat('precast_stone_paving', { size: 1.2 });
    const onLawn = (x, z) => this.lawns.some((L) => x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1);
    for (const t of this.treeSpots) {
      if (t.far) continue;
      if (!onLawn(t.x, t.z)) {
        this.B.geom(bedGrass, new THREE.CircleGeometry(1.5, 28).rotateX(-Math.PI / 2), { tint: 0xd3dfb0, tile: 2.6, matrix: new THREE.Matrix4().setPosition(t.x, 0.075, t.z), cast: false });
        const ring = new THREE.TorusGeometry(1.55, 0.09, 6, 32); uvFromBox(ring, 1.2);
        this.B.geom(edge, ring, { tint: 0xe6e0d4, matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(t.x, 0.07, t.z), cast: false });
      }
      for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28, r = 0.5 + Math.random() * 0.8; P('grass_medium_01', t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, Math.random() * 6, 0.6 + Math.random() * 0.4, 0.08); }
    }
  }
  _bounds() {
    const BND = 46;
    this.colliders.push({ type: 'box', x: -BND - 1, y: 10, z: 0, w: 2, h: 40, d: 2 * BND + 4 }, { type: 'box', x: BND + 1, y: 10, z: 0, w: 2, h: 40, d: 2 * BND + 4 },
      { type: 'box', x: 0, y: 10, z: -BND - 1, w: 2 * BND + 4, h: 40, d: 2 }, { type: 'box', x: 0, y: 10, z: BND + 1, w: 2 * BND + 4, h: 40, d: 2 });
    this.colliders.push({ type: 'box', x: 0, y: -1, z: 0, w: 400, h: 2, d: 400 });
  }
  prop(name, x, y, z, ry = 0, s = 1) { (this.props[name] || (this.props[name] = [])).push({ x, y, z, ry, s }); }

  /* ---------- GLB props, instanced ---------- */
  async loadProps(onProgress) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const names = Object.keys(this.props);
    let done = 0;
    this.propMeshes = [];
    await Promise.all(names.map(async (name) => {
      const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
      const list = this.props[name];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
        im.castShadow = true; im.receiveShadow = true;
        if (o.material.map) o.material.map.anisotropy = 8;
        o.material.envMapIntensity = 1;
        const m = new THREE.Matrix4(), base = o.matrixWorld.clone();
        list.forEach((t, i) => {
          m.makeRotationY(t.ry).scale(new THREE.Vector3(t.s, t.s, t.s)).setPosition(t.x, t.y, t.z);
          im.setMatrixAt(i, m.multiply(base));
        });
        im.computeBoundingSphere();
        this.scene.add(im);
        this.propMeshes.push(im);
      });
      done++; if (onProgress) onProgress(done / names.length);
    }));
  }
}

/* ---------- helpers ---------- */
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function faceOf(b) {
  if (b.door) return b.door.face;
  if (b.z1 <= -30) return 'south';
  if (b.z0 >= 30) return 'north';
  if (b.x0 >= 30) return 'west';
  return 'east';
}
// Facade frame: u runs along the front, y up, o out from the wall.
export function facade(b) {
  const face = faceOf(b);
  const F = {
    south: { u0: b.x0, u1: b.x1, rot: 0,            pt: (u, y, o) => [u, y, b.z1 + o] },
    north: { u0: b.x0, u1: b.x1, rot: Math.PI,      pt: (u, y, o) => [u, y, b.z0 - o] },
    west:  { u0: b.z0, u1: b.z1, rot: -Math.PI / 2, pt: (u, y, o) => [b.x0 - o, y, u] },
    east:  { u0: b.z0, u1: b.z1, rot: Math.PI / 2,  pt: (u, y, o) => [b.x1 + o, y, u] }
  }[face];
  F.face = face;
  F.rot3 = [0, F.rot, 0];
  // (width along the front, height, depth out) → box size in world axes
  F.wd = (w, h, d) => (face === 'south' || face === 'north') ? [w, h, d] : [d, h, w];
  return F;
}
const TOWN_ADS = TOWN.adSlots.filter((a) => !a.scene || a.scene === 'town');
function overlapsAd(F, b, u0, u1, y0, y1) {
  for (const a of TOWN_ADS) {
    const [ax, ay, az] = a.position;
    let onFace = false, au = 0;
    if (F.face === 'south') { onFace = Math.abs(az - b.z1) < 0.5; au = ax; }
    if (F.face === 'north') { onFace = Math.abs(az - b.z0) < 0.5; au = ax; }
    if (F.face === 'west')  { onFace = Math.abs(ax - b.x0) < 0.5; au = az; }
    if (F.face === 'east')  { onFace = Math.abs(ax - b.x1) < 0.5; au = az; }
    if (!onFace) continue;
    const hw = a.size[0] / 2 + 0.4, hh = a.size[1] / 2 + 0.4;
    if (u1 > au - hw && u0 < au + hw && y1 > ay - hh && y0 < ay + hh) return true;
  }
  return false;
}
