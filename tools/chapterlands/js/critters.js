// Blocky characters and items for quests and districts, in the town's toon
// style. Every model is our own (boxes), built from the book's descriptions —
// no film designs. Each builder returns a THREE.Group whose origin sits on
// the ground, facing +z.
import * as THREE from 'three';
import { toon, addOutline } from './gfx.js';
import { canvasTexture } from './world.js';
import { buildCharacter } from './player.js';

const mats = {};
function mat(c, extra) {
  const k = c + (extra ? JSON.stringify(extra) : '');
  return mats[k] || (mats[k] = toon(Object.assign({ color: c }, extra || {})));
}
function box(g, w, h, d, c, x, y, z, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, extra));
  m.position.set(x, y, z); m.castShadow = true;
  g.add(m);
  return m;
}

// The White Rabbit: white, pink eyes, a waistcoat with a pocket watch (from
// the book's own description). Waistcoat in plain tan — nothing like a film's.
export function rabbit({ coat = 0xf7f3ea, waistcoat = 0xb08a5a, eyes = 0xd8457a, watch = true, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  box(body, 0.55, 0.62, 0.42, coat, 0, 0.55, 0);                  // body
  if (waistcoat !== null) box(body, 0.58, 0.36, 0.44, waistcoat, 0, 0.62, 0.01);
  box(body, 0.46, 0.42, 0.42, coat, 0, 1.06, 0.04);               // head
  box(body, 0.18, 0.12, 0.08, 0xf2c4cf, 0, 0.98, 0.27);           // nose/muzzle
  box(body, 0.08, 0.08, 0.04, eyes, -0.12, 1.12, 0.25);
  box(body, 0.08, 0.08, 0.04, eyes, 0.12, 1.12, 0.25);
  const earL = box(body, 0.12, 0.5, 0.06, coat, -0.12, 1.5, 0.0);
  const earR = box(body, 0.12, 0.5, 0.06, coat, 0.12, 1.5, 0.0);
  box(earL, 0.07, 0.4, 0.02, 0xf2c4cf, 0, 0, 0.035);
  box(earR, 0.07, 0.4, 0.02, 0xf2c4cf, 0, 0, 0.035);
  box(body, 0.2, 0.2, 0.18, 0xffffff, 0, 0.42, -0.26);           // tail
  const feetL = box(g, 0.18, 0.12, 0.36, coat, -0.15, 0.06, 0.06);
  const feetR = box(g, 0.18, 0.12, 0.36, coat, 0.15, 0.06, 0.06);
  box(body, 0.12, 0.34, 0.12, coat, -0.32, 0.72, 0.06);
  box(body, 0.12, 0.34, 0.12, coat, 0.32, 0.72, 0.06);
  if (watch) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 14), mat(0xffd23f, { emissive: 0x6b4a00, emissiveIntensity: 0.4 }));
    w.rotation.x = Math.PI / 2; w.position.set(0.18, 0.66, 0.24); body.add(w);
  }
  addOutline(g);
  g.scale.setScalar(scale);
  g.userData.anim = (t, moving) => {
    const hop = moving ? Math.abs(Math.sin(t * 9)) * 0.35 : 0;
    body.position.y = hop;
    feetL.position.y = feetR.position.y = 0.06 + hop * 0.6;
    earL.rotation.x = earR.rotation.x = moving ? -0.3 : Math.sin(t * 2) * 0.08;
  };
  return g;
}

// A toy horse (the Skin Horse, rocking horses) or a real horse (Black Beauty).
export function horse({ coat = 0x8a5a3a, mane = 0x3a2416, bald = false, rocker = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  box(body, 0.7, 0.6, 1.5, coat, 0, 1.15, 0);
  if (bald) { box(body, 0.3, 0.05, 0.4, 0xb08a6a, 0.2, 1.46, -0.2); box(body, 0.25, 0.05, 0.3, 0xb08a6a, -0.15, 1.46, 0.35); }
  const neck = box(body, 0.36, 0.7, 0.4, coat, 0, 1.6, 0.62);
  neck.rotation.x = -0.4;
  box(body, 0.38, 0.38, 0.7, coat, 0, 1.95, 0.95);                 // head
  box(body, 0.1, 0.5, 0.36, mane, 0, 1.75, 0.5);                   // mane
  box(body, 0.1, 0.18, 0.08, coat, -0.12, 2.2, 0.75); box(body, 0.1, 0.18, 0.08, coat, 0.12, 2.2, 0.75);
  box(body, 0.06, 0.06, 0.04, 0x1b1b1b, -0.2, 2.02, 1.12); box(body, 0.06, 0.06, 0.04, 0x1b1b1b, 0.2, 2.02, 1.12);
  const tail = box(body, 0.12, 0.6, 0.12, mane, 0, 1.0, -0.8); tail.rotation.x = 0.4;
  const legs = [];
  for (const [x, z] of [[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.55], [0.24, -0.55]]) legs.push(box(body, 0.16, 0.85, 0.16, coat, x, 0.45, z));
  if (rocker) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 6, 24, Math.PI * 0.55), mat(0x7a4e30));
    r.rotation.set(0, Math.PI / 2, Math.PI * 1.225); r.position.set(0, 1.15, 0); g.add(r);
    body.position.y = 0.05;
  }
  addOutline(g);
  g.scale.setScalar(scale);
  g.userData.anim = (t, moving) => {
    if (rocker) { body.rotation.x = Math.sin(t * 2) * 0.06; return; }
    legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 8 + (i % 3) * 1.6) * 0.5 : 0; });
    tail.rotation.z = Math.sin(t * 1.7) * 0.15;
  };
  return g;
}

