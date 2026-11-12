// SNEAK — reach a goal without being seen. Watchers patrol with sight cones
// drawn on the ground; hiding spots (bushes, crates, curtains) keep you safe.
// params:
//   area: [w, d]               (default 40 × 48)
//   watchers: N or [{ path: [[x,z]...], speed }]   who's looking
//   watcher: { kind, look, name }                    what they look like
//   view: metres (default 8), fov: degrees (default 60)
//   hides: N                    hiding spots
//   dark: true                  night-time (softer light, cones glow)
//   goal: { name, icon }        what you're sneaking to
//   lives: N (default 3)
//   floor, objective, done
import * as THREE from 'three';
import { npcAt, goalMarker, checkpointPad } from '../common.js';
import { hex, prop } from '../props.js';
import { toast } from '../../js/hud.js';
import { Sfx } from '../../js/audio.js';

export function build(A) {
  const p = A.params, r = A.rng, P = A.P;
  const [w, d] = p.area || [40, 48];
  A.ground(w, d, p.floor || 'grass', { wallH: 6 });
  A.decorate({ w, d, count: 26 });
  // cover: low walls / hedges between the start and the goal
  const blocks = [];
  for (let i = 0; i < (p.cover || 7); i++) {
    const x = (r() - 0.5) * (w - 10), z = d / 2 - 10 - (i + 0.5) * (d - 18) / (p.cover || 7);
    const bw = 3 + r() * 4;
    A.B.box(x - bw / 2, x + bw / 2, 0, 2.2, z - 0.6, z + 0.6, hex(i % 2 ? P.wall : P.stone));
    const c = A.world.add(x - bw / 2, x + bw / 2, 0, 2.2, z - 0.6, z + 0.6);
    blocks.push(c);
  }
  // hiding spots: stand inside to be invisible
  const hides = [];
  const hideKind = A.theme.hide || 'bush';
  for (let i = 0; i < (p.hides || 6); i++) {
    const x = (r() - 0.5) * (w - 8), z = d / 2 - 8 - (i + 0.3) * (d - 14) / (p.hides || 6);
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 2.2), new THREE.MeshLambertMaterial({ color: hex(hideKind === 'bush' ? P.leaf : P.accent2), transparent: true, opacity: 0.85 }));
    m.position.set(x, 0.95, z); A.scene.add(m);
    hides.push({ x, z, m });
  }
  // watchers
  const defs = Array.isArray(p.watchers) ? p.watchers : Array.from({ length: p.watchers || 3 }, (_, i) => {
    const z = d / 2 - 14 - i * (d - 22) / Math.max(1, (p.watchers || 3) - 1 || 1);
    const x0 = -w / 2 + 5, x1 = w / 2 - 5;
    return { path: i % 2 ? [[x0, z], [x1, z]] : [[x1, z], [x0, z]], speed: 2 + (i % 3) * 0.4 };
  });
  const view = p.view || 8, fov = (p.fov || 60) * Math.PI / 180;
  const coneGeo = new THREE.CircleGeometry(view, 20, -fov / 2, fov);
  coneGeo.rotateX(-Math.PI / 2);
  const watchers = defs.map((W, i) => {
    const g = npcAt(A, p.watcher || { kind: 'person', name: 'Watcher', look: { shirt: 0x2b3442 } }, W.path[0][0], W.path[0][1], 0);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: p.dark ? 0xfff2a8 : 0xffd23f, transparent: true, opacity: p.dark ? 0.35 : 0.28, depthWrite: false }));
    cone.position.y = 0.05; A.scene.add(cone);
    return { W, g, cone, k: 1, wait: 0, ang: 0 };
  });
  let spottedT = 0;
  const lastHidden = { v: false };
  A.setLives(p.lives || 3);
  const _ray = new THREE.Vector3();
  A.onUpdate((dt, t) => {
    const pl = A.player.pos;
    const hidden = hides.some((h) => Math.abs(pl.x - h.x) < 1.1 && Math.abs(pl.z - h.z) < 1.1);
    if (hidden !== lastHidden.v) { lastHidden.v = hidden; hides.forEach((h) => { h.m.material.opacity = hidden ? 0.55 : 0.85; }); if (hidden) toast('Hidden 🤫'); }
    spottedT -= dt;
    for (const o of watchers) {
      const path = o.W.path, tgt = path[o.k];
      const g = o.g.position;
      const dx = tgt[0] - g.x, dz = tgt[1] - g.z, dist = Math.hypot(dx, dz);
      if (o.wait > 0) { o.wait -= dt; o.ang += Math.sin(t * 2) * dt * 0.8; o.g.userData.moving = false; }
      else if (dist < 0.2) { o.k = (o.k + 1) % path.length; o.wait = 1.4; }
      else {
        const sp = (o.W.speed || 2) * dt;
        g.x += dx / dist * Math.min(sp, dist); g.z += dz / dist * Math.min(sp, dist);
        o.ang = Math.atan2(dx, dz);
        o.g.userData.moving = true;
      }
      o.g.rotation.y = o.ang;
      o.cone.position.x = g.x; o.cone.position.z = g.z;
      o.cone.rotation.y = o.ang - Math.PI / 2;
      // can they see the player?
      if (hidden || spottedT > 0 || A.state() !== 'playing') continue;
      const px = pl.x - g.x, pz = pl.z - g.z, pd = Math.hypot(px, pz);
      if (pd > view || pd < 0.01) continue;
      const a = Math.atan2(px, pz);
      let da = a - o.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > fov / 2) continue;
      if (pl.y > 2.3) continue;   // up on a wall: out of sight
      // walls block the view
      _ray.set(px / pd, 0, pz / pd);
      const hit = A.world.raycast(g.x, 1.2, g.z, _ray.x, 0, _ray.z, pd);
      if (hit < pd - 0.4) continue;
      spottedT = 1.5;
      Sfx.beep(false);
      A.loseLife(`${(p.watcher && p.watcher.name) || 'Someone'} spotted you! Back to the last safe spot.`);
    }
  });
  // checkpoints halfway
  checkpointPad(A, -w / 2 + 3, 0, 0, Math.PI);
  const goal = goalMarker(A, 0, 0, -d / 2 + 4, (p.goal && p.goal.icon) || '🚪');
  let done = false;
  A.onUpdate(() => {
    if (done) return;
    const pl = A.player.pos;
    if (Math.hypot(pl.x - goal.position.x, pl.z - goal.position.z) < 1.8) { done = true; A.win(p.done); }
  });
  return {
    start: { x: 0, y: 0, z: d / 2 - 3, facing: Math.PI },
    usesLives: true,
    onStart() { A.setObjective(p.objective || `Reach the ${(p.goal && p.goal.name) || 'goal'} without being seen`, 'Stay out of the yellow cones. Bushes hide you.'); }
  };
}
