// Lookout Tower prefab (A1 §3). Everything about a tower is data
// (CONFIG.lookoutTowers): which road, how far along, which side, how tall,
// a layout preset and an optional requiresKey. This module turns that into a
// climbable level built from the normal jump (every step is at most 1.25 m up
// with a short gap, so a single jump always works), with a checkpoint pad
// halfway, a top deck and a telescope that lifts the road's fog.
//
// Presets, one per road, each themed to its kind of story:
//   spiral    Fantasy    wooden ledges wind round a stone wizard's tower
//   zigzag    Mystery    a clock tower: ledges switch back and forth up one face
//   treehouse Family     branch platforms round a huge oak, treehouse on top
//   books     Life       a stack of giant books; the spines stick out as steps
//   mast      Adventure  a ship's mast: yard-arms, barrels and a crow's nest
//   stumps    Animals    tree stumps of rising height, a ring of them, then a lookout tree
//   pylon     Sci-Fi     glowing hover-pads round an energy pylon
import * as THREE from 'three';
import { toon, addOutline } from './gfx.js';
import { signMesh } from './world.js';
import { Catalogue } from './catalogue.js';
import { Save } from './save.js';

const RISE = 1.25;      // metres between ledges (a normal jump is 2.2 m)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);

export function buildLookout({ cfg, road, scene, world, B, interactables, hooks }) {
  const Q = road.Q;
  const base = road.at(cfg.at, cfg.side, cfg.offset || 13);
  const cx = base.x, cz = base.z, H = cfg.height;
  const col = new THREE.Color(Q.colour).getHex();
  const preset = PRESETS[cfg.preset] ? cfg.preset : 'spiral';
  const a0 = Math.atan2(road.out.z - cz, road.out.x - cx);   // first step faces the road
  const ctx = { cfg, road, scene, world, B, cx, cz, H, col, a0, ledges: [], extras: [] };
  const P = PRESETS[preset](ctx);
  const { top } = P;
  const ledges = ctx.ledges;
  const checkpoint = ledges[Math.round(ledges.length / 2)] || top;

  // flag on top, visible from the square
  const poleY = P.flagY != null ? P.flagY : top.y + 1.5;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), toon({ color: 0x555555 }));
  pole.position.set(P.flagX != null ? P.flagX : cx, poleY, P.flagZ != null ? P.flagZ : cz); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), toon({ color: col, side: THREE.DoubleSide }));
  flag.geometry.translate(0.8, 0, 0);
  flag.position.set(pole.position.x, poleY + 1, pole.position.z); scene.add(flag);

  // name board at the foot, facing the road
  const sign = signMesh(`LOOKOUT · ${Q.name.toUpperCase()}`, { w: 4.2, h: 0.8, bg: Q.colour, fg: '#fff', glow: true });
  const ry = Math.atan2(road.out.x - cx, road.out.z - cz);
  const sr = P.signR || 2.07;
  sign.position.set(cx + Math.sin(ry) * sr, 2.6, cz + Math.cos(ry) * sr); sign.rotation.y = ry; scene.add(sign);
  if (P.signPosts) {
    for (const k of [-1.9, 1.9]) {
      const px = sign.position.x + Math.cos(ry) * k, pz = sign.position.z - Math.sin(ry) * k;
      B.box(px - 0.09, px + 0.09, 0, 3.0, pz - 0.09, pz + 0.09, 0x6b4a2e);
      world.add(px - 0.12, px + 0.12, 0, 3.0, pz - 0.12, pz + 0.12, false);
    }
  }

  // checkpoint pad (glows once touched)
  const padMat = new THREE.MeshBasicMaterial({ color: 0x7fd6b0, transparent: true, opacity: 0.55 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 20), padMat);
  pad.position.set(checkpoint.x, checkpoint.y + 0.04, checkpoint.z); scene.add(pad);

  // telescope at the top
  const scope = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 10), toon({ color: 0xc9a24a }));
  tube.rotation.z = Math.PI / 2 - 0.35; tube.position.y = 1.35;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), toon({ color: 0x3a2a20 }));
  leg.position.y = 0.6;
  scope.add(tube, leg);
  addOutline(scope);
  const look = road.at(road.len * 0.6);
  scope.position.set(top.x + (P.scopeOff || 0), top.y, top.z);
  scope.rotation.y = Math.atan2(look.z - top.z, -(look.x - top.x));
  scene.add(scope);

  const T = { cfg, road, top, checkpoint, pad, ledges, reached: false, base: { x: cx, z: cz }, gate: null, extras: ctx.extras };
  interactables.push({ x: top.x, z: top.z, y: top.y, r: 2.6, label: 'Look through the telescope', icon: '🔭', iconY: 2.6, act: () => hooks.telescope(T) });

  // requiresKey: a locked gate round the base
  if (cfg.requiresKey) {
    const need = Catalogue.getBook(cfg.requiresKey);
    const r = 7.5;
    const gateC = world.add(cx - r, cx + r, 0, H + 8, cz - r, cz + r, false);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      B.box(x - 0.12, x + 0.12, 0, 1.6, z - 0.12, z + 0.12, 0x5a5f66);
    }
    const gp = road.at(cfg.at, cfg.side, 13 - r - 0.6);
    T.gate = { collider: gateC, need };
    interactables.push({
      x: gp.x, z: gp.z, y: 0, r: 2.4, icon: '🔒', iconY: 2.4,
      get label() { return Save.hasKey(cfg.requiresKey) ? 'Open the tower gate' : 'Locked gate'; },
      act: () => {
        if (Save.hasKey(cfg.requiresKey)) { world.remove(gateC); hooks.toast('The gate swings open!'); return; }
        hooks.toast(`You need the ${need ? Catalogue.keyName(need) : cfg.requiresKey} Key. Finish ${need ? need.title : 'that book'} to earn it.`);
      }
    });
    if (Save.hasKey(cfg.requiresKey)) world.remove(gateC);
  }

  // "back to the checkpoint" pad at the base for anyone who falls
  const back = road.at(cfg.at + 4.5, cfg.side, 6.5);
  const ret = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 18), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6 }));
  ret.position.set(back.x, 0.04, back.z); ret.visible = false; scene.add(ret);
  interactables.push({
    x: back.x, z: back.z, y: 0, r: 1.6, get label() { return T.reached ? 'Back to the checkpoint' : 'Climb the Lookout Tower'; },
    act: () => {
      if (T.reached) hooks.teleport(checkpoint.x, checkpoint.y + 0.05, checkpoint.z);
      else hooks.toast('Jump up to the top!');
    }
  });

  T.update = (dt, t, player) => {
    flag.rotation.y = Math.sin(t * 1.3) * 0.25;
    for (const e of ctx.extras) if (e.update) e.update(dt, t);
    if (!T.reached && Math.hypot(player.pos.x - checkpoint.x, player.pos.z - checkpoint.z) < 1.4 && Math.abs(player.pos.y - checkpoint.y) < 0.6) {
      T.reached = true;
      padMat.color.set(0xffd23f);
      ret.visible = true;
      hooks.toast('Checkpoint!');
      hooks.sfx();
    }
    pad.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
  };
  return T;
}

