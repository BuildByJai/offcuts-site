// Library noticeboards (A1 §6): our own posters, drawn from the catalogue,
// where the third-party ad placeholders used to be. No external links.
import { CONFIG } from '../config.js';
import { Catalogue, quarterIcon } from './catalogue.js';
import { canvasTexture } from './world.js';

function wrap(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  return lines;
}

// slot: CONFIG.adSlots entry. `i` varies the pick so boards don't repeat.
export function posterTexture(slot, i = 0) {
  const [w, h] = slot.size;
  const tall = h > w * 1.4, wide = w > h * 3.2;
  const cw = 512, ch = Math.max(96, Math.round(512 * h / w));
  const books = Catalogue.books;
  const planned = books.filter((b) => b.status !== 'live');
  const live = books.filter((b) => b.status === 'live');
  return canvasTexture(cw, ch, (ctx) => {
    const paper = '#f6eedb';
    ctx.fillStyle = paper; ctx.fillRect(0, 0, cw, ch);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pin = (x, y) => { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(x, y, Math.max(5, ch * 0.018), 0, Math.PI * 2); ctx.fill(); };
    const head = (t, col) => {
      ctx.fillStyle = col; ctx.fillRect(0, 0, cw, Math.max(26, ch * (tall ? 0.08 : 0.2)));
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(Math.max(16, ch * (tall ? 0.04 : 0.11)))}px Inter, system-ui, sans-serif`;
      ctx.fillText(t, cw / 2, Math.max(13, ch * (tall ? 0.04 : 0.1)));
    };
    if (slot.poster === 'quarters') {
      head(`${CONFIG.gameName.toUpperCase()} · SEVEN ROADS`, '#1f3b2c');
      const qs = Catalogue.quarters;
      const cols = wide ? 7 : 4, rows = Math.ceil(qs.length / cols);
      const top = ch * 0.24, cellW = cw / cols, cellH = (ch - top) / rows;
      qs.forEach((q, k) => {
        const x = (k % cols) * cellW, y = top + Math.floor(k / cols) * cellH;
        ctx.fillStyle = q.colour; ctx.fillRect(x + 6, y + 6, cellW - 12, cellH - 12);
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.round(cellH * 0.32)}px system-ui`; ctx.fillText(quarterIcon(q), x + cellW / 2, y + cellH * 0.38);
        ctx.font = `700 ${Math.round(Math.min(cellH * 0.16, cellW * 0.12))}px Inter, system-ui`; ctx.fillText(q.name, x + cellW / 2, y + cellH * 0.74);
      });
      return;
    }
    if (slot.poster === 'reading-room') {
      head('READING ROOM', '#156534');
      ctx.fillStyle = '#231a12';
      ctx.font = `700 ${Math.round(cw * 0.09)}px Georgia, serif`;
      const lines = ['Read a', 'chapter.', 'Open a', 'street.'];
      lines.forEach((l, k) => ctx.fillText(l, cw / 2, ch * 0.2 + k * cw * 0.12));
      ctx.font = `${Math.round(cw * 0.22)}px system-ui`; ctx.fillText('📖', cw / 2, ch * 0.62);
      ctx.font = `600 ${Math.round(cw * 0.055)}px Inter, system-ui`; ctx.fillStyle = '#5a4a36';
      wrap(ctx, 'In Library Square, by the fountain. Free for everyone.', cw * 0.85).forEach((l, k) => ctx.fillText(l, cw / 2, ch * 0.8 + k * cw * 0.07));
      return;
    }
    const pool = slot.poster === 'open-now' ? (live.length ? live : planned) : planned;
    const b = pool[(i * 7 + slot.id.length * 3) % Math.max(1, pool.length)];
    if (!b) return;
    const q = Catalogue.getQuarter(b.quarter);
    const label = b.status === 'live' ? 'OPEN NOW' : 'COMING SOON';
    head(label, b.status === 'live' ? '#156534' : q.colour);
    pin(cw * 0.06, ch * 0.3); pin(cw * 0.94, ch * 0.3);
    ctx.fillStyle = '#231a12';
    const titleSize = Math.round(Math.min(ch * (wide ? 0.34 : 0.15), cw * 0.075));
    ctx.font = `700 ${titleSize}px Georgia, serif`;
    const lines = wrap(ctx, b.title, cw * 0.86).slice(0, 3);
    const y0 = ch * (wide ? 0.58 : 0.45) - (lines.length - 1) * titleSize * 0.55;
    lines.forEach((l, k) => ctx.fillText(l, cw / 2, y0 + k * titleSize * 1.1));
    if (!wide) {
      ctx.font = `600 ${Math.round(titleSize * 0.5)}px Inter, system-ui`; ctx.fillStyle = '#5a4a36';
      ctx.fillText(`${quarterIcon(q)} ${q.name} road · ${'📖'.repeat(b.level)} Level ${b.level}`, cw / 2, ch * 0.84);
    }
  });
}
