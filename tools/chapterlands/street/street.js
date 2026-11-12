// Chapterlands street runner. One page plays every District Kit template:
//   street/?book=<bookId>&street=<streetId>   a street (opens after its check)
//   street/?book=<bookId>&street=sky          the district's Sky Run
//   street/?demo=<TEMPLATE>                   a sample of any template
// The template and its params come from content/<quarter>/<book>/book.json;
// no per-book code lives here.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { World, Batcher } from '../js/world.js';
import { Player } from '../js/player.js';
import { FollowCamera } from '../js/camera.js';
import { Input } from '../js/input.js';
import { Save } from '../js/save.js';
import { Sfx } from '../js/audio.js';
import { toast, awardBadge, setPrompt, fadeOut, fadeIn, controlsHelpHTML, confetti } from '../js/hud.js';
import { createGfx, followShadow } from '../js/gfx.js';
import { attachJuice } from '../js/fx.js';
import { MoveHud } from '../js/movehud.js';
import { Catalogue } from '../js/catalogue.js';
import { track } from '../js/track.js';
import { guardLinks } from '../js/grownups.js';
import { pal, rng, seedOf, groundTexture, hex, decorate } from '../kit/props.js';
import { DEMO } from '../kit/demo.js';
import { TEMPLATES } from '../kit/templates/index.js';
import { runArcade } from '../kit/arcade.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const demo = qs.get('demo');
const DEBUG = qs.get('debug') === '1';

/* =============== what are we playing? =============== */
await Catalogue.load();
let book, kit, def, isSky = false;
if (demo) {
  kit = DEMO.kit;
  book = DEMO.book;
  def = DEMO.streets[demo] || DEMO.streets[Object.keys(DEMO.streets).find((k) => k.toLowerCase() === demo.toLowerCase())];
} else {
  book = Catalogue.getBook(qs.get('book'));
  kit = book ? await Catalogue.kit(book.id) : null;
  const sid = qs.get('street');
  isSky = sid === 'sky';
  def = kit ? (isSky ? kit.skyRun : kit.streets.find((s) => s.id === sid)) : null;
}
for (const bd of (kit && kit.unlock && kit.unlock.badges) || []) if (!CONFIG.badges.some((x) => x.id === bd.id)) CONFIG.badges.push(bd);
const backUrl = book && !demo ? `../?spawn=plot:${encodeURIComponent(book.id)}&panel=1${DEBUG ? '&debug=1' : ''}` : '../';
document.querySelectorAll('#btn-back-start, #btn-back-pause, #btn-finish-back, #btn-fail-back, #btn-locked-back').forEach((a) => { a.href = backUrl; });
guardLinks();

function stop(title, text) {
  $('loading').hidden = true;
  $('locked-title').textContent = title;
  $('locked-text').textContent = text;
  $('locked').hidden = false;
  fadeIn();
}
const theme = (kit && kit.theme) || {};
// a street can tweak the book's palette (a garden street in a nursery book, a night scene…)
const P = Object.assign(pal(theme), (def && def.params && def.params.palette) || {});
let allowed = true;
if (!def) { stop("We couldn't find that street", 'Head back to the district and pick a street from the list.'); allowed = false; }
else if (!demo && !isSky && !Save.isStreetOpen(book.id, def.id) && !DEBUG) {
  stop(`${def.name} isn't open yet`, `Read ${book.readable ? 'the chapter in the Reading Room' : 'the chapter in your own copy'}, then answer its three questions to open this street.`);
  allowed = false;
} else if (!demo && isSky && !Save.isStreetOpen(book.id, kit.streets[0].id) && !DEBUG) {
  stop('The Sky Run opens with the first street', 'Open the first street of this district, then come back up here.');
  allowed = false;
}