/* ------------------------------------------------------------------ helpers */

// a flat step the player stands on; records it in the climb path
function plank(ctx, x, y, z, w, d, color, under = 0x6b4a2e) {
  const { B, world } = ctx;
  B.box(x - w / 2, x + w / 2, y - 0.35, y, z - d / 2, z + d / 2, color);
  if (under != null) B.box(x - w / 2 + 0.25, x + w / 2 - 0.25, y - 0.75, y - 0.35, z - d / 2 + 0.25, z + d / 2 - 0.25, under);
  world.add(x - w / 2, x + w / 2, y - 0.35, y, z - d / 2, z + d / 2);
  ctx.ledges.push({ x, y, z, w, d });
}
function crate(ctx, x, y, z, s = 1.8, color = 0xb7834a) {
  const { B, world } = ctx;
  B.box(x - s / 2, x + s / 2, y - 1.0, y, z - s / 2, z + s / 2, color);
  B.box(x - s / 2 - 0.02, x + s / 2 + 0.02, y - 0.95, y - 0.85, z - s / 2 - 0.02, z + s / 2 + 0.02, 0x7a5230);
  world.add(x - s / 2, x + s / 2, y - 1.0, y, z - s / 2, z + s / 2);
  ctx.ledges.push({ x, y, z, w: s, d: s });
}
function cyl(ctx, x, y0, y1, z, r, color, { solid = true, six = false, opts = {} } = {}) {
  ctx.B.geom(six ? CYL6 : CYL, color, Object.assign({ x, y: (y0 + y1) / 2, z, sx: r * 2, sy: y1 - y0, sz: r * 2 }, opts));
  if (solid) ctx.world.add(x - r * 0.85, x + r * 0.85, y0, y1, z - r * 0.85, z + r * 0.85);
}
// points round a circle, rising RISE each step
function ring(ctx, { R, step, n, y0, start = ctx.a0 }) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const a = start + i * step;
    pts.push({ x: ctx.cx + Math.cos(a) * R, y: y0 + i * RISE, z: ctx.cz + Math.sin(a) * R, a });
  }
  return pts;
}
function deck(ctx, size, y, color, rails = 0x8a5a3a) {
  const { B, world, cx, cz } = ctx;
  B.box(cx - size, cx + size, y, y + 0.4, cz - size, cz + size, color);
  world.add(cx - size, cx + size, y, y + 0.4, cz - size, cz + size);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.box(cx + sx * (size - 0.1) - 0.08, cx + sx * (size - 0.1) + 0.08, y + 0.4, y + 1.3, cz + sz * (size - 0.1) - 0.08, cz + sz * (size - 0.1) + 0.08, rails);
  }
  return { x: cx, y: y + 0.4, z: cz };
}
function roofCone(ctx, r, h, y, color, sides = 4) {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r, h, sides), toon({ color, flatShading: true }));
  roof.rotation.y = Math.PI / 4; roof.position.set(ctx.cx, y, ctx.cz); roof.castShadow = true;
  addOutline(roof);
  ctx.scene.add(roof);
}

