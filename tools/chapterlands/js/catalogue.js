// Chapterlands catalogue — loads catalogue/books.json once and answers every
// question about books. Nothing about books is hard-coded anywhere else: the
// roads, plots, library card, Reading Room and lost-books quest all ask here.
//
// Paths: every page that imports this module lives one or two folders below
// tools/chapterlands/, so URLs are resolved against this file's own location.

const ROOT = new URL('../', import.meta.url);          // tools/chapterlands/
let data = null;
let loading = null;
const kitCache = {};

export const Catalogue = {
  root: ROOT,
  url(rel) { return new URL(rel, ROOT).href; },

  async load() {
    if (data) return data;
    if (!loading) {
      loading = fetch(new URL('catalogue/books.json', ROOT)).then((r) => {
        if (!r.ok) throw new Error('catalogue ' + r.status);
        return r.json();
      }).then((j) => { data = j; return j; });
    }
    return loading;
  },
  get ready() { return !!data; },
  get quarters() { return data ? data.quarters : []; },
  get books() { return data ? data.books : []; },

  getQuarter(id) { return this.quarters.find((q) => q.id === id) || null; },
  getBook(id) { return this.books.find((b) => b.id === id) || null; },

  // Road order: Level 1 nearest the square, Level 4 furthest out. Within a
  // level, books of a series stay together in series order (so a borough's
  // districts sit side by side for their bridge), otherwise catalogue order.
  booksInQuarter(qid) {
    const list = this.books.filter((b) => b.quarter === qid);
    const firstIdx = {};
    this.books.forEach((b, i) => {
      const key = b.series ? 's:' + b.series + ':' + b.level : 'b:' + b.id;
      if (!(key in firstIdx)) firstIdx[key] = i;
    });
    const groupOf = (b) => firstIdx[b.series ? 's:' + b.series + ':' + b.level : 'b:' + b.id];
    return list.slice().sort((a, b) => (a.level - b.level) || (groupOf(a) - groupOf(b)) || ((a.seriesOrder || 0) - (b.seriesOrder || 0)));
  },

  // The next book in the same series (or null).
  nextInSeries(id) {
    const b = this.getBook(id);
    if (!b || !b.series) return null;
    return this.books.find((x) => x.series === b.series && x.seriesOrder === (b.seriesOrder || 0) + 1) || null;
  },

  // Short name for banners ("Wonderland — coming soon").
  placeName(b) { return (b && (b.place || b.title)) || ''; },
  // "the Alice Key"
  keyName(b) { return (b && (b.keyName || b.title)) || 'that'; },
  levelIcons(level) { return '📖'.repeat(Math.max(1, Math.min(4, level || 1))); },

  isLive(b) { return !!b && b.status === 'live'; },
  // A District Kit book (as opposed to Atomic Habits, which has its own page).
  hasKit(b) { return !!b && b.status === 'live' && !!b.contentPath; },

  /* ---------- District Kit content ---------- */
  // book.json for a book (cached). Resolves to null if the district isn't built.
  async kit(id) {
    if (id in kitCache) return kitCache[id];
    const b = this.getBook(id);
    if (!b || !b.contentPath) return (kitCache[id] = null);
    kitCache[id] = fetch(new URL(b.contentPath + 'book.json', ROOT)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return kitCache[id];
  },
  async questions(id) {
    const b = this.getBook(id);
    if (!b || !b.contentPath) return null;
    try { const r = await fetch(new URL(b.contentPath + 'questions.json', ROOT)); return r.ok ? r.json() : null; } catch (e) { return null; }
  },
  // Raw markdown for one chapter file (readable books only).
  async chapter(id, file) {
    const b = this.getBook(id);
    if (!b || !b.readable || !b.contentPath) return null;
    try { const r = await fetch(new URL(b.contentPath + 'chapters/' + file, ROOT)); return r.ok ? r.text() : null; } catch (e) { return null; }
  },
  // Every live District Kit book with its book.json — used by the town to
  // register district side quests and badges.
  async liveKits() {
    const out = [];
    for (const b of this.books) {
      if (!this.hasKit(b)) continue;
      const k = await this.kit(b.id);
      if (k) out.push({ book: b, kit: k });
    }
    return out;
  }
};

// Quarter icons (A1 names → emoji used on signs, shelves, books and the card).
export const QUARTER_ICON = { wand: '🪄', map: '🗺️', leaf: '🍃', house: '🏠', magnifier: '🔍', rocket: '🚀', compass: '🧭' };
export function quarterIcon(q) { return (q && QUARTER_ICON[q.icon]) || '📚'; }
