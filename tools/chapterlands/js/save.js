// Single source of truth for Chapterlands progress. One localStorage key; if
// storage is unavailable (private mode, blocked cookies) we keep an in-memory
// copy so the game still works for the session.
//
// Chapterlands save v2 (key `chapterlands.save.v2`, internal v: 4) adds the
// library: profile name, library card (stamps + Keys), Lookout Towers, side
// quests, unlocked streets, reading progress and the District Kit records.
// It's migrated once from the Book Town keys (`bookTown.save.v2`, then
// `bookTown.save.v1`) keeping coins, badges and best times. The old keys are
// never deleted, so a rollback still finds them.
//
// v2 (Phase 2) added `tower` (Habit Tower PB, ghost, furthest section).
// v3 (Phase 3) adds the coin wallet, bought moves, graphics quality, time
// trial records and "seen" flags for one-off tips. Older saves are migrated
// automatically on first load — existing coins are credited to the wallet.
//
// `?debug=1` unlocks every move and gives a big wallet for this session only
// (nothing debug-related is written to storage).
import { CONFIG } from '../config.js';

const KEY = CONFIG.saveKey;
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';

function blankTower() {
  return { bestMs: null, ghost: null, maxSection: 0, runs: 0 };
}
function blank() {
  return {
    v: 4, coins: {}, golden: {}, badges: {}, bestEscapeMs: null, muted: false, pendingToasts: [],
    tower: blankTower(),
    wallet: 0, earned: 0, unlocks: {}, quality: null, timeOfDay: null, trials: {}, seen: {}, crates: {},
    // ---- Chapterlands (save v2) ----
    profile: { name: null },
    libraryCard: { stamps: [], keys: [] },
    towers: {},                 // quarter id → true once its Lookout Tower is climbed
    sideQuests: {},             // quest id → { step, done, got: { itemId: 1 }, gave: { itemId: 1 } }
    streets: {},                // book id → [street ids whose reading check is passed]
    reading: {},                // book id → last chapter number read in the Reading Room
    streetGames: {},            // book id → [street ids whose game is finished]
    skyRuns: {},                // book id → best ms
    vaults: {},                 // book id → best ms
    ownCopy: {},                // book id → [street ids] the player said they read in their own copy
    hints: {}                   // "bookId:streetId:q" → 1 when a hint was bought
  };
}
const ARR = ['stamps', 'keys'];

// adjective + noun from config — no free text entry anywhere.
export function rollName(not = null) {
  const N = CONFIG.names;
  for (let i = 0; i < 20; i++) {
    const n = N.adjectives[(Math.random() * N.adjectives.length) | 0] + ' ' + N.nouns[(Math.random() * N.nouns.length) | 0];
    if (n !== not) return n;
  }
  return 'Brave Lantern';
}

function migrate(old) {
  const out = blank();
  if (old && typeof old === 'object') {
    for (const k of ['coins', 'golden', 'badges', 'bestEscapeMs', 'muted', 'pendingToasts',
      'wallet', 'earned', 'unlocks', 'quality', 'timeOfDay', 'trials', 'seen', 'crates']) {
      if (old[k] !== undefined && old[k] !== null) out[k] = old[k];
    }
    if (old.tower && typeof old.tower === 'object') out.tower = Object.assign(blankTower(), old.tower);
    for (const k of ['towers', 'sideQuests', 'streets', 'reading', 'streetGames', 'skyRuns', 'vaults', 'ownCopy', 'hints']) {
      if (old[k] && typeof old[k] === 'object') out[k] = old[k];
    }
    if (old.profile && typeof old.profile === 'object') out.profile = Object.assign(out.profile, old.profile);
    if (old.libraryCard && typeof old.libraryCard === 'object') {
      for (const k of ARR) if (Array.isArray(old.libraryCard[k])) out.libraryCard[k] = old.libraryCard[k].slice();
    }
    if (!old.v || old.v < 3) {
      // credit coins collected before the wallet existed
      const e = CONFIG.economy;
      out.wallet = Object.keys(out.coins).length * e.coin + Object.keys(out.golden).length * e.golden;
      out.earned = out.wallet;
    }
  }
  out.v = 4;
  if (!out.profile.name) out.profile.name = rollName();
  // Atomic Habits: the escape room already finished → its stamp and Key.
  if (out.badges['habit-breaker']) {
    if (!out.libraryCard.stamps.includes('life-atomic')) out.libraryCard.stamps.push('life-atomic');
    if (!out.libraryCard.keys.includes('life-atomic')) out.libraryCard.keys.push('life-atomic');
  }
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
    if (data && (!data.v || data.v < 4)) migrated = true;
  } catch (e) { /* storage unavailable or corrupt — fall through */ }
  memory = migrate(data);
  if (migrated) write();
  return memory;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* in-memory only */ }
}

