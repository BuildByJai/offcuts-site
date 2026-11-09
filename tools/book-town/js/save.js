// Single source of truth for Book Town progress. One localStorage key; if
// storage is unavailable (private mode, blocked cookies) we keep an in-memory
// copy so the game still works for the session.
//
// v2 (Phase 2) adds `tower` (Habit Tower PB, ghost, furthest section).
// A v1 save is migrated automatically on first load.
import { CONFIG } from '../config.js';

const KEY = CONFIG.saveKey;

function blankTower() {
  return { bestMs: null, ghost: null, maxSection: 0, runs: 0 };
}
function blank() {
  return {
    v: 2, coins: {}, golden: {}, badges: {}, bestEscapeMs: null, muted: false, pendingToasts: [],
    tower: blankTower()
  };
}

// v1 → v2: same top-level fields, plus the tower block.
function migrate(old) {
  const out = blank();
  if (old && typeof old === 'object') {
    for (const k of ['coins', 'golden', 'badges', 'bestEscapeMs', 'muted', 'pendingToasts']) {
      if (old[k] !== undefined) out[k] = old[k];
    }
    if (old.tower && typeof old.tower === 'object') out.tower = Object.assign(blankTower(), old.tower);
  }
  out.v = 2;
  return out;
}

let memory = null;

function read() {
  if (memory) return memory;
  let data = null, migrated = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
    if (!data) {
      for (const legacy of CONFIG.legacySaveKeys || []) {
        const r = localStorage.getItem(legacy);
        if (r) { data = JSON.parse(r); migrated = true; break; }
      }
    }
  } catch (e) { /* storage unavailable or corrupt — fall through */ }
  memory = migrate(data);
  if (migrated) write();
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

  /* ---------- Habit Tower ---------- */
  tower() { return read().tower; },
  // Records a finished climb; keeps the ghost only for a new personal best.
  recordTower(ms, ghost) {
    const t = read().tower;
    t.runs = (t.runs || 0) + 1;
    const isBest = t.bestMs == null || ms < t.bestMs;
    if (isBest) { t.bestMs = Math.round(ms); t.ghost = ghost || null; }
    write();
    return isBest;
  },
  reachTowerSection(n) {
    const t = read().tower;
    if (n > (t.maxSection || 0)) { t.maxSection = n; write(); }
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