/* ------------------------------------------------------------------ presets */

const PRESETS = {
  // Fantasy: a stone wizard's tower; wooden ledges spiral round it.
  spiral(ctx) {
    const { cx, cz, H, col, B, world } = ctx;
    const R = 3.7, core = 2.0, stone = 0xd8cfbf, dark = 0x8f8574;
    B.box(cx - core, cx + core, 0, H, cz - core, cz + core, stone);
    world.add(cx - core, cx + core, 0, H, cz - core, cz + core);
    for (let y = 3; y < H; y += 3.2) B.box(cx - core - 0.08, cx + core + 0.08, y, y + 0.25, cz - core - 0.08, cz + core + 0.08, dark);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = cx + dx * (core + 0.06), bz = cz + dz * (core + 0.06);
      B.box(bx - (dz ? 0.6 : 0.03), bx + (dz ? 0.6 : 0.03), H - 6, H - 1.5, bz - (dx ? 0.6 : 0.03), bz + (dx ? 0.6 : 0.03), col);
    }
    const n = Math.floor((H - 0.6 - 0.9) / RISE);
    crate(ctx, cx + Math.cos(ctx.a0 + 0.95) * (R + 2.3), 0.9, cz + Math.sin(ctx.a0 + 0.95) * (R + 2.3));
    for (const p of ring(ctx, { R, step: 0.95, n, y0: 0.9 })) plank(ctx, p.x, p.y, p.z, 2.5, 2.5, 0x8a5a3a);
    const top = deck(ctx, 2.2, H, dark);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(cx + sx * 2.0 - 0.1, cx + sx * 2.0 + 0.1, H + 0.4, H + 3.6, cz + sz * 2.0 - 0.1, cz + sz * 2.0 + 0.1, 0x8a5a3a);
    roofCone(ctx, 3.4, 2.4, H + 4.8, col);
    return { top, scopeOff: 0.9, flagY: H + 7.6 };
  },

  // Mystery: a tall stone clock tower. Iron balconies climb round its four
  // faces, two to a side; a clock on every face near the top.
  zigzag(ctx) {
    const { cx, cz, H, col, B, world, scene } = ctx;
    const stone = 0x9aa0a8, dark = 0x4b5058, iron = 0x3a3f48;
    const n = Math.round((H - 0.85) / RISE);
    const Hd = n * RISE + 0.85;            // deck bottom: its top is one step above the last balcony
    const h = 2.2;
    B.box(cx - h, cx + h, 0, Hd, cz - h, cz + h, stone); world.add(cx - h, cx + h, 0, Hd, cz - h, cz + h);
    for (let y = 4; y < Hd; y += 4) B.box(cx - h - 0.06, cx + h + 0.06, y, y + 0.3, cz - h - 0.06, cz + h + 0.06, dark);
    // tall arched windows (dark insets) between the bands
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let y = 5; y < Hd - 5; y += 8) B.box(cx + dx * (h + 0.02) - (dz ? 0.45 : 0.02), cx + dx * (h + 0.02) + (dz ? 0.45 : 0.02), y, y + 2.2, cz + dz * (h + 0.02) - (dx ? 0.45 : 0.02), cz + dz * (h + 0.02) + (dx ? 0.45 : 0.02), 0x2a2f38, { cast: false });
    }
    const side = [[1, 0], [0, 1], [-1, 0], [0, -1]], out = 3.45;
    const k0 = Math.round(((ctx.a0 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
    for (let i = 1; i <= n; i++) {
      const sdir = side[(k0 + Math.floor((i - 1) / 2)) % 4], along = side[(k0 + Math.floor((i - 1) / 2) + 1) % 4];
      const t = (i % 2 ? -1 : 1) * 1.6;
      const x = cx + sdir[0] * out + along[0] * t, z = cz + sdir[1] * out + along[1] * t;
      plank(ctx, x, i * RISE, z, 2.3, 2.3, i % 6 === 0 ? col : 0x6b7380, iron);
      // a little railing on the outer edge (low, so it never blocks a jump)
      B.box(x + sdir[0] * 1.1 - (sdir[0] ? 0.04 : 1.1), x + sdir[0] * 1.1 + (sdir[0] ? 0.04 : 1.1), i * RISE, i * RISE + 0.45, z + sdir[1] * 1.1 - (sdir[1] ? 0.04 : 1.1), z + sdir[1] * 1.1 + (sdir[1] ? 0.04 : 1.1), iron, { cast: false });
    }
    // clock faces just under the deck, one per side
    const cy = Hd - 1.8;
    for (const [dx, dz] of side) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
      const rimG = new THREE.RingGeometry(1.25, 1.42, 28);
      const rim = new THREE.Mesh(rimG, new THREE.MeshBasicMaterial({ color: 0x2a2f38 }));
      const hg = new THREE.BoxGeometry(0.1, 0.62, 0.02); hg.translate(0, 0.29, 0);
      const mg = new THREE.BoxGeometry(0.06, 0.95, 0.02); mg.translate(0, 0.45, 0);
      const hh = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: 0x222222 }));
      const mh = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: 0x222222 }));
      const g = new THREE.Group(); g.add(face, rim, hh, mh); hh.position.z = mh.position.z = 0.02; rim.position.z = 0.005;
      g.position.set(cx + dx * (h + 0.03), cy, cz + dz * (h + 0.03));
      g.rotation.y = Math.atan2(dx, dz);
      scene.add(g);
      ctx.extras.push({ update: (dt, t) => { hh.rotation.z = -t * 0.02; mh.rotation.z = -t * 0.24; } });
    }
    const top = deck(ctx, h + 0.5, Hd, dark, iron);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(cx + sx * 1.6 - 0.12, cx + sx * 1.6 + 0.12, Hd + 0.4, Hd + 3.2, cz + sz * 1.6 - 0.12, cz + sz * 1.6 + 0.12, dark);
    roofCone(ctx, 2.6, 2.6, Hd + 4.5, col);
    return { top, scopeOff: 0.9, flagY: Hd + 7.2, signR: h + 0.08 };
  },

  // Friends & Family: a huge oak; branch platforms spiral up to a treehouse.
  treehouse(ctx) {
    const { cx, cz, H, B } = ctx;
    const bark = 0x7a5534, leaf = 0x5fa046, leaf2 = 0x4c8a3a, plankC = 0xc89a5e;
    cyl(ctx, cx, 0, H, cz, 1.7, bark);
    for (let k = 0; k < 5; k++) { const a = k * 1.26; cyl(ctx, cx + Math.cos(a) * 1.7, 0, 0.9, cz + Math.sin(a) * 1.7, 0.55, bark, { solid: false }); }
    const n = Math.floor((H - 0.4) / RISE) - 1;
    crate(ctx, cx + Math.cos(ctx.a0 + 0.9) * 6.0, 0.9, cz + Math.sin(ctx.a0 + 0.9) * 6.0, 1.8, 0xb7834a);
    ring(ctx, { R: 3.9, step: 0.9, n, y0: 0.9 }).forEach((p, i) => {
      // a branch from the trunk to each platform
      const bx = (cx + p.x) / 2, bz = (cz + p.z) / 2;
      B.geom(CYL6, bark, { x: bx, y: p.y - 0.55, z: bz, rz: Math.PI / 2, ry: -p.a, sx: 0.45, sy: 3.4, sz: 0.45 });
      plank(ctx, p.x, p.y, p.z, 2.4, 2.4, i % 4 === 2 ? leaf : plankC, i % 4 === 2 ? leaf2 : 0x8a5a3a);
    });
    // canopy above the treehouse (no collision, high up so it never blocks a jump)
    const top = deck(ctx, 2.8, H, plankC);
    // the treehouse: low walls on three sides, open to the last branch
    const s = 2.8, last = ctx.ledges[ctx.ledges.length - 1];
    const lx = last.x - cx, lz = last.z - cz;
    const open = Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? 'x+' : 'x-') : (lz > 0 ? 'z+' : 'z-');
    if (open !== 'x-') B.box(cx - s, cx - s + 0.15, H + 0.4, H + 1.4, cz - s, cz + s, 0xa8763f);
    if (open !== 'x+') B.box(cx + s - 0.15, cx + s, H + 0.4, H + 1.4, cz - s, cz + s, 0xa8763f);
    if (open !== 'z-') B.box(cx - s, cx + s, H + 0.4, H + 1.4, cz - s, cz - s + 0.15, 0xa8763f);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(cx + sx * 2.6 - 0.1, cx + sx * 2.6 + 0.1, H + 0.4, H + 3.4, cz + sz * 2.6 - 0.1, cz + sz * 2.6 + 0.1, 0x8a5a3a);
    roofCone(ctx, 4.0, 2.0, H + 4.4, 0xc0563a);
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9, r = 3.6 + (k % 2);
      B.geom(new THREE.IcosahedronGeometry(1, 0), k % 2 ? leaf : leaf2, { x: cx + Math.cos(a) * r, y: H + 5.2 + (k % 3) * 0.5, z: cz + Math.sin(a) * r, sx: 2.6, sy: 2.0, sz: 2.6 });
    }
    return { top, scopeOff: 1.0, flagY: H + 7.4 };
  },

  // Life Skills: a pile of giant books. The spines stick out as steps.
  books(ctx) {
    const { cx, cz, H, B, world } = ctx;
    const colours = [0x2f5d8a, 0xc0563a, 0x3f8a5a, 0xe0a83a, 0x7a4a9a, 0x2a7a8a, 0xb03a4a, 0x5a6a2a];
    // the stack: slabs 1.25 m thick, each nudged a little so it looks piled up
    const n = Math.floor(H / RISE);
    for (let i = 0; i < n; i++) {
      const y0 = i * RISE, y1 = y0 + RISE, ox = ((i * 37) % 5 - 2) * 0.12, oz = ((i * 53) % 5 - 2) * 0.12, h = 2.3;
      B.box(cx - h + ox, cx + h + ox, y0, y1 - 0.06, cz - h + oz, cz + h + oz, colours[i % colours.length]);
      B.box(cx - h + ox + 0.12, cx + h + ox - 0.02, y0 + 0.12, y1 - 0.18, cz - h + oz - 0.02, cz + h + oz + 0.02, 0xf4ecd8, { cast: false });   // page edges
    }
    world.add(cx - 2.35, cx + 2.35, 0, n * RISE, cz - 2.35, cz + 2.35);
    // steps: books lying flat on the ground, then spines poking out of the stack, going round the 4 sides
    const out = 3.6, side = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let k0 = Math.round(((ctx.a0 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
    crate(ctx, cx + side[k0][0] * 6.2 - side[(k0 + 1) % 4][0] * 1.6, 0.9, cz + side[k0][1] * 6.2 - side[(k0 + 1) % 4][1] * 1.6, 1.9, 0x8a3a3a);
    for (let i = 1; i < n; i++) {
      const sdir = side[(k0 + Math.floor((i - 1) / 2)) % 4], along = side[(k0 + Math.floor((i - 1) / 2) + 1) % 4];
      const t = (i % 2 ? -1 : 1) * 1.6;
      const x = cx + sdir[0] * out + along[0] * t, z = cz + sdir[1] * out + along[1] * t;
      plank(ctx, x, i * RISE + 0.9, z, 2.4, 2.4, colours[(i + 3) % colours.length], 0xf4ecd8);
    }
    // an open book on top as the deck
    const y = n * RISE;
    B.box(cx - 2.3, cx, y, y + 0.4, cz - 2.2, cz + 2.2, 0xfaf3e0); B.box(cx, cx + 2.3, y, y + 0.4, cz - 2.2, cz + 2.2, 0xf4ecd8);
    B.box(cx - 2.35, cx + 2.35, y - 0.1, y, cz - 2.3, cz + 2.3, 0x7a4a9a);
    world.add(cx - 2.3, cx + 2.3, y, y + 0.4, cz - 2.2, cz + 2.2);
    for (let l = -1.6; l <= 1.6; l += 0.4) { B.box(cx - 2.0, cx - 0.3, y + 0.4, y + 0.42, cz + l - 0.03, cz + l + 0.03, 0x9a9488, { cast: false }); B.box(cx + 0.3, cx + 2.0, y + 0.4, y + 0.42, cz + l - 0.03, cz + l + 0.03, 0x9a9488, { cast: false }); }
    return { top: { x: cx, y: y + 0.4, z: cz }, scopeOff: 1.0, flagY: y + 1.9, flagX: cx - 1.9, flagZ: cz - 1.9, signR: 2.45 };
  },

  // Adventure: a ship's mast. Barrels, yard-arms and a crow's nest.
  mast(ctx) {
    const { cx, cz, H, B, scene, col } = ctx;
    const wood = 0x8a5a3a, dark = 0x5a3a24;
    cyl(ctx, cx, 0, H + 5, cz, 0.55, dark);
    // a ship's deck to start from
    B.box(cx - 5.5, cx + 5.5, 0, 0.5, cz - 5.5, cz + 5.5, 0xb08050);
    ctx.world.add(cx - 5.5, cx + 5.5, 0, 0.5, cz - 5.5, cz + 5.5);
    for (let k = -5; k <= 5; k += 1.1) B.box(cx + k - 0.02, cx + k + 0.02, 0.5, 0.52, cz - 5.5, cz + 5.5, 0x8a6038, { cast: false });
    // barrels on the deck as the first steps
    const b0 = ctx.a0 + 0.7;
    const barrel = (x, y, z) => { cyl(ctx, x, y - 1.1, y, z, 0.75, 0x9a6a3a); B.geom(CYL, 0x4a4a4a, { x, y: y - 0.3, z, sx: 1.56, sy: 0.12, sz: 1.56 }); B.geom(CYL, 0x4a4a4a, { x, y: y - 0.85, z, sx: 1.56, sy: 0.12, sz: 1.56 }); ctx.ledges.push({ x, y, z, w: 1.4, d: 1.4 }); };
    barrel(cx + Math.cos(b0) * 3.6, 1.6, cz + Math.sin(b0) * 3.6);
    // plank steps round the mast, with a yard-arm (cross beam) every so often
    const n = Math.floor((H - 2) / RISE);
    ring(ctx, { R: 3.4, step: 0.85, n, y0: 1.6, start: b0 }).forEach((p, i) => {
      plank(ctx, p.x, p.y, p.z, 2.3, 2.3, wood, dark);
      // rope from the plank up to the mast
      B.geom(CYL6, 0xd8c8a0, { x: (p.x + cx) / 2, y: p.y + 1.2, z: (p.z + cz) / 2, rz: Math.PI / 2 - 0.62, ry: -p.a, sx: 0.06, sy: 4.0, sz: 0.06, cast: false });
      if (i % 6 === 5) B.box(cx - 4.6, cx + 4.6, p.y + 1.6, p.y + 1.9, cz - 0.15, cz + 0.15, dark);
    });
    // crow's nest: a round barrel-top platform
    const y = 1.6 + (n + 1) * RISE - 0.4;
    cyl(ctx, cx, y - 0.4, y, cz, 2.2, 0x9a6a3a);
    ctx.world.add(cx - 2.2, cx + 2.2, y - 0.4, y, cz - 2.2, cz + 2.2);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; if (Math.cos(a - (b0 + n * 0.85)) > 0.7) continue; B.box(cx + Math.cos(a) * 2.1 - 0.08, cx + Math.cos(a) * 2.1 + 0.08, y, y + 1.0, cz + Math.sin(a) * 2.1 - 0.08, cz + Math.sin(a) * 2.1 + 0.08, dark); }
    // a sail (cloth panel) below the nest, between two yard-arms
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(6, 5, 6, 4), toon({ color: 0xf2ead2, side: THREE.DoubleSide }));
    const pos = sail.geometry.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getY(i) + 2.5) / 5 * Math.PI) * 0.6);
    sail.position.set(cx, y - 6.5, cz); sail.rotation.y = ctx.a0; scene.add(sail);
    // the jolly flag colour is the road colour
    return { top: { x: cx + 0.9, y, z: cz }, scopeOff: 0, flagY: H + 6, signR: 5.6 };
  },

  // Animals & Nature: tree stumps of rising height in a ring, up to a lookout tree.
  stumps(ctx) {
    const { cx, cz, H, B } = ctx;
    const bark = 0x7a5534, top = 0xd9b47a, leaf = 0x6aa84f, leaf2 = 0x4e8f3e;
    const n = Math.floor((H - 0.6) / RISE);
    // spiral inward: radius shrinks 3.2 m per lap, about 2.8 m between stump centres.
    // Built from the middle outwards, then reversed so the climb starts on the outside.
    const shrink = 3.2 / (2 * Math.PI), ring0 = [];
    let a = 0, R = 4.4;
    for (let i = 0; i < n; i++) { ring0.push({ a, R }); const da = 2.8 / R; a -= da; R += shrink * da; }
    ring0.reverse();
    const rot = ctx.a0 - ring0[0].a;
    const pts = ring0.map((q, i) => ({ x: cx + Math.cos(q.a + rot) * q.R, y: 0.2 + (i + 1) * RISE, z: cz + Math.sin(q.a + rot) * q.R, a: q.a + rot, R: q.R }));
    pts.forEach((p, i) => {
      const r = 1.0;
      cyl(ctx, p.x, 0, p.y - 0.3, p.z, r, bark);
      B.geom(CYL, top, { x: p.x, y: p.y - 0.15, z: p.z, sx: r * 2, sy: 0.3, sz: r * 2 });
      ctx.world.add(p.x - r * 0.85, p.x + r * 0.85, p.y - 0.3, p.y, p.z - r * 0.85, p.z + r * 0.85);
      ctx.ledges.push({ x: p.x, y: p.y, z: p.z, w: 1.7, d: 1.7 });
      if (i % 5 === 4) B.geom(new THREE.IcosahedronGeometry(1, 0), leaf2, { x: p.x + Math.cos(p.a) * 1.3, y: p.y - 0.4, z: p.z + Math.sin(p.a) * 1.3, sx: 1.1, sy: 0.8, sz: 1.1 });
    });
    // the lookout tree in the middle, a platform in its branches
    const y = pts.length ? pts[pts.length - 1].y + RISE : H;
    cyl(ctx, cx, 0, y, cz, 1.4, bark);
    const T = deck(ctx, 2.6, y - 0.4, 0xb08050);
    for (let k = 0; k < 9; k++) {
      const a = k * 0.7, r = 3.2 + (k % 2) * 0.8;
      B.geom(new THREE.IcosahedronGeometry(1, 0), k % 2 ? leaf : leaf2, { x: cx + Math.cos(a) * r, y: y + 3.6 + (k % 3) * 0.6, z: cz + Math.sin(a) * r, sx: 2.4, sy: 1.8, sz: 2.4 });
    }
    B.geom(new THREE.IcosahedronGeometry(1, 0), leaf, { x: cx, y: y + 5.4, z: cz, sx: 3.4, sy: 2.4, sz: 3.4 });
    for (const [sx, sz] of [[-1, -1], [1, 1]]) B.box(cx + sx * 2.4 - 0.12, cx + sx * 2.4 + 0.12, y, y + 3.6, cz + sz * 2.4 - 0.12, cz + sz * 2.4 + 0.12, bark);
    return { top: T, scopeOff: 1.0, flagY: y + 7.8, signR: pts.length ? pts[0].R + 2.6 : 8, signPosts: true };
  },

  // Sci-Fi: glowing hover-pads circle an energy pylon.
  pylon(ctx) {
    const { cx, cz, H, B, scene, col } = ctx;
    const metal = 0xb8c4d0, dark = 0x3a4250, glow = 0x5ef0ff;
    cyl(ctx, cx, 0, H, cz, 1.3, metal, { six: true });
    for (let y = 2; y < H; y += 2.5) B.geom(CYL6, glow, { x: cx, y, z: cz, sx: 2.8, sy: 0.18, sz: 2.8, bucket: 'glow', shade: false });
    // energy beam up the middle (just for looks)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, H + 8, 10, 1, true), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.25, depthWrite: false }));
    beam.position.set(cx, (H + 8) / 2, cz); scene.add(beam);
    const n = Math.floor((H - 0.6) / RISE);
    ring(ctx, { R: 4.0, step: 0.8, n, y0: 0.4 }).forEach((p, i) => {
      // pads: a hexagon top with a glowing rim underneath (hover look)
      B.geom(CYL6, i % 4 === 3 ? col : metal, { x: p.x, y: p.y - 0.17, z: p.z, sx: 2.5, sy: 0.34, sz: 2.5 });
      B.geom(CYL6, glow, { x: p.x, y: p.y - 0.42, z: p.z, sx: 1.6, sy: 0.12, sz: 1.6, bucket: 'glow', shade: false });
      ctx.world.add(p.x - 1.1, p.x + 1.1, p.y - 0.34, p.y, p.z - 1.1, p.z + 1.1);
      ctx.ledges.push({ x: p.x, y: p.y, z: p.z, w: 2.2, d: 2.2 });
    });
    const T = deck(ctx, 2.6, H, dark, glow);
    // a spinning ring above the deck
    const halo = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: glow }));
    halo.rotation.x = Math.PI / 2; halo.position.set(cx, H + 4, cz); scene.add(halo);
    ctx.extras.push({ update: (dt, t) => { halo.rotation.z = t * 0.6; halo.position.y = H + 4 + Math.sin(t * 1.5) * 0.25; beam.material.opacity = 0.18 + Math.sin(t * 3) * 0.07; } });
    return { top: T, scopeOff: 1.0, flagY: H + 6.6 };
  }
};
