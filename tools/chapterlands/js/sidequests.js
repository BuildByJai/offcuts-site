// Side quest framework (A1 §5). Quests are data:
//   { id, title, giver, steps: [{ type, params, text, say? }], reward: { coins, badge? } }
// Step types: talk · collect · deliver · reach. Town quests are defined in
// config.js; District Kit quests come from each book.json (same format, with
// positions in that plot's frame). Side quests never need reading.
//
// The town supplies `resolve(spec)` to turn a position spec into world x/z:
//   [x, y, z]            world position (y = height above the ground)
//   [x, z]               world position on the ground
//   'plot:<bookId>'      the road-side front of that book's plot
//   'shelf:<quarter>'    the little shelf under that road's arch
//   { frame, at }        an offset in a plot's frame (District Kit quests)
import * as THREE from 'three';
import { Save } from './save.js';
import { Sfx } from './audio.js';
import { toast, awardBadge, confetti } from './hud.js';
import { track } from './track.js';
import { buildNPC, bookItem, trinket } from './critters.js';
import { Catalogue, quarterIcon } from './catalogue.js';

const _v = new THREE.Vector3();
let bangTex = null;
function bangSprite() {
  if (!bangTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#2a2420'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#2a2420'; x.font = 'bold 40px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 32, 34);
    bangTex = new THREE.CanvasTexture(c); bangTex.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthWrite: false }));
  s.scale.set(0.7, 0.7, 1);
  return s;
}

export class SideQuests {
  constructor({ scene, player, quests, npcs, resolve, say, earn, interactables }) {
    this.scene = scene; this.player = player; this.resolve = resolve; this.say = say; this.earn = earn;
    this.quests = quests;
    this.t = 0;
    this.npcs = {};
    this.items = {};       // item id → { def, quest, mesh, x, y, z }
    this.targets = [];     // deliver targets
    this.carry = [];       // item ids picked up (collect) but not yet delivered
    this.trackerEl = document.getElementById('quest-tracker');

    for (const d of npcs) {
      const p = resolve(d.at, d.frame);
      const g = buildNPC(d);
      g.position.set(p.x, p.y || 0, p.z);
      g.rotation.y = d.facing != null ? d.facing : (p.facing || 0);
      scene.add(g);
      const n = { def: d, g, home: g.position.clone(), moving: false, path: null, speed: d.speed || 5.5 };
      n.bang = bangSprite();
      n.bang.position.y = d.kind === 'horse' ? 3 : 2.5;
      g.add(n.bang);
      this.npcs[d.id] = n;
      interactables.push({
        get x() { return n.g.position.x; }, get z() { return n.g.position.z; }, y: 0, r: 2.1,
        get label() { return `Talk to ${d.name}`; },
        act: () => this.talk(d.id)
      });
    }
    // items for every quest (shown only while their collect step is active)
    for (const q of quests) {
      q.steps.forEach((s, si) => {
        if (s.type === 'collect') {
          for (const it of s.params.items) {
            const p = resolve(it.at, it.frame || q.frame);
            let mesh;
            if (it.quarter) {
              const Q = Catalogue.getQuarter(it.quarter);
              mesh = bookItem(Q ? Q.colour : '#888888', quarterIcon(Q));
            } else mesh = trinket(it.colour ? new THREE.Color(it.colour).getHex() : 0xffd23f, it.shape || 'gem');
            mesh.position.set(p.x, p.y || 0, p.z);
            mesh.visible = false;
            scene.add(mesh);
            this.items[it.id] = { def: it, quest: q, step: si, mesh, x: p.x, y: p.y || 0, z: p.z, base: p.y || 0 };
          }
        }
        if (s.type === 'deliver') {
          for (const pair of s.params.pairs) {
            const p = resolve(pair.target, q.frame);
            const it = this._itemDef(q, pair.item);
            const label = it && it.quarter ? `Shelve the ${Catalogue.getQuarter(it.quarter).name} book` : (pair.label || 'Hand it over');
            const T = { q, si, pair, x: p.x, z: p.z };
            this.targets.push(T);
            interactables.push({
              x: p.x, z: p.z, y: 0, r: 2.0,
              get label() { return label; },
              get active() { return true; },
              act: () => this.deliver(T)
            });
          }
        }
      });
    }
    this.carry = [];
    for (const q of quests) {
      const st = Save.quest(q.id);
      for (const id of Object.keys(st.got)) if (!st.gave[id]) this.carry.push(id);
    }
    this.refresh();
  }

  _itemDef(q, id) {
    for (const s of q.steps) if (s.type === 'collect') { const f = s.params.items.find((i) => i.id === id); if (f) return f; }
    return null;
  }
  stepOf(q) { const st = Save.quest(q.id); return st.done ? null : q.steps[st.step]; }

