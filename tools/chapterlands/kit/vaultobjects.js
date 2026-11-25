// Furniture for Vault / PUZZLE stations: each clue object gets a real piece
// built from boxes and low-poly shapes, turned to face into the room.
// face: rotation (0 = facing +z, ±π/2 = facing ±x). Shapes are drawn in a
// local frame (u across, v depth, +v toward the room) and rotated into place.
import * as THREE from 'three';
import { hex } from './props.js';

const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const DODE = new THREE.DodecahedronGeometry(1, 0);
const tint = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();

export function vaultObject(name, B, W, x, z, face, P) {
  const c = Math.round(Math.cos(face)), s = Math.round(Math.sin(face));
  // local (u, v) → world (x, z); v points into the room
  const at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  const box = (u0, u1, y0, y1, v0, v1, col, opts) => {
    const [ax, az] = at(u0, v0), [bx, bz] = at(u1, v1);
    B.box(Math.min(ax, bx), Math.max(ax, bx), y0, y1, Math.min(az, bz), Math.max(az, bz), col, opts);
  };
  const geom = (g, col, u, y, v, sx, sy, sz, extra = {}) => { const [px, pz] = at(u, v); B.geom(g, col, Object.assign({ x: px, y, z: pz, sx, sy, sz, ry: face }, extra)); };
  const solid = (u0, u1, y1, v0, v1) => { if (!W) return; const [ax, az] = at(u0, v0), [bx, bz] = at(u1, v1); W.add(Math.min(ax, bx), Math.max(ax, bx), 0, y1, Math.min(az, bz), Math.max(az, bz)); };
  const wood = hex(P.wood), dark = tint(P.wood, 0.7), trim = hex(P.trim), acc = hex(P.accent), acc2 = hex(P.accent2), paper = 0xf6efdc;
  const books = [P.accent, P.accent2, P.roof, '#3a6b4a', '#6a4a80', '#c9a24a'].map(hex);
  const frame = (y0, y1, half, inner) => { box(-half, half, y0, y1, -0.08, 0.02, trim); box(-half + 0.1, half - 0.1, y0 + 0.1, y1 - 0.1, 0.02, 0.05, inner, { cast: false }); };
  const easel = (inner) => {
    for (const u of [-0.45, 0.45]) box(u - 0.04, u + 0.04, 0, 1.9, -0.1, -0.02, dark);
    box(-0.05, 0.05, 0, 1.8, -0.5, -0.42, dark);
    frame(0.8, 1.85, 0.6, inner);
    box(-0.55, 0.55, 0.72, 0.8, -0.08, 0.06, dark);
  };
  switch (name) {
    case 'desk': case 'table':
      box(-0.9, 0.9, 0.78, 0.86, -0.55, 0.55, wood);
      for (const [a, b] of [[-0.8, -0.45], [0.8, -0.45], [-0.8, 0.45], [0.8, 0.45]]) box(a - 0.05, a + 0.05, 0, 0.78, b - 0.05, b + 0.05, dark);
      if (name === 'desk') { box(-0.85, -0.2, 0.3, 0.78, -0.5, 0.5, wood); box(-0.6, -0.1, 0.86, 0.92, -0.1, 0.3, paper, { cast: false }); geom(CYL, 0x2a2a2a, 0.5, 0.95, 0, 0.05, 0.18, 0.05); }
      else { geom(CYL, 0xffffff, 0.3, 0.88, 0.1, 0.18, 0.03, 0.18); geom(CYL, acc, -0.3, 0.95, -0.1, 0.08, 0.18, 0.08); }
      solid(-0.9, 0.9, 0.86, -0.55, 0.55); break;
    case 'book': {
      // a lectern with an open book
      box(-0.12, 0.12, 0, 1.0, -0.12, 0.12, dark);
      box(-0.35, 0.35, 0, 0.06, -0.3, 0.3, dark);
      box(-0.45, 0.45, 1.0, 1.08, -0.35, 0.35, wood);
      box(-0.4, -0.02, 1.08, 1.13, -0.28, 0.28, paper, { cast: false }); box(0.02, 0.4, 1.08, 1.13, -0.28, 0.28, 0xfaf4e4, { cast: false });
      for (let k = 0; k < 4; k++) box(-0.33, -0.08, 1.131, 1.135, -0.2 + k * 0.1, -0.18 + k * 0.1, 0x9a9488, { cast: false });
      solid(-0.45, 0.45, 1.13, -0.35, 0.35); break;
    }
    case 'shelf': case 'bookcase':
      box(-0.9, 0.9, 0, 2.2, -0.35, 0.05, wood);
      for (let y = 0.3; y < 2.0; y += 0.5) for (let u = -0.8; u < 0.75; u += 0.16) box(u, u + 0.13, y, y + 0.36, -0.28, 0.08, books[Math.abs(Math.round((u + 1) * 7 + y * 3)) % books.length], { cast: false });
      solid(-0.9, 0.9, 2.2, -0.35, 0.05); break;
    case 'box': case 'chest': case 'trunk': case 'toy': {
      const col = name === 'box' ? 0xb7834a : name === 'toy' ? acc : tint(P.wood, 0.9);
      box(-0.55, 0.55, 0, 0.55, -0.38, 0.38, col);
      box(-0.58, 0.58, 0.55, 0.75, -0.4, 0.4, tint(col, 1.1));
      box(-0.58, 0.58, 0.2, 0.26, -0.4, 0.4, 0x4a3a2a, { cast: false });
      box(-0.08, 0.08, 0.4, 0.62, 0.39, 0.43, 0xd9b44a, { cast: false });
      solid(-0.58, 0.58, 0.75, -0.4, 0.4); break;
    }
    case 'safe':
      box(-0.5, 0.5, 0, 1.1, -0.45, 0.45, 0x4a5058);
      geom(CYL, 0xc9a24a, 0, 0.6, 0.47, 0.18, 0.06, 0.18, { rx: Math.PI / 2 });
      box(0.25, 0.32, 0.4, 0.8, 0.45, 0.5, 0xc9a24a, { cast: false });
      solid(-0.5, 0.5, 1.1, -0.45, 0.45); break;
    case 'barrel':
      geom(CYL, 0x8a5a3a, 0, 0.6, 0, 0.42, 1.2, 0.42);
      for (const y of [0.2, 1.0]) geom(CYL, 0x444444, 0, y, 0, 0.44, 0.07, 0.44, { cast: false });
      solid(-0.4, 0.4, 1.2, -0.4, 0.4); break;
    case 'chair':
      box(-0.3, 0.3, 0.45, 0.52, -0.3, 0.3, wood);
      box(-0.3, 0.3, 0.52, 1.15, -0.3, -0.24, wood);
      for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) box(a - 0.04, a + 0.04, 0, 0.45, b - 0.04, b + 0.04, dark);
      box(-0.25, 0.25, 0.52, 0.6, -0.25, 0.25, acc, { cast: false });
      solid(-0.3, 0.3, 0.6, -0.3, 0.3); break;
    case 'clock':
      box(-0.4, 0.4, 0, 2.3, -0.3, 0.2, dark);
      box(-0.45, 0.45, 2.3, 2.45, -0.33, 0.23, wood);
      geom(CYL, 0xfff6d8, 0, 1.85, 0.21, 0.3, 0.03, 0.3, { rx: Math.PI / 2, cast: false });
      box(-0.02, 0.02, 1.85, 2.05, 0.23, 0.24, 0x222222, { cast: false });
      box(-0.15, 0.15, 0.4, 1.3, 0.2, 0.22, 0x2a2018, { cast: false });
      geom(CYL, 0xc9a24a, 0, 0.75, 0.23, 0.1, 0.02, 0.1, { rx: Math.PI / 2, cast: false });
      solid(-0.4, 0.4, 2.45, -0.3, 0.2); break;
    case 'statue':
      box(-0.5, 0.5, 0, 0.8, -0.5, 0.5, hex(P.stone));
      geom(CYL, tint(P.stone, 1.08), 0, 1.4, 0, 0.28, 1.2, 0.24);
      geom(ICO, tint(P.stone, 1.12), 0, 2.2, 0, 0.3, 0.32, 0.3);
      solid(-0.5, 0.5, 2.4, -0.5, 0.5); break;
    case 'lamp':
      geom(CYL, 0x2f3b3a, 0, 0.8, 0, 0.05, 1.6, 0.05);
      geom(CYL, 0x2f3b3a, 0, 0.05, 0, 0.25, 0.1, 0.25);
      geom(new THREE.ConeGeometry(1, 1, 10, 1, true), 0xffe2a0, 0, 1.75, 0, 0.35, 0.4, 0.35, { bucket: 'glow', shade: false });
      solid(-0.25, 0.25, 1.9, -0.25, 0.25); break;
    case 'plant': case 'tree':
      geom(CYL, 0xc0563a, 0, 0.3, 0, 0.3, 0.6, 0.3);
      geom(CYL, hex(P.wood), 0, 0.9, 0, 0.06, 0.8, 0.06);
      geom(ICO, hex(P.leaf), 0, 1.5, 0, 0.6, 0.55, 0.6);
      geom(ICO, tint(P.leaf, 1.12), 0.25, 1.75, 0.1, 0.35, 0.3, 0.35);
      solid(-0.3, 0.3, 0.6, -0.3, 0.3); break;
    case 'rock': case 'log':
      if (name === 'rock') geom(DODE, hex(P.stone), 0, 0.45, 0, 0.7, 0.5, 0.6);
      else { geom(CYL, hex(P.wood), 0, 0.35, 0, 0.35, 1.6, 0.35, { rz: Math.PI / 2 }); }
      solid(-0.8, 0.8, 0.8, -0.5, 0.5); break;
    case 'scales':
      box(-0.5, 0.5, 0.78, 0.84, -0.4, 0.4, wood); box(-0.45, 0.45, 0, 0.78, -0.35, 0.35, dark);
      geom(CYL, 0xc9a24a, 0, 1.15, 0, 0.03, 0.6, 0.03); box(-0.4, 0.4, 1.42, 1.45, -0.02, 0.02, 0xc9a24a);
      for (const u of [-0.38, 0.38]) geom(CYL, 0xc9a24a, u, 1.1, 0, 0.16, 0.03, 0.16);
      solid(-0.5, 0.5, 0.84, -0.4, 0.4); break;
    case 'telescope':
      for (const a of [0, 2.1, 4.2]) geom(CYL, dark, Math.cos(a) * 0.2, 0.55, Math.sin(a) * 0.2, 0.03, 1.1, 0.03);
      geom(CYL, 0xc9a24a, 0, 1.25, 0, 0.1, 1.0, 0.1, { rx: 1.1 });
      solid(-0.3, 0.3, 1.5, -0.3, 0.3); break;
    case 'bed':
      box(-0.8, 0.8, 0, 0.5, -1.0, 1.0, wood); box(-0.75, 0.75, 0.5, 0.68, -0.95, 0.95, acc2); box(-0.55, 0.55, 0.68, 0.82, -0.9, -0.5, 0xffffff);
      solid(-0.8, 0.8, 0.68, -1.0, 1.0); break;
    case 'door':
      box(-0.6, 0.6, 0, 2.3, -0.12, 0.0, trim); box(-0.5, 0.5, 0.05, 2.2, 0.0, 0.05, wood);
      for (const y of [0.4, 1.3]) box(-0.4, 0.4, y, y + 0.7, 0.05, 0.07, tint(P.wood, 0.85), { cast: false });
      geom(ICO, 0xc9a24a, 0.35, 1.1, 0.1, 0.06, 0.06, 0.06);
      solid(-0.6, 0.6, 2.3, -0.12, 0.08); break;
    case 'window':
      box(-0.75, 0.75, 0.7, 2.3, -0.1, 0.0, trim); box(-0.65, 0.65, 0.8, 2.2, 0.0, 0.02, 0xcfe9ff, { bucket: 'glow', shade: false });
      box(-0.03, 0.03, 0.8, 2.2, 0.02, 0.05, trim, { cast: false }); box(-0.65, 0.65, 1.47, 1.53, 0.02, 0.05, trim, { cast: false });
      box(-0.8, 0.8, 0.65, 0.72, -0.1, 0.25, trim);
      solid(-0.8, 0.8, 2.3, -0.1, 0.25); break;
    case 'mirror':
      box(-0.45, 0.45, 0, 2.0, -0.12, -0.02, trim); box(-0.35, 0.35, 0.2, 1.9, -0.02, 0.0, 0xcfe0ea, { cast: false });
      box(-0.3, 0.3, 0.9, 1.6, 0.0, 0.01, 0xe8f2f8, { cast: false });
      solid(-0.45, 0.45, 2.0, -0.12, 0.05); break;
    case 'picture': easel(acc2); solid(-0.6, 0.6, 1.9, -0.5, 0.1); break;
    case 'map': easel(0xe8d3a0); box(-0.3, 0.2, 1.2, 1.5, 0.05, 0.06, 0x7a9a5a, { cast: false }); solid(-0.6, 0.6, 1.9, -0.5, 0.1); break;
    case 'board': easel(0x25302a); for (let k = 0; k < 3; k++) box(-0.35, 0.3 - k * 0.1, 1.45 - k * 0.15, 1.48 - k * 0.15, 0.05, 0.06, 0xf4f1e6, { cast: false }); solid(-0.6, 0.6, 1.9, -0.5, 0.1); break;
    case 'note':
      box(-0.35, 0.35, 0.78, 0.84, -0.35, 0.35, wood); box(-0.08, 0.08, 0, 0.78, -0.08, 0.08, dark); box(-0.35, 0.35, 0, 0.05, -0.35, 0.35, dark);
      box(-0.2, 0.15, 0.84, 0.86, -0.15, 0.2, paper, { cast: false });
      solid(-0.35, 0.35, 0.86, -0.35, 0.35); break;
    case 'sign':
      box(-0.05, 0.05, 0, 1.5, -0.05, 0.05, dark); box(-0.6, 0.6, 1.2, 1.9, 0.05, 0.12, wood); box(-0.5, 0.5, 1.3, 1.8, 0.12, 0.13, paper, { cast: false });
      solid(-0.3, 0.3, 1.9, -0.2, 0.2); break;
    case 'well':
      geom(CYL, hex(P.stone), 0, 0.45, 0, 0.7, 0.9, 0.7); geom(CYL, 0x1a2a3a, 0, 0.91, 0, 0.55, 0.02, 0.55, { cast: false });
      for (const u of [-0.6, 0.6]) box(u - 0.06, u + 0.06, 0.9, 2.0, -0.06, 0.06, dark);
      box(-0.8, 0.8, 1.9, 2.1, -0.5, 0.5, hex(P.roof));
      solid(-0.75, 0.75, 1.0, -0.75, 0.75); break;
    default:
      box(-0.55, 0.55, 0, 0.95, -0.55, 0.55, acc); box(-0.6, 0.6, 0.95, 1.02, -0.6, 0.6, trim);
      solid(-0.6, 0.6, 1.02, -0.6, 0.6);
  }
}
