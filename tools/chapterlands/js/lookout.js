// Lookout Tower prefab (A1 §3). Everything about a tower is data
// (CONFIG.lookoutTowers): which road, how far along, which side, how tall,
// a layout preset and an optional requiresKey. This module turns that into
// a climbable structure built from the existing movement set — ledges,
// crates and a couple of easy jumps, with a checkpoint pad halfway — and a
// telescope at the top.
//
// Presets:
//   spiral — ledges wind round a stone core (gentle; good for young players)
//   zigzag — ledges switch back and forth across one face of a tall wall
import * as THREE from 'three';
import { toon, addOutline } from './gfx.js';
import { signMesh } from './world.js';
import { Catalogue } from './catalogue.js';
import { Save } from './save.js';

const RISE = 1.25;      // metres between ledges (a normal jump is 2.2 m)

export function buildLookout({ cfg, road, scene, world, B, interactables, hooks }) {
  const Q = road.Q;
  const base = road.at(cfg.at, cfg.side, 13);
  const cx = base.x, cz = base.z, H = cfg.height;
  const col = new THREE.Color(Q.colour).getHex();
  const stone = 0xd8cfbf, dark = 0x8f8574, wood = 0x8a5a3a;
  const ledges = [];
  const ledge = (x, y, z, w = 2.4, d = 2.4, c = wood, crate = false) => {
    if (crate) {
      B.box(x - w / 2, x + w / 2, y - 1.0, y, z - d / 2, z + d / 2, 0xb7834a);
      B.box(x - w / 2 - 0.02, x + w / 2 + 0.02, y - 0.95, y - 0.85, z - d / 2 - 0.02, z + d / 2 + 0.02, 0x7a5230);
      world.add(x - w / 2, x + w / 2, y - 1.0, y, z - d / 2, z + d / 2);
    } else {
      B.box(x - w / 2, x + w / 2, y - 0.35, y, z - d / 2, z + d / 2, c);
      B.box(x - w / 2 + 0.25, x + w / 2 - 0.25, y - 0.75, y - 0.35, z - d / 2 + 0.25, z + d / 2 - 0.25, 0x6b4a2e);
      world.add(x - w / 2, x + w / 2, y - 0.35, y, z - d / 2, z + d / 2);
    }
    ledges.push({ x, y, z });
  };

  let checkpoint = null, top = null;
  if (cfg.preset === 'zigzag') {
    // a tall wall with ledges stepping left-right up its road-facing side
    const n = Math.ceil(H / RISE);
    const wx = Math.abs(road.D.x) > Math.abs(road.D.z);  // wall runs along the road
    const w0 = wx ? cx - 4 : cx - 1.2, w1 = wx ? cx + 4 : cx + 1.2, z0 = wx ? cz - 1.2 : cz - 4, z1 = wx ? cz + 1.2 : cz + 4;
    B.box(w0, w1, 0, H, z0, z1, stone); world.add(w0, w1, 0, H, z0, z1);
    const fx = -road.N.x * cfg.side, fz = -road.N.z * cfg.side;     // face toward the road
    for (let i = 1; i <= n; i++) {
      const s = (i % 2 ? -1 : 1) * 2.6;
      const x = cx + (wx ? s : fx * 2.6), z = cz + (wx ? fz * 2.6 : s);
      ledge(x, i * RISE, z, 2.4, 2.4, wood, i % 5 === 0);
      if (i === Math.round(n / 2)) checkpoint = { x, y: i * RISE, z };
    }
    top = { x: cx, y: H, z: cz };
    B.box(w0 - 0.8, w1 + 0.8, H, H + 0.4, z0 - 0.8, z1 + 0.8, dark);
    world.add(w0 - 0.8, w1 + 0.8, H, H + 0.4, z0 - 0.8, z1 + 0.8);
    top.y = H + 0.4;
  } else {
    // spiral: a stone core, ledges winding round it
    const R = 3.7, core = 2.0;
    B.box(cx - core, cx + core, 0, H, cz - core, cz + core, stone);
    world.add(cx - core, cx + core, 0, H, cz - core, cz + core);
    for (let y = 3; y < H; y += 3.2) B.box(cx - core - 0.08, cx + core + 0.08, y, y + 0.25, cz - core - 0.08, cz + core + 0.08, dark);
    // banners in the quarter colour
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = cx + dx * (core + 0.06), bz = cz + dz * (core + 0.06);
      B.box(bx - (dz ? 0.6 : 0.03), bx + (dz ? 0.6 : 0.03), H - 6, H - 1.5, bz - (dx ? 0.6 : 0.03), bz + (dx ? 0.6 : 0.03), col);
    }
    const n = Math.floor((H - 0.6 - 0.9) / RISE);   // last ledge sits just under the deck
    const a0 = Math.atan2(road.out.z - cz, road.out.x - cx);   // first ledge faces the road
    // starter steps: two crates so the first climb is obvious
    ledge(cx + Math.cos(a0 + 0.95) * (R + 2.3), 0.9, cz + Math.sin(a0 + 0.95) * (R + 2.3), 1.8, 1.8, 0, true);
    for (let i = 1; i <= n; i++) {
      const a = a0 + i * 0.95;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      ledge(x, i * RISE + 0.9, z, 2.5, 2.5, wood, i % 6 === 3);
      if (i === Math.round(n / 2)) checkpoint = { x, y: i * RISE + 0.9, z };
    }
    // top deck with railings
    // (kept small so the top ledges, which wind just outside it, have head room)
    const T2 = 2.2;
    B.box(cx - T2, cx + T2, H, H + 0.4, cz - T2, cz + T2, dark);
    world.add(cx - T2, cx + T2, H, H + 0.4, cz - T2, cz + T2);
    top = { x: cx, y: H + 0.4, z: cz };
    // low rails on the side away from the last ledge, and a pointed roof on posts
    const ra = a0 + n * 0.95 + Math.PI;
    const rx = Math.cos(ra) >= 0 ? 1 : -1;
    B.box(cx + rx * T2 - 0.06, cx + rx * T2 + 0.06, H + 0.4, H + 1.3, cz - T2, cz + T2, wood);
    world.add(cx + rx * T2 - 0.1, cx + rx * T2 + 0.1, H + 0.4, H + 1.3, cz - T2, cz + T2, false);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(cx + sx * 2.0 - 0.1, cx + sx * 2.0 + 0.1, H + 0.4, H + 3.6, cz + sz * 2.0 - 0.1, cz + sz * 2.0 + 0.1, wood);
  }
  // spiral roof cone (outside the batcher: its own mesh)
  if (cfg.preset !== 'zigzag') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.4, 4), toon({ color: col, flatShading: true }));
    roof.rotation.y = Math.PI / 4; roof.position.set(cx, H + 4.8, cz); roof.castShadow = true;
    addOutline(roof);
    scene.add(roof);
  }
  // flag on top, visible from the square
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), toon({ color: 0x555555 }));
  pole.position.set(cx, H + (cfg.preset === 'zigzag' ? 1.9 : 7.6), cz); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), toon({ color: col, side: THREE.DoubleSide }));
  flag.geometry.translate(0.8, 0, 0);
  flag.position.set(cx, pole.position.y + 1, cz); scene.add(flag);

  // name board at the foot
  const sign = signMesh(`LOOKOUT · ${Q.name.toUpperCase()}`, { w: 4.2, h: 0.8, bg: Q.colour, fg: '#fff', glow: true });
  const ry = Math.atan2(road.out.x - cx, road.out.z - cz);
  sign.position.set(cx + Math.sin(ry) * 2.07, 2.6, cz + Math.cos(ry) * 2.07); sign.rotation.y = ry; scene.add(sign);

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
  scope.position.set(top.x + (cfg.preset === 'zigzag' ? 0 : 0.9), top.y, top.z);
  scope.rotation.y = Math.atan2(look.z - top.z, -(look.x - top.x));
  scene.add(scope);

  const T = { cfg, road, top, checkpoint, pad, reached: false, base: { x: cx, z: cz }, gate: null };
  interactables.push({ x: top.x, z: top.z, y: top.y, r: 2.6, label: 'Look through the telescope', icon: '🔭', iconY: 2.6, act: () => hooks.telescope(T) });

  // requiresKey: a locked gate round the base
  if (cfg.requiresKey) {
    const need = Catalogue.getBook(cfg.requiresKey);
    const r = 7.5;
    const gateC = world.add(cx - r, cx + r, 0, H + 8, cz - r, cz + r, false);
    const fence = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      fence.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    for (const [x, z] of fence) B.box(x - 0.12, x + 0.12, 0, 1.6, z - 0.12, z + 0.12, 0x5a5f66);
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

  // halfway: "back to the checkpoint" pad at the base for anyone who falls
  const back = road.at(cfg.at + 4.5, cfg.side, 8.5);
  const ret = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 18), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6 }));
  ret.position.set(back.x, 0.04, back.z); ret.visible = false; scene.add(ret);
  interactables.push({
    x: back.x, z: back.z, y: 0, r: 1.6, get label() { return T.reached ? 'Back to the halfway checkpoint' : 'Climb the Lookout Tower'; },
    act: () => {
      if (T.reached) hooks.teleport(checkpoint.x, checkpoint.y + 0.05, checkpoint.z);
      else hooks.toast('Jump from ledge to ledge round the tower. There\'s a checkpoint halfway up.');
    }
  });

  T.update = (dt, t, player) => {
    flag.rotation.y = Math.sin(t * 1.3) * 0.25;
    if (!T.reached && Math.hypot(player.pos.x - checkpoint.x, player.pos.z - checkpoint.z) < 1.4 && Math.abs(player.pos.y - checkpoint.y) < 0.6) {
      T.reached = true;
      padMat.color.set(0xffd23f);
      ret.visible = true;
      hooks.toast('Checkpoint! If you fall, the yellow pad at the bottom brings you back here.');
      hooks.sfx();
    }
    pad.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
  };
  return T;
}
