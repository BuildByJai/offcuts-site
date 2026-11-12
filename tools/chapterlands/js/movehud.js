// Move HUD shared by every scene with the player controller: a stamina bar
// (doubles as the super-jump charge meter), active boost timers, and the
// trick combo meter that pays out coins when you land a long air chain.
import { CONFIG } from '../config.js';
import { Sfx } from './audio.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export class MoveHud {
  constructor(player) {
    this.player = player;
    const root = el('div', 'movehud', document.body);
    root.id = 'movehud';
    this.root = root;
    this.stam = el('div', 'stam', root);
    this.stamFill = el('span', 'stam-fill', this.stam);
    this.stamCharge = el('span', 'stam-charge', this.stam);
    this.stamLabel = el('em', 'stam-label', this.stam, '');
    this.boostBox = el('div', 'boosts', document.body);
    this.boostBox.id = 'boosts';
    this.boostEls = {};
    for (const b of CONFIG.shop.boosts) {
      const e = el('div', 'boost-pill', this.boostBox, `<span class="bi">${b.icon}</span><b>0</b>`);
      e.hidden = true;
      this.boostEls[b.id] = e;
    }
    this.vis = 0;
    this.visible = true;
  }
  show(on) {
    this.visible = on;
    this.root.hidden = !on; this.boostBox.hidden = !on;
  }
  update(dt) {
    if (!this.visible) return;
    const p = this.player;
    const s = p.stamina / p.st.max;
    const charging = p.charging;
    const want = (s < 0.995 || charging || p.gliding) ? 1 : 0;
    this.vis += (want - this.vis) * Math.min(1, dt * (want ? 10 : 2.5));
    this.stam.style.opacity = this.vis.toFixed(2);
    this.stamFill.style.width = (s * 100).toFixed(1) + '%';
    this.stam.classList.toggle('low', s < 0.3);
    const c = p.chargeLevel;
    this.stamCharge.style.width = charging ? (c * 100).toFixed(1) + '%' : '0%';
    this.stam.classList.toggle('charging', charging);
    this.stam.classList.toggle('full', charging && c >= 1);
    this.stamLabel.textContent = charging ? (c >= 1 ? 'SUPER!' : 'charge') : (p.gliding ? 'glide' : '');
    for (const b of CONFIG.shop.boosts) {
      const left = p.boosts[b.id] || 0, e = this.boostEls[b.id];
      e.hidden = left <= 0;
      if (left > 0) { e.querySelector('b').textContent = Math.ceil(left) + 's'; e.classList.toggle('ending', left < 5); }
    }
  }
}

// Counts tricks chained without touching the ground. Lands pay out coins.
export class Combo {
  constructor(player, { onPayout = null, onCount = null } = {}) {
    this.player = player;
    this.count = 0; this.names = []; this.onPayout = onPayout; this.onCount = onCount;
    const box = el('div', 'combo', document.body);
    box.id = 'combo';
    box.hidden = true;
    this.box = box;
    this.numEl = el('b', 'combo-n', box, '×0');
    this.nameEl = el('span', 'combo-name', box, '');
    this.payEl = el('em', 'combo-pay', box, '');
    this.hideT = 0;
    player.on('trick', (name) => this.add(name));
    player.on('land', () => this.end());
    player.on('pullUp', () => this.end());
  }
  add(name) {
    if (name === 'ladder') return;
    this.count++;
    this.names.push(name);
    const E = CONFIG.economy;
    this.box.hidden = false;
    this.box.classList.remove('paid');
    this.numEl.textContent = '×' + this.count;
    this.nameEl.textContent = name;
    const pay = this.value();
    this.payEl.textContent = pay > 0 ? `+${pay} 🪙` : `${E.comboMin - this.count} more`;
    this.box.classList.remove('pulse'); void this.box.offsetWidth; this.box.classList.add('pulse');
    this.hideT = 0;
    if (this.count > 1) Sfx.combo(this.count);
    if (this.onCount) this.onCount(this.count);
  }
  value() {
    const E = CONFIG.economy;
    return this.count >= E.comboMin ? Math.min(E.comboCap, this.count - E.comboMin + 1) : 0;
  }
  end() {
    if (this.player.ride) return;
    if (!this.count) return;
    const pay = this.value();
    if (pay > 0) {
      this.payEl.textContent = `+${pay} 🪙 landed!`;
      this.box.classList.add('paid');
      Sfx.payout();
      if (this.onPayout) this.onPayout(pay, this.count, this.names.slice());
      this.hideT = 1.6;
    } else this.hideT = 0.5;
    this.count = 0; this.names = [];
  }
  cancel() { this.count = 0; this.names = []; this.box.hidden = true; }
  update(dt) {
    if (this.hideT > 0) { this.hideT -= dt; if (this.hideT <= 0 && !this.count) this.box.hidden = true; }
  }
}