/* =============== the run =============== */
async function play() {
  const title = isSky ? def.name : def.name;
  document.title = `${title} — ${book.title} — ${CONFIG.gameName}`;
  $('crumb').innerHTML = '';
  $('crumb').textContent = `${CONFIG.gameName.toLowerCase()} / ${Catalogue.placeName(book).toLowerCase()} / ${isSky ? 'sky run' : 'street'}`;
  const ch = def.chapters ? (def.chapters.length === 1 ? `${kit.chapterWord || 'Chapter'} ${def.chapters[0]}` : `${kit.chapterWord || 'Chapter'}s ${def.chapters[0]}–${def.chapters[def.chapters.length - 1]}`) : '';
  $('start-tag').textContent = isSky ? 'sky run · optional' : `${book.title}${ch ? ' · ' + ch : ''}`;
  $('start-title').textContent = title;
  $('start-lede').textContent = def.blurb || '';
  $('start-how').innerHTML = `<b>${esc(def.game || def.template)}</b><br>${esc(def.how || def.objective || '')}`;
  $('pause-title').textContent = title;
  document.documentElement.style.setProperty('--qc', (Catalogue.getQuarter(book.quarter) || {}).colour || '#ffd23f');

  if (def.template === 'ARCADE') return playArcade();
  const T = TEMPLATES[def.template];
  if (!T) { stop('This game is still being built', `Template ${def.template} isn't ready.`); return; }
  return play3D(T);
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- shared finish / fail ---------- */
let finished = false;
function rewardAndFinish({ ms = null, text = '' } = {}) {
  if (finished) return;
  finished = true;
  let pay = 0, extra = '';
  if (!demo) {
    if (isSky) {
      const first = !Save.skyRun(book.id);
      const best = Save.recordSkyRun(book.id, ms || 1);
      if (first) { pay = CONFIG.rewards.skyRun; awardBadge('sky-runner'); }
      track('sky-run', { book: book.id, ms });
      if (best && !first) extra = ' New best time!';
    } else {
      const first = Save.playStreet(book.id, def.id);
      if (first) pay = CONFIG.rewards.streetGame;
      track('street-played', { book: book.id, street: def.id });
    }
    if (pay) Save.earn(pay);
  }
  Sfx.badge();
  confetti({ count: 160 });
  $('finish-tag').textContent = isSky ? 'sky run done' : 'street done';
  $('finish-title').textContent = def.winTitle || 'Well done!';
  $('finish-text').textContent = (def.winText || text || 'You did it!') + extra;
  $('finish-pay').textContent = (ms ? `Time: ${fmt(ms)}. ` : '') + (pay ? `+${pay} coins` : (demo ? 'Demo mode — nothing saved.' : 'Coins are paid the first time you finish.'));
  setTimeout(() => { $('finish').hidden = false; }, 600);
}
function fmt(ms) { const t = ms / 1000, m = Math.floor(t / 60), s = (t - m * 60).toFixed(1); return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`; }
$('btn-finish-again').addEventListener('click', () => location.reload());
$('btn-fail-again').addEventListener('click', () => location.reload());
$('btn-restart').addEventListener('click', () => location.reload());
$('btn-mute').addEventListener('click', () => { Save.setMuted(!Save.isMuted()); $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; });

function refreshWallet() { $('hud-wallet').querySelector('b').textContent = Save.DEBUG ? '∞' : Save.wallet(); }
Save.onChange((w) => { if (w === 'wallet') refreshWallet(); });

/* =============== 2D arcade =============== */
function playArcade() {
  $('loading').hidden = true;
  $('start-controls').innerHTML = def.params && def.params.mode ? arcadeHelp(def.params.mode) : '';
  $('start-screen').hidden = false;
  fadeIn();
  $('btn-start').addEventListener('click', () => {
    Sfx.unlock();
    $('start-screen').hidden = true;
    $('hud').hidden = false;
    refreshWallet();
    $('arcade').hidden = false;
    $('btn-pause').hidden = false;
    $('btn-pause').onclick = () => { if (window.__pauseForHelp) window.__pauseForHelp(); $('pause').hidden = false; };
    runArcade($('arcade-canvas'), {
      params: def.params || {}, P, theme, def,
      hud: { progress: (t) => { $('hud-progress').textContent = t; }, lives: (n) => { const el = $('hud-lives'); el.hidden = n == null; el.textContent = n == null ? '' : '❤️'.repeat(Math.max(0, n)); } },
      help: helpButton,
      onWin: (o) => { $('arcade').hidden = true; $('btn-pause').hidden = true; $('help-btn').hidden = true; rewardAndFinish(o); },
      onFail: (msg) => { $('arcade').hidden = true; $('btn-pause').hidden = true; $('help-btn').hidden = true; $('fail-text').textContent = msg || 'Have another go!'; $('fail').hidden = false; },
      onPause: () => { $('pause').hidden = false; }
    });
  });
  $('btn-resume').addEventListener('click', () => { $('pause').hidden = true; window.__arcadeResume && window.__arcadeResume(); });
}
function arcadeHelp(mode) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const h = {
    rhythm: touch ? 'Tap the lane buttons as each note reaches the line.' : 'Press A / S / D (or ← ↓ →) as each note reaches the line.',
    paddle: touch ? 'Hold the left or right side of the screen to steer.' : 'Steer with ← → (or A / D).',
    catch: touch ? 'Drag left and right to move.' : 'Move with ← → (or A / D), or the mouse.',
    golf: 'Drag back from the ball and let go to hit it. Further drag = harder hit.',
    dodge: touch ? 'Drag anywhere to move.' : 'Move with the arrow keys / WASD, or the mouse.',
    typeset: touch ? 'Tap the letters in order.' : 'Type the letters, or click them in order.'
  };
  return h[mode] || '';
}

/* help: coins buy an extra life or a short speed boost — never an answer */
let helpOpts = [];
function helpButton(opts) {
  helpOpts = opts || [];
  $('help-btn').hidden = !helpOpts.length;
}
$('help-btn').addEventListener('click', () => {
  $('help-list').innerHTML = helpOpts.map((o, i) => `<button class="btn ${Save.wallet() >= o.cost ? '' : 'ghost'}" type="button" data-i="${i}">${o.icon} ${esc(o.label)} · 🪙${o.cost}</button>`).join('') + `<p class="fineprint">You have 🪙${Save.DEBUG ? '∞' : Save.wallet()}.</p>`;
  $('help-list').querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const o = helpOpts[Number(b.dataset.i)];
    if (!Save.spend(o.cost)) { toast(`You need 🪙${o.cost}.`); return; }
    o.act(); Sfx.click(); $('help').hidden = true; if (window.__resume) window.__resume();
  }));
  $('help').hidden = false;
  if (window.__pauseForHelp) window.__pauseForHelp();
});
$('btn-help-close').addEventListener('click', () => { $('help').hidden = true; if (window.__resume) window.__resume(); });

/* =============== 3D arena =============== */
function play3D(T) {
  const canvas = $('game-canvas');
  const scene = new THREE.Scene();
  const sky = new THREE.Color(P.sky);
  scene.background = sky;
  scene.fog = new THREE.Fog(new THREE.Color(P.fog), 40, (def.params && def.params.fogFar) || 150);
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.1, 400);
  const dark = def.params && def.params.dark;
  scene.add(new THREE.HemisphereLight(dark ? 0x8a9ad0 : 0xeaf4ff, 0x5a6a4a, dark ? 0.85 : 1.2));
  const sun = new THREE.DirectionalLight(dark ? 0xc8d4ff : 0xfff3dc, dark ? 1.1 : 2.0);
  sun.castShadow = true; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const gfx = createGfx({ canvas, scene, camera, sun, exposure: dark ? 1.15 : 1.0 });
  const world = new World();
  const B = new Batcher();
  const input = new Input(canvas);
  const player = new Player(scene, world, (def.params && def.params.move) || {});
  player.setUnlocks(Save.unlocks());
  input.setMoves(Save.unlocks());
  const cam = new FollowCamera(camera, world, (def.params && def.params.camera) || {});
  cam.player = player;
  const juice = attachJuice({ scene, player, cam, camera, renderer: gfx.renderer });
  const moveHud = new MoveHud(player);
  moveHud.show(false);
  player.onJump = () => Sfx.jump();

  // mirror-reversed controls (Looking-Glass), or reversed forward/back
  const inv = def.params && def.params.invert;
  if (inv) {
    const get = input.getMove.bind(input);
    input.getMove = () => { const m = get(); return { x: inv.includes('x') ? -m.x : m.x, y: inv.includes('z') ? -m.y : m.y, mag: m.mag }; };
  }

  const interactables = [];
  const updates = [];
  let state = 'start';
  let lives = null, startT = 0, timeLeft = null, checkpoint = { x: 0, y: 0, z: 0, facing: Math.PI };
  const A = {
    scene, camera, world, B, player, cam, input, juice, gfx, P, theme, def, book, kit, demo: !!demo,
    params: Object.assign({}, def.params || {}),
    rng: rng(seedOf((book && book.id) + ':' + def.id)),
    interactables,
    killY: -6,
    onUpdate(fn) { updates.push(fn); },
    setObjective(text, sub = '') {
      $('objective').hidden = false;
      $('ob-name').textContent = def.name;
      $('ob-text').textContent = text;
      $('ob-sub').textContent = sub;
    },
    setSub(sub) { $('ob-sub').textContent = sub; },
    setProgress(t) { $('hud-progress').textContent = t; $('hud-progress').hidden = !t; },
    setLives(n) { lives = n; renderLives(); },
    get lives() { return lives; },
    checkpoint(x, y, z, facing = player.facing) { checkpoint = { x, y, z, facing }; },
    respawn() {
      player.teleport(checkpoint.x, checkpoint.y + 0.05, checkpoint.z, checkpoint.facing);
      player.vel.set(0, 0, 0);
      cam.snapBehind(checkpoint.facing);
    },
    // a mistake: lose a life (if this game has lives), then back to the checkpoint
    loseLife(msg) {
      if (state !== 'playing') return;
      Sfx.beep(false);
      cam.shake(0.4);
      if (lives != null) {
        lives--; renderLives();
        if (lives <= 0) { A.fail(msg || 'Out of lives — have another go!'); return; }
      }
      toast(msg || 'Oops! Back to the checkpoint.');
      A.respawn();
    },
    setTimer(seconds) { timeLeft = seconds; $('hud-timer').hidden = false; },
    elapsed() { return performance.now() - startT; },
    say(who, text, after = null, extraHTML = '') {
      $('say-who').textContent = who;
      $('say-text').textContent = text;
      $('say-extra').innerHTML = extraHTML;
      const prev = state;
      setState('panel');
      $('say').hidden = false;
      $('btn-say-close').onclick = () => { $('say').hidden = true; if (state === 'panel') setState(prev === 'panel' ? 'playing' : prev); if (after) after(); };
      return $('say-extra');
    },
    panel(html) {   // custom sheet (PUZZLE / BUILD answers); returns the extra box
      setState('panel');
      return html;
    },
    closePanel() { $('say').hidden = true; if (state === 'panel') setState('playing'); },
    win(text) {
      if (state === 'won') return;
      setState('won');
      rewardAndFinish({ ms: A.elapsed(), text });
    },
    fail(text) {
      if (state === 'failed' || state === 'won') return;
      setState('failed');
      $('fail-text').textContent = text || 'Have another go!';
      setTimeout(() => { $('fail').hidden = false; }, 400);
    },
    // ground: w×d area. floor = 'grass' | 'floor' | 'snow' | 'sand' | 'stone' | 'water' | 'none'
    ground(w, d, floor = 'grass', { cx = 0, cz = 0, walls = true, wallH = 8 } = {}) {
      const F = {
        grass: [P.ground, P.ground2], floor: ['#a0764e', '#8a6440'], snow: ['#f4f7fb', '#dfe7f0'],
        sand: ['#e8d3a0', '#d8c08a'], stone: ['#b9b2a5', '#a49d90'], water: [P.water, '#5ab8e6']
      }[floor] || [P.ground, P.ground2];
      if (floor !== 'none') {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 120, d + 120), new THREE.MeshLambertMaterial({ map: groundTexture(F[0], F[1], (w + 120) / 6) }));
        m.rotation.x = -Math.PI / 2; m.position.set(cx, floor === 'water' ? -0.6 : 0, cz); m.receiveShadow = true;
        scene.add(m);
        A.groundMesh = m;
      }
      if (floor !== 'water' && floor !== 'none') world.add(cx - w / 2 - 60, cx + w / 2 + 60, -1, 0, cz - d / 2 - 60, cz + d / 2 + 60);
      if (walls) {
        world.add(cx - w / 2 - 1, cx - w / 2, -2, wallH, cz - d / 2 - 1, cz + d / 2 + 1, false);
        world.add(cx + w / 2, cx + w / 2 + 1, -2, wallH, cz - d / 2 - 1, cz + d / 2 + 1, false);
        world.add(cx - w / 2 - 1, cx + w / 2 + 1, -2, wallH, cz - d / 2 - 1, cz - d / 2, false);
        world.add(cx - w / 2 - 1, cx + w / 2 + 1, -2, wallH, cz + d / 2, cz + d / 2 + 1, false);
      }
    },
    decorate(opts) { decorate(B, world, Object.assign({ P, props: theme.props, seed: seedOf(def.id || 'x') }, opts)); },
    interact(o) { interactables.push(o); return o; },
    help(opts) { helpButton(opts); },
    hex
  };
  function renderLives() {
    const el = $('hud-lives');
    el.hidden = lives == null;
    if (lives != null) el.textContent = '❤️'.repeat(Math.max(0, lives));
  }

  // let the template build its world
  const run = T.build(A);
  B.build(scene);
  // default help: an extra life (if lives) and a speed boost
  const help = [];
  if (lives != null || run.usesLives) help.push({ icon: '❤️', label: 'An extra life', cost: CONFIG.costs.extraLife, act: () => { lives = (lives || 0) + 1; renderLives(); toast('+1 life'); } });
  help.push({ icon: '👟', label: 'A short speed boost', cost: CONFIG.costs.speedBoost, act: () => { player.addBoost('speed', 12); toast('👟 Speedy for 12 seconds!'); } });
  helpButton(help);

  // start position
  const st = run.start || { x: 0, y: 0, z: 0, facing: Math.PI };
  A.checkpoint(st.x, st.y, st.z, st.facing);
  player.teleport(st.x, st.y + 0.05, st.z, st.facing);
  cam.snapBehind(st.facing);

  /* ---------- state + menus ---------- */
  function setState(s) {
    state = s;
    input.setPlaying(s === 'playing');
    input.consumePause();
    if (s !== 'playing') { setPrompt(input, null); current = null; }
    const inGame = s === 'playing' || s === 'panel' || s === 'paused';
    $('hud').hidden = !inGame;
    $('btn-pause').hidden = s !== 'playing';
    $('help-btn').hidden = s !== 'playing' || !helpOpts.length;
    moveHud.show(inGame);
  }
  A.setState = setState;
  A.state = () => state;
  window.__pauseForHelp = () => setState('panel');
  window.__resume = () => setState('playing');
  function renderControls() { document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = controlsHelpHTML(input.touchMode, Save.unlocks()); }); }
  input.onTouchModeChange = renderControls;
  renderControls();
  $('btn-start').addEventListener('click', () => {
    Sfx.unlock();
    $('start-screen').hidden = true;
    startT = performance.now();
    setState('playing');
    if (run.onStart) run.onStart();
  });
  $('btn-pause').addEventListener('click', () => { setState('paused'); $('pause').hidden = false; $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; });
  $('btn-resume').addEventListener('click', () => { $('pause').hidden = true; setState('playing'); });

  let current = null;
  function nearest() {
    let best = null, bd = Infinity;
    for (const o of interactables) {
      if (o.enabled === false) continue;
      if (Math.abs(player.pos.y - (o.y || 0)) > (o.dy || 2.5)) continue;
      const d = Math.hypot(player.pos.x - o.x, player.pos.z - o.z);
      if (d < (o.r || 1.8) && d < bd) { best = o; bd = d; }
    }
    return best;
  }

  /* ---------- loop ---------- */
  const SUN_DIR = new THREE.Vector3(0.5, 1, 0.35).normalize();
  const clock = new THREE.Clock();
  refreshWallet();
  function tick() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (state === 'playing') {
      if (input.consumePause()) { setState('paused'); $('pause').hidden = false; }
      player.update(dt, input, cam.yaw);
      const n = nearest();
      const lab = n ? (typeof n.label === 'function' ? n.label() : n.label) : null;
      if (n !== current) { current = n; setPrompt(input, lab); } else if (n) setPrompt(input, lab);
      if (input.consumeInteract() && current) current.act();
      if (player.pos.y < A.killY) { if (run.onFall) run.onFall(); else A.loseLife('Whoops — back to the checkpoint.'); }
      if (timeLeft != null) {
        timeLeft -= dt;
        $('hud-timer').textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft));
        if (timeLeft <= 0) { timeLeft = null; if (run.onTimeUp) run.onTimeUp(); else A.fail("Time's up — have another go!"); }
      }
      for (const f of updates) f(dt, t);
      if (run.update) run.update(dt, t);
      cam.update(dt, player.pos, input);
    } else {
      if (state === 'paused' && input.consumePause()) { $('pause').hidden = true; setState('playing'); }
      if (state === 'start') player.update(dt, input, cam.yaw);
      else player._sync(dt);
      if (run.idle) run.idle(dt, t);
      cam.update(dt, player.pos, null);
    }
    followShadow(sun, player.pos, SUN_DIR, gfx.tierCfg.shadowRange || 0, 60);
    juice.update(dt);
    moveHud.update(dt);
    gfx.monitor(dt, state === 'playing');
    gfx.render();
    requestAnimationFrame(tick);
  }
  $('loading').hidden = true;
  $('start-screen').hidden = false;
  setState('start');
  fadeIn();
  addEventListener('pageshow', (e) => { if (e.persisted) fadeIn(); });
  window.__street = { A, run, player, setState, get state() { return state; } };
  tick();
}

// start (last, so every module-level helper above is initialised)
if (allowed) await play();