  // Show/hide items and place actors to match saved progress.
  refresh() {
    for (const it of Object.values(this.items)) {
      const st = Save.quest(it.quest.id);
      it.mesh.visible = !st.done && st.step === it.step && !st.got[it.def.id];
    }
    for (const q of this.quests) {
      const s = this.stepOf(q);
      if (s && s.type === 'reach' && s.params.actor) {
        const n = this.npcs[s.params.actor];
        if (n && !n.path) { n.k = 0; this._placeActor(n, s, 0); }
      }
      // a finished "lead" quest leaves its actor where it ended up
      const st = Save.quest(q.id);
      if (st.done || (s && s.type === 'talk' && st.step > 0)) {
        const prev = q.steps[st.done ? q.steps.length - 1 : st.step - 1];
        const reachStep = [...q.steps.slice(0, st.done ? q.steps.length : st.step)].reverse().find((x) => x.type === 'reach' && x.params.actor);
        if (reachStep && prev) {
          const n = this.npcs[reachStep.params.actor];
          if (n && !n.path) { const last = reachStep.params.points[reachStep.params.points.length - 1]; const p = this.resolve(last); n.g.position.set(p.x, 0, p.z); }
        }
      }
    }
    this.renderTracker();
  }
  _placeActor(n, s, k) {
    const p = this.resolve(s.params.points[k]);
    n.g.position.set(p.x, 0, p.z);
  }

  /* ---------- step actions ---------- */
  talk(npcId) {
    const n = this.npcs[npcId];
    // the first quest whose current step is "talk to this NPC"
    for (const q of this.quests) {
      const s = this.stepOf(q);
      if (s && s.type === 'talk' && s.params.npc === npcId) {
        this.say(n.def.name, s.say || '…', () => this.advance(q));
        return;
      }
    }
    for (const q of this.quests) {
      const s = this.stepOf(q);
      if (s && s.type === 'reach' && s.params.actor === npcId && s.say) { this.say(n.def.name, s.say); return; }
    }
    const done = this.quests.find((q) => q.giver === npcId && Save.quest(q.id).done);
    this.say(n.def.name, (done && (n.def.thanks || 'Thank you again!')) || n.def.idle || 'Hello there!');
  }
  deliver(T) {
    const st = Save.quest(T.q.id);
    if (st.done) { toast('The shelf is neat and tidy.'); return; }
    const s = T.q.steps[st.step];
    if (!s || s.type !== 'deliver' || T.q.steps.indexOf(s) !== T.si) {
      const it = this._itemDef(T.q, T.pair.item);
      toast(it && it.quarter ? `A little shelf for ${Catalogue.getQuarter(it.quarter).name} books.` : 'Nothing to hand over yet.');
      return;
    }
    if (st.gave[T.pair.item]) { toast('That one is already back where it belongs.'); return; }
    if (!st.got[T.pair.item]) {
      const it = this._itemDef(T.q, T.pair.item);
      toast(it && it.quarter ? `This shelf is for ${Catalogue.getQuarter(it.quarter).name} books. You don't have that one yet.` : "You haven't found that yet.");
      Sfx.beep(false);
      return;
    }
    st.gave[T.pair.item] = 1;
    this.carry = this.carry.filter((x) => x !== T.pair.item);
    Save.saveQuests();
    Sfx.beep(true);
    const it = this._itemDef(T.q, T.pair.item);
    const left = s.params.pairs.filter((p) => !st.gave[p.item]).length;
    toast(it && it.quarter ? `${quarterIcon(Catalogue.getQuarter(it.quarter))} ${Catalogue.getQuarter(it.quarter).name} book shelved! ${left ? left + ' to go.' : ''}` : `Done! ${left ? left + ' to go.' : ''}`);
    if (!left) this.advance(T.q);
    else this.renderTracker();
  }

  advance(q) {
    const st = Save.quest(q.id);
    if (st.done) return;
    track('quest-step', { quest: q.id, step: st.step });
    st.step++;
    if (st.step >= q.steps.length) {
      st.done = true;
      Save.saveQuests();
      track('quest-complete', { quest: q.id });
      Sfx.badge();
      confetti({ count: 140 });
      toast(`🧭 Quest complete: <b>${q.title}</b> · +${q.reward.coins} coins`, { badge: true, ms: 3800 });
      if (q.reward.coins) this.earn(q.reward.coins);
      if (q.reward.badge) setTimeout(() => awardBadge(q.reward.badge), 900);
    } else {
      Save.saveQuests();
      Sfx.unlockLock();
      toast(`🧭 ${q.title}: ${q.steps[st.step].text}`, { ms: 3600 });
    }
    this.refresh();
  }

