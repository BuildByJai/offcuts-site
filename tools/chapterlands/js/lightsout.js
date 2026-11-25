// Lights Out (bedtime). Uses the device's own clock only: no location, no
// time zone lookup, nothing sent anywhere. Times live in CONFIG.lightsOut.
//
// During Lights Out the town goes dark and every game is asleep. The only
// lit building is the Reading Room, which stays open: bedtime is for reading.
// Finishing a chapter during Lights Out earns the Rested bonus next morning.
//
// Testing: ?lightsout=1 forces it on, ?lightsout=0 forces it off.
import { CONFIG } from '../config.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lightsout') : null;
const LS_KEY = 'chapterlands.lightsout';

function hm(s) { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); }
function minutesNow(d = new Date()) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }

export const LightsOut = {
  get cfg() { return CONFIG.lightsOut; },
  // true between start and end (wraps past midnight)
  isOn(d = new Date()) {
    if (Q === '1') return true;
    if (Q === '0' || !this.cfg || !this.cfg.enabled) return false;
    const now = minutesNow(d), s = hm(this.cfg.start), e = hm(this.cfg.end);
    return s > e ? (now >= s || now < e) : (now >= s && now < e);
  },
  // minutes until Lights Out starts (only meaningful when it's off)
  minutesUntil(d = new Date()) {
    if (Q === '0' || !this.cfg || !this.cfg.enabled) return Infinity;
    const now = minutesNow(d), s = hm(this.cfg.start);
    return ((s - now) + 24 * 60) % (24 * 60);
  },
  // the date of the night that a moment belongs to: after midnight counts as the night before
  nightOf(d = new Date()) {
    const t = new Date(d);
    if (minutesNow(d) < hm(this.cfg.end)) t.setDate(t.getDate() - 1);
    return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
  },
  _state() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } },
  _write(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } },
  // call when a chapter is finished
  noteReading() {
    if (!this.isOn()) return false;
    const s = this._state(); s.readNight = this.nightOf(); this._write(s);
    return true;
  },
  // Morning after a bedtime read: returns true once (the Rested bonus).
  claimRested(d = new Date()) {
    if (this.isOn(d)) return false;
    const s = this._state();
    if (!s.readNight) return false;
    // last night = the night that ended this morning
    const lastNight = this.nightOf(new Date(d.getTime() - 12 * 3600 * 1000));
    if (s.readNight !== lastNight || s.claimed === lastNight) return false;
    s.claimed = lastNight; this._write(s);
    return true;
  }
};
