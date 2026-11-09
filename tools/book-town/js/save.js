// Single source of truth for Book Town progress. One localStorage key; if
// storage is unavailable (private mode, blocked cookies) we keep an in-memory
// copy so the game still works for the session.
import { CONFIG } from '../config.js';

const KEY = CONFIG.saveKey;

function blank() {
  return { v: 1, coins: {}, golden: {}, badges: {}, bestEscapeMs: null, muted: false, pendingToasts: [] };
}

let memory = null;

function read() {
  if (memory) return memory;
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) { /* storage unavailable or corrupt — fall through */ }
  memory = Object.assign(blank(), data && typeof data === 'object' ? data : {});
  return memory;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* in-memory only */ }
}

export const Save = {
  get() { return read(); },

  hasCoin(id) { return !!read().coins[id]; },
  hasGolden(id) { return !!read().golden[id]; },
  addCoin(id) { read().coins[id] = 1; write(); },
  addGolden(id) { read().golden[id] = 1; write(); },
  coinCount() { return Object.keys(read().coins).length; },
  goldenCount() { return Object.keys(read().golden).length; },

  hasBadge(id) { return !!read().badges[id]; },
  // Returns true only the first time a badge is earned.
  awardBadge(id) {
    const s = read();
    if (s.badges[id]) return false;
    s.badges[id] = Date.now();
    write();
    return true;
  },

  // Toasts queued on one page to show on the next (e.g. badge earned in the study).
  queueToast(msg) { read().pendingToasts.push(msg); write(); },
  takeToasts() { const s = read(); const t = s.pendingToasts || []; s.pendingToasts = []; write(); return t; },

  recordEscape(ms) {
    const s = read();
    const isBest = s.bestEscapeMs == null || ms < s.bestEscapeMs;
    if (isBest) { s.bestEscapeMs = Math.round(ms); write(); }
    return isBest;
  },

  isMuted() { return !!read().muted; },
  setMuted(m) { read().muted = !!m; write(); },

  reset() {
    const muted = read().muted;
    memory = blank();
    memory.muted = muted;
    write();
  }
};