// A storybook "person" NPC using the player rig.
export function person(look = {}, scale = 0.86) {
  const rig = buildCharacter(look);
  rig.root.scale.setScalar(scale);
  addOutline(rig.root);
  const g = new THREE.Group();
  g.add(rig.root);
  g.userData.rig = rig;
  g.userData.blob = rig.blob;
  g.userData.anim = (t, moving) => {
    rig.armL.rotation.x = moving ? Math.sin(t * 7) * 0.6 : Math.sin(t * 1.4) * 0.05;
    rig.armR.rotation.x = moving ? -Math.sin(t * 7) * 0.6 : -Math.sin(t * 1.4) * 0.05;
    rig.legL.rotation.x = moving ? -Math.sin(t * 7) * 0.6 : 0;
    rig.legR.rotation.x = moving ? Math.sin(t * 7) * 0.6 : 0;
  };
  return g;
}

// A closed book lying flat (or standing), its cover in a quarter's colour
// with that quarter's icon — used by the Lost Books quest.
const coverTex = {};
export function bookItem(colour = '#7B4FB5', icon = '📚', { scale = 1 } = {}) {
  const key = colour + icon;
  const tex = coverTex[key] || (coverTex[key] = canvasTexture(128, 160, (ctx) => {
    ctx.fillStyle = colour; ctx.fillRect(0, 0, 128, 160);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 108, 140);
    ctx.font = '64px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, 64, 82);
  }));
  const g = new THREE.Group();
  const cover = toon({ map: tex });
  const plain = mat(new THREE.Color(colour).getHex());
  const pages = mat(0xf7f0dc);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.18), [plain, pages, pages, pages, cover, cover]);
  m.castShadow = true; m.position.y = 0.45;
  g.add(m);
  addOutline(g);
  g.scale.setScalar(scale);
  return g;
}

// A small glowing pickup (hair, flower, straw, page…): a coloured gem with a halo.
export function trinket(colour = 0xffd23f, shape = 'gem') {
  const g = new THREE.Group();
  let geo;
  if (shape === 'strand') geo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 5);
  else if (shape === 'flower') geo = new THREE.DodecahedronGeometry(0.22, 0);
  else if (shape === 'page') geo = new THREE.BoxGeometry(0.45, 0.6, 0.03);
  else geo = new THREE.OctahedronGeometry(0.25, 0);
  const m = new THREE.Mesh(geo, toon({ color: colour, emissive: colour, emissiveIntensity: 0.35 }));
  m.position.y = 0.7; m.castShadow = true;
  if (shape === 'strand') m.rotation.z = 0.6;
  g.add(m);
  addOutline(g);
  g.userData.spin = m;
  return g;
}

// A small fairy: a flowery dress and two soft, glowing wings (our own design).
export function fairy({ dress = 0xf4f0ff, hair = 0xf2d38a, glow = 0xbfe6ff, scale = 0.75 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const dressM = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 6), mat(dress, { emissive: dress, emissiveIntensity: 0.25 }));
  dressM.position.y = 0.95; body.add(dressM);
  box(body, 0.34, 0.34, 0.3, 0xf0c8a0, 0, 1.55, 0);
  box(body, 0.38, 0.14, 0.34, hair, 0, 1.76, 0);
  for (const c of [0xff9ec4, 0xffe27a, 0x9fe0b0]) box(body, 0.1, 0.1, 0.1, c, (c % 3 - 1) * 0.12, 1.86, 0.05);
  const wingMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), wingMat), wR = wL.clone();
  wL.position.set(-0.3, 1.35, -0.2); wR.position.set(0.3, 1.35, -0.2);
  wL.rotation.y = 0.6; wR.rotation.y = -0.6;
  body.add(wL, wR);
  addOutline(g, { skip: (m) => m === wL || m === wR });
  g.scale.setScalar(scale);
  g.userData.anim = (t) => {
    body.position.y = 0.4 + Math.sin(t * 2.2) * 0.15;
    wL.rotation.y = 0.6 + Math.sin(t * 14) * 0.4; wR.rotation.y = -0.6 - Math.sin(t * 14) * 0.4;
  };
  return g;
}

// Build an NPC from a {kind, ...} description (config.npcs or book.json npcs).
// Colours in book.json may be written "0x8a5a3a" or "#8a5a3a".
function normLook(look = {}) {
  const out = {};
  for (const [k, v] of Object.entries(look)) out[k] = typeof v === 'string' && /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : v;
  return out;
}
export function buildNPC(d) {
  const L = normLook(d.look);
  if (d.scale && d.kind !== 'person') L.scale = d.scale;
  switch (d.kind) {
    case 'rabbit': return rabbit(L);
    case 'horse': return horse(L);
    case 'fairy': return fairy(L);
    case 'child': return person(L, 0.68);
    case 'person': default: return person(L, d.scale || 0.86);
  }
}