  /* ---------- per frame ---------- */
  update(dt) {
    this.t += dt;
    const p = this.player.pos;
    // items: spin, bob, pick up
    for (const it of Object.values(this.items)) {
      if (!it.mesh.visible) continue;
      it.mesh.rotation.y += dt * 1.6;
      it.mesh.position.y = it.base + Math.sin(this.t * 2 + it.x) * 0.12;
      if (Math.hypot(p.x - it.x, p.z - it.z) < 1.3 && Math.abs(p.y - it.base) < 2.2) {
        const st = Save.quest(it.quest.id);
        st.got[it.def.id] = 1;
        it.mesh.visible = false;
        this.carry.push(it.def.id);
        Save.saveQuests();
        Sfx.golden();
        const s = it.quest.steps[it.step];
        const left = s.params.items.filter((i) => !st.got[i.id]).length;
        const Q = it.def.quarter && Catalogue.getQuarter(it.def.quarter);
        toast(Q ? `${quarterIcon(Q)} A ${Q.name} book! ${left ? left + ' more to find.' : 'That\'s all of them!'}` : `${it.def.name || 'Found one'}! ${left ? left + ' more to find.' : 'That\'s all of them!'}`);
        if (!left) this.advance(it.quest);
        else this.renderTracker();
      }
    }
    // actors for reach steps
    for (const q of this.quests) {
      const s = this.stepOf(q);
      if (!s || s.type !== 'reach') continue;
      const n = s.params.actor && this.npcs[s.params.actor];
      const r = s.params.radius || 2.5;
      if (!n) {
        // plain reach: go to each point in turn
        const st = Save.quest(q.id);
        const k = st.reachK || 0;
        const tgt = this.resolve(s.params.points[k]);
        if (Math.hypot(p.x - tgt.x, p.z - tgt.z) < r) {
          st.reachK = k + 1;
          if (st.reachK >= s.params.points.length) { st.reachK = 0; this.advance(q); } else Save.saveQuests();
        }
        continue;
      }
      if (n.k == null) n.k = 0;
      if (s.params.lead) {
        // walk ahead along the points while the player keeps up
        const tgt = this.resolve(s.params.points[Math.min(n.k, s.params.points.length - 1)]);
        const dPlayer = Math.hypot(p.x - n.g.position.x, p.z - n.g.position.z);
        const dx = tgt.x - n.g.position.x, dz = tgt.z - n.g.position.z, d = Math.hypot(dx, dz);
        const go = dPlayer < 9 && d > 0.3;
        n.moving = go;
        if (go) {
          const sp = Math.min(d, (n.speed * 0.75) * dt);
          n.g.position.x += dx / d * sp; n.g.position.z += dz / d * sp;
          n.g.rotation.y = Math.atan2(dx, dz);
        } else if (dPlayer < 9 || d <= 0.3) {
          n.g.rotation.y = Math.atan2(p.x - n.g.position.x, p.z - n.g.position.z);
        }
        if (d <= 0.3 && n.k < s.params.points.length - 1) n.k++;
        if (d <= 0.3 && n.k >= s.params.points.length - 1 && dPlayer < r) { n.k = null; n.moving = false; this.advance(q); }
      } else {
        // hop away to the next point each time the player catches up
        if (n.path) {
          n.path.t += dt / n.path.dur;
          const k = Math.min(1, n.path.t);
          n.g.position.lerpVectors(n.path.a, n.path.b, k);
          n.moving = true;
          if (k >= 1) { n.path = null; n.moving = false; }
        } else {
          const dPlayer = Math.hypot(p.x - n.g.position.x, p.z - n.g.position.z);
          if (dPlayer < r) {
            n.k++;
            if (n.k >= s.params.points.length) { n.k = null; this.advance(q); Sfx.golden(); continue; }
            const b = this.resolve(s.params.points[n.k]);
            n.path = { a: n.g.position.clone(), b: new THREE.Vector3(b.x, 0, b.z), t: 0, dur: Math.max(0.6, n.g.position.distanceTo(_v.set(b.x, 0, b.z)) / n.speed) };
            n.g.rotation.y = Math.atan2(b.x - n.g.position.x, b.z - n.g.position.z);
            Sfx.jump();
            if (n.k === 1) toast(s.say ? `“${s.say}”` : 'After him!');
          } else {
            n.g.rotation.y += Math.sin(this.t * 3) * dt * 0.8;   // fidgety
          }
        }
      }
    }
    for (const [id, n] of Object.entries(this.npcs)) {
      if (n.g.userData.anim) n.g.userData.anim(this.t, n.moving);
      const wants = this.quests.some((q) => { const s = this.stepOf(q); return s && ((s.type === 'talk' && s.params.npc === id) || (s.type === 'reach' && s.params.actor === id && !s.params.lead)); });
      n.bang.visible = wants;
      if (wants) n.bang.position.y = (n.def.kind === 'horse' ? 3 : 2.5) + Math.sin(this.t * 3) * 0.12;
    }
  }

  renderTracker() {
    if (!this.trackerEl) return;
    const active = this.quests.filter((q) => { const st = Save.quest(q.id); return !st.done && st.step > 0; });
    if (!active.length) { this.trackerEl.hidden = true; return; }
    const q = active[active.length - 1];
    const s = q.steps[Save.quest(q.id).step];
    let extra = '';
    if (s.type === 'collect') { const st = Save.quest(q.id); extra = ` (${s.params.items.filter((i) => st.got[i.id]).length}/${s.params.items.length})`; }
    if (s.type === 'deliver') { const st = Save.quest(q.id); extra = ` (${s.params.pairs.filter((x) => st.gave[x.item]).length}/${s.params.pairs.length})`; }
    this.trackerEl.innerHTML = `<b>🧭 ${q.title}</b><span></span>`;
    this.trackerEl.querySelector('span').textContent = s.text + extra;
    this.trackerEl.hidden = false;
  }
}
