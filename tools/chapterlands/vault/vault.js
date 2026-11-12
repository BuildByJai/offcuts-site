// The Vault — every district's final escape room, testing the whole book.
// This is a copy of The Study engine (study/study.js: the room shell, lamp
// light, door with lock lights, clue panels, lesson cards and the escape
// timer) made data-driven: the puzzles come from book.json `vault` and the
// book-wide questions from questions.json `vault`. The original is unchanged.
//
// vault/?book=<bookId>
// book.json vault: {
//   name, blurb, intro, room: { wall, floor, rug, dark },
//   stations: [{ id, object, label, text, lock, lesson, solve: { type, prompt, … } }],
//   quiz: { object, label, lock, lesson }   ← the questions.json vault questions
//   outro
// }
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { World, Batcher, canvasTexture } from '../js/world.js';
import { Player } from '../js/player.js';
import { FollowCamera } from '../js/camera.js';
import { Input } from '../js/input.js';
import { Save } from '../js/save.js';
import { Sfx } from '../js/audio.js';
import { toast, setPrompt, fadeOut, fadeIn, controlsHelpHTML, badgeInfo } from '../js/hud.js';
import { createGfx } from '../js/gfx.js';
import { attachJuice } from '../js/fx.js';
import { MoveHud } from '../js/movehud.js';
import { Catalogue } from '../js/catalogue.js';
import { track } from '../js/track.js';
import { openQuiz, districtDone } from '../js/library-ui.js';
import { renderSolve } from '../kit/solve.js';
import { pal, hex, prop, emojiSprite } from '../kit/props.js';
import { guardLinks } from '../js/grownups.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const DEBUG = qs.get('debug') === '1';

await Catalogue.load();
const book = Catalogue.getBook(qs.get('book'));
const kit = book ? await Catalogue.kit(book.id) : null;
const questions = book ? await Catalogue.questions(book.id) : null;
const V = kit && kit.vault;
for (const bd of (kit && kit.unlock && kit.unlock.badges) || []) if (!CONFIG.badges.some((x) => x.id === bd.id)) CONFIG.badges.push(bd);
const backUrl = book ? `../?spawn=plot:${encodeURIComponent(book.id)}&panel=1${DEBUG ? '&debug=1' : ''}` : '../';
document.querySelectorAll('.back-link').forEach((a) => { a.href = backUrl; });
guardLinks();

function locked(title, text) {
  $('loading').hidden = true;
  $('locked-title').textContent = title;
  $('locked-text').textContent = text;
  $('locked').hidden = false;
  fadeIn();
}
let ok = true;
if (!V) { locked('No vault here', 'This district has no Vault yet.'); ok = false; }
else if (!districtDone(book, kit) && !DEBUG) { locked(`${V.name} is locked`, 'Finish every street in this district first (read, answer the questions, play the game).'); ok = false; }
if (ok) start();

