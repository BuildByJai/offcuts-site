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

  // sprites get a soft shadow on the ground so they sit in the scene
  function emoji(ch, x, y, size) {
    ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(30,20,10,0.35)'; ctx.shadowBlur = size * 0.18; ctx.shadowOffsetY = size * 0.1;
    ctx.fillText(ch, x, y);
    ctx.restore();
  }
  // little bursts of sparks (wrapped round the coin / bump sounds below)
  const sparks = [];
  function burst(x, y, col, n = 12) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.5 + Math.random() * 0.3, col }); }
  }
  let shakeT = 0;
  function text(s, x, y, size = 24, col = '#231a12', weight = 800, align = 'center') {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  const BGNAME = p.bg || (mode === 'paddle' ? 'river' : mode === 'golf' ? 'grass' : mode === 'typeset' ? 'paper' : 'kitchen');
  const scene = paintScene(BGNAME, P);
  function background(scroll = 0) {
    // the painted scene; river / sky / night layers scroll with the action
    const sc = scroll % H;
    if (scene.scrolls) { ctx.drawImage(scene.c, 0, sc - H, W, H); ctx.drawImage(scene.c, 0, sc, W, H); }
    else ctx.drawImage(scene.c, 0, 0, W, H);
    if (scene.live) scene.live(ctx, t, scroll);
  }
  function overlay(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt;
      ctx.globalAlpha = Math.min(1, s.life * 2); ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, 4 + s.life * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(vignette, 0, 0, W, H);
  }
  const vignette = (() => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.32)');
    x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
  })();
  function lose(msg) {
    shakeT = 0.3;
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

  // every point scored throws a few sparks where the pointer / player is
  const coinSfx = Sfx.coin.bind(Sfx);
  const sfx = { coin: () => { coinSfx(); burst(lastHit.x, lastHit.y, P.item || '#ffd23f'); } };
  const lastHit = { x: W / 2, y: H / 2 };
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
      if (best) { best.hit = true; hits++; lastHit.x = laneX(lane); lastHit.y = lineY; (sfx.coin()); flash.push({ lane, t: 0.25, ok: true }); }
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
        if (o.good) { got++; lastHit.x = o.x; lastHit.y = o.y; (sfx.coin()); } else if (inv <= 0) { inv = 1; lose('Bump! Mind the rocks.'); }
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
        if (o.y > H - 120 && o.y < H - 60 && Math.abs(o.x - x) < 70) { o.done = true; if (o.good) { got++; lastHit.x = o.x; lastHit.y = o.y; (sfx.coin()); } else lose(`Oops — not the ${bad[0].name || 'bad one'}!`); }
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
      if (!through && prevX < L.hoopX && ball.x >= L.hoopX && Math.abs(ball.y - hy) < 42) { through = true; lastHit.x = ball.x; lastHit.y = ball.y; (sfx.coin()); toast('Through the hoop!'); }
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
          wi++; (sfx.coin());
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
    shakeT = Math.max(0, shakeT - dt);
    ctx.save();
    if (shakeT > 0) ctx.translate(Math.sin(t * 90) * 10 * shakeT, Math.cos(t * 70) * 8 * shakeT);
    draw();
    overlay(paused ? 0 : dt);
    ctx.restore();
    if (paused && !over) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H); text('Paused', W / 2, H / 2, 44, '#fff'); }
    if (!over) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { get over() { return over; } };
}


