// COLLECT — explore an area and find N items or clues, then (optionally)
// talk to someone. params:
//   area: [w, d]                 size of the area (default 44 × 44)
//   floor: grass|floor|snow|sand|stone|water
//   items: [{ name, icon, colour }]   one entry per item, or…
//   item: { name, icon, colour }, count: N
//   label: 'toys found'          progress label
//   platforms: N                 low crates/blocks to climb (some items sit on top)
//   rafts: N                     (floor: water) floating objects to cross on
//   finale: { npc: {kind, look, name}, say }   talk to them once everything is found
//   time: seconds                optional, generous timer
//   objective, done              objective text / text when all are found
import * as THREE from 'three';
import { spawnItems, npcAt, critters } from '../common.js';
import { Sfx } from '../../js/audio.js';
import { toast } from '../../js/hud.js';
import { hex, prop } from '../props.js';

export function build(A) {
  const p = A.params, r = A.rng, P = A.P;
  const [w, d] = p.area || [44, 44];
  const water = p.floor === 'water';
  A.ground(w, d, p.floor || 'grass');
  const defs = p.items || [p.item || { name: 'Item', icon: '⭐' }];
  const count = p.items ? p.items.length : (p.count || 6);
  const tops = [];
  const blocked = (x, z) => A.world.colliders.some((c) => c.y1 > 0.4 && c.y0 < 2 && x > c.x0 - 1 && x < c.x1 + 1 && z > c.z0 - 1 && z < c.z1 + 1 && (c.x1 - c.x0) < w);
  if (water) {
    // shores at both ends, rafts in between that bob a little
    const shore = (z0, z1) => { A.B.box(-w / 2, w / 2, -1, 0.3, z0, z1, hex('#d8c08a')); A.world.add(-w / 2, w / 2, -1, 0.3, z0, z1); };
    shore(d / 2 - 6, d / 2);
    shore(-d / 2, -d / 2 + 6);
    const rafts = [];
    const n = p.rafts || 14;
    for (let i = 0; i < n; i++) {
      const z = d / 2 - 9 - (i / (n - 1)) * (d - 18);
      const x = Math.sin(i * 1.7) * (w * 0.28) + (r() - 0.5) * 4;
      const s = 2.4 + r() * 1.2;
      const kinds = A.theme.rafts || ['crate', 'barrel', 'leaf', 'chest'];
      const kind = kinds[i % kinds.length];
      const col = { crate: '#b7834a', barrel: '#8a5a3a', leaf: P.leaf, chest: '#7a4e30', book: P.accent2, hat: P.accent }[kind] || P.accent;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, 0.5, s), new THREE.MeshLambertMaterial({ color: hex(col) }));
      m.position.set(x, 0, z); m.castShadow = true; m.receiveShadow = true;
      A.scene.add(m);
      const c = A.world.add(x - s / 2, x + s / 2, -0.25, 0.25, z - s / 2, z + s / 2);
      rafts.push({ m, c, base: 0, ph: r() * 6 });
      if (i % 2 === 1) tops.push([x, 0.25, z]);
    }
    A.onUpdate((dt, t) => {
      for (const R of rafts) {
        const y = Math.sin(t * 1.4 + R.ph) * 0.12;
        R.m.position.y = y; R.c.y0 = y - 0.25; R.c.y1 = y + 0.25;
      }
    });
    A.killY = -1.2;
  } else {
    A.decorate({ w, d, count: 30 });
    // a few props in the middle for things to hide behind
    for (let i = 0; i < 8; i++) {
      const x = (r() - 0.5) * (w - 14), z = (r() - 0.5) * (d - 14);
      if (Math.hypot(x, z - (d / 2 - 4)) < 6) continue;
      const list = A.theme.props || ['bush', 'rock'];
      prop(list[i % list.length], A.B, A.world, x, z, 1, P, r);
    }
    for (let i = 0; i < (p.platforms || 6); i++) {
      const x = (r() - 0.5) * (w - 12), z = (r() - 0.5) * (d - 12);
      if (Math.hypot(x, z - (d / 2 - 4)) < 6 || blocked(x, z)) continue;
      const h = 0.9 + Math.floor(r() * 3) * 0.9;
      A.B.box(x - 1.1, x + 1.1, 0, h, z - 1.1, z + 1.1, hex(i % 2 ? P.accent : P.accent2));
      A.world.add(x - 1.1, x + 1.1, 0, h, z - 1.1, z + 1.1);
      tops.push([x, h, z]);
    }
  }
  if (p.critters) critters(A, p.critters, { w: w - 6, d: d - 6 });
  // item positions: some on platforms, the rest on the ground, never at the start
  // and never inside a prop (anything solid taller than a step)
  const pos = [];
  const pool = tops.slice();
  for (let i = 0; i < count; i++) {
    if (pool.length && (water || i % 2 === 0)) { const t = pool.splice(Math.floor(r() * pool.length), 1)[0]; pos.push([t[0], t[1], t[2]]); continue; }
    let x, z, k = 0;
    do { x = (r() - 0.5) * (w - 8); z = (r() - 0.5) * (d - 8); k++; } while (k < 80 && (Math.hypot(x, z - (d / 2 - 4)) < 7 || pos.some((q) => Math.hypot(q[0] - x, q[2] - z) < 5) || blocked(x, z)));
    pos.push([x, 0, z]);
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (p.finale && p.finale.npc) {
      const f = p.finale;
      const fz = water ? -d / 2 + 3 : 0;
      npcAt(A, f.npc, 0, fz, Math.PI * 0, { label: `Talk to ${f.npc.name}`, onTalk: () => A.say(f.npc.name, f.say || 'Thank you!', () => A.win(p.done)) });
      A.setObjective(`Talk to ${f.npc.name}`, p.done || '');
      toast(`All found! Now talk to ${f.npc.name}.`);
      Sfx.badge();
    } else if (water && !p.noCross) {
      A.setObjective('Reach the far shore', '');
      toast('All found! Now get to the far shore.');
    } else A.win(p.done);
  };
  spawnItems(A, defs, pos, { label: p.label || 'found', onAll: finish });
  if (water && !p.finale) {
    A.onUpdate(() => { if (done && A.player.pos.z < -d / 2 + 5 && A.player.grounded) A.win(p.done); });
  }
  if (p.time) A.setTimer(p.time);
  const start = { x: 0, y: water ? 0.3 : 0, z: d / 2 - 3, facing: Math.PI };
  return {
    start,
    onStart() { A.setObjective(p.objective || `Find all ${count}`, water ? 'Hop across on the floating things — the water won\'t hurt, it just sends you back.' : ''); },
    onFall() { if (water) { toast('Splash! Back you go.'); A.respawn(); } else A.loseLife(); }
  };
}
