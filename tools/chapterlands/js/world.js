// Shared world helpers: axis-aligned colliders, a static-geometry batcher that
// merges every box into a few draw calls (vertex-coloured), canvas textures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './gfx.js';

export class World {
  constructor() {
    this.colliders = [];   // { x0,x1,y0,y1,z0,z1, cam }
  }
  // cam: whether this collider also blocks the camera (thin posts shouldn't).
  add(x0, x1, y0, y1, z0, z1, cam = true) {
    const c = {
      x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      y0: Math.min(y0, y1), y1: Math.max(y0, y1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1), cam
    };
    this.colliders.push(c);
    return c;
  }
  remove(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }
  // Distance along a normalised ray to the first camera-blocking collider, or Infinity.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    for (const b of this.colliders) {
      if (!b.cam) continue;
      // skip boxes containing the origin (e.g. player standing in a doorway trim)
      if (ox > b.x0 && ox < b.x1 && oy > b.y0 && oy < b.y1 && oz > b.z0 && oz < b.z1) continue;
      let tmin = 0, tmax = best;
      let ok = true;
      for (let a = 0; a < 3; a++) {
        const o = a === 0 ? ox : a === 1 ? oy : oz;
        const d = a === 0 ? dx : a === 1 ? dy : dz;
        const lo = a === 0 ? b.x0 : a === 1 ? b.y0 : b.z0;
        const hi = a === 0 ? b.x1 : a === 1 ? b.y1 : b.z1;
        if (Math.abs(d) < 1e-8) {
          if (o < lo || o > hi) { ok = false; break; }
        } else {
          let t1 = (lo - o) / d, t2 = (hi - o) / d;
          if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
          if (t1 > tmin) tmin = t1;
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && tmin < best) best = tmin;
    }
    return best;
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const BOX = new THREE.BoxGeometry(1, 1, 1);
// Box with an extra row of vertices near the bottom so fake ambient occlusion
// (darker base) stays a short gradient instead of spanning the whole wall.
const AO_BOX = new THREE.BoxGeometry(1, 1, 1, 1, 2, 1);

// Collects coloured box geometry and merges it into one mesh per bucket:
//   cast  – casts + receives shadows (buildings, props)
//   flat  – receive only (ground, roads, decals)
//   glow  – like cast, but its material glows at night (windows, lamp heads)
export class Batcher {
  constructor() {
    this.lists = { cast: [], flat: [], glow: [] };
  }
  // Add an arbitrary geometry with a uniform colour and transform.
  geom(geometry, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true, bucket = null, ao = 0, aoRise = 0.9, shade = null } = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    const isAO = ao > 0 && geometry === AO_BOX;
    if (isAO) {
      // pull the middle row of vertices down to aoRise metres above the base
      const pa = g.attributes.position;
      const k = Math.min(0.45, aoRise / Math.max(0.01, sy));
      for (let i = 0; i < pa.count; i++) if (Math.abs(pa.getY(i)) < 1e-4) pa.setY(i, -0.5 + k);
    }
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(_m);
    _c.set(color);   // THREE.Color converts sRGB hex to linear vertex colours
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const pos = g.attributes.position, nrm = g.attributes.normal;
    const base = y - sy / 2;
    for (let i = 0; i < n; i++) {
      let f = 1;
      if (isAO && Math.abs(pos.getY(i) - base) < 1e-3) f = 1 - ao;
      // top faces a hair brighter, undersides darker: reads as soft bounce light
      if (shade !== false && nrm) { const ny = nrm.getY(i); if (ny > 0.5) f *= 1.04; else if (ny < -0.5) f *= 0.82; }
      cols[i * 3] = _c.r * f; cols[i * 3 + 1] = _c.g * f; cols[i * 3 + 2] = _c.b * f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.lists[bucket || (cast ? 'cast' : 'flat')].push(g);
  }
  // Box from min/max extents. Boxes standing on the ground get a darker base (fake AO).
  box(x0, x1, y0, y1, z0, z1, color, opts = {}) {
    const lo = Math.min(y0, y1), h = Math.abs(y1 - y0);
    const groundAO = opts.ao !== undefined ? opts.ao : (lo < 0.05 && h > 0.7 && opts.cast !== false ? 0.36 : 0);
    this.geom(groundAO > 0 ? AO_BOX : BOX, color, Object.assign({
      x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2,
      sx: Math.abs(x1 - x0), sy: h, sz: Math.abs(z1 - z0)
    }, opts, { ao: groundAO }));
  }
  // Box from centre + size.
  cbox(x, y, z, w, h, d, color, opts = {}) {
    this.geom(BOX, color, Object.assign({ x, y, z, sx: w, sy: h, sz: d }, opts));
  }
  build(scene) {
    const mats = {
      cast: Batcher.material(),
      flat: Batcher.material(),
      glow: Batcher.glowMaterial()
    };
    const out = [];
    for (const key of ['cast', 'glow', 'flat']) {
      const list = this.lists[key];
      if (!list.length) continue;
      // chunk to keep individual buffers a sensible size
      for (let i = 0; i < list.length; i += 400) {
        const merged = mergeGeometries(list.slice(i, i + 400), false);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mats[key]);
        mesh.castShadow = key !== 'flat';
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        scene.add(mesh);
        out.push(mesh);
      }
    }
    this.lists = { cast: [], flat: [], glow: [] };
    return out;
  }
  static material() {
    if (!Batcher._mat) Batcher._mat = toon({ vertexColors: true });
    return Batcher._mat;
  }
  // Shared by every batch: drive .emissive / .emissiveIntensity from the day cycle.
  static glowMaterial() {
    if (!Batcher._glow) Batcher._glow = toon({ vertexColors: true, emissive: 0xffc46b, emissiveIntensity: 0 });
    return Batcher._glow;
  }
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// A painted shop sign: rounded board, inset border, lettering with a soft
// drop shadow. style: 'sans' (default) or 'serif' for the older buildings.
// Returns the mesh (not batched — it needs its own texture).
export function signMesh(text, { w = 4, h = 1, bg = '#2b2b2b', fg = '#ffffff', font = 'bold', px = 96, border = null, style = 'sans', glow = false } = {}) {
  const cw = 512, ch = Math.max(64, Math.round(512 * h / w));
  const family = style === 'serif'
    ? "Georgia, 'Times New Roman', serif"
    : "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const tex = canvasTexture(cw, ch, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    // subtle top highlight + bottom shade so it reads as a raised board
    const grd = ctx.createLinearGradient(0, 0, 0, ch);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)'); grd.addColorStop(0.5, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, cw, ch);
    const inset = Math.max(6, ch * 0.08);
    ctx.lineWidth = Math.max(3, ch * 0.035);
    ctx.strokeStyle = border || 'rgba(255,255,255,0.35)';
    roundRect(ctx, inset, inset, cw - inset * 2, ch - inset * 2, inset);
    ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = Math.min(px, ch * 0.58);
    const setFont = () => { ctx.font = `${font} ${size}px ${family}`; };
    setFont();
    if (style === 'serif') { try { ctx.letterSpacing = '2px'; } catch (e) { /* older canvases */ } }
    while (ctx.measureText(text).width > cw * 0.84 && size > 12) { size -= 2; setFont(); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(text, cw / 2 + size * 0.04, ch / 2 + 2 + size * 0.06);
    ctx.fillStyle = fg;
    ctx.fillText(text, cw / 2, ch / 2 + 2);
  });
  const mat = glow ? toon({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 }) : toon({ map: tex });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  if (glow) m.userData.nightGlow = true;
  return m;
}
