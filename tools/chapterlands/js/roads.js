// Library roads (A1 §2): seven roads leave Library Square, one per quarter,
// and every catalogue book gets a plot along its road — Level 1 nearest the
// square. Nothing here is hand-placed per book: add a book to
// catalogue/books.json and its road grows a plot.
//
// Each plot: a building (the town's own building builder, so the art style
// matches), a signpost with the title and level, and — until that road's
// Lookout Tower is climbed — a bank of mist. Live districts are never fogged.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Catalogue, quarterIcon } from './catalogue.js';
import { canvasTexture, signMesh } from './world.js';
import { toon } from './gfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Save } from './save.js';

const P = CONFIG.palette;
const deg = (a) => a * Math.PI / 180;

/* ---------- mist: instanced camera-facing puffs, one draw call ---------- */
class Mist {
  constructor(scene, max = 900) {
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    this.offset = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.seed = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    for (const a of [this.offset, this.size, this.alpha, this.seed]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('offset', this.offset); g.setAttribute('size', this.size);
    g.setAttribute('alpha', this.alpha); g.setAttribute('seed', this.seed);
    g.instanceCount = 0;
    this.uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xe8eef2) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: `
        attribute vec3 offset; attribute float size; attribute float alpha; attribute float seed;
        uniform float uTime; varying vec2 vUv; varying float vA;
        void main() {
          vec3 o = offset + vec3(sin(uTime * 0.18 + seed * 6.0) * 1.2, sin(uTime * 0.3 + seed) * 0.25, cos(uTime * 0.15 + seed * 3.0) * 1.2);
          vec4 mv = modelViewMatrix * vec4(o, 1.0);
          float s = size * (1.0 + 0.08 * sin(uTime * 0.4 + seed * 9.0));
          mv.xy += position.xy * s;
          vUv = uv;
          vA = alpha * smoothstep(3.0, 14.0, -mv.z) * (1.0 - smoothstep(170.0, 230.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying vec2 vUv; varying float vA;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p) * 2.0;
          float a = smoothstep(1.0, 0.15, d);
          a *= 0.85 + 0.15 * sin((p.x + p.y) * 9.0);
          gl_FragColor = vec4(uColor, a * vA);
          #include <colorspace_fragment>
        }`
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.n = 0;
    this.groups = {};      // key → { from, to, target, value }
    this.geo = g;
  }
  add(key, x, y, z, size, alpha = 0.92) {
    const i = this.n++;
    this.offset.setXYZ(i, x, y, z);
    this.size.setX(i, size);
    this.seed.setX(i, Math.random() * 10);
    this.alpha.setX(i, alpha);
    const G = this.groups[key] || (this.groups[key] = { list: [], value: 1, target: 1, base: [] });
    G.list.push(i); G.base.push(alpha);
    this.geo.instanceCount = this.n;
  }
  set(key, on, instant = false) {
    const G = this.groups[key];
    if (!G) return;
    G.target = on ? 1 : 0;
    if (instant) { G.value = G.target; this._apply(G); }
  }
  _apply(G) {
    G.list.forEach((i, k) => this.alpha.setX(i, G.base[k] * G.value));
    this.alpha.needsUpdate = true;
  }
  update(dt, t, fogColor) {
    this.uniforms.uTime.value = t;
    if (fogColor) this.uniforms.uColor.value.copy(fogColor).lerp(new THREE.Color(0xffffff), 0.35);
    for (const G of Object.values(this.groups)) {
      if (G.value === G.target) continue;
      G.value += Math.sign(G.target - G.value) * Math.min(Math.abs(G.target - G.value), dt * 0.6);
      this._apply(G);
    }
  }
}

