// Shared world helpers: axis-aligned colliders, a static-geometry batcher that
// merges every box into a few draw calls (vertex-coloured), canvas textures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

// Collects coloured box geometry and merges it into one mesh per shadow bucket.
export class Batcher {
  constructor() {
    this.cast = [];     // geometries that cast + receive shadows
    this.flat = [];     // receive only (ground, roads, decals)
  }
  // Add an arbitrary geometry with a uniform colour and transform.
  geom(geometry, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true } = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(_m);
    _c.set(color);
    // vertex colours are linear; convert from sRGB hex
    _c.convertSRGBToLinear();
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = _c.r; cols[i * 3 + 1] = _c.g; cols[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    (cast ? this.cast : this.flat).push(g);
  }
  // Box from min/max extents.
  box(x0, x1, y0, y1, z0, z1, color, opts = {}) {
    this.geom(BOX, color, Object.assign({
      x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2,
      sx: Math.abs(x1 - x0), sy: Math.abs(y1 - y0), sz: Math.abs(z1 - z0)
    }, opts));
  }
  // Box from centre + size.
  cbox(x, y, z, w, h, d, color, opts = {}) {
    this.geom(BOX, color, Object.assign({ x, y, z, sx: w, sy: h, sz: d }, opts));
  }
  build(scene) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const out = [];
    for (const [list, cast] of [[this.cast, true], [this.flat, false]]) {
      if (!list.length) continue;
      // chunk to keep individual buffers a sensible size
      for (let i = 0; i < list.length; i += 400) {
        const merged = mergeGeometries(list.slice(i, i + 400), false);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = cast;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        scene.add(mesh);
        out.push(mesh);
      }
    }
    this.cast = []; this.flat = [];
    return out;
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

// A flat textured sign. Returns the mesh (not batched — it needs its own texture).
export function signMesh(text, { w = 4, h = 1, bg = '#2b2b2b', fg = '#ffffff', font = 'bold', px = 96, border = null } = {}) {
  const cw = 512, ch = Math.max(64, Math.round(512 * h / w));
  const tex = canvasTexture(cw, ch, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 10; ctx.strokeRect(5, 5, cw - 10, ch - 10); }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = Math.min(px, ch * 0.62);
    ctx.font = `${font} ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    while (ctx.measureText(text).width > cw * 0.9 && size > 12) {
      size -= 2;
      ctx.font = `${font} ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    }
    ctx.fillText(text, cw / 2, ch / 2 + 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  return m;
}
