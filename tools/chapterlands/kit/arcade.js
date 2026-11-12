// ARCADE — 2D overlay mini-games. Modes: rhythm, paddle, catch, golf, dodge,
// typeset. Everything is drawn on one canvas (960 × 600 logical pixels) with
// the book's palette and emoji sprites; works with keys, mouse and touch.
// params (all optional):
//   mode, duration (s), target, lives, speed (0.6–1.6)
//   good: [{icon, name}], bad: [{icon, name}]     catch / paddle / dodge
//   icons: ['🎵', …]                              rhythm notes
//   lanes: 3                                       rhythm lanes
//   holes: 3, ball: '🦔', club: '🦩', hoop: '🃏'   golf
//   words: ['TRUTH', …]                            typeset
//   player: '🧒', bg: 'river' | 'grass' | 'kitchen' | 'paper' | 'night' | 'sky'
//   objective, done
import { CONFIG } from '../config.js';
import { Save } from '../js/save.js';
import { Sfx } from '../js/audio.js';
import { toast } from '../js/hud.js';

const W = 960, H = 600;

export function runArcade(canvas, { params: p, P, def, hud, help, onWin, onFail }) {
  const ctx = canvas.getContext('2d');
  const mode = p.mode || 'catch';
  const speed = p.speed || 1;
  const keys = {};
  let pointer = { x: W / 2, y: H / 2, down: false, sx: 0, sy: 0, moved: false };
  let paused = false, over = false, t = 0, slow = 0;
  let lives = p.lives == null ? (['paddle', 'catch', 'dodge'].includes(mode) ? 3 : null) : p.lives;
  hud.lives(lives);
  const extra = [];
  if (lives != null) extra.push({ icon: '❤️', label: 'An extra life', cost: CONFIG.costs.extraLife, act: () => { lives++; hud.lives(lives); } });
  extra.push({ icon: '🐢', label: 'Slow things down for 10 seconds', cost: CONFIG.costs.speedBoost, act: () => { slow = 10; toast('🐢 Nice and slow for 10 seconds.'); } });
  help(extra);
  window.__pauseForHelp = () => { paused = true; };
  window.__resume = () => { paused = false; };
  window.__arcadeResume = () => { paused = false; };

  const emojiCache = {};
  function emoji(ch, x, y, size) {
    ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
  }
  function text(s, x, y, size = 24, col = '#231a12', weight = 800, align = 'center') {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  const BG = {
    river: [P.water || '#3fa6d8', '#5ab8e6'], grass: [P.ground || '#8cc47a', P.ground2 || '#7db86b'], kitchen: ['#e9dcc4', '#d8c7a8'],
    paper: ['#f6eedb', '#efe4c8'], night: ['#1d2540', '#2a3456'], sky: [P.sky || '#8fc6ec', '#b9dcf2'], hall: ['#c8b89a', '#b8a888']
  }[p.bg || (mode === 'paddle' ? 'river' : mode === 'golf' ? 'grass' : mode === 'typeset' ? 'paper' : 'kitchen')];
  function background(scroll = 0) {
    ctx.fillStyle = BG[0]; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = BG[1];
    for (let i = 0; i < 40; i++) { const y = ((i * 97 + scroll) % (H + 40)) - 20; ctx.fillRect((i * 211) % W, y, 18 + (i % 4) * 10, 6); }
  }
  function lose(msg) {
    if (lives == null) return;
    lives--; hud.lives(lives); Sfx.beep(false);
    if (msg) toast(msg);
    if (lives <= 0) end(false, 'Out of lives — have another go!');
  }
  function end(win, msg) {
    if (over) return;
    over = true;
    help([]);
    if (win) { Sfx.badge(); onWin({ ms: t * 1000, text: p.done || msg }); } else onFail(msg);
  }

  /* ---------- input ---------- */
  const toLocal = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  canvas.addEventListener('pointerdown', (e) => { const q = toLocal(e); pointer = { x: q.x, y: q.y, down: true, sx: q.x, sy: q.y, moved: false }; canvas.setPointerCapture(e.pointerId); onPress && onPress(q); });
  canvas.addEventListener('pointermove', (e) => { const q = toLocal(e); pointer.x = q.x; pointer.y = q.y; if (Math.hypot(q.x - pointer.sx, q.y - pointer.sy) > 8) pointer.moved = true; });
  canvas.addEventListener('pointerup', (e) => { const q = toLocal(e); pointer.down = false; onRelease && onRelease(q); });
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape' || e.code === 'KeyP') { paused = true; document.getElementById('pause').hidden = false; }
    onKey && onKey(e);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  let onPress = null, onRelease = null, onKey = null;
  const left = () => keys.ArrowLeft || keys.KeyA, right = () => keys.ArrowRight || keys.KeyD, up = () => keys.ArrowUp || keys.KeyW, down = () => keys.ArrowDown || keys.KeyS;

  const good = p.good || [{ icon: '⭐', name: 'star' }];
  const bad = p.bad || [{ icon: '💥', name: 'bump' }];
  let step = () => {}, draw = () => {};
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- rhythm ---------- */
  if (mode === 'rhythm') {
    const lanes = p.lanes || 3, dur = p.duration || 40, bpm = (p.bpm || 96) * speed;
    const laneX = (i) => W / 2 + (i - (lanes - 1) / 2) * 150;
    const lineY = H - 110;
    const notes = [];
    for (let b = 2; b < dur * bpm / 60; b += (Math.random() < 0.25 ? 0.5 : 1)) notes.push({ beat: b, lane: Math.floor(Math.random() * lanes), hit: null, icon: (p.icons || ['🎵', '🎶', '🦞'])[Math.floor(Math.random() * (p.icons || [1, 2, 3]).length)] });
    const target = p.target || Math.ceil(notes.length * 0.6);
    let hits = 0, flash = [];
    const hitLane = (lane) => {
      const now = t * bpm / 60;
      let best = null, bd = 0.45;
      for (const n of notes) { if (n.hit !== null || n.lane !== lane) continue; const d = Math.abs(n.beat - now); if (d < bd) { bd = d; best = n; } }
      if (best) { best.hit = true; hits++; Sfx.coin(); flash.push({ lane, t: 0.25, ok: true }); }
      else { flash.push({ lane, t: 0.2, ok: false }); }
    };
    const laneKeys = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2, ArrowUp: 3 };
    onKey = (e) => { if (e.code in laneKeys && laneKeys[e.code] < lanes) hitLane(laneKeys[e.code]); };
    onPress = (q) => { let best = 0, bd = 1e9; for (let i = 0; i < lanes; i++) { const d = Math.abs(q.x - laneX(i)); if (d < bd) { bd = d; best = i; } } hitLane(best); };
    step = (dt) => {
      const now = t * bpm / 60;
      for (const n of notes) if (n.hit === null && n.beat < now - 0.5) n.hit = false;
      flash = flash.filter((f) => (f.t -= dt) > 0);
      hud.progress(`${hits} / ${target} in time`);
      if (t > dur + 1) end(hits >= target, hits >= target ? '' : `Nearly! ${hits} of ${target} in time. Have another go!`);
    };
    draw = () => {
      background();
      const now = t * bpm / 60;
      for (let i = 0; i < lanes; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(laneX(i) - 55, 0, 110, H);
        const f = flash.find((x) => x.lane === i);
        ctx.fillStyle = f ? (f.ok ? '#7dff9a' : '#ffb09a') : P.accent || '#e9a23b';
        ctx.beginPath(); ctx.arc(laneX(i), lineY, 46, 0, Math.PI * 2); ctx.fill();
        text(['A', 'S', 'D', 'F'][i], laneX(i), lineY, 26, '#fff');
      }
      for (const n of notes) {
        if (n.hit) continue;
        const y = lineY - (n.beat - now) * 170;
        if (y < -40 || y > H + 40) continue;
        emoji(n.icon, laneX(n.lane), y, 54);
      }
      text(p.objective || 'Keep to the beat!', W / 2, 40, 26);
    };
  }

  /* ---------- paddle (row up the river) ---------- */
  if (mode === 'paddle') {
    const dur = p.duration || 45;
    let x = W / 2, scroll = 0, inv = 0, got = 0;
    const objs = [];
    let spawnT = 0;
    step = (dt) => {
      const sp = 210 * speed * (slow > 0 ? 0.55 : 1);
      scroll += sp * dt;
      const steer = (left() ? -1 : 0) + (right() ? 1 : 0) + (pointer.down ? (pointer.x < W / 2 ? -1 : 1) : 0);
      x = Math.max(110, Math.min(W - 110, x + steer * 380 * dt));
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = rnd(0.45, 0.9) / speed; const g = Math.random() < 0.35; objs.push({ x: rnd(120, W - 120), y: -40, good: g, icon: (g ? good : bad)[Math.floor(Math.random() * (g ? good : bad).length)].icon }); }
      for (const o of objs) o.y += sp * dt;
      inv -= dt;
      for (const o of objs) {
        if (o.done || Math.abs(o.y - (H - 110)) > 40 || Math.abs(o.x - x) > 52) continue;
        o.done = true;
        if (o.good) { got++; Sfx.coin(); } else if (inv <= 0) { inv = 1; lose('Bump! Mind the rocks.'); }
      }
      hud.progress(`${Math.min(100, Math.round(t / dur * 100))}% of the way · ${got} picked up`);
      if (t >= dur) end(!p.need || got >= p.need, `You needed ${p.need} — have another go!`);
    };
    draw = () => {
      background(scroll);
      ctx.fillStyle = P.ground || '#8cc47a'; ctx.fillRect(0, 0, 90, H); ctx.fillRect(W - 90, 0, 90, H);
      for (const o of objs) if (!o.done) emoji(o.icon, o.x, o.y, 52);
      if (inv > 0 && Math.floor(t * 10) % 2) return;
      emoji(p.player || '🚣', x, H - 110, 76);
      text(p.objective || 'Row up the river!', W / 2, 36, 24, '#fff');
    };
  }

  /* ---------- catch ---------- */
  if (mode === 'catch') {
    const target = p.target || 12;
    let x = W / 2, got = 0, spawnT = 0;
    const objs = [];
    onPress = (q) => { x = q.x; };
    step = (dt) => {
      if (pointer.down) x += (pointer.x - x) * Math.min(1, dt * 14);
      x += ((right() ? 1 : 0) - (left() ? 1 : 0)) * 520 * dt;
      x = Math.max(60, Math.min(W - 60, x));
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = rnd(0.5, 0.95) / speed; const g = Math.random() < 0.68; objs.push({ x: rnd(60, W - 60), y: -30, vy: rnd(150, 230) * speed, good: g, icon: (g ? good : bad)[Math.floor(Math.random() * (g ? good : bad).length)].icon, spin: rnd(-2, 2), a: 0 }); }
      for (const o of objs) { o.y += o.vy * dt * (slow > 0 ? 0.5 : 1); o.a += o.spin * dt; }
      for (const o of objs) {
        if (o.done) continue;
        if (o.y > H - 120 && o.y < H - 60 && Math.abs(o.x - x) < 70) { o.done = true; if (o.good) { got++; Sfx.coin(); } else lose(`Oops — not the ${bad[0].name || 'bad one'}!`); }
        else if (o.y > H + 30) o.done = true;
      }
      hud.progress(`${got} / ${target} caught`);
      if (got >= target) end(true);
    };
    draw = () => {
      background();
      for (const o of objs) if (!o.done) { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); emoji(o.icon, 0, 0, 52); ctx.restore(); }
      emoji(p.player || '🧺', x, H - 80, 84);
      text(p.objective || `Catch ${target}!`, W / 2, 36, 24);
    };
  }

  /* ---------- dodge ---------- */
  if (mode === 'dodge') {
    const dur = p.duration || 30;
    let x = W / 2, y = H / 2, inv = 0, spawnT = 0;
    const objs = [];
    step = (dt) => {
      const vx = (right() ? 1 : 0) - (left() ? 1 : 0), vy = (down() ? 1 : 0) - (up() ? 1 : 0);
      x += vx * 380 * dt; y += vy * 380 * dt;
      if (pointer.down) { x += (pointer.x - x) * Math.min(1, dt * 10); y += (pointer.y - y) * Math.min(1, dt * 10); }
      x = Math.max(40, Math.min(W - 40, x)); y = Math.max(80, Math.min(H - 40, y));
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = rnd(0.35, 0.7) / speed / (1 + t / dur);
        const side = Math.floor(Math.random() * 4);
        const sx = side === 0 ? -30 : side === 1 ? W + 30 : rnd(0, W), sy = side === 2 ? 50 : side === 3 ? H + 30 : rnd(80, H);
        const a = Math.atan2(y - sy, x - sx) + rnd(-0.3, 0.3), v = rnd(170, 260) * speed;
        objs.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, icon: bad[Math.floor(Math.random() * bad.length)].icon, a: 0 });
      }
      const k = slow > 0 ? 0.5 : 1;
      for (const o of objs) { o.x += o.vx * dt * k; o.y += o.vy * dt * k; o.a += dt * 4; }
      inv -= dt;
      for (const o of objs) if (!o.done && Math.hypot(o.x - x, o.y - y) < 42 && inv <= 0) { o.done = true; inv = 1.2; lose('Ouch! Keep dodging.'); }
      hud.progress(`Hold on: ${Math.max(0, Math.ceil(dur - t))}s`);
      if (t >= dur) end(true);
    };
    draw = () => {
      background();
      for (const o of objs) if (!o.done) { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); emoji(o.icon, 0, 0, 46); ctx.restore(); }
      if (!(inv > 0 && Math.floor(t * 10) % 2)) emoji(p.player || '🧒', x, y, 64);
      text(p.objective || 'Dodge!', W / 2, 36, 24);
    };
  }

  /* ---------- golf (croquet) ---------- */
  if (mode === 'golf') {
    const holes = p.holes || 3;
    let hole = 0, shots = 0;
    const ball = { x: 150, y: H / 2, vx: 0, vy: 0, wander: 0 };
    let through = false;
    const layout = () => ({ hoopX: 470 + hole * 30, hoopY: H / 2, target: { x: W - 130, y: H / 2 + (hole - 1) * 120 } });
    let L = layout();
    let aim = null;
    onPress = (q) => { if (Math.hypot(q.x - ball.x, q.y - ball.y) < 90 && Math.hypot(ball.vx, ball.vy) < 5) aim = { x: q.x, y: q.y }; };
    onRelease = (q) => {
      if (!aim) return;
      const dx = ball.x - q.x, dy = ball.y - q.y, d = Math.min(220, Math.hypot(dx, dy));
      if (d > 12) { ball.vx = dx / Math.hypot(dx, dy) * d * 4.2; ball.vy = dy / Math.hypot(dx, dy) * d * 4.2; shots++; Sfx.jump(); }
      aim = null;
    };
    onKey = (e) => {
      if (e.code === 'Space' && Math.hypot(ball.vx, ball.vy) < 5) {
        const tx = through ? L.target.x : L.hoopX, ty = through ? L.target.y : hoopY();
        const a = Math.atan2(ty - ball.y, tx - ball.x);
        ball.vx = Math.cos(a) * 520; ball.vy = Math.sin(a) * 520; shots++; Sfx.jump();
      }
    };
    const hoopY = () => L.hoopY + Math.sin(t * 0.9 * speed * (slow > 0 ? 0.4 : 1)) * 150;
    step = (dt) => {
      const prevX = ball.x;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      ball.vx *= Math.pow(0.35, dt); ball.vy *= Math.pow(0.35, dt);
      if (ball.y < 70 || ball.y > H - 30) { ball.vy *= -0.7; ball.y = Math.max(70, Math.min(H - 30, ball.y)); }
      if (ball.x < 40 || ball.x > W - 40) { ball.vx *= -0.7; ball.x = Math.max(40, Math.min(W - 40, ball.x)); }
      // the hedgehog won't keep still
      if (Math.hypot(ball.vx, ball.vy) < 5) { ball.wander += dt; ball.x += Math.sin(ball.wander * 1.3) * 6 * dt; ball.y += Math.cos(ball.wander) * 6 * dt; }
      const hy = hoopY();
      if (!through && prevX < L.hoopX && ball.x >= L.hoopX && Math.abs(ball.y - hy) < 42) { through = true; Sfx.coin(); toast('Through the hoop!'); }
      if (through && Math.hypot(ball.x - L.target.x, ball.y - L.target.y) < 36) {
        hole++; Sfx.badge();
        if (hole >= holes) { end(true); return; }
        toast(`Hole ${hole} done!`);
        L = layout(); through = false; Object.assign(ball, { x: 150, y: H / 2, vx: 0, vy: 0 });
      }
      hud.progress(`Hoop ${Math.min(hole + 1, holes)} of ${holes} · ${shots} hits`);
    };
    draw = () => {
      background();
      const hy = hoopY();
      emoji(p.hoop || '🃏', L.hoopX, hy - 50, 56);
      ctx.strokeStyle = through ? '#3fae5c' : '#ffffff'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(L.hoopX, hy - 42); ctx.lineTo(L.hoopX, hy + 42); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(L.target.x, L.target.y, 36, 0, Math.PI * 2); ctx.fill();
      emoji('🚩', L.target.x + 6, L.target.y - 30, 44);
      if (aim) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + (ball.x - pointer.x), ball.y + (ball.y - pointer.y)); ctx.stroke(); ctx.setLineDash([]); }
      emoji(p.ball || '🦔', ball.x, ball.y, 50);
      emoji(p.club || '🦩', ball.x - 50, ball.y - 30, 44);
      text(p.objective || (through ? 'Now into the flag!' : 'Through the hoop first!'), W / 2, 36, 24);
      text('Drag back from the ball and let go (Space = auto-aim)', W / 2, H - 20, 15, '#3a2a20', 600);
    };
  }

  /* ---------- typeset ---------- */
  if (mode === 'typeset') {
    const words = (p.words || ['TRUTH', 'ORDER', 'THRIFT']).map((w) => w.toUpperCase());
    let wi = 0, pos = 0, tiles = [], shake = 0;
    const deal = () => {
      const w = words[wi];
      const letters = w.split('').concat('ETAOINSHR'.split('').sort(() => Math.random() - 0.5).slice(0, Math.min(4, 9 - w.length)));
      letters.sort(() => Math.random() - 0.5);
      tiles = letters.map((ch, i) => ({ ch, x: 120 + (i % 7) * 120, y: 330 + Math.floor(i / 7) * 110, used: false }));
      pos = 0;
    };
    deal();
    const pick = (tile) => {
      const w = words[wi];
      if (tile.used) return;
      if (tile.ch === w[pos]) {
        tile.used = true; pos++; Sfx.click();
        if (pos >= w.length) {
          wi++; Sfx.coin();
          if (wi >= words.length) { end(true); return; }
          toast(`“${w}” set!`); deal();
        }
      } else { shake = 0.3; Sfx.beep(false); }
    };
    onPress = (q) => { for (const tl of tiles) if (Math.abs(q.x - tl.x) < 48 && Math.abs(q.y - tl.y) < 48) { pick(tl); break; } };
    onKey = (e) => { if (/^Key[A-Z]$/.test(e.code)) { const ch = e.code.slice(3); const tl = tiles.find((x) => !x.used && x.ch === ch); if (tl) pick(tl); else { shake = 0.3; Sfx.beep(false); } } };
    step = (dt) => { shake = Math.max(0, shake - dt); hud.progress(`Word ${Math.min(wi + 1, words.length)} of ${words.length}`); };
    draw = () => {
      background();
      const w = words[wi] || '';
      text(p.objective || 'Set the type: pick the letters in order', W / 2, 40, 24);
      text(w.split('').join(' '), W / 2, 84, 30, '#8a6a3a', 800);
      // composing stick (letters are set mirror-wise in real type; we show the result)
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(W / 2 - w.length * 40 - 20, 110, w.length * 80 + 40, 110);
      for (let i = 0; i < w.length; i++) {
        const x = W / 2 - w.length * 40 + i * 80 + 40 + (shake > 0 ? Math.sin(t * 80) * 4 : 0);
        ctx.fillStyle = i < pos ? '#f6eedb' : 'rgba(255,255,255,0.15)'; ctx.fillRect(x - 32, 125, 64, 80);
        if (i < pos) text(w[i], x, 165, 48, '#231a12', 900);
        else text('·', x, 165, 40, '#cdb894');
      }
      for (const tl of tiles) {
        if (tl.used) continue;
        ctx.fillStyle = '#d8c7a8'; ctx.fillRect(tl.x - 44, tl.y - 44, 88, 88);
        ctx.fillStyle = '#efe4c8'; ctx.fillRect(tl.x - 40, tl.y - 40, 80, 80);
        text(tl.ch, tl.x, tl.y + 2, 46, '#231a12', 900);
      }
    };
  }

  /* ---------- loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused && !over) { t += dt; slow = Math.max(0, slow - dt); step(dt); }
    draw();
    if (paused && !over) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H); text('Paused', W / 2, H / 2, 44, '#fff'); }
    if (!over) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { get over() { return over; } };
}
