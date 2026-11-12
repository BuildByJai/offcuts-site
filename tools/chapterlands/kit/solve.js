// Answer widgets used by PUZZLE (and the Vault): choice, order, match, code.
// Each renders into a box and calls done(true|false).
import { Sfx } from '../js/audio.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function shuffle(a, r = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// spec: { type, prompt, options, answer, items, pairs, hint }
//   choice: options [..], answer index
//   order:  items [..] in the right order (shown shuffled)
//   match:  pairs [[left, right]..] (rights shown shuffled)
//   code:   answer '1234' (digits)
export function renderSolve(box, spec, done) {
  const msg = () => box.querySelector('.solve-msg');
  const wrong = () => { Sfx.beep(false); const m = msg(); m.hidden = false; m.textContent = spec.hint ? `Not quite. ${spec.hint}` : 'Not quite — look around again.'; };
  let html = spec.prompt ? `<p class="obj-text" style="margin-bottom:10px">${esc(spec.prompt)}</p>` : '';
  if (spec.type === 'choice') {
    html += `<div class="choice-list">${spec.options.map((o, i) => `<button class="btn ghost" type="button" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
  } else if (spec.type === 'order') {
    box._order = shuffle(spec.items.map((_, i) => i));
    if (box._order.every((v, i) => v === i) && spec.items.length > 1) box._order.reverse();
    html += '<ul class="order-list"></ul><button class="btn" type="button" data-check="1">That\'s the order</button>';
  } else if (spec.type === 'match') {
    const rights = shuffle(spec.pairs.map((p) => p[1]));
    box._match = {};
    html += spec.pairs.map((p, i) => `<div class="pair-row"><div class="pr-label">${esc(p[0])}</div><div class="seg">${rights.map((rr) => `<button type="button" class="seg-btn" data-row="${i}" data-v="${esc(rr)}">${esc(rr)}</button>`).join('')}</div></div>`).join('')
      + '<button class="btn" type="button" data-check="1">Check</button>';
  } else if (spec.type === 'code') {
    box._code = '';
    html += `<div class="digit-row">${'<div class="digit-box"></div>'.repeat(String(spec.answer).length)}</div>
      <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Back'].map((k) => `<button class="key-btn ${k.length > 1 ? 'wide' : ''}" type="button" data-k="${k}">${k}</button>`).join('')}</div>`;
  }
  html += '<p class="quiz-msg solve-msg" hidden></p>';
  box.innerHTML = html;
  if (spec.type === 'choice') {
    box.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => {
      if (Number(b.dataset.i) === spec.answer) { Sfx.beep(true); b.classList.add('on'); setTimeout(() => done(true), 350); }
      else { b.disabled = true; wrong(); }
    });
  } else if (spec.type === 'order') {
    const ul = box.querySelector('.order-list');
    const draw = () => {
      ul.innerHTML = box._order.map((v, k) => `<li><b>${k + 1}</b><span>${esc(spec.items[v])}</span><button type="button" data-up="${k}" aria-label="Move up">▲</button><button type="button" data-dn="${k}" aria-label="Move down">▼</button></li>`).join('');
      ul.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { const k = Number(b.dataset.up); if (k > 0) { [box._order[k - 1], box._order[k]] = [box._order[k], box._order[k - 1]]; Sfx.click(); draw(); } });
      ul.querySelectorAll('[data-dn]').forEach((b) => b.onclick = () => { const k = Number(b.dataset.dn); if (k < box._order.length - 1) { [box._order[k + 1], box._order[k]] = [box._order[k], box._order[k + 1]]; Sfx.click(); draw(); } });
    };
    draw();
    box.querySelector('[data-check]').onclick = () => { if (box._order.every((v, i) => v === i)) { Sfx.beep(true); done(true); } else wrong(); };
  } else if (spec.type === 'match') {
    box.querySelectorAll('[data-row]').forEach((b) => b.onclick = () => {
      box._match[b.dataset.row] = b.dataset.v;
      box.querySelectorAll(`[data-row="${b.dataset.row}"]`).forEach((x) => x.classList.toggle('on', x === b));
      Sfx.click();
    });
    box.querySelector('[data-check]').onclick = () => {
      if (spec.pairs.some((_, i) => !box._match[i])) { const m = msg(); m.hidden = false; m.textContent = 'Pick one for each first.'; return; }
      if (spec.pairs.every((p, i) => box._match[i] === p[1])) { Sfx.beep(true); done(true); } else wrong();
    };
  } else if (spec.type === 'code') {
    const boxes = box.querySelectorAll('.digit-box');
    const draw = () => boxes.forEach((b, i) => { b.textContent = box._code[i] || ''; b.classList.toggle('filled', !!box._code[i]); });
    box.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
      const k = b.dataset.k;
      if (k === 'Clear') box._code = '';
      else if (k === 'Back') box._code = box._code.slice(0, -1);
      else if (box._code.length < String(spec.answer).length) box._code += k;
      draw(); Sfx.click();
      if (box._code.length === String(spec.answer).length) {
        setTimeout(() => {
          if (box._code === String(spec.answer)) { Sfx.beep(true); done(true); }
          else { wrong(); box._code = ''; draw(); }
        }, 200);
      }
    });
  }
}
