// BUILD — place or arrange objects to meet a goal. Pick things up by walking
// into them (you carry one at a time), then use a labelled spot to put it down.
// params:
//   area: [w, d]
//   items: [{ id, name, icon }]
//   slots: [{ id, name, accepts: [itemIds] }]     where things go
//   order: true          slots must be filled in order (oil the joints in the right order)
//   anyItem: true        any item fills any slot (block the gaps)
//   hint                 shown when something's in the wrong place
//   floor, objective, done
import * as THREE from 'three';
import { pickup, hex, emojiSprite } from '../props.js';
import { signMesh } from '../../js/world.js';
import { toast } from '../../js/hud.js';
import { Sfx } from '../../js/audio.js';

export function build(A) {
  const p = A.params, r = A.rng, P = A.P;
  const [w, d] = p.area || [30, 30];
  A.ground(w, d, p.floor || 'grass', { wallH: 6 });
  A.decorate({ w, d, count: 22 });
  const items = (p.items || []).map((it, i) => {
    const g = pickup(it.icon || '📦', P.item);
    let x, z, k = 0;
    do { x = (r() - 0.5) * (w - 8); z = d / 2 - 6 - r() * (d * 0.45); k++; } while (k < 20 && Math.hypot(x, z - (d / 2 - 3)) < 4);
    g.position.set(x, 0, z); A.scene.add(g);
    return Object.assign({ g, x, z, state: 'ground', home: [x, z] }, it);
  });
  const slots = (p.slots || []).map((s, i) => {
    const n = p.slots.length;
    const x = -w / 2 + 4 + (i + 0.5) * (w - 8) / n, z = -d / 2 + 5 + (i % 2) * 2.5;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 2.2), new THREE.MeshLambertMaterial({ color: hex(P.trim) }));
    pad.position.set(x, 0.12, z); A.scene.add(pad);
    A.world.add(x - 1.1, x + 1.1, 0, 0.25, z - 1.1, z + 1.1);
    const label = signMesh(s.name, { w: 2.4, h: 0.55, bg: '#f4ead2', fg: '#3a2a20', px: 54 });
    label.position.set(x, 1.4, z - 1.15); A.scene.add(label);
    if (p.order) { const num = emojiSprite(String(i + 1), 0.6); num.position.set(x, 2.1, z - 1.1); A.scene.add(num); }
    return Object.assign({ x, z, pad, filled: null }, s);
  });
  let carry = null;
  const carryEl = document.createElement('div');
  carryEl.className = 'carry'; carryEl.hidden = true; document.body.appendChild(carryEl);
  const filled = () => slots.filter((s) => s.filled).length;
  A.setProgress(`${filled()} / ${slots.length} placed`);
  A.onUpdate((dt, t) => {
    const pl = A.player.pos;
    for (const it of items) {
      if (it.state === 'ground') {
        it.g.userData.gem.rotation.y += dt * 2;
        if (!carry && Math.hypot(pl.x - it.x, pl.z - it.z) < 1.2 && pl.y < 1.5) {
          carry = it; it.state = 'carried'; Sfx.coin();
          carryEl.hidden = false; carryEl.textContent = `Carrying: ${it.icon || ''} ${it.name}`;
        }
      } else if (it.state === 'carried') {
        it.g.position.set(pl.x, pl.y + 2.1, pl.z);
      }
    }
  });
  const place = (s) => {
    if (s.filled) { toast(`${s.name} already has ${s.filled.name}.`); return; }
    if (!carry) { toast('Pick something up first — walk into it.'); return; }
    if (p.order) {
      const next = slots.find((x) => !x.filled);
      if (next !== s) { toast(p.hint || `Not yet — start with number ${slots.indexOf(next) + 1}.`); Sfx.beep(false); return; }
    }
    const ok = p.anyItem || !s.accepts || s.accepts.includes(carry.id);
    if (!ok) {
      Sfx.beep(false);
      toast(p.hint ? `Hmm, ${carry.name} doesn't go there. ${p.hint}` : `Hmm, ${carry.name} doesn't go there.`);
      carry.state = 'ground'; carry.g.position.set(carry.home[0], 0, carry.home[1]); carry.x = carry.home[0]; carry.z = carry.home[1];
      carry = null; carryEl.hidden = true;
      return;
    }
    s.filled = carry; carry.state = 'placed';
    carry.g.position.set(s.x, 0.25, s.z);
    carry = null; carryEl.hidden = true;
    Sfx.beep(true);
    A.juice.sparkle(s.x, 1, s.z, 16, 0xfff2a8, { speed: 3 });
    A.setProgress(`${filled()} / ${slots.length} placed`);
    if (filled() === slots.length) { carryEl.remove(); A.win(p.done); }
  };
  for (const s of slots) A.interact({ x: s.x, z: s.z + 1.6, y: 0, r: 1.9, label: () => (carry ? `Put ${carry.name} on “${s.name}”` : s.name), act: () => place(s) });
  return {
    start: { x: 0, y: 0, z: d / 2 - 3, facing: Math.PI },
    onStart() { A.setObjective(p.objective || 'Put everything in the right place', p.order ? 'Do them in order: 1, 2, 3…' : 'Walk into a thing to pick it up, then use a spot to put it down.'); }
  };
}