/* ---------- signpost: title + level, drawn into an atlas cell ---------- */
function drawSignpost(atlas, ox, oy, book, quarter) {
  atlas.save();
  atlas.translate(ox, oy);
  atlas.beginPath(); atlas.rect(0, 0, 256, 128); atlas.clip();
  ((ctx) => {
    ctx.fillStyle = '#f4ead2'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = quarter.colour; ctx.fillRect(0, 0, 256, 22);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${quarterIcon(quarter)} ${quarter.name.toUpperCase()}`, 8, 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5a4a36'; ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('📖'.repeat(book.level) + '  Level ' + book.level, 128, 108);
    // title, wrapped onto up to 3 lines
    ctx.fillStyle = '#231a12';
    let size = 22;
    const words = book.title.split(' ');
    let lines;
    for (; size >= 13; size -= 1) {
      ctx.font = `bold ${size}px Georgia, serif`;
      lines = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (ctx.measureText(t).width > 236 && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      lines.push(cur);
      if (lines.length <= 3) break;
    }
    const lh = size * 1.12, y0 = 56 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, 128, y0 + i * lh));
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 252, 124);
  })(atlas);
  atlas.restore();
}

// Darken a hex colour string → number.
function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k).getHex(); }

export function buildRoads({ scene, world, B, buildBuilding, interactables, onPlot, onLockedPlot }) {
  const C = CONFIG.plots;
  const out = { plots: {}, shelves: {}, roads: {}, arches: [], mist: new Mist(scene), towersAt: {}, more: [] };
  // signposts share one texture atlas and one merged mesh (one draw call)
  const ATLAS_COLS = 8, CELL_W = 256, CELL_H = 128;
  const allBooks = [];
  for (const R of CONFIG.roads) allBooks.push(...Catalogue.booksInQuarter(R.quarter).slice(0, C.maxPerRoad));
  const atlasRows = Math.max(1, Math.ceil(allBooks.length / ATLAS_COLS));
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_COLS * CELL_W; atlasCanvas.height = atlasRows * CELL_H;
  const atlasCtx = atlasCanvas.getContext('2d');
  const boardGeos = [];

  // a flat strip from a to b, `w` wide — batched into the town's merged mesh
  // (one draw call for every road), with paler edges and a few worn patches
  const UNIT = new THREE.BoxGeometry(1, 1, 1);
  const strip = (ax, az, bx, bz, w, y = 0.012) => {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    B.geom(UNIT, 0xc9b48f, { x: cx, y: y / 2, z: cz, ry, sx: w, sy: y, sz: len, cast: false, shade: false });
    const ex = Math.cos(ry), ez = -Math.sin(ry);
    for (const sd of [-1, 1]) B.geom(UNIT, 0xb39d77, { x: cx + ex * sd * (w / 2 - 0.2), y: y / 2 + 0.002, z: cz + ez * sd * (w / 2 - 0.2), ry, sx: 0.4, sy: y, sz: len, cast: false, shade: false });
    for (let k = 4; k < len - 3; k += 9) {
      const t = k / len, o = ((k * 7) % 5 - 2) * 0.4;
      B.geom(UNIT, 0xd6c29b, { x: ax + (bx - ax) * t + ex * o, y: y / 2 + 0.003, z: az + (bz - az) * t + ez * o, ry: ry + 0.3, sx: 1.2, sy: y, sz: 0.9, cast: false, shade: false });
    }
  };

  for (const R of CONFIG.roads) {
    const Q = Catalogue.getQuarter(R.quarter);
    if (!Q) continue;
    const D = { x: Math.cos(deg(R.angle)), z: Math.sin(deg(R.angle)) };
    const N = { x: -D.z, z: D.x };
    const [gx, gz] = R.gate, [ox, oz] = R.out;
    const books = Catalogue.booksInQuarter(Q.id);
    const shown = books.slice(0, C.maxPerRoad);
    const roadLen = C.first + C.spacing * Math.max(0, shown.length - 1) + 34;
    const end = { x: ox + D.x * roadLen, z: oz + D.z * roadLen };
    const road = { R, Q, D, N, gate: { x: gx, z: gz }, out: { x: ox, z: oz }, end, books, shown, len: roadLen,
      at: (d, side = 0, off = 0) => ({ x: ox + D.x * d + N.x * side * off, z: oz + D.z * d + N.z * side * off }) };
    out.roads[Q.id] = road;

    // road surface: through the gap, then out into the countryside
    strip(gx, gz, ox, oz, R.width);
    strip(ox - D.x * 0.5, oz - D.z * 0.5, end.x, end.z, 5.5);
    // kerb-stones every few metres along the open road
    for (let d = 4; d < roadLen - 6; d += 7) {
      for (const s of [-1, 1]) {
        const p = road.at(d, s, 3.2);
        B.box(p.x - 0.25, p.x + 0.25, 0, 0.35, p.z - 0.25, p.z + 0.25, 0xcfc5b2, { cast: false });
      }
    }
    // little lamps along the road
    for (let d = 10; d < roadLen - 10; d += 23) {
      const p = road.at(d, d % 2 ? 1 : -1, 3.9);
      B.box(p.x - 0.09, p.x + 0.09, 0, 3.2, p.z - 0.09, p.z + 0.09, 0x2f3b3a);
      B.box(p.x - 0.25, p.x + 0.25, 3.2, 3.6, p.z - 0.25, p.z + 0.25, 0xffe9a8, { bucket: 'glow', shade: false });
      world.add(p.x - 0.12, p.x + 0.12, 0, 3.6, p.z - 0.12, p.z + 0.12, false);
    }

    // ---- gateway arch: quarter name, colour and icon ----
    {
      const across = Math.abs(D.x) > Math.abs(D.z) ? 'z' : 'x';     // arch spans the gap
      const half = Math.min(R.width / 2 + 0.4, 3.3);
      const col = new THREE.Color(Q.colour).getHex(), dark = shade(Q.colour, 0.65);
      const post = (px, pz) => {
        B.box(px - 0.35, px + 0.35, 0, 5.2, pz - 0.35, pz + 0.35, col);
        B.box(px - 0.45, px + 0.45, 0, 0.5, pz - 0.45, pz + 0.45, dark);
        world.add(px - 0.35, px + 0.35, 0, 5.2, pz - 0.35, pz + 0.35);
      };
      // nudge the arch a little into the gap so it reads as the road's mouth
      const ax = gx + D.x * 0.8, az = gz + D.z * 0.8;
      if (across === 'z') { post(ax, az - half); post(ax, az + half); B.box(ax - 0.4, ax + 0.4, 5.2, 5.9, az - half - 0.45, az + half + 0.45, dark); }
      else { post(ax - half, az); post(ax + half, az); B.box(ax - half - 0.45, ax + half + 0.45, 5.2, 5.9, az - 0.4, az + 0.4, dark); }
      const sign = signMesh(`${quarterIcon(Q)} ${Q.name}`, { w: Math.max(3.2, half * 2 + 0.4), h: 0.85, bg: Q.colour, fg: '#ffffff', border: '#ffffff', glow: true });
      const ry = Math.atan2(-D.x, -D.z);      // face back into the square
      sign.position.set(ax - D.x * 0.42, 5.55, az - D.z * 0.42); sign.rotation.y = ry; scene.add(sign);
      const back = sign.clone(); back.position.set(ax + D.x * 0.42, 5.55, az + D.z * 0.42); back.rotation.y = ry + Math.PI; scene.add(back);
      out.arches.push(sign, back);
      // the little lost-books shelf under the arch, to one side of the road
      const sp = across === 'z' ? { x: ax - D.x * 1.1, z: az - half + 0.9 } : { x: ax - half + 0.9, z: az - D.z * 1.1 };
      B.box(sp.x - 0.55, sp.x + 0.55, 0, 1.25, sp.z - 0.55, sp.z + 0.55, 0x7a4e30);
      B.box(sp.x - 0.6, sp.x + 0.6, 1.25, 1.35, sp.z - 0.6, sp.z + 0.6, dark);
      B.box(sp.x - 0.45, sp.x + 0.45, 0.62, 0.68, sp.z - 0.45, sp.z + 0.45, 0x5a3a24);
      world.add(sp.x - 0.55, sp.x + 0.55, 0, 1.35, sp.z - 0.55, sp.z + 0.55);
      const tag = signMesh(quarterIcon(Q), { w: 0.6, h: 0.6, bg: Q.colour, fg: '#fff', px: 90 });
      tag.position.set(sp.x - D.x * 0.62, 1.0, sp.z - D.z * 0.62); tag.rotation.y = ry; scene.add(tag);
      out.shelves[Q.id] = { x: sp.x - D.x * 1.3, z: sp.z - D.z * 1.3 };
    }

    // ---- plots ----
    shown.forEach((book, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const d = C.first + C.spacing * i;
      const c = road.at(d, side, C.offset);
      // AABB footprint: long side along the road's main axis
      const alongX = Math.abs(D.x) >= Math.abs(D.z) - 1e-6;
      const [L, W] = C.size;
      const w = alongX ? L : W, dd = alongX ? W : L;
      // door faces the road
      const tx = -N.x * side, tz = -N.z * side;
      let face;
      if (Math.abs(tz) >= Math.abs(tx) - 1e-6) face = tz > 0 ? 'south' : 'north';
      else face = tx > 0 ? 'east' : 'west';
      const live = book.status === 'live';
      const kitTheme = (book._kit && book._kit.theme && book._kit.theme.building) || {};
      const b = {
        id: 'plot-' + book.id, name: Catalogue.placeName(book), plot: true, book,
        sign: live ? (kitTheme.sign || Catalogue.placeName(book)) : null,
        status: live ? 'live' : 'locked',
        x0: c.x - w / 2, x1: c.x + w / 2, z0: c.z - dd / 2, z1: c.z + dd / 2,
        h: kitTheme.h || (book.level >= 3 ? 6.5 : book.level === 2 ? 5.5 : 4.8),
        wall: kitTheme.wall != null ? kitTheme.wall : P.cream,
        trim: kitTheme.trim != null ? kitTheme.trim : shade(Q.colour, 0.75),
        roof: kitTheme.roof != null ? kitTheme.roof : new THREE.Color(Q.colour).getHex(),
        style: kitTheme.style || 'house',
        door: { face, at: face === 'south' || face === 'north' ? c.x : c.z },
        icon: '📖', open: () => onPlot(book)
      };
      if (book.entry) { b.href = book.entry; b.open = null; b.icon = '📘'; }
      buildBuilding(b);
      // ground pad (yard)
      B.box(c.x - (w + 6) / 2, c.x + (w + 6) / 2, 0, 0.01, c.z - (dd + 6) / 2, c.z + (dd + 6) / 2, live ? 0x9fc98a : 0x93b884, { cast: false, shade: false });
      // signpost at the road edge
      const sp = road.at(d - 7.5, side, 4.6);     // beside the path to the door, not in it
      B.box(sp.x - 0.1, sp.x + 0.1, 0, 2.7, sp.z - 0.1, sp.z + 0.1, 0x6b4a2e);
      world.add(sp.x - 0.12, sp.x + 0.12, 0, 2.7, sp.z - 0.12, sp.z + 0.12, false);
      const cell = boardGeos.length;
      drawSignpost(atlasCtx, (cell % ATLAS_COLS) * CELL_W, Math.floor(cell / ATLAS_COLS) * CELL_H, book, Q);
      const bg = new THREE.PlaneGeometry(2.2, 1.1);
      const uv = bg.attributes.uv;
      const u0 = (cell % ATLAS_COLS) / ATLAS_COLS, v0 = 1 - (Math.floor(cell / ATLAS_COLS) + 1) / atlasRows;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / ATLAS_COLS, v0 + uv.getY(k) / atlasRows);
      bg.rotateY(Math.atan2(-N.x * side, -N.z * side));   // face the road
      bg.translate(sp.x, 2.45, sp.z);
      boardGeos.push(bg);
      // door point (road-side front) for quests and spawns
      const fx = face === 'east' ? b.x1 + 2.2 : face === 'west' ? b.x0 - 2.2 : c.x;
      const fz = face === 'south' ? b.z1 + 2.2 : face === 'north' ? b.z0 - 2.2 : c.z;
      const facing = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[face];
      const plot = { book, road, i, side, d, c, b, front: { x: fx, z: fz, facing }, live, face };
      // frame for District Kit quests: [a, b] = along the road, away from it
      plot.frame = (a, bb) => ({ x: c.x + D.x * a + N.x * side * bb, z: c.z + D.z * a + N.z * side * bb });
      out.plots[book.id] = plot;
      // signpost interaction
      interactables.push({ x: sp.x, z: sp.z, y: 0, r: 1.6, label: 'Read the signpost', act: () => onLockedPlot(book, 'sign') });
      if (!live) {
        interactables.push({ x: fx, z: fz, y: 0, r: 2.2, get label() { return `${Catalogue.placeName(book)} (coming soon)`; }, act: () => onLockedPlot(book, 'door') });
        // fog bank over the building (lifted by the road's Lookout Tower)
        const key = 'q:' + Q.id;
        const n = 7;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          out.mist.add(key, c.x + Math.cos(a) * 5.5, 2 + (k % 3) * 1.8, c.z + Math.sin(a) * 5.5, 9 + (k % 2) * 3);
        }
        out.mist.add(key, c.x, 4.5, c.z, 13);
      }
    });
    // "more coming": the road fades out into a permanent bank of mist
    const more = books.length - shown.length;
    {
      const e = road.at(roadLen - 12);
      for (let k = 0; k < 9; k++) out.mist.add('end', e.x + D.x * (k % 3) * 5 + N.x * ((k % 3) - 1) * 6, 2 + (k % 3) * 2, e.z + D.z * (k % 3) * 5 + N.z * ((k % 3) - 1) * 6, 14);
      const s = road.at(roadLen - 20, 1, 4.2);
      B.box(s.x - 0.1, s.x + 0.1, 0, 2.2, s.z - 0.1, s.z + 0.1, 0x6b4a2e);
      const sign = signMesh(more > 0 ? `${more} more coming…` : 'More coming…', { w: 2.4, h: 0.6, bg: '#f4ead2', fg: '#5a4a36', style: 'serif', px: 60 });
      sign.position.set(s.x, 2.0, s.z); sign.rotation.y = Math.atan2(D.x, D.z) + Math.PI / 2; scene.add(sign);
      const sign2 = sign.clone(); sign2.rotation.y += Math.PI; scene.add(sign2);
    }
    out.mist.set('q:' + Q.id, !Save.towerClimbed(Q.id), true);
  }
  if (boardGeos.length) {
    const tex = new THREE.CanvasTexture(atlasCanvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const boards = new THREE.Mesh(mergeGeometries(boardGeos, false), toon({ map: tex, side: THREE.DoubleSide }));
    boards.castShadow = false; boards.receiveShadow = true;
    scene.add(boards);
    out.boards = boards;
  }
  return out;
}
