// CHASE — run, ride or flee along a path with obstacles, or chase a target.
// params:
//   mode: race | follow | flee | loop
//   length: metres of track (race/follow/flee), laps + radius (loop)
//   width: track width (default 10)
//   obstacles: ['hurdle', 'block', 'gap', 'log', 'low']   kinds to use
//   density: 0..1 (default 0.5)
//   floor: grass|floor|snow|sand|stone
//   target: { kind, look, name }   follow: who you follow
//   chaser: { kind, look, name }, chaserSpeed   flee: who's after you
//   collect: { item: {name, icon, colour}, count, need }  optional pickups on the way
//   lives: N (default 3 when the track has gaps/logs or a chaser)
//   time: seconds (race; generous)
//   objective, done
import * as THREE from 'three';
import { spawnItems, npcAt, finishArch, checkpointPad, critters } from '../common.js';
import { hex, prop } from '../props.js';
import { toast } from '../../js/hud.js';
import { Sfx } from '../../js/audio.js';

export function build(A) {
  const p = A.params, r = A.rng, P = A.P;
  if (p.mode === 'loop') return loop(A);
  const L = p.length || 120, W = p.width || 10;
  const kinds = p.obstacles || ['hurdle', 'block'];
  const dens = p.density == null ? 0.5 : p.density;
  A.ground(W, L + 30, 'none', { cz: -L / 2 + 5, walls: true, wallH: 10 });
  const floorCols = { grass: [P.ground, P.ground2], floor: ['#a0764e', '#8a6440'], snow: ['#f4f7fb', '#dfe7f0'], sand: ['#e8d3a0', '#d8c08a'], stone: ['#b9b2a5', '#a49d90'] }[p.floor || 'grass'] || [P.ground, P.ground2];
  // obstacles every few metres
  const obs = [];
  const gaps = [];
  for (let z = -14; z > -L + 10; z -= 9 + (1 - dens) * 8 + r() * 4) {
    const k = kinds[Math.floor(r() * kinds.length)];
    obs.push({ k, z });
    if (k === 'gap') gaps.push([z - 1.4, z + 1.4]);
  }
  // floor segments, leaving holes for gaps (a soft "pit" below)
  let zTop = 15;
  const segs = [];
  for (const [a, b] of gaps.sort((x, y) => y[0] - x[0])) { segs.push([b, zTop]); zTop = a; }
  segs.push([-L - 15, zTop]);
  segs.forEach(([z0, z1], i) => {
    A.B.box(-W / 2, W / 2, -0.6, 0, z0, z1, hex(floorCols[i % 2]), { cast: false });
    A.world.add(-W / 2, W / 2, -2, 0, z0, z1);
  });
  // pits get a deep, soft-looking bottom so a fall reads as "oops", not danger
  for (const [a, b] of gaps) A.B.box(-W / 2, W / 2, -3.2, -3, a, b, hex(P.leaf), { cast: false });
  // the track edges
  const edge = A.theme.edge || 'hedge';
  for (let z = 12; z > -L - 12; z -= 3.2) {
    prop(edge, A.B, null, -W / 2 - 1.2, z, 1, P, r);
    prop(edge, A.B, null, W / 2 + 1.2, z, 1, P, r);
  }
  A.decorate({ w: W + 30, d: L + 40, cz: -L / 2, count: 40, margin: 8, collide: false });
  if (p.critters) critters(A, p.critters, { w: W - 2, d: L, cz: -L / 2 });
  const logs = [];
  for (const o of obs) {
    if (o.k === 'hurdle') {
      A.B.box(-W / 2, W / 2, 0, 0.75, o.z - 0.25, o.z + 0.25, hex(P.accent));
      A.B.box(-W / 2, W / 2, 0.75, 0.9, o.z - 0.3, o.z + 0.3, 0xffffff);
      A.world.add(-W / 2, W / 2, 0, 0.9, o.z - 0.3, o.z + 0.3);
    } else if (o.k === 'block') {
      const bw = 2.6 + r() * 2, x = (r() - 0.5) * (W - bw);
      const h = 2.4;
      A.B.box(x - bw / 2, x + bw / 2, 0, h, o.z - 0.8, o.z + 0.8, hex(P.accent2));
      A.world.add(x - bw / 2, x + bw / 2, 0, h, o.z - 0.8, o.z + 0.8);
    } else if (o.k === 'low') {
      // a low bar to slide under (or go round the gap at the side)
      A.B.box(-W / 2, W / 2 - 2.2, 1.0, 1.6, o.z - 0.3, o.z + 0.3, hex(P.trim));
      A.world.add(-W / 2, W / 2 - 2.2, 1.0, 1.6, o.z - 0.3, o.z + 0.3);
    } else if (o.k === 'gap') {
      // planks at the edges show where to jump from
      A.B.box(-W / 2, W / 2, -0.05, 0.02, o.z + 1.4, o.z + 1.9, 0xffffff, { cast: false });
    } else if (o.k === 'log') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3, 10), new THREE.MeshLambertMaterial({ color: hex(P.wood) }));
      m.rotation.x = Math.PI / 2; m.position.set(0, 0.45, o.z); m.castShadow = true;
      A.scene.add(m);
      logs.push({ m, z: o.z, ph: r() * 6, sp: 0.6 + r() * 0.5, hitT: 0 });
    }
  }
  A.onUpdate((dt, t) => {
    const pl = A.player.pos;
    for (const g of logs) {
      g.m.position.x = Math.sin(t * g.sp + g.ph) * (W / 2 - 1.6);
      g.m.rotation.y = 0; g.m.rotation.z = t * 3;
      g.hitT -= dt;
      if (g.hitT <= 0 && Math.abs(pl.z - g.z) < 1.8 && Math.abs(pl.x - g.m.position.x) < 1.9 && pl.y < 0.9) {
        g.hitT = 1.2; A.loseLife('Bonk! Watch out for the rolling logs.');
      }
    }
  });
  // checkpoints at thirds
  for (const k of [1, 2]) {
    let cz = -L * k / 3;
    for (const [a, b] of gaps) if (cz > a - 3 && cz < b + 3) cz = b + 4;
    checkpointPad(A, W / 2 - 1.5, 0, cz, Math.PI);
  }
  finishArch(A, 0, -L, W, p.finishText || 'FINISH');
  const needLives = gaps.length || logs.length || p.mode === 'flee';
  if (p.lives || needLives) A.setLives(p.lives || 3);
  // optional pickups
  let pick = null;
  if (p.collect) {
    const c = p.collect, n = c.count || 6, pos = [];
    for (let i = 0; i < n; i++) pos.push([(r() - 0.5) * (W - 3), 0, -10 - (i + 0.5) * (L - 20) / n]);
    pick = spawnItems(A, [c.item], pos, { label: c.label || 'caught', beam: false });
  }
  // follow: a guide who runs ahead and waits for you
  let guide = null;
  if (p.mode === 'follow' && p.target) {
    guide = npcAt(A, p.target, 0, -8, Math.PI);
    A.onUpdate((dt) => {
      const g = guide.position, pl = A.player.pos;
      const gap = g.z - pl.z;     // negative = guide is ahead (further −z)
      const ahead = -gap;
      let sp = ahead > 14 ? 0 : ahead > 7 ? 5.5 : 8.5;
      if (g.z <= -L - 4) sp = 0;
      g.z -= sp * dt;
      // hop over hurdles / gaps, weave round blocks
      let y = 0;
      for (const o of obs) if (Math.abs(g.z - o.z) < 1.6 && (o.k === 'hurdle' || o.k === 'gap' || o.k === 'log')) y = Math.cos((g.z - o.z) / 1.6 * Math.PI / 2) * 1.4;
      g.y = y;
      g.x += (Math.sin(g.z * 0.08) * (W / 2 - 2) - g.x) * Math.min(1, dt * 2);
      guide.userData.moving = sp > 0;
      guide.rotation.y = Math.PI;
    });
  }
  // flee: something behind you
  let chaser = null, caughtT = 0;
  if (p.mode === 'flee' && p.chaser) {
    chaser = npcAt(A, p.chaser, 0, 14, Math.PI);
    const sp = p.chaserSpeed || 6.6;
    A.onUpdate((dt) => {
      if (A.state() !== 'playing') return;
      const c = chaser.position, pl = A.player.pos;
      const dx = pl.x - c.x, dz = pl.z - c.z, d = Math.hypot(dx, dz);
      caughtT -= dt;
      if (d > 0.1) { c.x += dx / d * sp * dt; c.z += dz / d * sp * dt; chaser.rotation.y = Math.atan2(dx, dz); }
      chaser.userData.moving = true;
      if (d < 1.4 && caughtT <= 0) {
        caughtT = 1.5;
        A.loseLife(`${p.chaser.name || 'They'} caught up! Keep running.`);
        c.set(A.player.pos.x, 0, A.player.pos.z + 12);
      }
    });
  }
  let finished = false;
  A.onUpdate(() => {
    if (finished) return;
    if (A.player.pos.z < -L + 0.5) {
      if (pick && p.collect.need && pick.got < p.collect.need) {
        toast(`You need ${p.collect.need} ${p.collect.label || 'of them'} — go back for ${p.collect.need - pick.got} more!`);
        A.player.teleport(A.player.pos.x, 0.05, -L + 3, 0);
        return;
      }
      finished = true;
      Sfx.badge();
      A.win(p.done);
    }
  });
  if (p.mode === 'race' || p.time) A.setTimer(p.time || Math.round(L / 3.5));
  return {
    start: { x: 0, y: 0, z: 8, facing: Math.PI },
    usesLives: true,
    onStart() {
      A.setObjective(p.objective || (p.mode === 'follow' ? `Follow ${p.target ? p.target.name : 'them'} to the end` : p.mode === 'flee' ? 'Run! Get to the end' : 'Reach the finish'), gaps.length ? 'Jump the gaps!' : '');
      if (p.mode === 'flee') toast(`${p.chaser.name} is coming — run!`);
    },
    onFall() { A.loseLife('Into the ditch! Back to the checkpoint.'); }
  };
}

