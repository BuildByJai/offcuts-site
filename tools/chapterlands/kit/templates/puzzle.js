// PUZZLE — a single-room logic puzzle (a lightweight cousin of The Study).
// Walk round the room, look at things for clues, then answer at the solve
// station. params:
//   room: { w, d, h, floor, wall }       size + colours (palette by default)
//   clues: [{ object, label, text, at? }] things to look at. object: desk | shelf | clock |
//          chair | box | picture | window | table | bed | barrel | chest | plant | statue | sign
//   solve: { object, label, type: choice|order|match|code, prompt, options, answer, items, pairs, hint }
//   invert: 'x'                          mirror-reversed controls
//   dark: true                           a dim room
//   needClues: N                         clues to read before the answer opens (default all)
//   objective, done, outdoors: true      (a garden/clearing instead of walls)
import * as THREE from 'three';
import { hex, prop } from '../props.js';
import { emojiSprite } from '../props.js';
import { renderSolve } from '../solve.js';
import { toast } from '../../js/hud.js';
import { Sfx } from '../../js/audio.js';

const OBJ_ICON = { desk: '🗄️', shelf: '📚', clock: '🕰️', chair: '🪑', box: '📦', picture: '🖼️', window: '🪟', table: '🍽️', bed: '🛏️', barrel: '🛢️', chest: '🧰', plant: '🪴', statue: '🗿', sign: '🪧', door: '🚪', mirror: '🪞', book: '📖', map: '🗺️', note: '📝', tree: '🌳', well: '🪣', lamp: '🪔', safe: '🔐' };

