// Shared HUD bits: toasts, badge awards, interact prompt, fade transitions.
import { CONFIG } from '../config.js';
import { Save } from './save.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

export function toast(msg, { badge = false, ms = 2400 } = {}) {
  const box = $('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (badge ? ' badge' : '');
  if (badge) el.innerHTML = msg; else el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

export function badgeInfo(id) { return CONFIG.badges.find((b) => b.id === id); }

// Awards a badge once; shows a toast and plays a jingle the first time.
export function awardBadge(id) {
  if (!Save.awardBadge(id)) return false;
  const b = badgeInfo(id);
  toast(`${b.icon} Badge earned: <b>${b.name}</b>`, { badge: true, ms: 3600 });
  Sfx.badge();
  confetti({ count: 90 });
  return true;
}

// Paper confetti burst over the whole screen (badges, trial medals, quests).
export function confetti({ count = 160, colors = ['#2f7fd6', '#e9a23b', '#3fae5c', '#d8452f', '#ffd23f', '#ffffff', '#e94f6a'], originY = 0.55 } = {}) {
  let c = $('confetti');
  if (!c) {
    c = document.createElement('canvas');
    c.id = 'confetti';
    document.body.appendChild(c);
  }
  c.hidden = false;
  c.width = innerWidth; c.height = innerHeight;
  const ctx = c.getContext('2d');
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 160, y: innerHeight * originY,
    vx: (Math.random() - 0.5) * 16, vy: -8 - Math.random() * 13, r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4, s: 5 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0]
  }));
  const t0 = performance.now();
  const id = (c._burst = (c._burst || 0) + 1);
  (function frame() {
    if (c._burst !== id) return;
    const t = performance.now() - t0;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - t / 3000); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (t < 3000 && !c.hidden) requestAnimationFrame(frame); else c.hidden = true;
  })();
}

// Desktop prompt pill + touch interact button, kept in sync.
export function setPrompt(input, label, key = 'E') {
  const p = $('interact-prompt');
  if (p) {
    if (label) {
      p.innerHTML = `<kbd>${key}</kbd><span></span>`;
      p.querySelector('span').textContent = label;
      p.classList.add('show');
    } else p.classList.remove('show');
  }
  if (input) input.setInteract(label ? shortLabel(label) : null);
}
function shortLabel(label) {
  const w = label.split(' ')[0].replace(/[:·,]+$/, '');
  return w.length > 8 ? w.slice(0, 8) : w;
}

export function fadeOut() {
  return new Promise((res) => {
    const f = $('fade');
    if (!f) return res();
    f.classList.add('on');
    setTimeout(res, 480);
  });
}
export function fadeIn() {
  const f = $('fade');
  if (!f) return;
  requestAnimationFrame(() => f.classList.remove('on'));
}

// u: unlocked moves (Save.unlocks()) — bought moves are only listed once owned.
export function controlsHelpHTML(touch, u = {}) {
  const extra = [];
  if (touch) {
    if (u.dash) extra.push('<b>Dash</b>: 💨 button, or flick the stick twice');
    if (u.wallJump) extra.push('<b>Wall jump</b>: Jump while touching a wall');
    if (u.glide) extra.push('<b>Glide</b>: hold Jump while falling after a double jump');
    if (u.groundPound) extra.push('<b>Ground pound</b>: ⚡ in mid-air');
    if (u.tripleJump) extra.push('<b>Triple jump</b>: tap Jump a third time');
    return `<b>Move</b>: drag anywhere on the left half (push far to sprint)<br>
       <b>Look</b>: drag on the right half<br>
       <b>Jump</b>: big button (hold for higher, tap again mid-air to double jump)<br>
       <b>Super jump</b>: hold ⚡ Charge, release &nbsp;·&nbsp; <b>Slide</b>: ⚡ while sprinting<br>
       <b>Interact</b>: hand button appears near doors &amp; signs` + (extra.length ? '<br>' + extra.join('<br>') : '');
  }
  if (u.dash) extra.push('<b>Dash</b>: Q or double-tap a direction');
  if (u.wallJump) extra.push('<b>Wall jump</b>: Space while touching a wall');
  if (u.glide) extra.push('<b>Glide</b>: hold Space while falling after a double jump');
  if (u.groundPound) extra.push('<b>Ground pound</b>: C in mid-air');
  if (u.tripleJump) extra.push('<b>Triple jump</b>: Space a third time in mid-air');
  return `<b>Move</b>: WASD / arrow keys &nbsp;·&nbsp; <b>Sprint</b>: Shift<br>
       <b>Jump</b>: Space (hold for higher) &nbsp;·&nbsp; <b>Double jump</b>: Space again in mid-air<br>
       <b>Super jump</b>: hold C (or Ctrl), release &nbsp;·&nbsp; <b>Slide</b>: C while sprinting<br>
       <b>Camera</b>: click-drag to orbit, scroll to zoom<br>
       <b>Interact</b>: E &nbsp;·&nbsp; <b>Pause</b>: Esc / P` + (extra.length ? '<br>' + extra.join('<br>') : '');
}
