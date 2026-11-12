// PBR material library for the proof. Every texture set is three WebP maps:
//   <name>_col  albedo (sRGB)
//   <name>_nrm  normal map (OpenGL +Y)
//   <name>_arm  R = ambient occlusion, G = roughness, B = metalness
// Meshes built here get UVs in world metres (uvFromBox) so one material per
// set serves every building, with vertex colours for the pastel tints.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TEX_DIR = 'assets/textures/';
const loader = new THREE.TextureLoader();
const sets = new Map();
let anisotropy = 4;
export function setAnisotropy(a) { anisotropy = a; for (const s of sets.values()) for (const t of [s.col, s.nrm, s.arm]) { t.anisotropy = a; t.needsUpdate = true; } }

function tex(name, srgb) {
  const t = loader.load(TEX_DIR + name + '.webp');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.flipY = false;
  return t;
}
// A texture set: { col, nrm, arm, size } where size = metres one tile covers.
export function textureSet(name, size = 2) {
  let s = sets.get(name);
  if (!s) { s = { name, col: tex(name + '_col', true), nrm: tex(name + '_nrm', false), arm: tex(name + '_arm', false), size }; sets.set(name, s); }
  return s;
}
export function pbr(name, { size = 2, roughness = 1, normalScale = 1, vertexColors = true, color = 0xffffff, side = THREE.FrontSide, envMapIntensity = 1, ...rest } = {}) {
  const s = textureSet(name, size);
  const m = new THREE.MeshStandardMaterial({
    map: s.col, normalMap: s.nrm, aoMap: s.arm, roughnessMap: s.arm, metalnessMap: s.arm,
    roughness, metalness: 1, color, vertexColors, side, envMapIntensity,
    normalScale: new THREE.Vector2(normalScale, normalScale), ...rest
  });
  m.userData.set = s;
  return m;
}
// Plain coloured PBR (trims, metal, painted wood without a texture).
export function plain(color, { roughness = 0.7, metalness = 0, vertexColors = false, ...rest } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, vertexColors, ...rest });
}

/* ---------- geometry helpers ---------- */
const _n = new THREE.Vector3();
// Assign UVs (in metres / tile size) from each vertex's dominant normal axis.
// Works on BoxGeometry / RoundedBoxGeometry in local space; call before transforming.
export function uvFromBox(geo, tile = 2, offset = [0, 0]) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    _n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u / tile + offset[0]; uv[i * 2 + 1] = v / tile + offset[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const _c = new THREE.Color();
// `color` may be a hex or a THREE.Color; components above 1 brighten the albedo (handy for dark scans).
export function tintGeometry(geo, color) {
  if (color && color.isColor) _c.copy(color); else _c.set(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Collects geometry per material and merges into one mesh per material.
export class Batch {
  constructor() { this.groups = new Map(); this.colliders = []; }
  // Rounded box: centre (x,y,z), size (w,h,d), options { bevel, tile, tint, rot: [rx,ry,rz], collide, cast, uvOffset }
  box(mat, x, y, z, w, h, d, { bevel = 0.02, tile = null, tint = 0xffffff, rot = null, collide = false, cast = true, uvOffset = [0, 0], segments = 2 } = {}) {
    const r = Math.min(bevel, w / 2.2, h / 2.2, d / 2.2);
    const geo = r > 0.001 ? new RoundedBoxGeometry(w, h, d, segments, r) : new THREE.BoxGeometry(w, h, d);
    const t = tile || (mat.userData.set ? mat.userData.set.size : 2);
    uvFromBox(geo, t, uvOffset);
    tintGeometry(geo, tint);
    const m = new THREE.Matrix4();
    if (rot) m.makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
    m.setPosition(x, y, z);
    geo.applyMatrix4(m);
    this.add(mat, geo, cast);
    if (collide) this.colliders.push({ type: 'box', x, y, z, w, h, d, rot });
    return geo;
  }
  // Box from min/max extents.
  span(mat, x0, x1, y0, y1, z0, z1, opts = {}) {
    return this.box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), opts);
  }
  geom(mat, geo, { tint = 0xffffff, matrix = null, cast = true, tile = null } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (tile) uvFromBox(g, tile);
    tintGeometry(g, tint);
    if (matrix) g.applyMatrix4(matrix);
    this.add(mat, g, cast);
  }
  add(mat, geo, cast = true) {
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.color) tintGeometry(geo, 0xffffff);
    const key = cast ? mat : mat.uuid + ':flat';
    let g = this.groups.get(key);
    if (!g) { g = { mat, cast, list: [] }; this.groups.set(key, g); }
    g.list.push(geo.index ? geo.toNonIndexed() : geo);
  }
  build(scene) {
    const out = [];
    for (const g of this.groups.values()) {
      for (let i = 0; i < g.list.length; i += 600) {
        const merged = mergeGeometries(g.list.slice(i, i + 600), false);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, g.mat);
        mesh.castShadow = g.cast; mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        scene.add(mesh);
        out.push(mesh);
      }
    }
    this.groups.clear();
    return out;
  }
}

/* ---------- canvas textures (signs, posters) ---------- */
export function canvasTexture(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  return t;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// A painted wooden sign board with lettering; returns a Mesh (w × h metres).
export function signMesh(text, { w = 3, h = 0.8, bg = '#2f4a3a', fg = '#f6ecd2', serif = true, border = '#d9b56a' } = {}) {
  const cw = 1024, ch = Math.max(96, Math.round(1024 * h / w));
  const t = canvasTexture(cw, ch, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    const g = ctx.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    const inset = ch * 0.1; ctx.lineWidth = ch * 0.035; ctx.strokeStyle = border;
    roundRect(ctx, inset, inset, cw - inset * 2, ch - inset * 2, inset * 0.6); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = ch * 0.5;
    const fam = serif ? "Georgia, 'Times New Roman', serif" : "'Inter', system-ui, sans-serif";
    const set = () => { ctx.font = `${serif ? '' : 'bold '}${size}px ${fam}`; };
    set(); while (ctx.measureText(text).width > cw * 0.8 && size > 10) { size -= 2; set(); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText(text, cw / 2 + size * 0.03, ch / 2 + size * 0.05);
    ctx.fillStyle = fg; ctx.fillText(text, cw / 2, ch / 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.castShadow = true;
  return m;
}