export function build(A) {
  const p = A.params, r = A.rng, P = A.P;
  const room = p.room || {};
  const w = room.w || 16, d = room.d || 14, h = room.h || 4.5;
  const out = !!p.outdoors;
  // a higher, further camera so you can see round the room
  Object.assign(A.cam.cfg, { distance: 6.5, maxDistance: 9, pitch: 0.62 });
  A.cam.wantDist = 6.5; A.cam.pitch = 0.62;
  A.ground(w, d, room.floor || (out ? 'grass' : 'floor'), { wallH: 8 });
  if (!out) {
    const wall = hex(room.wall || P.wall), trim = hex(P.trim);
    A.B.box(-w / 2 - 0.3, w / 2 + 0.3, 0, h, -d / 2 - 0.3, -d / 2, wall);
    A.B.box(-w / 2 - 0.3, -w / 2, 0, h, -d / 2, d / 2, wall);
    A.B.box(w / 2, w / 2 + 0.3, 0, h, -d / 2, d / 2, wall);
    A.B.box(-w / 2 - 0.3, w / 2 + 0.3, 0, h * 0.35, d / 2, d / 2 + 0.3, wall);   // low front wall so the camera sees in
    A.B.box(-w / 2, w / 2, 0, 0.18, -d / 2, -d / 2 + 0.05, trim);
    A.world.add(-w / 2 - 1, w / 2 + 1, 0, h, -d / 2 - 1, -d / 2);
    A.world.add(-w / 2 - 1, -w / 2, 0, h, -d / 2, d / 2);
    A.world.add(w / 2, w / 2 + 1, 0, h, -d / 2, d / 2);
    A.world.add(-w / 2 - 1, w / 2 + 1, 0, 2.5, d / 2, d / 2 + 1);
    // rug
    A.B.box(-w * 0.25, w * 0.25, 0, 0.02, -d * 0.2, d * 0.2, hex(P.accent), { cast: false });
  } else {
    A.decorate({ w, d, count: 20 });
  }
  // clue stations around the walls
  const clues = p.clues || [];
  const solve = p.solve || { type: 'choice', prompt: 'What now?', options: ['A', 'B', 'C'], answer: 0 };
  const stations = clues.concat([Object.assign({ object: solve.object || 'door', label: solve.label || 'The answer', _solve: true }, solve)]);
  const spots = [];
  const n = stations.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    // walk round the back and side walls: left wall → back wall → right wall
    let x, z, face;
    if (t < 0.25) { x = -w / 2 + 1.2; z = d / 2 - 2 - (t / 0.25) * (d - 3.5); face = Math.PI / 2; }
    else if (t < 0.75) { x = -w / 2 + 2 + ((t - 0.25) / 0.5) * (w - 4); z = -d / 2 + 1.2; face = 0; }
    else { x = w / 2 - 1.2; z = -d / 2 + 1.5 + ((t - 0.75) / 0.25) * (d - 3.5); face = -Math.PI / 2; }
    if (stations[i].at) { x = stations[i].at[0]; z = stations[i].at[1]; }
    spots.push({ x, z, face });
  }
  const read = new Set();
  const need = p.needClues == null ? clues.length : p.needClues;
  let solved = false;
  stations.forEach((S, i) => {
    const { x, z, face } = spots[i];
    // a plinth/prop for the object + its icon floating above
    const kind = S.object || 'box';
    const propFor = { desk: 'table', table: 'table', shelf: 'bookcase', bed: 'bed', barrel: 'barrel', chest: 'crate', box: 'crate', plant: 'bush', statue: 'statue', tree: 'tree', chair: 'chair' }[kind];
    if (propFor) prop(propFor, A.B, A.world, x, z, 0.9, P, r);
    else { A.B.box(x - 0.5, x + 0.5, 0, 1.0, z - 0.5, z + 0.5, hex(S._solve ? P.accent : P.trim)); A.world.add(x - 0.5, x + 0.5, 0, 1.0, z - 0.5, z + 0.5); }
    const sp = emojiSprite(OBJ_ICON[kind] || '❓', S._solve ? 1.2 : 0.95);
    sp.position.set(x, propFor === 'bookcase' || propFor === 'tree' ? 3.2 : 2.2, z); A.scene.add(sp);
    const ox = x + Math.sin(face) * 1.4, oz = z + Math.cos(face) * 1.4;
    A.onUpdate((dt, t) => { sp.position.y += Math.sin(t * 2 + i) * 0.002; sp.material.opacity = S._solve && read.size < need ? 0.6 : 1; });
    A.interact({
      x: ox, z: oz, y: 0, r: 1.7,
      label: () => (S._solve ? (solved ? 'Done!' : (S.label || 'Solve it')) : `Look at the ${S.label || kind}`),
      act: () => {
        Sfx.click();
        if (!S._solve) {
          if (!read.has(i)) { read.add(i); A.setProgress(`${Math.min(read.size, need)} / ${need} clues`); }
          A.say(S.label || kind, S.text || '');
          return;
        }
        if (solved) return;
        if (read.size < need) { toast(`Look around first — ${need - read.size} more clue${need - read.size === 1 ? '' : 's'} to find.`); return; }
        const box = A.say(S.label || 'Solve it', '', null, '');
        box.parentElement.querySelector('#btn-say-close').textContent = 'Not yet';
        renderSolve(box, S, (ok) => {
          if (!ok) return;
          solved = true;
          box.parentElement.querySelector('#btn-say-close').textContent = 'OK';
          A.closePanel();
          A.win(p.done || S.success);
        });
      }
    });
  });
  if (need) A.setProgress(`0 / ${need} clues`);
  if (p.dark) {
    const lamp = new THREE.PointLight(0xffd8a0, 6, 14, 1.6);
    lamp.position.set(0, 3.2, 0); A.scene.add(lamp);
  }
  return {
    start: { x: 0, y: 0, z: d / 2 - 2, facing: Math.PI },
    onStart() {
      A.setObjective(p.objective || 'Look around, then solve it', p.invert ? 'Everything is back to front in here — even your feet!' : `${need} clue${need === 1 ? '' : 's'} to find`);
    }
  };
}
