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

// Short filtered noise burst (whooshes, thuds).
let noiseBuf = null;
function noise(dur, { vol = 0.08, from = 1200, to = 300, type = 'bandpass', q = 1, delay = 0 } = {}) {
  if (Save.isMuted()) return;
  const a = ac();
  if (!a) return;
  try {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 1, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = a.currentTime + delay;
    const s = a.createBufferSource(); s.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(a.destination);
    s.start(t0); s.stop(t0 + dur + 0.02);
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
  unlockLock() { tone(400, 800, 0.1, 'triangle', 0.08); tone(800, 1200, 0.15, 'triangle', 0.08, 0.1); },

  // ---- moves ----
  doubleJump(n = 1) { tone(420 + n * 120, 980 + n * 160, 0.14, 'triangle', 0.05); noise(0.15, { vol: 0.03, from: 3000, to: 900 }); },
  charge() { tone(180, 520, 0.9, 'sawtooth', 0.018); },
  superJump(k = 1) { tone(220, 880 + k * 500, 0.3, 'triangle', 0.07); noise(0.3, { vol: 0.05, from: 600, to: 2400 }); },
  slide() { noise(0.4, { vol: 0.05, from: 900, to: 300, type: 'lowpass' }); },
  dash() { noise(0.22, { vol: 0.08, from: 400, to: 3200, q: 0.8 }); },
  wallJump() { tone(260, 140, 0.06, 'square', 0.04); tone(500, 900, 0.1, 'sine', 0.05, 0.03); },
  glide() { noise(0.35, { vol: 0.04, from: 700, to: 1600 }); tone(700, 900, 0.12, 'sine', 0.03); },
  poundStart() { tone(900, 300, 0.16, 'square', 0.03); },
  poundLand() { tone(110, 40, 0.3, 'sine', 0.12); noise(0.3, { vol: 0.1, from: 500, to: 80, type: 'lowpass' }); },
  bounce() { tone(200, 700, 0.22, 'sine', 0.08); tone(300, 1000, 0.18, 'triangle', 0.04, 0.05); },
  ring(n = 0) { const f = 660 * Math.pow(1.122, n % 8); tone(f, f * 1.5, 0.16, 'triangle', 0.06); },
  zip() { noise(0.6, { vol: 0.03, from: 2400, to: 2000, q: 6 }); },
  rail() { noise(0.4, { vol: 0.03, from: 3200, to: 2800, q: 8 }); tone(1200, 1100, 0.2, 'triangle', 0.02); },
  cannon() { tone(90, 40, 0.4, 'sine', 0.14); noise(0.45, { vol: 0.12, from: 800, to: 100, type: 'lowpass' }); },
  crate() { noise(0.25, { vol: 0.12, from: 1600, to: 200 }); tone(180, 90, 0.15, 'square', 0.04); },
  buy() { [659, 784, 988, 1318].forEach((f, i) => tone(f, f, 0.14, 'square', 0.04, i * 0.06)); },
  denied() { tone(200, 150, 0.12, 'square', 0.04); tone(150, 110, 0.14, 'square', 0.04, 0.1); },
  boost() { tone(400, 1200, 0.3, 'triangle', 0.06); tone(600, 1600, 0.25, 'sine', 0.04, 0.08); },
  combo(n) { const f = 523 * Math.pow(1.06, Math.min(n, 20)); tone(f, f * 1.25, 0.1, 'triangle', 0.045); },
  payout() { [988, 1175, 1318, 1568, 1976].forEach((f, i) => tone(f, f, 0.1, 'square', 0.035, i * 0.05)); },
  countdown(go) { go ? tone(880, 880, 0.35, 'square', 0.06) : tone(440, 440, 0.15, 'square', 0.05); },
  gate() { tone(784, 1046, 0.12, 'triangle', 0.06); },
  speedPad() { tone(500, 1400, 0.18, 'sawtooth', 0.03); }
};
