// Anonymous event counts (Gate A). Sent to /api/chapterlands/events, which
// stores them in Cloudflare Analytics Engine (see src/lib/chapterlands-events.js).
//
// What leaves the device: the event name, a random id made here (not linked
// to the player's name, IP or anything else), and for some events the book,
// the street and the street's position in the book. Never the player's name,
// never location, never anything typed. With ?debug=1 events are only logged
// to the console, not sent.
//
// Events: session-start · tower-climbed · fog-lifted · quest-step ·
// quest-complete · library-card-opened · chapter-read · street-unlocked ·
// check-passed · check-failed · street-played · sky-run · vault · lights-out ·
// rested · cafe-entered · matcha-bought · matcha-free-claimed · matcha-pickup ·
// guest-art-viewed
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';
const ENDPOINT = '/api/chapterlands/events';
const ID_KEY = 'chapterlands.anon';
const SEND = typeof location !== 'undefined' && /^https:/.test(location.protocol) && !DEBUG;

function anonId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id || !/^[A-Za-z0-9]{8,16}$/.test(id)) {
      const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      const b = new Uint8Array(12); crypto.getRandomValues(b);
      id = Array.from(b, (x) => c[x % c.length]).join('');
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch (e) { return null; }
}

let queue = [];
let timer = null;
function flush() {
  timer = null;
  if (!queue.length) return;
  const p = anonId();
  const events = queue.splice(0, 40);
  if (!p) return;
  const body = JSON.stringify({ p, events });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
    fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch (e) { /* never break the game over stats */ }
}
if (typeof addEventListener !== 'undefined') {
  addEventListener('pagehide', flush);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

export function track(eventName, data = {}) {
  if (DEBUG) { try { console.log('[track]', eventName, data); } catch (e) { /* no console */ } return; }
  if (!SEND) return;
  const ev = { e: eventName, d: Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000) };
  if (data.book) ev.b = String(data.book);
  if (data.street) ev.s = String(data.street);
  if (Number.isFinite(data.index)) ev.i = data.index;
  queue.push(ev);
  if (!timer) timer = setTimeout(flush, 4000);
}
