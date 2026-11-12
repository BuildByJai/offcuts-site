// CLIMB — a vertical, high-in-the-sky obstacle course. Also every Sky Run.
// params:
//   height: metres (default 20)
//   layout: spiral | zigzag | scatter        how the ledges wind upward
//   core: tower | tree | wall | mast | shaft | blocks | none   what you climb around
//   direction: up | down                     down = start at the top, reach the bottom
//   floaty: true                             slow, gentle falling (falling down a hole)
//   fade: true                               some ledges fade in and out (Cheshire Cat)
//   moving: N                                N ledges slide back and forth
//   collect: { item: {name, icon, colour}, count, need }   pickups on the way
//   goalIcon, objective, done
import * as THREE from 'three';
import { spawnItems, checkpointPad, goalMarker, npcAt } from '../common.js';
import { hex } from '../props.js';
import { toast } from '../../js/hud.js';

const RISE = 1.3;

export function build(A) {
  const p = A.params, r = A.rng, P = A.P;
  const H = p.height || 20;
  const down = p.direction === 'down';
  const layout = p.layout || 'spiral';
  const core = p.core || 'tower';
  if (p.floaty) { A.player.cfg.gravity = 11; A.player.cfg.terminalVelocity = 6; }
  A.ground(60, 60, down ? 'floor' : (p.floor || 'grass'), { walls: true, wallH: H + 30 });
  A.decorate({ w: 60, d: 60, count: 22, collide: false });
  // the core
  const coreCol = { tree: P.wood, wall: P.stone, mast: P.wood, shaft: P.wall, blocks: P.accent, tower: P.stone }[core] || P.stone;
  if (core === 'shaft') {
    // a round-ish well you fall down inside: four walls with shelves
    const R = 7;
    for (const [a, b, c, d] of [[-R - 1, R + 1, -R - 1, -R], [-R - 1, R + 1, R, R + 1], [-R - 1, -R, -R, R], [R, R + 1, -R, R]]) {
      A.B.box(a, b, 0, H + 6, c, d, hex(P.wall));
      A.world.add(a, b, 0, H + 6, c, d);
    }
    for (let y = 3; y < H + 4; y += 4) for (const s of [-1, 1]) A.B.box(-R + 0.1, R - 0.1, y, y + 0.15, s * (R - 0.2) - 0.1, s * (R - 0.2) + 0.1, hex(P.trim));
  } else if (core !== 'none') {
    const c = core === 'tree' ? 1.4 : core === 'mast' ? 0.5 : core === 'wall' ? 0 : 2.0;
    if (core === 'wall') {
      A.B.box(-7, 7, 0, H, -1.5, 1.5, hex(coreCol)); A.world.add(-7, 7, 0, H, -1.5, 1.5);
      for (let y = 0.6; y < H; y += 0.6) A.B.box(-7.02, 7.02, y, y + 0.05, -1.52, 1.52, new THREE.Color(coreCol).multiplyScalar(0.9).getHex(), { cast: false });
    } else if (core === 'blocks') {
      for (let y = 0; y < H; y += 2) {
        const col = [P.accent, P.accent2, P.roof, '#3fae5c'][Math.floor(y / 2) % 4];
        A.B.box(-c, c, y, y + 2, -c, c, hex(col));
        A.B.box(-c * 0.6, c * 0.6, y + 0.4, y + 1.6, c, c + 0.03, 0xffffff, { cast: false });
      }
      A.world.add(-c, c, 0, H, -c, c);
    } else {
      A.B.box(-c, c, 0, H, -c, c, hex(coreCol)); A.world.add(-c, c, 0, H, -c, c);
      if (core === 'tree') for (let y = 6; y < H; y += 5) A.B.box(-3, 3, y, y + 1.6, -3, 3, hex(P.leaf), { cast: false });
    }
  }
  // ledges
  const ledges = [];
  const n = Math.floor((H - 1) / RISE);
  const R = core === 'shaft' ? 4.6 : core === 'tree' ? 4.4 : core === 'mast' ? 3.0 : 3.9;
  let x = 0, z = 0;
  for (let i = 1; i <= n; i++) {
    const y = i * RISE;
    if (layout === 'zigzag' || core === 'wall') {
      x = (i % 2 ? -1 : 1) * 3.2; z = 3.0;
      if (core === 'wall' && i % 8 >= 4) z = -3.0;
    } else if (layout === 'scatter') {
      const a = i * 1.1 + r() * 0.5;
      x = Math.cos(a) * (R + r() * 1.2); z = Math.sin(a) * (R + r() * 1.2);
    } else {
      const a = i * 0.9;
      x = Math.cos(a) * R; z = Math.sin(a) * R;
    }
    const s = 2.4;
    ledges.push({ x, y, z, s, i });
  }
  const fadeSet = new Set(), moveSet = new Set();
  if (p.fade) ledges.forEach((L, i) => { if (i % 3 === 1 && i < ledges.length - 1) fadeSet.add(i); });
  if (p.moving) { for (let k = 0; k < p.moving; k++) moveSet.add(2 + Math.floor(k * (ledges.length - 4) / p.moving)); }
  const live = [];
  ledges.forEach((L, i) => {
    const col = hex(i % 2 ? P.accent : P.wood);
    if (fadeSet.has(i) || moveSet.has(i)) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(L.s, 0.4, L.s), new THREE.MeshLambertMaterial({ color: fadeSet.has(i) ? hex(P.accent2) : col, transparent: fadeSet.has(i) }));
      m.position.set(L.x, L.y - 0.2, L.z); m.castShadow = true; m.receiveShadow = true;
      A.scene.add(m);
      const c = A.world.add(L.x - L.s / 2, L.x + L.s / 2, L.y - 0.4, L.y, L.z - L.s / 2, L.z + L.s / 2);
      live.push({ L, m, c, fade: fadeSet.has(i), move: moveSet.has(i), ph: i * 1.3 });
    } else {
      A.B.box(L.x - L.s / 2, L.x + L.s / 2, L.y - 0.4, L.y, L.z - L.s / 2, L.z + L.s / 2, col);
      A.world.add(L.x - L.s / 2, L.x + L.s / 2, L.y - 0.4, L.y, L.z - L.s / 2, L.z + L.s / 2);
    }
  });
  A.onUpdate((dt, t) => {
    for (const o of live) {
      if (o.fade) {
        // 4 s cycle: solid for 2.6 s, fades, gone for 0.8 s, back
        const k = ((t + o.ph) % 4) / 4;
        const vis = k < 0.65 ? 1 : k < 0.75 ? 1 - (k - 0.65) / 0.1 : k < 0.95 ? 0 : (k - 0.95) / 0.05;
        o.m.material.opacity = Math.max(0.08, vis);
        const solid = vis > 0.3;
        o.c.y0 = solid ? o.L.y - 0.4 : -999; o.c.y1 = solid ? o.L.y : -998;
      }
      if (o.move) {
        const dx = Math.sin(t * 0.9 + o.ph) * 1.4;
        const nx = o.L.x + dx;
        o.m.position.x = nx;
        o.c.x0 = nx - o.L.s / 2; o.c.x1 = nx + o.L.s / 2;
      }
    }
  });
  // top / bottom
  const topY = ledges.length ? ledges[ledges.length - 1].y : H;
  const last = ledges[ledges.length - 1] || { x: 0, z: 0 };
  let goal, start;
  if (!down) {
    const gx = core === 'none' || core === 'mast' || core === 'shaft' ? last.x : 0, gz = core === 'none' || core === 'mast' || core === 'shaft' ? last.z : 0;
    const gy = core === 'none' || core === 'mast' || core === 'shaft' ? topY : H;
    if (!(core === 'none' || core === 'mast' || core === 'shaft')) {
      A.B.box(-2.2, 2.2, H, H + 0.4, -2.2, 2.2, hex(P.trim)); A.world.add(-2.2, 2.2, H, H + 0.4, -2.2, 2.2);
    }
    goal = { x: gx, y: core === 'none' || core === 'mast' || core === 'shaft' ? gy : H + 0.4, z: gz };
    start = { x: ledges[0] ? ledges[0].x * 1.6 : 0, y: 0, z: ledges[0] ? ledges[0].z * 1.6 + 2 : 6, facing: Math.PI };
  } else {
    // start on the top ledge, goal on the floor
    start = { x: last.x, y: last.y, z: last.z, facing: Math.PI };
    goal = { x: 0, y: 0, z: 0 };
  }
  goalMarker(A, goal.x, goal.y, goal.z, p.goalIcon || (down ? '⬇️' : '🏁'));
  // checkpoints at thirds (on ledges)
  for (const k of [1, 2]) {
    const L = ledges[Math.floor(ledges.length * (down ? 1 - k / 3 : k / 3))];
    if (L) checkpointPad(A, L.x, L.y, L.z, Math.PI);
  }
  // pickups on ledges
  let pick = null;
  if (p.collect) {
    const c = p.collect, nn = c.count || 6, pos = [];
    for (let k = 0; k < nn; k++) {
      const L = ledges[Math.min(ledges.length - 1, Math.floor((k + 0.5) * ledges.length / nn))];
      // jars on the wall shelves for a shaft; otherwise just above a ledge
      pos.push([L.x, L.y + (down ? 0 : 0.2), L.z]);
    }
    pick = spawnItems(A, [c.item], pos, { label: c.label || 'collected', beam: false });
  }
  let bestY = 0, done = false;
  A.onUpdate(() => {
    const pl = A.player.pos;
    bestY = Math.max(bestY, pl.y);
    if (!down) A.setSub(`${Math.round(Math.min(1, bestY / goal.y) * 100)}% of the way up`);
    if (done) return;
    if (Math.hypot(pl.x - goal.x, pl.z - goal.z) < 2.2 && Math.abs(pl.y - goal.y) < 1.2 && A.player.grounded) {
      if (pick && p.collect.need && pick.got < p.collect.need) {
        toast(`You still need ${p.collect.need - pick.got} more ${p.collect.label || ''}! Up you go again.`);
        if (down) { A.player.teleport(start.x, start.y + 0.1, start.z, Math.PI); }
        return;
      }
      done = true;
      if (p.finale && p.finale.npc) A.say(p.finale.npc.name, p.finale.say || '', () => A.win(p.done));
      else A.win(p.done);
    }
  });
  // someone waiting at the top (or bottom)
  if (p.finale && p.finale.npc) npcAt(A, p.finale.npc, goal.x + 1.4, goal.z, Math.PI).position.y = goal.y;
  if (p.guide && p.guide.npc) {
    // a companion who rises with you, a ledge or two ahead
    const gd = npcAt(A, p.guide.npc, start.x, start.z, Math.PI);
    A.onUpdate((dt, t) => {
      const pl = A.player.pos;
      const k = Math.min(ledges.length - 1, ledges.findIndex((L) => L.y > pl.y + 0.5) + 1);
      const L = k >= 0 ? ledges[k] : last;
      gd.position.x += ((L.x + 0.6) - gd.position.x) * Math.min(1, dt * 2);
      gd.position.z += (L.z - gd.position.z) * Math.min(1, dt * 2);
      gd.position.y += ((L.y + 0.3 + Math.sin(t * 2) * 0.25) - gd.position.y) * Math.min(1, dt * 2);
    });
  }
  A.killY = -4;
  return {
    start,
    onStart() { A.setObjective(p.objective || (down ? 'Get all the way to the bottom' : 'Climb to the very top'), p.fade ? 'Some ledges fade away — wait for them to come back!' : ''); },
    // falling to the ground in an upward climb just puts you back at the last checkpoint
    update() {
      const pl = A.player.pos;
      if (!down && A.player.grounded && pl.y < 0.1 && bestY > RISE * 3 && A.state() === 'playing') {
        bestY = 0;
        toast('Back to your last checkpoint!');
        A.respawn();
      }
    }
  };
}