function start() {
const P = pal(kit.theme);
const ROOM = V.room || {};
document.title = `${V.name} — ${book.title} — ${CONFIG.gameName}`;
$('crumb').textContent = `${CONFIG.gameName.toLowerCase()} / ${Catalogue.placeName(book).toLowerCase()} / vault`;
$('start-tag').textContent = `${book.title} · the vault`;
$('start-title').textContent = V.name;
$('start-lede').textContent = V.intro || V.blurb || '';
$('pause-title').textContent = V.name;

/* =============== locks (data) =============== */
const LOCKS = (V.stations || []).filter((s) => s.solve).map((s) => ({ kind: 'station', s, name: s.lock || s.label, lesson: s.lesson }));
const QUIZ = V.quiz && questions && questions.vault && questions.vault.length
  ? Object.assign({ object: 'desk', label: 'The reading desk', _quiz: true }, V.quiz) : null;
if (QUIZ) LOCKS.push({ kind: 'quiz', s: QUIZ, name: QUIZ.lock || 'The last lock', lesson: QUIZ.lesson });
const NL = LOCKS.length;

/* =============== renderer / scene (from The Study) =============== */
const canvas = $('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120e0b);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 60);
const ambient = new THREE.AmbientLight(0x8a9bc4, ROOM.dark ? 0.4 : 0.85);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xfff0dc, ROOM.dark ? 0.35 : 0.9);
moon.position.set(-2, 6, 6);
scene.add(moon);
const lampLight = new THREE.PointLight(0xffc77a, ROOM.dark ? 6 : 8, 18, 1.6);
lampLight.position.set(0, 3.4, 0);
lampLight.castShadow = true;
scene.add(lampLight);
const gfx = createGfx({ canvas, scene, camera, extraShadowLights: [lampLight], exposure: 1.2, post: false });

/* =============== room (The Study's shell, resized + recoloured) =============== */
const world = new World();
const B = new Batcher();
const HX = 7, HZ = 6, WH = 4, DOOR_HW = 1.05;
world.add(-20, 20, -1, 0, -20, 20);
world.add(-20, 20, WH, WH + 1, -20, 20);
world.add(-HX - 1, HX + 1, 0, WH, -HZ - 1, -HZ);
world.add(-HX - 1, -HX, 0, WH, -HZ - 1, HZ + 3);
world.add(HX, HX + 1, 0, WH, -HZ - 1, HZ + 3);
world.add(-HX - 1, -DOOR_HW, 0, WH, HZ, HZ + 1);
world.add(DOOR_HW, HX + 1, 0, WH, HZ, HZ + 1);
world.add(-DOOR_HW, DOOR_HW, 2.7, WH, HZ, HZ + 1);
world.add(-DOOR_HW - 1, -DOOR_HW, 0, WH, HZ, HZ + 3);
world.add(DOOR_HW, DOOR_HW + 1, 0, WH, HZ, HZ + 3);
world.add(-3, 3, 0, WH, HZ + 3, HZ + 4);
const doorBlocker = world.add(-DOOR_HW, DOOR_HW, 0, 2.7, HZ - 0.05, HZ + 0.2);
{
  const floorTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = ROOM.floor || '#6b4c34'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, i * 16, 256, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(((i * 97) % 256), i * 16, 2, 16);
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(6, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2 + 6), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 3; floor.receiveShadow = true;
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2 + 6), new THREE.MeshLambertMaterial({ color: 0x3a312a }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, WH, 3); scene.add(ceil);
  const WALL = hex(ROOM.wall || P.wall), SKIRT = hex(P.trim);
  B.box(-HX, HX, 0, WH, -HZ - 0.25, -HZ, WALL);
  B.box(-HX - 0.25, -HX, 0, WH, -HZ, HZ, WALL);
  B.box(HX, HX + 0.25, 0, WH, -HZ, HZ, WALL);
  B.box(-HX, -DOOR_HW, 0, WH, HZ, HZ + 0.25, WALL);
  B.box(DOOR_HW, HX, 0, WH, HZ, HZ + 0.25, WALL);
  B.box(-DOOR_HW, DOOR_HW, 2.7, WH, HZ, HZ + 0.25, WALL);
  B.box(-HX, HX, 0, 0.15, -HZ, -HZ + 0.04, SKIRT);
  B.box(-HX, -HX + 0.04, 0, 0.15, -HZ, HZ, SKIRT);
  B.box(HX - 0.04, HX, 0, 0.15, -HZ, HZ, SKIRT);
  B.box(-DOOR_HW - 0.25, -DOOR_HW, 0, WH, HZ, HZ + 3, 0xbfb59f);
  B.box(DOOR_HW, DOOR_HW + 0.25, 0, WH, HZ, HZ + 3, 0xbfb59f);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
  outside.position.set(0, 1.6, HZ + 2.95); outside.rotation.y = Math.PI; scene.add(outside);
  B.box(-2.4, 2.4, 0, 0.02, -1.4, 2.0, hex(ROOM.rug || P.accent), { cast: false });
  B.box(-2.1, 2.1, 0.02, 0.025, -1.1, 1.7, new THREE.Color(ROOM.rug || P.accent).multiplyScalar(1.15).getHex(), { cast: false });
  // themed props round the edges (no colliders near stations)
  (kit.theme.vaultProps || kit.theme.props || []).slice(0, 4).forEach((n, i) => prop(n, B, null, i % 2 ? HX - 1.2 : -HX + 1.2, i < 2 ? HZ - 1.5 : 1.5, 0.7, P));
}