const listeners = new Set();
function changed(what) { listeners.forEach((fn) => { try { fn(what); } catch (e) { /* ignore */ } }); }

export const Save = {
  DEBUG,
  get() { return read(); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  hasCoin(id) { return !!read().coins[id]; },
  hasGolden(id) { return !!read().golden[id]; },
  addCoin(id) { read().coins[id] = 1; this.earn(CONFIG.economy.coin, false); write(); },
  addGolden(id) { read().golden[id] = 1; this.earn(CONFIG.economy.golden, false); write(); },
  coinCount() { return Object.keys(read().coins).length; },
  goldenCount() { return Object.keys(read().golden).length; },

  /* ---------- wallet ---------- */
  wallet() { return DEBUG ? Math.max(9999, read().wallet) : read().wallet; },
  earn(n, save = true) {
    const s = read();
    s.wallet = (s.wallet || 0) + n; s.earned = (s.earned || 0) + n;
    if (save) write();
    changed('wallet');
  },
  spend(n) {
    if (DEBUG) { changed('wallet'); return true; }
    const s = read();
    if ((s.wallet || 0) < n) return false;
    s.wallet -= n; write(); changed('wallet');
    return true;
  },

  /* ---------- moves ---------- */
  hasUnlock(id) { return DEBUG || !!read().unlocks[id]; },
  unlocks() {
    const out = {};
    for (const u of CONFIG.shop.unlocks) out[u.id] = this.hasUnlock(u.id);
    return out;
  },
  unlock(id) { read().unlocks[id] = Date.now(); write(); changed('unlocks'); },

  /* ---------- one-off flags (tips shown, crates broken) ---------- */
  seen(id) { return !!read().seen[id]; },
  markSeen(id) { read().seen[id] = 1; write(); },
  crateBrokenAt(id) { return read().crates[id] || 0; },
  breakCrate(id) { read().crates[id] = Date.now(); write(); },

  /* ---------- graphics ---------- */
  quality() { return read().quality; },
  setQuality(q) { read().quality = q; write(); },
  // Pause-menu time of day: null = live day/night cycle, otherwise a fixed hour.
  timeOfDay() { const t = read().timeOfDay; return typeof t === 'number' ? t : null; },
  setTimeOfDay(h) { read().timeOfDay = h; write(); },

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

  /* ---------- time trials ---------- */
  trial(id) {
    const all = read().trials;
    if (!all[id]) all[id] = { bestMs: null, ghost: null, medals: {}, runs: 0 };
    return all[id];
  },
  // Returns { isBest, newMedals: [...] }.
  recordTrial(id, ms, ghost, medal) {
    const t = this.trial(id);
    t.runs = (t.runs || 0) + 1;
    const isBest = t.bestMs == null || ms < t.bestMs;
    if (isBest) { t.bestMs = Math.round(ms); t.ghost = ghost || null; }
    const order = ['bronze', 'silver', 'gold'];
    const newMedals = [];
    if (medal) {
      for (const m of order.slice(0, order.indexOf(medal) + 1)) {
        if (!t.medals[m]) { t.medals[m] = Date.now(); newMedals.push(m); }
      }
    }
    write();
    return { isBest, newMedals };
  },

  /* ---------- Chapterlands: profile + library card ---------- */
  name() { return read().profile.name; },
  rerollName() { const s = read(); s.profile.name = rollName(s.profile.name); write(); changed('profile'); return s.profile.name; },
  card() { return read().libraryCard; },
  hasStamp(id) { return read().libraryCard.stamps.includes(id); },
  hasKey(id) { return !!id && read().libraryCard.keys.includes(id); },
  // Finishing a book: stamp + Key. Returns true the first time.
  finishBook(id) {
    const c = read().libraryCard;
    let fresh = false;
    if (!c.stamps.includes(id)) { c.stamps.push(id); fresh = true; }
    if (!c.keys.includes(id)) { c.keys.push(id); fresh = true; }
    if (fresh) { write(); changed('card'); }
    return fresh;
  },

  /* ---------- Lookout Towers ---------- */
  towerClimbed(q) { return !!read().towers[q]; },
  climbTower(q) { read().towers[q] = true; write(); changed('towers'); },

  /* ---------- side quests ---------- */
  quest(id) {
    const all = read().sideQuests;
    if (!all[id]) all[id] = { step: 0, done: false, got: {}, gave: {} };
    const q = all[id];
    q.got = q.got || {}; q.gave = q.gave || {};
    return q;
  },
  saveQuests() { write(); changed('quests'); },

  /* ---------- streets + reading ---------- */
  streetsOpen(book) { return read().streets[book] || []; },
  isStreetOpen(book, street) { return this.streetsOpen(book).includes(street); },
  openStreet(book, street) {
    const s = read();
    const list = s.streets[book] || (s.streets[book] = []);
    if (list.includes(street)) return false;
    list.push(street); write(); changed('streets');
    return true;
  },
  isStreetPlayed(book, street) { return (read().streetGames[book] || []).includes(street); },
  playStreet(book, street) {
    const s = read();
    const list = s.streetGames[book] || (s.streetGames[book] = []);
    if (list.includes(street)) return false;
    list.push(street); write(); changed('streets');
    return true;
  },
  lastRead(book) { return read().reading[book] || 0; },
  markRead(book, chapter) {
    const s = read();
    if ((s.reading[book] || 0) >= chapter) return false;
    s.reading[book] = chapter; write(); changed('reading');
    return true;
  },
  ownCopy(book) { return read().ownCopy[book] || []; },
  markOwnCopy(book, street) {
    const s = read();
    const list = s.ownCopy[book] || (s.ownCopy[book] = []);
    if (!list.includes(street)) { list.push(street); write(); }
  },
  hasHint(key) { return !!read().hints[key]; },
  buyHint(key) { read().hints[key] = 1; write(); },
  skyRun(book) { return read().skyRuns[book] || null; },
  recordSkyRun(book, ms) {
    const s = read();
    const best = s.skyRuns[book];
    const isBest = !best || ms < best;
    if (isBest) { s.skyRuns[book] = Math.round(ms); write(); }
    return isBest;
  },
  vault(book) { return read().vaults[book] || null; },
  recordVault(book, ms) {
    const s = read();
    const best = s.vaults[book];
    const isBest = !best || ms < best;
    if (isBest) { s.vaults[book] = Math.round(ms); write(); }
    return isBest;
  },

  isMuted() { return !!read().muted; },
  setMuted(m) { read().muted = !!m; write(); },

  reset() {
    const { muted, quality, timeOfDay, profile } = read();
    memory = blank();
    memory.muted = muted;
    memory.quality = quality;
    memory.timeOfDay = timeOfDay;
    memory.profile = Object.assign({}, profile);
    write();
    changed('reset');
  }
};