// The Caucus-race: round and round a ring; everybody wins.
function loop(A) {
  const p = A.params, r = A.rng, P = A.P;
  const R = p.radius || 16, laps = p.laps || 2, W = p.width || 6;
  A.ground(R * 2 + 30, R * 2 + 30, p.floor || 'grass');
  // ring track markers + obstacles around the ring
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    for (const rr of [R - W / 2, R + W / 2]) A.B.box(Math.cos(a) * rr - 0.2, Math.cos(a) * rr + 0.2, 0, 0.3, Math.sin(a) * rr - 0.2, Math.sin(a) * rr + 0.2, i % 2 ? 0xffffff : hex(P.accent), { cast: false });
  }
  const hurdles = [];
  for (let i = 0; i < (p.hurdles || 6); i++) {
    const a = (i + 0.5) / (p.hurdles || 6) * Math.PI * 2;
    const cx = Math.cos(a) * R, cz = Math.sin(a) * R;
    const ax = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
    const hw = W / 2;
    if (ax) { A.B.box(cx - 0.3, cx + 0.3, 0, 0.8, cz - hw, cz + hw, hex(P.accent2)); A.world.add(cx - 0.3, cx + 0.3, 0, 0.8, cz - hw, cz + hw); }
    else { A.B.box(cx - hw, cx + hw, 0, 0.8, cz - 0.3, cz + 0.3, hex(P.accent2)); A.world.add(cx - hw, cx + hw, 0, 0.8, cz - 0.3, cz + 0.3); }
    hurdles.push(a);
  }
  // keep runners on the ring: inner + outer soft walls
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const x = Math.cos(a) * (R - W / 2 - 0.6), z = Math.sin(a) * (R - W / 2 - 0.6);
    A.world.add(x - 0.5, x + 0.5, 0, 3, z - 0.5, z + 0.5, false);
  }
  A.decorate({ w: R * 2 + 26, d: R * 2 + 26, count: 26 });
  // the other racers (they run round too)
  const racers = (p.racers || []).map((npc, i) => ({ g: npcAt(A, npc, 0, 0, 0), a: -0.3 - i * 0.35, sp: 0.32 + (i % 3) * 0.04 }));
  let total = 0, lastA = Math.atan2(R * 0, R), started = false;
  A.setProgress(`Lap 0 / ${laps}`);
  A.onUpdate((dt) => {
    for (const q of racers) {
      q.a -= q.sp * dt * (A.state() === 'playing' ? 1 : 0);
      let y = 0;
      for (const h of hurdles) { const d = Math.atan2(Math.sin(q.a - h), Math.cos(q.a - h)); if (Math.abs(d) < 0.08) y = Math.cos(d / 0.08 * Math.PI / 2) * 1.1; }
      q.g.position.set(Math.cos(q.a) * R, y, Math.sin(q.a) * R);
      q.g.rotation.y = Math.atan2(-Math.sin(q.a), Math.cos(q.a)) + Math.PI;
      q.g.userData.moving = true;
    }
    const pl = A.player.pos;
    const a = Math.atan2(pl.z, pl.x);
    if (!started) { lastA = a; started = true; return; }
    let d = a - lastA;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    total += -d;                       // running anticlockwise (−angle) counts
    lastA = a;
    const lap = Math.max(0, Math.floor(total / (Math.PI * 2)));
    A.setProgress(`Lap ${Math.min(lap, laps)} / ${laps}`);
    if (lap >= laps) A.win(p.done || 'Everybody has won, and all must have prizes!');
  });
  return {
    start: { x: R, y: 0, z: 1, facing: Math.PI },
    onStart() { A.setObjective(p.objective || `Run ${laps} laps round the course`, 'Any direction you like… but the arrows go this way!'); }
  };
}