/* =============== exit door + lock lights (from The Study) =============== */
const doorPivot = new THREE.Group();
doorPivot.position.set(-DOOR_HW + 0.06, 0, HZ + 0.02);
const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HW * 2 - 0.12, 2.68, 0.12), new THREE.MeshLambertMaterial({ color: hex(P.trim) }));
doorMesh.position.set(DOOR_HW - 0.06, 1.34, 0); doorMesh.castShadow = true;
doorPivot.add(doorMesh);
scene.add(doorPivot);
const lockLights = [];
for (let i = 0; i < NL; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.06), new THREE.MeshBasicMaterial({ color: 0xc9463a }));
  m.position.set(-(NL - 1) * 0.15 + i * 0.3, 2.95, HZ - 0.03);
  scene.add(m); lockLights.push(m);
}
const doorLabelTex = canvasTexture(256, 48, (ctx) => {
  ctx.fillStyle = '#2a2420'; ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = '#f5e7c4'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`${NL} LOCKS`, 128, 31);
});
const doorLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), new THREE.MeshBasicMaterial({ map: doorLabelTex }));
doorLabel.position.set(0, 3.28, HZ - 0.03); doorLabel.rotation.y = Math.PI; scene.add(doorLabel);

/* =============== stations round the walls =============== */
const ICON = { desk: '🗄️', shelf: '📚', clock: '🕰️', chair: '🪑', box: '📦', picture: '🖼️', window: '🪟', table: '🍽️', bed: '🛏️', chest: '🧰', plant: '🪴', statue: '🗿', sign: '🪧', mirror: '🪞', book: '📖', map: '🗺️', note: '📝', lamp: '🪔', safe: '🔐', toy: '🧸', board: '♟️', scales: '⚖️', telescope: '🔭', trunk: '🧳' };
const stations = (V.stations || []).slice();
if (QUIZ) stations.push(QUIZ);
const interactables = [];
const spots = [];
{
  const n = stations.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    let x, z, face;
    if (t < 0.25) { x = -HX + 0.9; z = HZ - 2 - (t / 0.25) * (HZ * 2 - 3.5); face = Math.PI / 2; }
    else if (t < 0.75) { x = -HX + 2 + ((t - 0.25) / 0.5) * (HX * 2 - 4); z = -HZ + 0.9; face = 0; }
    else { x = HX - 0.9; z = -HZ + 1.5 + ((t - 0.75) / 0.25) * (HZ * 2 - 3.5); face = -Math.PI / 2; }
    spots.push({ x, z, face });
  }
}
stations.forEach((S, i) => {
  const { x, z, face } = spots[i];
  B.box(x - 0.55, x + 0.55, 0, 0.95, z - 0.55, z + 0.55, hex(S._quiz || S.solve ? P.accent : P.wood));
  B.box(x - 0.6, x + 0.6, 0.95, 1.02, z - 0.6, z + 0.6, hex(P.trim));
  world.add(x - 0.6, x + 0.6, 0, 1.02, z - 0.6, z + 0.6);
  const sp = emojiSprite(ICON[S.object] || '❓', 0.9);
  sp.position.set(x, 1.75, z); scene.add(sp);
  interactables.push({ id: i, S, x: x + Math.sin(face) * 1.35, z: z + Math.cos(face) * 1.35, r: 1.6, label: S.label || S.object });
});
interactables.push({ id: 'door', x: 0, z: HZ - 1.0, r: 1.6, label: 'Examine the vault door' });
B.build(scene);

/* =============== player / camera / input (from The Study) =============== */
const input = new Input(canvas);
const player = new Player(scene, world);
player.setUnlocks(Save.unlocks());
input.setMoves(Save.unlocks());
const cam = new FollowCamera(camera, world, { distance: 4.6, minDistance: 1.8, maxDistance: 6.5, pitch: 0.48, maxPitch: 1.0, speedPullBack: 0.6 });
cam.player = player;
const juice = attachJuice({ scene, player, cam, camera, renderer: gfx.renderer });
const moveHud = new MoveHud(player);
moveHud.show(false);
player.teleport(0, 0, 3.6, Math.PI);
cam.snapBehind(Math.PI);
player.onJump = () => Sfx.jump();

/* =============== game state =============== */
const solved = new Array(NL).fill(false);
let doorOpen = false;
let state = 'start';
let startTime = 0;
function elapsed() { return performance.now() - startTime; }
function fmtTime(ms) {
  const total = Math.max(0, ms) / 1000, m = Math.floor(total / 60), s = (total - m * 60).toFixed(1);
  return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}
