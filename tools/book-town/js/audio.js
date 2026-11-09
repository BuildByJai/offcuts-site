// Tiny synthesised sound effects — no audio files to load.
import { Save } from './save.js';

let ctx = null;
function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, endFreq, dur, type = 'sine', vol = 0.08, delay = 0) {
  if (Save.isMuted()) return;
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* ignore */ }
}

export const Sfx = {
  unlock() { ac(); },
  coin() { tone(988, 1318, 0.09, 'square', 0.05); tone(1318, 1760, 0.14, 'square', 0.05, 0.07); },
  golden() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, f * 1.01, 0.18, 'triangle', 0.07, i * 0.07)); },
  jump() { tone(320, 620, 0.12, 'sine', 0.05); },
  land() { tone(140, 80, 0.08, 'sine', 0.06); },
  badge() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.07, i * 0.1)); },
  beep(ok) { ok ? tone(660, 990, 0.2, 'sine', 0.08) : tone(160, 120, 0.22, 'sine', 0.08); },
  click() { tone(600, 400, 0.05, 'square', 0.03); },
  unlockLock() { tone(400, 800, 0.1, 'triangle', 0.08); tone(800, 1200, 0.15, 'triangle', 0.08, 0.1); }
};