/* ---------- painted backdrops (drawn once per game to an offscreen canvas) ---------- */
function paintScene(name, P) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const rand = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const lg = (y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  const blob = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
  const out = { c, scrolls: false, live: null };
  const water = P.water || '#3fa6d8', ground = P.ground || '#8cc47a', ground2 = P.ground2 || '#7db86b', leaf = P.leaf || '#5aa24f';
  if (name === 'river') {
    x.fillStyle = lg(0, H, [[0, water], [1, '#2a7fb0']]); x.fillRect(0, 0, W, H);
    // banks left and right
    for (const side of [0, 1]) {
      x.fillStyle = ground; x.beginPath();
      const bx = side ? W : 0, dir = side ? -1 : 1;
      x.moveTo(bx, 0);
      for (let y = 0; y <= H; y += 30) x.lineTo(bx + dir * (110 + Math.sin(y * 0.02 + side) * 25), y);
      x.lineTo(bx, H); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 4; x.beginPath();
      for (let y = 0; y <= H; y += 30) x.lineTo(bx + dir * (112 + Math.sin(y * 0.02 + side) * 25), y);
      x.stroke();
      for (let i = 0; i < 14; i++) { const y = rand() * H, xx = bx + dir * (20 + rand() * 70); blob(xx, y, 22, 16, leaf); blob(xx + 8, y - 6, 14, 10, ground2); }
      for (let i = 0; i < 10; i++) { const y = rand() * H, xx = bx + dir * (96 + rand() * 12); x.strokeStyle = '#4a7a3a'; x.lineWidth = 3; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(xx + k * 4, y); x.lineTo(xx + k * 4 + (rand() - 0.5) * 8, y - 26 - rand() * 14); x.stroke(); } }
    }
    for (let i = 0; i < 8; i++) { const lx = 180 + rand() * (W - 360), ly = rand() * H; blob(lx, ly, 20, 13, '#4f9a4a'); blob(lx + 6, ly - 3, 4, 3, '#f2a0c0'); }
    out.scrolls = true;
    out.live = (ctx, t, scroll) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      for (let i = 0; i < 18; i++) { const y = ((i * 53 + scroll * 1.2) % (H + 20)) - 10, xx = 170 + (i * 137) % (W - 340); ctx.beginPath(); ctx.arc(xx, y, 16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    };
  } else if (name === 'grass') {
    x.fillStyle = ground; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W; i += 80) { x.fillStyle = (i / 80) % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; x.fillRect(i, 0, 80, H); }
    // hedge along the top, flower borders at the bottom
    x.fillStyle = '#3f7a3a'; x.fillRect(0, 0, W, 46);
    for (let i = 0; i < W; i += 28) blob(i + 14, 46, 20, 14, rand() < 0.5 ? '#4f8f46' : '#467f3f');
    for (let i = 0; i < 26; i++) { const fx = rand() * W, fy = H - 16 - rand() * 18; blob(fx, fy, 6, 6, [P.accent || '#e9a23b', '#e94f6a', '#ffffff', P.accent2 || '#2f7fd6'][i % 4]); }
    for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(30,70,20,0.25)'; x.fillRect(rand() * W, 50 + rand() * (H - 80), 2, 6); }
  } else if (name === 'kitchen') {
    // tiled wall, a shelf with pots, a stove, a checker floor
    x.fillStyle = '#f2e6cf'; x.fillRect(0, 0, W, H * 0.42);
    x.strokeStyle = 'rgba(120,90,60,0.18)'; x.lineWidth = 2;
    for (let i = 0; i < W; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H * 0.42); x.stroke(); }
    for (let j = 0; j < H * 0.42; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
    x.fillStyle = '#8a5a3a'; x.fillRect(60, 120, 300, 12);
    for (let i = 0; i < 5; i++) blob(100 + i * 60, 105, 22, 18, ['#c0563a', '#e0a83a', '#3f8a5a', '#2f5d8a', '#7a4a9a'][i]);
    x.fillStyle = '#3a3a40'; x.fillRect(W - 300, 60, 220, H * 0.42 - 60); x.fillStyle = '#55555c'; x.fillRect(W - 290, 70, 200, 50);
    for (let i = 0; i < 2; i++) blob(W - 240 + i * 100, 66, 34, 8, '#222');
    for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#e9dcc4' : '#b9a27a'; x.fillRect(i * 80, H * 0.42 + j * 45, 80, 45); }
    x.fillStyle = lg(H * 0.42, H * 0.42 + 30, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, H * 0.42, W, 30);
  } else if (name === 'paper') {
    x.fillStyle = lg(0, H, [[0, '#f6eedb'], [1, '#ebdcbb']]); x.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(120,90,40,${rand() * 0.06})`; x.fillRect(rand() * W, rand() * H, 2, 2); }
    x.strokeStyle = 'rgba(120,100,70,0.18)'; x.lineWidth = 1.5;
    for (let j = 260; j < H; j += 34) { x.beginPath(); x.moveTo(60, j); x.lineTo(W - 60, j); x.stroke(); }
    x.strokeStyle = 'rgba(160,60,40,0.25)'; x.beginPath(); x.moveTo(110, 240); x.lineTo(110, H - 20); x.stroke();
    x.strokeStyle = '#8a5a3a'; x.lineWidth = 6; x.strokeRect(24, 24, W - 48, H - 48);
    x.lineWidth = 2; x.strokeRect(36, 36, W - 72, H - 72);
  } else if (name === 'night') {
    x.fillStyle = lg(0, H, [[0, '#0b1230'], [0.7, '#24305a'], [1, '#33406a']]); x.fillRect(0, 0, W, H);
    blob(W - 140, 110, 46, 46, '#fff6d8'); blob(W - 122, 98, 46, 46, '#0f1838');
    for (const [hy, col] of [[H - 120, '#1c2444'], [H - 70, '#141a34']]) { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 40) x.lineTo(i, hy - Math.sin(i * 0.01 + hy) * 30); x.lineTo(W, H); x.fill(); }
    const stars = Array.from({ length: 90 }, () => [rand() * W, rand() * (H - 160), rand()]);
    out.live = (ctx, t) => { for (const [sx, sy, k] of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + k * 9)); ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 2, 2); } ctx.globalAlpha = 1; };
  } else if (name === 'sky') {
    x.fillStyle = lg(0, H, [[0, P.sky || '#8fc6ec'], [1, '#e2f1fb']]); x.fillRect(0, 0, W, H);
    out.scrolls = true;
    for (let i = 0; i < 9; i++) { const cx = rand() * W, cy = rand() * H; for (let k = 0; k < 4; k++) blob(cx + k * 26 - 40, cy + (k % 2) * -10, 34, 22, 'rgba(255,255,255,0.85)'); }
  } else if (name === 'hall') {
    // a lecture / court hall: wood floor, panelled back wall, red curtains
    x.fillStyle = '#7a5236'; x.fillRect(0, 0, W, H * 0.35);
    for (let i = 0; i < W; i += 120) { x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 3; x.strokeRect(i + 12, 20, 96, H * 0.35 - 40); }
    for (let j = 0; j < 8; j++) { x.fillStyle = j % 2 ? '#c8a070' : '#bb9464'; x.fillRect(0, H * 0.35 + j * (H * 0.65 / 8), W, H * 0.65 / 8); }
    for (const side of [0, 1]) {
      const cx0 = side ? W - 90 : 0;
      x.fillStyle = '#a3243a'; x.fillRect(cx0, 0, 90, H);
      for (let k = 0; k < 5; k++) { x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(cx0 + k * 18 + 6, 0, 5, H); }
    }
    x.fillStyle = '#a3243a'; x.fillRect(0, 0, W, 34); for (let i = 0; i < W; i += 40) blob(i + 20, 34, 22, 12, '#8a1e30');
  } else {
    x.fillStyle = ground; x.fillRect(0, 0, W, H);
  }
  return out;
}
