// The shop stall: permanent move unlocks + timed boosts, paid from the coin
// wallet. Unlocks are saved (save.js); boosts start straight away.
import { CONFIG } from '../config.js';
import { Save } from './save.js';
import { Sfx } from './audio.js';

export class Shop {
  constructor({ player, input, toast, awardBadge, onOpen, onClose, onUnlock }) {
    this.player = player; this.input = input; this.toast = toast; this.awardBadge = awardBadge;
    this.onOpen = onOpen; this.onClose = onClose; this.onUnlock = onUnlock;
    const o = document.createElement('div');
    o.className = 'overlay'; o.id = 'shop'; o.hidden = true;
    o.innerHTML = `<div class="card scrollable shop-card">
      <div class="shop-head"><div><span class="tag-inline">market stall</span><h2>Moves &amp; boosts</h2></div>
      <div class="wallet-big">🪙 <b class="shop-wallet">0</b></div></div>
      <h3>Moves (yours to keep)</h3>
      <div class="shop-grid shop-unlocks"></div>
      <h3>Boosts (start now)</h3>
      <div class="shop-grid shop-boosts"></div>
      <p class="fineprint" style="margin-top:12px">Earn coins by collecting them around town, landing trick combos, breaking cracked crates and racing the time trials.</p>
      <button class="btn ghost shop-close" type="button">Close</button>
    </div>`;
    document.body.appendChild(o);
    this.el = o;
    o.querySelector('.shop-close').addEventListener('click', () => this.close());
    o.addEventListener('click', (e) => { if (e.target === o) this.close(); });

    const tip = document.createElement('div');
    tip.className = 'overlay'; tip.id = 'move-tip'; tip.hidden = true;
    tip.innerHTML = `<div class="card tip-card"><div class="tip-icon"></div><span class="tag-inline">new move</span><h2 class="tip-title"></h2><p class="lede tip-text"></p><button class="btn tip-go" type="button">Try it</button></div>`;
    document.body.appendChild(tip);
    this.tip = tip;
    tip.querySelector('.tip-go').addEventListener('click', () => { tip.hidden = true; if (this.onClose) this.onClose(); });
    Save.onChange((w) => { if (w === 'wallet' && !this.el.hidden) this.render(); });
  }
  get isOpen() { return !this.el.hidden || !this.tip.hidden; }
  open() {
    this.render();
    this.el.hidden = false;
    if (this.onOpen) this.onOpen();
  }
  close() {
    this.el.hidden = true;
    if (this.onClose) this.onClose();
  }
  render() {
    const w = Save.wallet();
    this.el.querySelector('.shop-wallet').textContent = Save.DEBUG ? '∞' : w;
    const un = this.el.querySelector('.shop-unlocks');
    un.innerHTML = '';
    for (const u of CONFIG.shop.unlocks) {
      const owned = Save.hasUnlock(u.id);
      const card = document.createElement('div');
      card.className = 'shop-item' + (owned ? ' owned' : '');
      card.innerHTML = `<div class="si-icon">${u.icon}</div><div class="si-body"><b>${u.name}</b><span>${u.desc}</span></div>
        <button class="btn si-buy" type="button">${owned ? 'Owned' : '🪙 ' + u.price}</button>`;
      const btn = card.querySelector('.si-buy');
      btn.disabled = owned || w < u.price;
      if (!owned && w < u.price) btn.title = `Need ${u.price - w} more coins`;
      btn.addEventListener('click', () => this.buyUnlock(u));
      un.appendChild(card);
    }
    const bo = this.el.querySelector('.shop-boosts');
    bo.innerHTML = '';
    for (const b of CONFIG.shop.boosts) {
      const active = (this.player.boosts[b.id] || 0) > 0;
      const card = document.createElement('div');
      card.className = 'shop-item';
      card.innerHTML = `<div class="si-icon">${b.icon}</div><div class="si-body"><b>${b.name}</b><span>${b.desc}</span></div>
        <button class="btn si-buy" type="button">${active ? 'Top up' : ''} 🪙 ${b.price}</button>`;
      const btn = card.querySelector('.si-buy');
      btn.disabled = w < b.price;
      btn.addEventListener('click', () => this.buyBoost(b));
      bo.appendChild(card);
    }
  }
  buyUnlock(u) {
    if (Save.hasUnlock(u.id)) return;
    if (!Save.spend(u.price)) { Sfx.denied(); return; }
    Save.unlock(u.id);
    this.player.setUnlocks(Save.unlocks());
    this.input.setMoves(Save.unlocks());
    Sfx.buy();
    this.awardBadge('new-moves');
    if (this.onUnlock) this.onUnlock(u);
    this.el.hidden = true;
    // try-it prompt, first time only
    const t = this.tip;
    t.querySelector('.tip-icon').textContent = u.icon;
    t.querySelector('.tip-title').textContent = u.name;
    t.querySelector('.tip-text').innerHTML = u.tip;
    t.hidden = false;
    Save.markSeen('tip-' + u.id);
  }
  buyBoost(b) {
    if (!Save.spend(b.price)) { Sfx.denied(); return; }
    this.player.addBoost(b.id, (this.player.boosts[b.id] || 0) + b.secs);
    Sfx.boost();
    this.toast(`${b.icon} ${b.name}: ${b.secs}s`);
    this.render();
  }
}