function setState(s) {
  state = s;
  input.setPlaying(s === 'playing');
  input.consumePause();
  if (s !== 'playing') { setPrompt(input, null); current = null; }
  $('hud').hidden = s === 'start' || s === 'won';
  moveHud.show(!(s === 'start' || s === 'won'));
  $('btn-pause').hidden = s !== 'playing';
}
function openPanel(id) { setState('panel'); $(id).hidden = false; }
function closePanel(id) { $(id).hidden = true; if (state === 'panel') setState('playing'); }
function renderControls() { document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = controlsHelpHTML(input.touchMode, Save.unlocks()); }); }
input.onTouchModeChange = renderControls;
renderControls();
function updateLocksHud() {
  const n = solved.filter(Boolean).length;
  $('hud-locks').textContent = `${n === NL ? '🔓' : '🔒'} ${n} / ${NL}`;
}

/* ---------- clue panel ---------- */
function clue(label, text, extra = null) {
  $('clue-label').textContent = label;
  $('clue-text').textContent = text || '';
  $('clue-extra').innerHTML = '';
  openPanel('clue');
  return $('clue-extra');
}
$('btn-clue-close').addEventListener('click', () => closePanel('clue'));

/* ---------- lesson card ---------- */
let afterLesson = null;
function showLesson(i, then) {
  const L = LOCKS[i];
  $('lesson-tag').textContent = `lock ${i + 1} of ${NL} · open`;
  $('lesson-law').textContent = L.name;
  $('lesson-text').textContent = L.lesson || 'Click! One more lock open.';
  afterLesson = then || null;
  openPanel('lesson');
}
$('btn-lesson-close').addEventListener('click', () => {
  closePanel('lesson');
  const f = afterLesson; afterLesson = null;
  if (f) f();
});
function solve(i) {
  if (solved[i]) return;
  solved[i] = true;
  lockLights[i].material.color.set(0x3fae5c);
  Sfx.unlockLock();
  updateLocksHud();
  const then = solved.every(Boolean) ? openExit : null;
  setTimeout(() => showLesson(i, then), 50);
}
function openExit() {
  doorOpen = true;
  world.remove(doorBlocker);
  toast(V.openText || 'Every lock clicks open. The vault door swings wide — out you go!');
  Sfx.badge();
}

/* ---------- interactions ---------- */
let current = null;
function nearest() {
  let best = null, bd = Infinity;
  for (const o of interactables) {
    const d = Math.hypot(player.pos.x - o.x, player.pos.z - o.z);
    if (d < o.r && d < bd) { best = o; bd = d; }
  }
  return best;
}
function labelFor(o) {
  if (o.id === 'door') return doorOpen ? 'Leave the vault' : 'Examine the vault door';
  return o.S && (o.S.solve || o.S._quiz) && solved[lockIndex(o.S)] ? `${o.label} (done)` : o.label;
}
function lockIndex(S) { return LOCKS.findIndex((L) => L.s === S); }
function interact(o) {
  Sfx.click();
  if (o.id === 'door') { if (doorOpen) winGame(); else openDoorPanel(); return; }
  const S = o.S;
  const li = lockIndex(S);
  if (S._quiz) {
    if (solved[li]) { clue(S.label, 'You answered every question. The lock is open.'); return; }
    setState('panel');
    openQuiz({ book, kit, street: null, questions: questions.vault, title: S.label || 'the vault',
      onPass: () => { setState('playing'); solve(li); },
      onClose: () => { setState('playing'); } });
    return;
  }
  if (!S.solve || solved[li]) { clue(S.label || S.object, solved[li] && S.doneText ? S.doneText : S.text); return; }
  const box = clue(S.label || S.object, S.text);
  renderSolve(box, S.solve, (okk) => { if (okk) { closePanel('clue'); solve(li); } });
}

/* ---------- door ---------- */
function openDoorPanel() {
  const ul = $('lock-list');
  ul.innerHTML = '';
  LOCKS.forEach((L, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="li-icon"></span><span class="li-main"><div class="li-name"></div><div class="li-sub"></div></span>';
    li.querySelector('.li-icon').textContent = solved[i] ? '🔓' : '🔒';
    li.querySelector('.li-name').textContent = L.name;
    li.querySelector('.li-sub').textContent = solved[i] ? 'Open' : `Solve: ${L.s.label || L.s.object}`;
    ul.appendChild(li);
  });
  openPanel('door-panel');
}
$('btn-door-close').addEventListener('click', () => closePanel('door-panel'));

