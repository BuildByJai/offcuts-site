// Chapterlands library UI: the library card, quest log, district panel,
// Reading Room and the 3-question reading checks. Plain DOM — every panel is
// built here so the town page only needs a few hooks.
//
// Flow for a street (Build Day brief): read chapter(s) → 3 questions →
// street opens → play its game. Coins can buy a hint per question; they never
// buy an answer.
import { CONFIG } from '../config.js';
import { Catalogue, quarterIcon } from './catalogue.js';
import { Save } from './save.js';
import { Sfx } from './audio.js';
import { toast, awardBadge, confetti } from './hud.js';
import { track } from './track.js';
import { libraryLinks } from './grownups.js';

export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const TEMPLATE_ICON = { CLIMB: '🧗', CHASE: '🏃', COLLECT: '🔎', SNEAK: '🤫', PUZZLE: '🧩', ARCADE: '🕹️', BUILD: '🧱', VAULT: '🗝️' };
export function templateIcon(t) { return TEMPLATE_ICON[t] || '🎮'; }

/* =============== tiny markdown (book text) =============== */
export function renderMarkdown(md) {
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(“"'‘—-])_(.+?)_(?=[\s.,;:!?)”"'’—-]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(“"'‘—-])\*(.+?)\*(?=[\s.,;:!?)”"'’—-]|$)/g, '$1<i>$2</i>');
  return md.replace(/\r/g, '').split(/\n{2,}/).map((block) => {
    const b = block.trim();
    if (!b) return '';
    const h = b.match(/^(#{1,3})\s+(.*)$/);
    if (h) return `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
    if (/^(\* \* \*|\*\*\*|---)$/.test(b)) return '<hr>';
    if (b.startsWith('> ')) return `<blockquote>${b.split('\n').map((l) => inline(l.replace(/^>\s?/, ''))).join('<br>')}</blockquote>`;
    return `<p>${b.split('\n').map(inline).join(' ')}</p>`;
  }).join('\n');
}

/* =============== shared overlay helper =============== */
function overlay(id, cls = '') {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'overlay ' + cls;
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}
function chapterLabel(street, kit) {
  const c = street.chapters || [];
  const word = kit.chapterWord || 'Chapter';
  if (!c.length) return '';
  if (c.length === 1) return `${word} ${c[0]}`;
  return `${word}s ${c[0]}–${c[c.length - 1]}`;
}

/* =============== library card =============== */
export function renderLibraryCard(box, { onReroll } = {}) {
  track('library-card-opened');
  const card = Save.card();
  let html = `<div class="lc-head"><div class="lc-photo">📚</div><div class="lc-who"><span class="lc-label">${esc(CONFIG.gameName)} library card</span>
    <b class="lc-name">${esc(Save.name())}</b><span class="lc-sub">${card.stamps.length} stamp${card.stamps.length === 1 ? '' : 's'} · ${card.keys.length} Key${card.keys.length === 1 ? '' : 's'}</span></div>
    <button class="btn ghost mini-btn lc-reroll" type="button">🎲 New name</button></div>`;
  for (const q of Catalogue.quarters) {
    const books = Catalogue.booksInQuarter(q.id);
    html += `<div class="lc-quarter" style="--qc:${q.colour}"><div class="lc-qhead"><span>${quarterIcon(q)}</span> ${esc(q.name)}</div><ul class="lc-slots">`;
    for (const b of books) {
      const stamped = card.stamps.includes(b.id), key = card.keys.includes(b.id);
      html += `<li class="${stamped ? 'stamped' : ''}"><span class="lc-stamp">${stamped ? '✅' : ''}</span>
        <span class="lc-title">${esc(b.title)}<i>${Catalogue.levelIcons(b.level)} Level ${b.level}${b.status === 'live' ? ' · open now' : ''}</i></span>
        <span class="lc-key" title="${key ? 'Key held' : ''}">${key ? '🗝️' : ''}</span></li>`;
    }
    html += '</ul></div>';
  }
  box.innerHTML = html;
  box.querySelector('.lc-reroll').addEventListener('click', () => {
    Save.rerollName();
    Sfx.click();
    renderLibraryCard(box, { onReroll });
    if (onReroll) onReroll();
  });
}

/* =============== quest log =============== */
export function renderQuestLog(box, quests) {
  if (!quests || !quests.length) { box.innerHTML = '<p class="lede">No quests yet.</p>'; return; }
  box.innerHTML = '<ul class="quest-log">' + quests.map((q) => {
    const st = Save.quest(q.id);
    const step = q.steps[Math.min(st.step, q.steps.length - 1)];
    const status = st.done ? '✅ Done' : (st.step > 0 ? `Step ${st.step + 1} of ${q.steps.length}` : 'Not started');
    return `<li class="${st.done ? 'done' : ''}"><b>${esc(q.title)}</b><span class="ql-status">${status}</span>
      <span class="ql-step">${st.done ? 'Reward: 🪙' + q.reward.coins + (q.reward.badge ? ' + badge' : '') : esc(step.text)}</span>
      ${q.where ? `<span class="ql-where">${esc(q.where)}</span>` : ''}</li>`;
  }).join('') + '</ul>';
}

/* =============== reading check (3 questions) =============== */
// opts: { book, kit, street, questions: [3], onPass, onClose }
export function openQuiz({ book, kit, street, questions, onPass, onClose, title }) {
  const el = overlay('quiz', 'quiz');
  let i = 0;
  const order = questions.map((q) => shuffle([0, 1, 2].slice(0, q.options.length)));
  let wrongOnThis = 0;
  const finish = (passed) => {
    el.hidden = true;
    if (passed && onPass) onPass();
    else if (!passed && onClose) onClose();
  };
  const render = () => {
    const q = questions[i];
    const hintKey = `${book.id}:${street ? street.id : 'vault'}:${i}`;
    const bought = Save.hasHint(hintKey);
    el.innerHTML = `<div class="card scrollable quiz-card">
      <span class="tag-inline">${esc(title || 'reading check')} · question ${i + 1} of ${questions.length}</span>
      <h2>${esc(q.q)}</h2>
      <div class="quiz-opts">${order[i].map((k) => `<button class="btn ghost quiz-opt" type="button" data-k="${k}">${esc(q.options[k])}</button>`).join('')}</div>
      <p class="quiz-msg" ${bought && q.hint ? '' : 'hidden'}>💡 ${esc(q.hint || '')}</p>
      <div class="btn-row">
        <button class="btn ghost quiz-hint" type="button" ${bought || !q.hint ? 'disabled' : ''}>💡 Hint (🪙${CONFIG.costs.hint})</button>
        <button class="btn ghost quiz-close" type="button">Later</button>
      </div>
      <p class="fineprint" style="margin-top:10px">Coins can buy a hint, never an answer.</p>
    </div>`;
    el.querySelectorAll('.quiz-opt').forEach((b) => b.addEventListener('click', () => {
      const k = Number(b.dataset.k);
      if (k === q.answer) {
        b.classList.add('right');
        Sfx.beep(true);
        el.querySelectorAll('.quiz-opt').forEach((x) => { x.disabled = true; });
        setTimeout(() => {
          i++; wrongOnThis = 0;
          if (i >= questions.length) {
            track('check-passed', { book: book.id, street: street ? street.id : 'vault' });
            finish(true);
          } else render();
        }, 550);
      } else {
        b.classList.add('wrong'); b.disabled = true;
        Sfx.beep(false);
        wrongOnThis++;
        track('check-failed', { book: book.id, street: street ? street.id : 'vault', q: i });
        const m = el.querySelector('.quiz-msg');
        m.hidden = false;
        m.textContent = q.hint ? `Not quite. ${q.hint}` : 'Not quite — have another look and try again.';
      }
    }));
    el.querySelector('.quiz-hint').addEventListener('click', () => {
      if (!Save.spend(CONFIG.costs.hint)) { toast(`You need 🪙${CONFIG.costs.hint} for a hint. Coins come from the square, quests and Sky Runs.`); return; }
      Save.buyHint(hintKey);
      Sfx.click();
      render();
    });
    el.querySelector('.quiz-close').addEventListener('click', () => finish(false));
  };
  render();
  el.hidden = false;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* =============== street state helpers =============== */
export function streetState(book, kit, idx) {
  const st = kit.streets[idx];
  const open = Save.isStreetOpen(book.id, st.id);
  const played = Save.isStreetPlayed(book.id, st.id);
  const prevOpen = idx === 0 || Save.isStreetOpen(book.id, kit.streets[idx - 1].id);
  const last = Math.max(...(st.chapters || [0]));
  const read = book.readable ? Save.lastRead(book.id) >= last : Save.ownCopy(book.id).includes(st.id);
  return { st, open, played, prevOpen, read, done: open && played };
}
export function districtDone(book, kit) {
  return kit.streets.every((_, i) => streetState(book, kit, i).done);
}

/* =============== district panel =============== */
// hooks: { play(book, kitStreetOrKind), read(book, chapter), refresh() }
export async function openDistrict(bookId, hooks) {
  const book = Catalogue.getBook(bookId);
  const el = overlay('district', 'district');
  el.innerHTML = '<div class="card"><p class="lede">Opening the district…</p></div>';
  el.hidden = false;
  const kit = await Catalogue.kit(bookId);
  const qs = await Catalogue.questions(bookId);
  if (!kit) { el.innerHTML = `<div class="card"><h2>${esc(book.title)}</h2><p class="lede">This district isn't built yet.</p><button class="btn" type="button" id="d-close">Close</button></div>`; el.querySelector('#d-close').onclick = () => { el.hidden = true; hooks.close && hooks.close(); }; return; }
  const q = Catalogue.getQuarter(book.quarter);
  const close = () => { el.hidden = true; if (hooks.close) hooks.close(); };
  const render = () => {
    const card = Save.card();
    const allDone = districtDone(book, kit);
    let html = `<div class="card scrollable district-card" style="--qc:${q.colour}">
      <span class="tag-inline">${quarterIcon(q)} ${esc(q.name)} · ${Catalogue.levelIcons(book.level)} Level ${book.level}</span>
      <h2>${esc(book.title)}</h2>
      <p class="lede" style="margin-bottom:8px">${esc(book.author)}${kit.blurb ? ' — ' + esc(kit.blurb) : ''}</p>
      ${card.stamps.includes(book.id) ? '<p class="d-done">✅ Stamped on your library card · 🗝️ Key held</p>' : ''}
      ${!book.readable ? `<p class="d-note">📕 This book isn't in our Reading Room. Read it in your own copy, or borrow it free from your library.</p>` : ''}
      <h3>Streets</h3><ol class="streets">`;
    kit.streets.forEach((s, i) => {
      const S = streetState(book, kit, i);
      const lab = chapterLabel(s, kit);
      let action = '';
      if (S.open) {
        action = `<button class="btn mini-btn" data-play="${i}" type="button">${templateIcon(s.template)} ${S.played ? 'Play again' : 'Play'}</button>`;
      } else if (!S.prevOpen) {
        action = '<span class="st-lock">🔒 Open the street before this one first</span>';
      } else {
        const readBtn = book.readable
          ? `<button class="btn ghost mini-btn" data-read="${i}" type="button">📖 Read ${esc(lab.toLowerCase())}</button>`
          : `<span class="st-own">Read ${esc(lab.toLowerCase())} in your own copy, or borrow it free from your library.</span>
             <button class="btn ghost mini-btn" data-lib="1" type="button">🏛️ Borrow it (grown-ups)</button>
             <button class="btn ghost mini-btn" data-own="${i}" type="button">I've read it</button>`;
        action = readBtn + `<button class="btn mini-btn" data-quiz="${i}" type="button" ${S.read ? '' : 'disabled'}>✏️ Answer 3 questions</button>`
          + (S.read ? '' : `<span class="st-hint">${book.readable ? 'Read it first — the questions open at the end of the chapter.' : ''}</span>`);
      }
      html += `<li class="${S.done ? 'done' : S.open ? 'open' : ''}"><div class="st-head"><b>${esc(s.name)}</b><span>${esc(lab)} · ${templateIcon(s.template)} ${esc(s.game || s.template)}</span></div>
        <div class="st-act">${S.done ? '<span class="st-tick">✅ Done</span>' : ''}${action}</div></li>`;
    });
    html += '</ol>';
    const firstOpen = Save.isStreetOpen(book.id, kit.streets[0].id);
    if (kit.skyRun) {
      const best = Save.skyRun(book.id);
      html += `<h3>Sky Run</h3><div class="d-extra"><span>☁️ <b>${esc(kit.skyRun.name)}</b> — ${esc(kit.skyRun.blurb || 'an optional climb high above the district, for coins and a badge.')}${best ? ` Best: ${fmtMs(best)}.` : ''}</span>
        ${firstOpen ? '<button class="btn mini-btn" data-sky="1" type="button">Climb</button>' : '<span class="st-lock">🔒 Opens with the first street</span>'}</div>`;
    }
    if (kit.sideQuest) {
      const st = Save.quest(kit.sideQuest.id);
      html += `<h3>Side quest</h3><div class="d-extra"><span>🧭 <b>${esc(kit.sideQuest.title)}</b> — ${st.done ? '✅ Done' : esc(kit.sideQuest.steps[Math.min(st.step, kit.sideQuest.steps.length - 1)].text)} <i>(No reading needed — it's out in the district's yard.)</i></span></div>`;
    }
    if (kit.vault) {
      html += `<h3>The Vault</h3><div class="d-extra"><span>🗝️ <b>${esc(kit.vault.name)}</b> — ${esc(kit.vault.blurb || 'an escape room about the whole book.')} Crack it to earn the <b>Key</b> and your library card stamp.</span>
        ${allDone ? '<button class="btn mini-btn gold" data-vault="1" type="button">Enter the Vault</button>' : '<span class="st-lock">🔒 Finish every street first</span>'}</div>`;
    }
    html += `<button class="btn ghost" type="button" data-close="1" style="margin-top:14px">Back to the road</button></div>`;
    el.innerHTML = html;
    el.querySelectorAll('[data-play]').forEach((b) => b.onclick = () => hooks.play(book, kit.streets[Number(b.dataset.play)].id));
    el.querySelectorAll('[data-read]').forEach((b) => b.onclick = () => {
      const s = kit.streets[Number(b.dataset.read)];
      const next = s.chapters.find((c) => c > Save.lastRead(book.id)) || s.chapters[0];
      openReader(book, kit, next, { onCheck: (street) => startCheck(street), onClose: () => { el.hidden = false; render(); } });
      el.hidden = true;
    });
    el.querySelectorAll('[data-lib]').forEach((b) => b.onclick = () => libraryLinks(book));
    el.querySelectorAll('[data-own]').forEach((b) => b.onclick = () => { Save.markOwnCopy(book.id, kit.streets[Number(b.dataset.own)].id); Sfx.click(); render(); });
    el.querySelectorAll('[data-quiz]').forEach((b) => b.onclick = () => startCheck(kit.streets[Number(b.dataset.quiz)]));
    el.querySelectorAll('[data-sky]').forEach((b) => b.onclick = () => hooks.play(book, 'sky'));
    el.querySelectorAll('[data-vault]').forEach((b) => b.onclick = () => hooks.vault(book));
    el.querySelector('[data-close]').onclick = close;
  };
  const startCheck = (s) => {
    const list = qs && qs.streets && qs.streets[s.id];
    if (!list || !list.length) { toast('Questions for this street are on their way.'); return; }
    el.hidden = true;
    openQuiz({
      book, kit, street: s, questions: list,
      onPass: () => {
        const fresh = Save.openStreet(book.id, s.id);
        if (fresh) {
          track('street-unlocked', { book: book.id, street: s.id });
          Sfx.unlockLock();
          confetti({ count: 120 });
          toast(`🎉 ${s.name} is open!`, { badge: true, ms: 3200 });
          awardBadge('first-check');
          if (hooks.refresh) hooks.refresh();
        }
        el.hidden = false; render();
      },
      onClose: () => { el.hidden = false; render(); }
    });
  };
  render();
  return { render, startCheck };
}

export function fmtMs(ms) {
  const t = ms / 1000, m = Math.floor(t / 60), s = (t - m * 60).toFixed(1);
  return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

/* =============== Reading Room: shelves + reader =============== */
let lightsOutCheck = () => false;   // Lights Out (separate brief) plugs in here
export function setLightsOutCheck(fn) { lightsOutCheck = fn; }

export async function openReadingRoom({ onOpenBook, onClose } = {}) {
  const el = overlay('reading-room', 'reading-room');
  if (lightsOutCheck()) {
    el.innerHTML = `<div class="card"><span class="tag-inline">reading room</span><h2>The Reading Room is closed</h2><p class="lede">It's Lights Out. Read tonight, and you'll wake up rested.</p><button class="btn" type="button" data-close="1">OK</button></div>`;
    el.hidden = false;
    el.querySelector('[data-close]').onclick = () => { el.hidden = true; onClose && onClose(); };
    return;
  }
  let html = `<div class="card scrollable rr-card"><span class="tag-inline">library square</span><h2>The Reading Room</h2>
    <p class="lede">Pick a book from the shelves. Read a chapter, then answer three questions to open its street out on the roads.</p>`;
  for (const q of Catalogue.quarters) {
    const books = Catalogue.booksInQuarter(q.id).filter((b) => b.readable);
    html += `<div class="rr-shelf" style="--qc:${q.colour}"><div class="rr-label">${quarterIcon(q)} ${esc(q.name)}</div><div class="rr-books">`;
    if (!books.length) html += '<span class="rr-empty">More books coming to this shelf.</span>';
    for (const b of books) {
      const ready = b.status === 'live';
      const read = Save.lastRead(b.id);
      html += `<button type="button" class="rr-spine ${ready ? '' : 'soon'}" data-book="${esc(b.id)}" ${ready ? '' : 'disabled'} title="${esc(b.title)}">
        <span class="rr-t">${esc(b.title)}</span><span class="rr-l">${Catalogue.levelIcons(b.level)}${ready ? (read ? ` · ch ${read}` : '') : ' · soon'}</span></button>`;
    }
    html += '</div></div>';
  }
  html += `<p class="fineprint" style="margin-top:10px">Books arrive on the shelves as their districts open.</p><button class="btn ghost" type="button" data-close="1">Leave the Reading Room</button></div>`;
  el.innerHTML = html;
  el.hidden = false;
  el.querySelectorAll('[data-book]').forEach((b) => b.onclick = async () => {
    el.hidden = true;
    const book = Catalogue.getBook(b.dataset.book);
    const kit = await Catalogue.kit(book.id);
    if (!kit) { toast('That book is still being shelved.'); el.hidden = false; return; }
    openBookContents(book, kit, { back: () => { el.hidden = false; }, onOpenBook });
  });
  el.querySelector('[data-close]').onclick = () => { el.hidden = true; onClose && onClose(); };
}

function openBookContents(book, kit, { back, onOpenBook }) {
  const el = overlay('rr-contents', 'reading-room');
  const read = Save.lastRead(book.id);
  el.innerHTML = `<div class="card scrollable"><span class="tag-inline">reading room · ${Catalogue.levelIcons(book.level)} level ${book.level}</span>
    <h2>${esc(book.title)}</h2><p class="lede">${esc(book.author)}</p>
    <ol class="rr-chapters">${(kit.chapterFiles || []).map((c) => `<li><button type="button" class="btn ghost mini-btn" data-ch="${c.n}">${c.n <= read ? '✅ ' : ''}${esc(c.title)}</button></li>`).join('')}</ol>
    <button class="btn" type="button" data-go="1">${read ? 'Keep reading' : 'Start reading'}</button>
    ${onOpenBook ? '<button class="btn ghost" type="button" data-district="1">Go to the district</button>' : ''}
    <button class="btn ghost" type="button" data-back="1">Back to the shelves</button></div>`;
  el.hidden = false;
  const files = kit.chapterFiles || [];
  const go = (n) => { el.hidden = true; openReader(book, kit, n, { onClose: () => { openBookContents(book, kit, { back, onOpenBook }); }, onCheck: (street) => { el.hidden = true; if (onOpenBook) onOpenBook(book, street); } }); };
  el.querySelectorAll('[data-ch]').forEach((b) => b.onclick = () => go(Number(b.dataset.ch)));
  el.querySelector('[data-go]').onclick = () => go(Math.min(files.length || 1, read + 1));
  const d = el.querySelector('[data-district]');
  if (d) d.onclick = () => { el.hidden = true; onOpenBook(book, null); };
  el.querySelector('[data-back]').onclick = () => { el.hidden = true; back(); };
}

// The reader. onCheck(street) is called when the player finishes the last
// chapter of a street and chooses to answer its questions.
export async function openReader(book, kit, n, { onClose, onCheck } = {}) {
  const el = overlay('reader', 'reader');
  const files = kit.chapterFiles || [];
  const ch = files.find((c) => c.n === n) || files[0];
  if (!ch) { toast('No chapters on the shelf yet.'); onClose && onClose(); return; }
  el.innerHTML = `<div class="reader-page"><div class="reader-bar">
      <button class="btn ghost mini-btn" type="button" data-close="1">✕ Close</button>
      <span class="reader-title">${esc(book.title)}</span>
      <span class="reader-size"><button class="btn ghost mini-btn" type="button" data-size="-1">A−</button><button class="btn ghost mini-btn" type="button" data-size="1">A+</button></span>
    </div><article class="reader-text"><p class="lede">Opening the book…</p></article></div>`;
  el.hidden = false;
  const size = Number(sessionStorage.getItem('cl.readSize') || 18);
  const art = el.querySelector('.reader-text');
  art.style.fontSize = size + 'px';
  el.querySelectorAll('[data-size]').forEach((b) => b.onclick = () => {
    const v = Math.max(14, Math.min(28, parseFloat(art.style.fontSize) + Number(b.dataset.size) * 2));
    art.style.fontSize = v + 'px';
    try { sessionStorage.setItem('cl.readSize', v); } catch (e) { /* ignore */ }
  });
  el.querySelector('[data-close]').onclick = () => { el.hidden = true; onClose && onClose(); };
  const md = await Catalogue.chapter(book.id, ch.file);
  if (md == null) { art.innerHTML = '<p class="lede">This chapter isn\'t on the shelf yet.</p>'; return; }
  const street = kit.streets.find((s) => Math.max(...s.chapters) === ch.n);
  const streetIdx = street ? kit.streets.indexOf(street) : -1;
  const prev = files.find((c) => c.n === ch.n - 1), next = files.find((c) => c.n === ch.n + 1);
  art.innerHTML = `<h1 class="reader-ch">${esc(ch.title)}</h1>${renderMarkdown(md)}
    <div class="reader-end">
      <button class="btn" type="button" data-done="1">I've finished this ${esc((kit.chapterWord || 'chapter').toLowerCase())}</button>
      <div class="reader-after" hidden></div>
      <div class="btn-row">${prev ? `<button class="btn ghost" type="button" data-n="${prev.n}">← ${esc(prev.title)}</button>` : ''}${next ? `<button class="btn ghost" type="button" data-n="${next.n}">${esc(next.title)} →</button>` : ''}</div>
      ${kit.source ? `<p class="fineprint reader-source">${esc(kit.source)}</p>` : ''}
    </div>`;
  el.querySelector('.reader-page').scrollTop = 0;
  art.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => openReader(book, kit, Number(b.dataset.n), { onClose, onCheck }));
  art.querySelector('[data-done]').onclick = () => {
    if (Save.markRead(book.id, ch.n)) track('chapter-read', { book: book.id, chapter: ch.n });
    Sfx.click();
    const after = art.querySelector('.reader-after');
    after.hidden = false;
    art.querySelector('[data-done]').hidden = true;
    if (street) {
      const S = streetState(book, kit, streetIdx);
      if (S.open) after.innerHTML = `<p class="lede">✅ <b>${esc(street.name)}</b> is already open. ${next ? 'On to the next one!' : ''}</p>`;
      else if (!S.prevOpen) after.innerHTML = '<p class="lede">Well read! Open the street before this one first, then come back for this one\'s questions.</p>';
      else {
        after.innerHTML = `<p class="lede">That's the end of <b>${esc(street.name)}</b>.</p><button class="btn gold" type="button" data-check="1">✏️ Answer 3 questions to open the street</button>`;
        after.querySelector('[data-check]').onclick = () => { el.hidden = true; onCheck ? onCheck(street) : onClose && onClose(); };
      }
    } else after.innerHTML = `<p class="lede">Nice reading! ${next ? 'The street opens at the end of the next part.' : ''}</p>`;
  };
}
