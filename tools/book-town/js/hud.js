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
  return true;
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
  const w = label.split(' ')[0];
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

export function controlsHelpHTML(touch) {
  return touch
    ? `<b>Move</b>: drag anywhere on the left half (push far to sprint)<br>
       <b>Look</b>: drag on the right half<br>
       <b>Jump</b>: big button, bottom-right (hold for higher)<br>
       <b>Interact</b>: hand button appears near doors &amp; signs`
    : `<b>Move</b>: WASD / arrow keys &nbsp;·&nbsp; <b>Sprint</b>: Shift<br>
       <b>Jump</b>: Space (hold for higher)<br>
       <b>Camera</b>: click-drag to orbit, scroll to zoom<br>
       <b>Interact</b>: E &nbsp;·&nbsp; <b>Pause</b>: Esc / P`;
}