/* ---------- start / pause / win ---------- */
$('btn-start').addEventListener('click', () => {
  Sfx.unlock();
  $('start-screen').hidden = true;
  startTime = performance.now();
  setState('playing');
  toast(V.startToast || `${NL} locks on the door. Look around the room.`);
});
$('btn-pause').addEventListener('click', () => { $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; setState('paused'); $('pause').hidden = false; });
$('btn-resume').addEventListener('click', () => { $('pause').hidden = true; setState('playing'); });
$('btn-mute').addEventListener('click', () => { Save.setMuted(!Save.isMuted()); $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; });
$('btn-restart').addEventListener('click', () => location.reload());
$('btn-win-retry').addEventListener('click', () => location.reload());

function winGame() {
  if (state === 'won') return;
  const ms = Math.round(elapsed());
  setState('won');
  const first = !Save.hasStamp(book.id);
  Save.recordVault(book.id, ms);
  Save.finishBook(book.id);
  track('vault', { book: book.id, ms });
  let pay = 0;
  if (first) { pay = CONFIG.rewards.vault; Save.earn(pay); }
  const queue = (id) => { if (Save.awardBadge(id)) { const b = badgeInfo(id); if (b) Save.queueToast(`${b.icon} Badge earned: <b>${b.name}</b>`); } };
  queue('vault-cracker');
  for (const bd of (kit.unlock && kit.unlock.badges) || []) if ((bd.requires || [book.id]).every((id) => Save.hasKey(id))) queue(bd.id);
  if (first) {
    Save.queueToast(`🗝️ You earned the <b>${Catalogue.keyName(book)} Key</b> and a library card stamp!`);
    const next = Catalogue.nextInSeries(book.id);
    if (next) Save.queueToast(`🌉 A bridge is being built to <b>${Catalogue.placeName(next)}</b>!`);
  }
  Sfx.badge();
  $('win-title').textContent = V.winTitle || 'You cracked the Vault!';
  $('win-text').textContent = (V.outro || '') + ` Time: ${fmtTime(ms)}.`;
  $('win-pay').textContent = first ? `🗝️ ${Catalogue.keyName(book)} Key · ✅ library card stamp · +${pay} coins` : 'You already hold this Key — nice to see you back!';
  $('recap').innerHTML = LOCKS.map((L) => `<li style="padding:8px 0;border-bottom:1px solid var(--line)"><b style="display:block;color:var(--accent);font-size:13px"></b><span></span></li>`).join('');
  $('recap').querySelectorAll('li').forEach((li, i) => { li.querySelector('b').textContent = LOCKS[i].name; li.querySelector('span').textContent = LOCKS[i].lesson || ''; });
  $('win').hidden = false;
}
$('btn-win-town').addEventListener('click', async (e) => { e.preventDefault(); await fadeOut(); location.href = backUrl; });

/* =============== loop =============== */
const clock = new THREE.Clock();
let doorAngle = 0;
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state === 'playing') {
    if (input.consumePause()) { setState('paused'); $('pause').hidden = false; }
    player.update(dt, input, cam.yaw);
    const n = nearest();
    if (n !== current) { current = n; setPrompt(input, n ? labelFor(n) : null); }
    else if (n) setPrompt(input, labelFor(n));
    if (input.consumeInteract() && current) interact(current);
    if (doorOpen && player.pos.z > HZ + 0.9) winGame();
    cam.update(dt, player.pos, input);
  } else {
    if (state === 'paused' && input.consumePause()) { $('pause').hidden = true; setState('playing'); }
    if (state === 'start') player.update(dt, input, cam.yaw);
    cam.update(dt, player.pos, null);
  }
  if (state === 'playing' || state === 'panel' || state === 'paused') $('hud-timer').textContent = fmtTime(elapsed());
  doorAngle += ((doorOpen ? -1.7 : 0) - doorAngle) * Math.min(1, dt * 3);
  doorPivot.rotation.y = doorAngle;
  juice.update(dt);
  moveHud.update(dt);
  gfx.monitor(dt, state === 'playing');
  gfx.render();
  requestAnimationFrame(tick);
}
updateLocksHud();
$('loading').hidden = true;
$('start-screen').hidden = false;
setState('start');
fadeIn();
addEventListener('pageshow', (e) => { if (e.persisted) fadeIn(); });
window.__vault = { player, solve, solved, LOCKS, interact: (i) => interact(interactables[i]), win: () => { solved.fill(true); openExit(); winGame(); } };
tick();
}
