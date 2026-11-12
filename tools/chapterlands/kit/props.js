// District Kit prop library: blocky procedural props in the town's style,
// tinted by each book's palette (book.json theme.palette). All our own art.
// Each prop draws into the Batcher (one merged mesh per scene) and can add
// colliders. `s` scales the prop.
import * as THREE from 'three';
import { toon } from '../js/gfx.js';

export const DEFAULT_PALETTE = {
  ground: '#8cc47a', ground2: '#7db86b', wall: '#efe3c8', trim: '#7a4e30', roof: '#c0583f',
  accent: '#e9a23b', accent2: '#2f7fd6', wood: '#8a5a3a', leaf: '#5aa24f', stone: '#bfb6a6',
  sky: '#8fc6ec', fog: '#cfe3ef', water: '#3fa6d8', item: '#ffd23f', hazard: '#d8452f'
};
export function pal(theme) { return Object.assign({}, DEFAULT_PALETTE, (theme && theme.palette) || {}); }
export const hex = (c) => (typeof c === 'number' ? c : new THREE.Color(c).getHex());

// seeded random so a street looks the same every visit
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
export function seedOf(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const PROPS = {
  tree(B, W, x, z, s, P) {
    B.box(x - 0.3 * s, x + 0.3 * s, 0, 2.4 * s, z - 0.3 * s, z + 0.3 * s, hex(P.wood));
    B.box(x - 1.4 * s, x + 1.4 * s, 2.0 * s, 3.6 * s, z - 1.4 * s, z + 1.4 * s, hex(P.leaf));
    B.box(x - 0.9 * s, x + 0.9 * s, 3.6 * s, 4.5 * s, z - 0.9 * s, z + 0.9 * s, new THREE.Color(P.leaf).multiplyScalar(1.12).getHex());
    W && W.add(x - 0.35 * s, x + 0.35 * s, 0, 2.4 * s, z - 0.35 * s, z + 0.35 * s, false);
  },
  bush(B, W, x, z, s, P) { B.box(x - 0.9 * s, x + 0.9 * s, 0, 1.1 * s, z - 0.9 * s, z + 0.9 * s, hex(P.leaf)); },
  flower(B, W, x, z, s, P, r) {
    const c = [P.accent, P.accent2, '#ffffff', '#e94f6a'][Math.floor(r() * 4)];
    B.box(x - 0.04, x + 0.04, 0, 0.5 * s, z - 0.04, z + 0.04, hex(P.leaf), { cast: false });
    B.box(x - 0.16 * s, x + 0.16 * s, 0.45 * s, 0.65 * s, z - 0.16 * s, z + 0.16 * s, hex(c), { cast: false });
  },
  rock(B, W, x, z, s, P) {
    B.box(x - 0.8 * s, x + 0.8 * s, 0, 0.7 * s, z - 0.6 * s, z + 0.7 * s, hex(P.stone));
    B.box(x - 0.5 * s, x + 0.5 * s, 0.7 * s, 1.0 * s, z - 0.4 * s, z + 0.4 * s, new THREE.Color(P.stone).multiplyScalar(1.08).getHex());
    W && W.add(x - 0.8 * s, x + 0.8 * s, 0, 1.0 * s, z - 0.6 * s, z + 0.7 * s);
  },
  crate(B, W, x, z, s) {
    B.box(x - 0.5 * s, x + 0.5 * s, 0, 1 * s, z - 0.5 * s, z + 0.5 * s, 0xb7834a);
    B.box(x - 0.52 * s, x + 0.52 * s, 0.85 * s, 0.95 * s, z - 0.52 * s, z + 0.52 * s, 0x7a5230);
    W && W.add(x - 0.5 * s, x + 0.5 * s, 0, 1 * s, z - 0.5 * s, z + 0.5 * s);
  },
  barrel(B, W, x, z, s) {
    B.box(x - 0.4 * s, x + 0.4 * s, 0, 1.1 * s, z - 0.4 * s, z + 0.4 * s, 0x8a5a3a);
    B.box(x - 0.43 * s, x + 0.43 * s, 0.25 * s, 0.33 * s, z - 0.43 * s, z + 0.43 * s, 0x444444);
    B.box(x - 0.43 * s, x + 0.43 * s, 0.8 * s, 0.88 * s, z - 0.43 * s, z + 0.43 * s, 0x444444);
    W && W.add(x - 0.4 * s, x + 0.4 * s, 0, 1.1 * s, z - 0.4 * s, z + 0.4 * s);
  },
  block(B, W, x, z, s, P, r) {    // toy block
    const c = [P.accent, P.accent2, P.roof, '#3fae5c'][Math.floor(r() * 4)];
    B.box(x - 0.45 * s, x + 0.45 * s, 0, 0.9 * s, z - 0.45 * s, z + 0.45 * s, hex(c));
    B.box(x - 0.3 * s, x + 0.3 * s, 0.9 * s, 0.92 * s, z - 0.3 * s, z + 0.3 * s, 0xffffff, { cast: false });
    W && W.add(x - 0.45 * s, x + 0.45 * s, 0, 0.9 * s, z - 0.45 * s, z + 0.45 * s);
  },
  lamp(B, W, x, z, s) {
    B.box(x - 0.08, x + 0.08, 0, 3 * s, z - 0.08, z + 0.08, 0x2f3b3a);
    B.box(x - 0.25, x + 0.25, 3 * s, 3.4 * s, z - 0.25, z + 0.25, 0xffe9a8, { bucket: 'glow', shade: false });
  },
  mushroom(B, W, x, z, s, P) {
    B.box(x - 0.2 * s, x + 0.2 * s, 0, 0.9 * s, z - 0.2 * s, z + 0.2 * s, 0xf3ead6);
    B.box(x - 0.8 * s, x + 0.8 * s, 0.9 * s, 1.3 * s, z - 0.8 * s, z + 0.8 * s, hex(P.hazard));
    B.box(x - 0.15 * s, x + 0.15 * s, 1.3 * s, 1.34 * s, z + 0.3 * s, z + 0.6 * s, 0xffffff, { cast: false });
  },
  fence(B, W, x, z, s, P) {
    for (const d of [-1, 0, 1]) B.box(x + d * 0.8 - 0.06, x + d * 0.8 + 0.06, 0, 1 * s, z - 0.06, z + 0.06, 0xffffff);
    B.box(x - 1, x + 1, 0.65 * s, 0.75 * s, z - 0.05, z + 0.05, 0xffffff);
    B.box(x - 1, x + 1, 0.3 * s, 0.4 * s, z - 0.05, z + 0.05, 0xffffff);
  },
  table(B, W, x, z, s, P) {
    B.box(x - 0.9 * s, x + 0.9 * s, 0.75 * s, 0.85 * s, z - 0.6 * s, z + 0.6 * s, hex(P.wood));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(x + a * 0.8 * s - 0.06, x + a * 0.8 * s + 0.06, 0, 0.75 * s, z + b * 0.5 * s - 0.06, z + b * 0.5 * s + 0.06, hex(P.wood));
    W && W.add(x - 0.9 * s, x + 0.9 * s, 0, 0.85 * s, z - 0.6 * s, z + 0.6 * s, false);
  },
  chair(B, W, x, z, s, P) {
    B.box(x - 0.3, x + 0.3, 0.45, 0.52, z - 0.3, z + 0.3, hex(P.wood));
    B.box(x - 0.3, x + 0.3, 0.52, 1.1, z + 0.24, z + 0.3, hex(P.wood));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(x + a * 0.25 - 0.04, x + a * 0.25 + 0.04, 0, 0.45, z + b * 0.25 - 0.04, z + b * 0.25 + 0.04, hex(P.wood));
  },
  bed(B, W, x, z, s, P) {
    B.box(x - 1 * s, x + 1 * s, 0, 0.55 * s, z - 1.6 * s, z + 1.6 * s, hex(P.wood));
    B.box(x - 0.95 * s, x + 0.95 * s, 0.55 * s, 0.75 * s, z - 1.55 * s, z + 1.55 * s, hex(P.accent2));
    B.box(x - 0.7 * s, x + 0.7 * s, 0.75 * s, 0.95 * s, z - 1.5 * s, z - 0.9 * s, 0xffffff);
    B.box(x - 1 * s, x + 1 * s, 0, 1.3 * s, z - 1.7 * s, z - 1.55 * s, hex(P.wood));
    W && W.add(x - 1 * s, x + 1 * s, 0, 0.75 * s, z - 1.7 * s, z + 1.6 * s);
  },
  bookcase(B, W, x, z, s, P, r) {
    B.box(x - 1 * s, x + 1 * s, 0, 2.4 * s, z - 0.35, z + 0.35, hex(P.wood));
    const cols = [P.accent, P.accent2, P.roof, '#3a6b4a', '#6a4a80'];
    for (let y = 0.25; y < 2.2 * s; y += 0.55 * s) for (let u = -0.85 * s; u < 0.85 * s; u += 0.18 * s) B.box(x + u, x + u + 0.15 * s, y, y + 0.4 * s, z + 0.2, z + 0.37, hex(cols[Math.floor(r() * cols.length)]), { cast: false });
    W && W.add(x - 1 * s, x + 1 * s, 0, 2.4 * s, z - 0.35, z + 0.35);
  },
  cupboard(B, W, x, z, s, P) {
    B.box(x - 1 * s, x + 1 * s, 0, 2.6 * s, z - 0.5 * s, z + 0.5 * s, hex(P.trim));
    B.box(x - 0.04, x + 0.04, 0.2, 2.4 * s, z + 0.5 * s, z + 0.52 * s, 0x2a2420, { cast: false });
    W && W.add(x - 1 * s, x + 1 * s, 0, 2.6 * s, z - 0.5 * s, z + 0.5 * s);
  },
  column(B, W, x, z, s, P) {
    B.box(x - 0.45 * s, x + 0.45 * s, 0, 4 * s, z - 0.45 * s, z + 0.45 * s, hex(P.stone));
    B.box(x - 0.6 * s, x + 0.6 * s, 4 * s, 4.3 * s, z - 0.6 * s, z + 0.6 * s, hex(P.stone));
    W && W.add(x - 0.45 * s, x + 0.45 * s, 0, 4.3 * s, z - 0.45 * s, z + 0.45 * s);
  },
  hedge(B, W, x, z, s, P) {
    B.box(x - 1.5 * s, x + 1.5 * s, 0, 1.6 * s, z - 0.6, z + 0.6, new THREE.Color(P.leaf).multiplyScalar(0.85).getHex());
    W && W.add(x - 1.5 * s, x + 1.5 * s, 0, 1.6 * s, z - 0.6, z + 0.6);
  },
  reeds(B, W, x, z, s, P, r) {
    for (let i = 0; i < 6; i++) { const a = x + (r() - 0.5), b = z + (r() - 0.5); B.box(a - 0.04, a + 0.04, 0, (1 + r()) * s, b - 0.04, b + 0.04, hex(P.leaf), { cast: false }); }
  },
  tent(B, W, x, z, s, P) {
    for (let i = 0; i < 4; i++) B.box(x - (1.4 - i * 0.35) * s, x + (1.4 - i * 0.35) * s, i * 0.5 * s, (i + 1) * 0.5 * s, z - 1.4 * s, z + 1.4 * s, hex(i % 2 ? P.accent : P.wall));
    W && W.add(x - 1.4 * s, x + 1.4 * s, 0, 2 * s, z - 1.4 * s, z + 1.4 * s);
  },
  cart(B, W, x, z, s, P) {
    B.box(x - 1 * s, x + 1 * s, 0.5 * s, 1.2 * s, z - 0.7 * s, z + 0.7 * s, hex(P.wood));
    for (const a of [-1, 1]) B.box(x + a * 0.7 * s - 0.25, x + a * 0.7 * s + 0.25, 0, 0.7 * s, z - 0.75 * s, z + 0.75 * s, 0x3a2a20);
    W && W.add(x - 1 * s, x + 1 * s, 0, 1.2 * s, z - 0.75 * s, z + 0.75 * s);
  },
  statue(B, W, x, z, s, P) {
    B.box(x - 0.6, x + 0.6, 0, 0.8, z - 0.6, z + 0.6, hex(P.stone));
    B.box(x - 0.3, x + 0.3, 0.8, 2.4 * s, z - 0.25, z + 0.25, new THREE.Color(P.stone).multiplyScalar(1.1).getHex());
    B.box(x - 0.22, x + 0.22, 2.4 * s, 2.85 * s, z - 0.22, z + 0.22, new THREE.Color(P.stone).multiplyScalar(1.1).getHex());
    W && W.add(x - 0.6, x + 0.6, 0, 2.85 * s, z - 0.6, z + 0.6);
  }
};
export const PROP_NAMES = Object.keys(PROPS);
export function prop(name, B, W, x, z, s = 1, P = DEFAULT_PALETTE, r = Math.random) {
  (PROPS[name] || PROPS.crate)(B, W, x, z, s, P, r);
}

// Scatter theme props around the edges of a w×d area (keeps the middle clear).
export function decorate(B, W, { w, d, props, P, seed = 1, count = 26, margin = 3, cx = 0, cz = 0, collide = true }) {
  const r = rng(seed);
  const list = props && props.length ? props : ['tree', 'bush', 'flower', 'rock'];
  for (let i = 0; i < count; i++) {
    const side = i % 4;
    const t = r();
    let x, z;
    if (side === 0) { x = cx - w / 2 + t * w; z = cz - d / 2 + r() * margin; }
    else if (side === 1) { x = cx - w / 2 + t * w; z = cz + d / 2 - r() * margin; }
    else if (side === 2) { x = cx - w / 2 + r() * margin; z = cz - d / 2 + t * d; }
    else { x = cx + w / 2 - r() * margin; z = cz - d / 2 + t * d; }
    prop(list[i % list.length], B, collide ? W : null, x, z, 0.8 + r() * 0.5, P, r);
  }
}

/* ---------- emoji sprites for items (readable on any screen) ---------- */
const emojiTex = {};
export function emojiSprite(icon, size = 1) {
  const tex = emojiTex[icon] || (emojiTex[icon] = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#2a2420'; x.lineWidth = 5; x.stroke();
    x.font = '70px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(icon, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })());
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

// A floating pickup: emoji badge over a glowing gem. Returns a Group.
export function pickup(icon, colour = '#ffd23f') {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), toon({ color: hex(colour), emissive: hex(colour), emissiveIntensity: 0.4 }));
  gem.position.y = 0.45;
  const sp = emojiSprite(icon, 0.95);
  sp.position.y = 1.25;
  g.add(gem, sp);
  g.userData.gem = gem; g.userData.sprite = sp;
  return g;
}

// Ground plane with a speckled canvas texture in two palette colours.
export function groundTexture(c1, c2, repeat = 20) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { x.fillStyle = i % 2 ? c2 : c1; x.globalAlpha = 0.6; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2 + Math.random() * 3); }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  return t;
}
