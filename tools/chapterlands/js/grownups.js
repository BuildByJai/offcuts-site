// "For grown-ups" check (A1 §6). Every link that leaves the game goes through
// here: the affiliate "buy the book" link, library links, and links back out
// to Offcuts. A simple parent gate — "type seventy-four in numbers" — then a
// panel with the links. Kids never see a live outbound link without it.
import { CONFIG } from '../config.js';

let el = null;
let passedThisVisit = false;

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.className = 'overlay grownups';
  el.id = 'grownups';
  el.hidden = true;
  el.innerHTML = `<div class="card scrollable">
    <span class="tag-inline">for grown-ups</span>
    <div class="gu-gate">
      <h2>Ask a grown-up</h2>
      <p class="lede gu-ask"></p>
      <input class="gu-input" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="Answer in numbers">
      <p class="fineprint gu-msg"></p>
      <div class="btn-row" style="margin-bottom:10px">
        <button class="btn gu-ok" type="button">Continue</button>
        <button class="btn ghost gu-cancel" type="button">Back to the game</button>
      </div>
    </div>
    <div class="gu-panel" hidden>
      <h2 class="gu-title">For grown-ups</h2>
      <div class="gu-body"></div>
      <button class="btn ghost gu-close" type="button">Back to the game</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.querySelector('.gu-cancel').addEventListener('click', close);
  el.querySelector('.gu-close').addEventListener('click', close);
  el.querySelector('.gu-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('.gu-ok').click(); e.stopPropagation(); });
  el.querySelector('.gu-input').addEventListener('keyup', (e) => e.stopPropagation());
  return el;
}

let onClose = null;
function close() {
  if (!el) return;
  el.hidden = true;
  const f = onClose; onClose = null;
  if (f) f();
}

// Open the gate, then show `content` = { title, html, links: [{label, href, sponsored, note}] }.
export function grownUps(content = {}, { onDone = null } = {}) {
  const g = ensure();
  onClose = onDone;
  const showPanel = () => {
    g.querySelector('.gu-gate').hidden = true;
    const p = g.querySelector('.gu-panel');
    p.hidden = false;
    g.querySelector('.gu-title').textContent = content.title || 'For grown-ups';
    const links = (content.links || []).map((l) => {
      const ok = /^https?:\/\//.test(l.href) || l.href.startsWith('/') || l.href.startsWith('.');
      const rel = l.sponsored ? 'sponsored noopener' : 'noopener';
      const target = /^https?:\/\//.test(l.href) ? ' target="_blank"' : '';
      return ok
        ? `<a class="btn ${l.gold ? 'gold' : 'ghost'}" href="${esc(l.href)}"${target} rel="${rel}">${esc(l.label)}</a>${l.note ? `<p class="fineprint" style="margin:-4px 0 12px">${esc(l.note)}</p>` : ''}`
        : `<button class="btn ghost" type="button" disabled>${esc(l.label)} — link coming soon</button>`;
    }).join('');
    g.querySelector('.gu-body').innerHTML = (content.html || '') + links;
  };
  if (passedThisVisit) showPanel();
  else {
    const [n, words] = CONFIG.grownUps.numbers[(Math.random() * CONFIG.grownUps.numbers.length) | 0];
    g.querySelector('.gu-gate').hidden = false;
    g.querySelector('.gu-panel').hidden = true;
    g.querySelector('.gu-ask').innerHTML = `This part is for grown-ups. Please type <b>${esc(words)}</b> in numbers.`;
    const input = g.querySelector('.gu-input');
    input.value = '';
    g.querySelector('.gu-msg').textContent = '';
    const ok = g.querySelector('.gu-ok');
    ok.onclick = () => {
      if (Number(input.value.trim()) === n) { passedThisVisit = true; showPanel(); }
      else { g.querySelector('.gu-msg').textContent = 'Not quite — ask a grown-up to help.'; input.value = ''; }
    };
    setTimeout(() => input.focus(), 50);
  }
  g.hidden = false;
}

// Turn every <a data-grownup> into a gated link (breadcrumbs, "leave" buttons).
export function guardLinks(root = document) {
  root.querySelectorAll('a[data-grownup]').forEach((a) => {
    if (a._guarded) return;
    a._guarded = true;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      grownUps({ title: 'Leaving Chapterlands', html: '<p class="lede">This link goes outside the game.</p>',
        links: [{ label: a.dataset.label || a.textContent.trim() || 'Continue', href: a.getAttribute('href') }] });
    });
  });
}

// Library links for books that aren't readable in-game.
export function libraryLinks(book) {
  grownUps({
    title: 'Borrow it from the library',
    html: `<p class="lede"><b>${esc(book.title)}</b> by ${esc(book.author)} isn't in our Reading Room, but your local library can lend it for free — often as an ebook or audiobook too.</p>`,
    links: CONFIG.grownUps.libraryLinks
  });
}
