// Event tracking stub (A1 §8). For now it only logs to the console, and only
// with ?debug=1. No network calls and no personal data — ever. Later (Gate A)
// this becomes anonymous event counts; the call sites won't need to change.
//
// Events: tower-climbed · fog-lifted · quest-step · quest-complete ·
// library-card-opened · chapter-read · street-unlocked · check-passed ·
// check-failed (+ a few District Kit ones: street-played, sky-run, vault).
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';

export function track(eventName, data = {}) {
  if (!DEBUG) return;
  try { console.log('[track]', eventName, data); } catch (e) { /* no console */ }
}
