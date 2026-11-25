// The Chapter Café (Library Square). Walk in, chat to the barista, get
// Matcha Orange (one free drink a day, or 10 coins), see the guest artist's
// drawing on the wall, or curl up in the window seat and go read.
// Built on the same room/player/camera stack as the Vault.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { World, Batcher, canvasTexture } from '../js/world.js';
import { Player } from '../js/player.js';
import { FollowCamera } from '../js/camera.js';
import { Input } from '../js/input.js';
import { Save } from '../js/save.js';
import { Sfx } from '../js/audio.js';
import { toast, setPrompt, fadeOut, fadeIn, controlsHelpHTML, badgeInfo, confetti } from '../js/hud.js';
import { createGfx } from '../js/gfx.js';
import { attachJuice } from '../js/fx.js';
import { buildNPC } from '../js/critters.js';
import { emojiSprite } from '../kit/props.js';
import { guardLinks } from '../js/grownups.js';
import { track } from '../js/track.js';
import { LightsOut } from '../js/lightsout.js';
import { Matcha, matchaCup } from '../js/matcha.js';

const $ = (id) => document.getElementById(id);
const BACK = '../?spawn=cafe';
const D = CONFIG.cafe.drink, ART = CONFIG.guestArt.matcha;
guardLinks();
if (LightsOut.isOn()) { location.replace('../?spawn=cafe'); }

/* =============== scene =============== */
const canvas = $('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1d16);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 60);
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6a4a34, 1.1));
const sun = new THREE.DirectionalLight(0xffe2b8, 1.3); sun.position.set(-4, 7, 3); scene.add(sun);
const warm = new THREE.PointLight(0xffc27a, 7, 16, 1.5); warm.position.set(0, 3.3, -1); warm.castShadow = true; scene.add(warm);
const gfx = createGfx({ canvas, scene, camera, extraShadowLights: [warm], exposure: 1.15, post: false });

/* =============== room =============== */
const world = new World();
const B = new Batcher();
const HX = 6.5, HZ = 5, WH = 3.8, DHW = 1.0;
const WALL = 0xf1d9b5, TRIM = 0x8a5a3a, WOOD = 0xa8743f, DARK = 0x5a3a24, TEAL = 0x4fb8a2, GREEN = 0x2f6b35;
world.add(-20, 20, -1, 0, -20, 20);
world.add(-HX - 1, HX + 1, 0, WH, -HZ - 1, -HZ);
world.add(-HX - 1, -HX, 0, WH, -HZ - 1, HZ + 3);
world.add(HX, HX + 1, 0, WH, -HZ - 1, HZ + 3);
world.add(-HX - 1, -DHW, 0, WH, HZ, HZ + 1);
world.add(DHW, HX + 1, 0, WH, HZ, HZ + 1);
world.add(-3, 3, 0, WH, HZ + 2.4, HZ + 3);
{
  const floorTex = canvasTexture(256, 256, (x) => {
    // checkerboard café tiles
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#e9dcc4' : '#6a4f3b'; x.fillRect(i * 32, j * 32, 32, 32); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2 + 3), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 1.5; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2 + 3), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, WH, 1.5); scene.add(ceil);
  // walls with a wood dado rail and wainscot
  B.box(-HX, HX, 0, WH, -HZ - 0.25, -HZ, WALL);
  B.box(-HX - 0.25, -HX, 0, WH, -HZ, HZ, WALL);
  B.box(HX, HX + 0.25, 0, WH, -HZ, HZ, WALL);
  B.box(-HX, -DHW, 0, WH, HZ, HZ + 0.25, WALL);
  B.box(DHW, HX, 0, WH, HZ, HZ + 0.25, WALL);
  B.box(-DHW, DHW, 2.6, WH, HZ, HZ + 0.25, WALL);
  for (const [x0, x1, z0, z1] of [[-HX, HX, -HZ, -HZ + 0.05], [-HX, -HX + 0.05, -HZ, HZ], [HX - 0.05, HX, -HZ, HZ], [-HX, -DHW, HZ - 0.05, HZ], [DHW, HX, HZ - 0.05, HZ]]) {
    B.box(x0, x1, 0, 1.0, z0, z1, 0xc9a27a, { cast: false });
    B.box(x0, x1, 1.0, 1.08, z0 - 0.02, z1 + 0.02, TRIM, { cast: false });
  }
  // door frame and the street beyond
  B.box(-DHW - 0.2, -DHW, 0, 2.6, HZ, HZ + 2.4, TRIM); B.box(DHW, DHW + 0.2, 0, 2.6, HZ, HZ + 2.4, TRIM);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
  outside.position.set(0, 1.3, HZ + 2.35); outside.rotation.y = Math.PI; scene.add(outside);
  // ceiling beams + hanging lamps
  for (let z = -3.5; z <= 3.5; z += 3.5) B.box(-HX, HX, WH - 0.3, WH, z - 0.15, z + 0.15, DARK);
  for (const [x, z] of [[-3, 0], [3, 0], [0, -3]]) {
    B.box(x - 0.02, x + 0.02, WH - 0.9, WH - 0.3, z - 0.02, z + 0.02, 0x333333, { cast: false });
    B.box(x - 0.3, x + 0.3, WH - 1.1, WH - 0.9, z - 0.3, z + 0.3, 0xffe2a0, { bucket: 'glow', shade: false });
  }
}

/* ---- the counter (north wall) with the barista behind it ---- */
const CZ = -HZ + 1.6;
B.box(-3.2, 3.2, 0, 1.1, CZ - 0.4, CZ + 0.4, WOOD);
B.box(-3.3, 3.3, 1.1, 1.18, CZ - 0.5, CZ + 0.5, 0xe9e0cf);
B.box(-3.2, 3.2, 0, 0.12, CZ + 0.38, CZ + 0.42, DARK, { cast: false });
world.add(-3.3, 3.3, 0, 1.18, CZ - 0.5, CZ + 0.5);
// shelves of cups behind the barista
for (const y of [1.35, 1.85]) {
  B.box(-3, 3, y, y + 0.06, -HZ + 0.05, -HZ + 0.4, DARK, { cast: false });
  for (let i = -2.6; i <= 2.6; i += 0.5) B.box(i - 0.12, i + 0.12, y + 0.06, y + 0.34, -HZ + 0.15, -HZ + 0.35, [TEAL, 0xf2b01e, 0xe9a27f, GREEN][Math.round(i * 2 + 6) % 4], { cast: false });
}
const barista = buildNPC({ kind: 'person', look: { skin: 0xd9a06b, hair: 0x5a2e1a, shirt: GREEN, pants: 0x2f2f3a, shoes: 0x2a2420 } });
barista.position.set(0, 0, -HZ + 0.9); scene.add(barista);
// apron
B.box(-0.28, 0.28, 0.75, 1.35, -HZ + 1.13, -HZ + 1.16, 0xf3ead6, { cast: false });
// a Matcha Orange on the counter (the 3D model of the drawing)
const counterCup = matchaCup(0.42); counterCup.position.set(1.4, 1.18, CZ); scene.add(counterCup);
const counterCup2 = matchaCup(0.42); counterCup2.position.set(-1.5, 1.18, CZ + 0.1); counterCup2.rotation.y = 2; scene.add(counterCup2);

/* ---- chalk menu board above the counter ---- */
{
  const tex = canvasTexture(512, 256, (x) => {
    x.fillStyle = '#25302a'; x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#8a5a3a'; x.lineWidth = 14; x.strokeRect(0, 0, 512, 256);
    x.fillStyle = '#f4f1e6'; x.textAlign = 'center';
    x.font = 'bold 40px "Comic Sans MS", "Chalkboard SE", cursive'; x.fillText('MENU', 256, 58);
    x.font = 'bold 34px "Comic Sans MS", "Chalkboard SE", cursive'; x.fillStyle = '#a6e86b'; x.fillText(`${D.name} · ${D.price} coins`, 256, 130);
    x.font = '24px "Comic Sans MS", "Chalkboard SE", cursive'; x.fillStyle = '#f4f1e6'; x.fillText('First one every day is FREE!', 256, 190);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: tex }));
  board.position.set(0, 3.0, -HZ + 0.06); scene.add(board);
}

/* ---- guest art wall (west): the drawing in a wooden frame + plaque ---- */
const ARTZ = -0.6, ARTX = -HX + 0.06;
{
  B.box(-HX, -HX + 0.12, 1.25, 3.25, ARTZ - 0.85, ARTZ + 0.85, TRIM);
  const plaqueTex = canvasTexture(256, 64, (x) => {
    x.fillStyle = '#c9a24a'; x.fillRect(0, 0, 256, 64);
    x.fillStyle = '#2a2018'; x.font = 'bold 18px monospace'; x.textAlign = 'center';
    x.fillText('Matcha Orange', 128, 26); x.font = '15px monospace'; x.fillText(ART.credit.replace(/^Guest artist: /, 'designed by '), 128, 48);
  });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: plaqueTex }));
  plaque.position.set(ARTX + 0.08, 1.0, ARTZ); plaque.rotation.y = Math.PI / 2; scene.add(plaque);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.8), new THREE.MeshBasicMaterial({ color: 0xfffdf6 }));
  pic.position.set(ARTX + 0.13, 2.25, ARTZ); pic.rotation.y = Math.PI / 2; scene.add(pic);
  new THREE.TextureLoader().load('../' + ART.file, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    const a = t.image.width / t.image.height;
    pic.material.map = t; pic.material.needsUpdate = true;
    pic.scale.set(Math.min(1, a * 1.8 / 1.5), Math.min(1, 1.5 / (a * 1.8)), 1);
  }, undefined, () => {
    // drawing not uploaded yet: a hand-drawn placeholder note
    pic.material.map = canvasTexture(256, 300, (x) => {
      x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 256, 300);
      x.fillStyle = '#8a7a66'; x.font = '22px "Comic Sans MS", cursive'; x.textAlign = 'center';
      x.fillText('Drawing', 128, 140); x.fillText('coming soon!', 128, 172);
    });
    pic.material.needsUpdate = true;
  });
}

/* ---- tables and chairs ---- */
const tables = [[-3.2, 2.2], [0.4, 2.6], [3.6, 1.6]];
for (const [x, z] of tables) {
  B.geom(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 18), 0xe9e0cf, { x, y: 0.78, z });
  B.geom(new THREE.CylinderGeometry(0.06, 0.06, 0.78, 8), DARK, { x, y: 0.39, z });
  B.geom(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), DARK, { x, y: 0.02, z });
  world.add(x - 0.5, x + 0.5, 0, 0.81, z - 0.5, z + 0.5);
  for (const a of [0.4, 0.4 + Math.PI]) {
    const cx = x + Math.cos(a) * 0.95, cz = z + Math.sin(a) * 0.95;
    B.box(cx - 0.22, cx + 0.22, 0.44, 0.5, cz - 0.22, cz + 0.22, WOOD);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(cx + sx * 0.18 - 0.03, cx + sx * 0.18 + 0.03, 0, 0.44, cz + sz * 0.18 - 0.03, cz + sz * 0.18 + 0.03, DARK, { cast: false });
    world.add(cx - 0.22, cx + 0.22, 0, 0.5, cz - 0.22, cz + 0.22);
  }
  const mug = matchaCup(0.22); mug.position.set(x + 0.15, 0.81, z - 0.1); scene.add(mug);
}

/* ---- reading nook: window seat on the east wall ---- */
const NZ = -1.2;
{
  B.box(HX - 1.0, HX, 0, 0.55, NZ - 1.3, NZ + 1.3, WOOD);
  B.box(HX - 0.95, HX - 0.05, 0.55, 0.7, NZ - 1.25, NZ + 1.25, 0xc0563a);
  for (const dz of [-0.8, 0.1, 0.8]) B.box(HX - 0.4, HX - 0.1, 0.7, 1.15, NZ + dz - 0.3, NZ + dz + 0.3, [TEAL, 0xf2b01e, 0xe9a27f][Math.round(dz * 2 + 2) % 3]);
  world.add(HX - 1.0, HX, 0, 0.7, NZ - 1.3, NZ + 1.3);
  // window
  B.box(HX - 0.08, HX, 1.2, 3.0, NZ - 1.2, NZ + 1.2, TRIM);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.55), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
  win.position.set(HX - 0.1, 2.1, NZ); win.rotation.y = -Math.PI / 2; scene.add(win);
  B.box(HX - 0.12, HX - 0.09, 1.3, 2.9, NZ - 0.03, NZ + 0.03, TRIM, { cast: false });
  // a little bookshelf next to it
  B.box(HX - 0.45, HX, 0, 2.0, NZ + 1.5, NZ + 2.5, DARK);
  for (const y of [0.5, 1.0, 1.5]) for (let k = 0; k < 6; k++) B.box(HX - 0.4, HX - 0.1, y, y + 0.38, NZ + 1.58 + k * 0.15, NZ + 1.7 + k * 0.15, [0x2f5d8a, 0xc0563a, 0x3f8a5a, 0xe0a83a, 0x7a4a9a, 0x2a7a8a][(k + y * 2) % 6 | 0], { cast: false });
  world.add(HX - 0.45, HX, 0, 2.0, NZ + 1.5, NZ + 2.5);
  const sp = emojiSprite('📖', 0.7); sp.position.set(HX - 0.6, 1.7, NZ); scene.add(sp);
}
// plants by the door
for (const x of [-2.2, 2.2]) {
  B.geom(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), 0xc0563a, { x, y: 0.25, z: HZ - 0.5 });
  B.geom(new THREE.IcosahedronGeometry(0.45, 0), 0x5fa046, { x, y: 0.85, z: HZ - 0.5 });
  world.add(x - 0.3, x + 0.3, 0, 0.5, HZ - 0.8, HZ - 0.2);
}
B.build(scene);

/* =============== player / camera / input =============== */
const input = new Input(canvas);
const player = new Player(scene, world);
player.setUnlocks(Save.unlocks());
input.setMoves(Save.unlocks());
const cam = new FollowCamera(camera, world, { distance: 4.2, minDistance: 1.6, maxDistance: 5.5, pitch: 0.42, maxPitch: 1.0, speedPullBack: 0.4 });
cam.player = player;
const juice = attachJuice({ scene, player, cam, camera, renderer: gfx.renderer });
player.teleport(0, 0, HZ - 2.6, Math.PI);
cam.snapBehind(Math.PI);
player.onJump = () => Sfx.jump();

/* =============== interactions =============== */
const interactables = [
  { id: 'counter', x: 0, z: CZ + 1.3, r: 1.7, label: () => (Matcha.freeReady() ? 'Get your free Matcha Orange' : 'Order a Matcha Orange') },
  { id: 'menu', x: -2.4, z: CZ + 1.2, r: 1.1, label: () => 'Read the menu' },
  { id: 'art', x: ARTX + 1.4, z: ARTZ, r: 1.6, label: () => 'Look at the drawing' },
  { id: 'nook', x: HX - 1.7, z: NZ, r: 1.6, label: () => 'Sit in the reading nook' },
  { id: 'door', x: 0, z: HZ - 0.4, r: 1.2, label: () => 'Back to town' }
];
let state = 'start';
function setState(s) {
  state = s;
  input.setPlaying(s === 'playing');
  input.consumePause();
  if (s !== 'playing') { setPrompt(input, null); current = null; }
  $('hud').hidden = s === 'start';
  $('btn-pause').hidden = s !== 'playing';
}
function wallet() { $('hud-wallet').textContent = Save.wallet(); }
wallet();
Save.onChange((w) => { if (w === 'wallet') wallet(); });
function award(id) {
  if (!Save.awardBadge(id)) return;
  const b = badgeInfo(id);
  if (b) { toast(`${b.icon} Badge earned: <b>${b.name}</b>`, { badge: true, ms: 3600 }); Sfx.badge(); confetti({ count: 80 }); }
}
// sip: the cup pops up over the player's head, a squash and a burst of green sparkles
function sip() {
  const cup = matchaCup(0.35); scene.add(cup);
  const t0 = performance.now();
  const step = () => {
    const k = (performance.now() - t0) / 900;
    cup.position.set(player.pos.x, player.pos.y + 1.9 + Math.sin(Math.min(1, k) * Math.PI) * 0.4, player.pos.z);
    cup.rotation.z = Math.sin(k * 12) * 0.2;
    if (k < 1) requestAnimationFrame(step); else scene.remove(cup);
  };
  step();
  player.stretchTimer = 0.3;
  juice.sparkle(player.pos.x, player.pos.y + 1.6, player.pos.z, 24, 0x7fdc6a, { speed: 3.5, life: 0.7 });
  Sfx.boost();
}
function counter() {
  const free = Matcha.freeReady();
  $('counter-text').innerHTML = free
    ? 'Your free <b>Matcha Orange</b> is ready! 🥤'
    : `<b>${D.name}</b>: ${D.price} coins. Focus Fizz: free stamina for ${D.secs} seconds!`;
  const box = $('counter-actions');
  box.innerHTML = free
    ? '<div class="btn-row"><button class="btn gold" type="button" data-a="free">Take it!</button><button class="btn ghost" type="button" data-a="no">Not now</button></div>'
    : `<div class="btn-row"><button class="btn" type="button" data-a="buy" ${Save.wallet() < D.price ? 'disabled' : ''}>Buy · 🪙 ${D.price}</button><button class="btn ghost" type="button" data-a="no">Not now</button></div>`
      + (Save.wallet() < D.price ? `<p class="fineprint" style="margin-top:8px">You need ${D.price - Save.wallet()} more coins. Come back tomorrow for a free one!</p>` : '');
  box.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
    const a = b.dataset.a;
    $('counter').hidden = true; setState('playing');
    if (a === 'free' && Matcha.claimFree()) { track('matcha-free-claimed'); served(); }
    else if (a === 'buy') { if (Matcha.buy()) { track('matcha-bought'); served(); } else { Sfx.denied(); toast('Not enough coins yet.'); } }
  });
  $('counter').hidden = false; setState('panel');
}
function served() {
  sip();
  Matcha.drink(null, award);         // counts the day + badges; the fizz starts outside
  toast(`🥤 Glug! The fizz starts when you step outside: ${D.secs}s of free stamina!`, { ms: 3800 });
}
function note(label, html) { $('note-label').textContent = label; $('note-text').innerHTML = html; $('note').hidden = false; setState('panel'); }
$('btn-note-close').onclick = () => { $('note').hidden = true; setState('playing'); };
function showArt() {
  track('guest-art-viewed');
  const box = $('art-box');
  box.innerHTML = '';
  const img = new Image();
  img.className = 'art-big'; img.alt = ART.alt;
  img.onload = () => { box.innerHTML = ''; box.appendChild(img); };
  img.onerror = () => { box.innerHTML = '<div class="art-wait">The drawing is on its way!</div>'; };
  img.src = '../' + ART.file;
  $('art-credit').textContent = `Matcha Orange — ${ART.credit.replace(/^Guest artist: /, 'designed by ')}`;
  $('art').hidden = false; setState('panel');
}
$('btn-art-close').onclick = () => { $('art').hidden = true; setState('playing'); };
async function leave(url) { setState('leaving'); await fadeOut(); location.href = url; }
function interact(o) {
  Sfx.click();
  if (o.id === 'counter') counter();
  else if (o.id === 'menu') note('The menu', `<div class="menu-row"><span class="cup">🥤</span><div><b>${D.name}</b> · 🪙 ${D.price}<br>Focus Fizz: free stamina and a faster sprint for ${D.secs} seconds.</div></div><p class="fineprint">The first one every day is free.</p>`);
  else if (o.id === 'art') showArt();
  else if (o.id === 'nook') leave('../?spawn=reading&open=reading');
  else if (o.id === 'door') leave(BACK);
}
let current = null;
function nearest() {
  let best = null, bd = Infinity;
  for (const o of interactables) { const d = Math.hypot(player.pos.x - o.x, player.pos.z - o.z); if (d < o.r && d < bd) { best = o; bd = d; } }
  return best;
}

document.querySelectorAll('.back-link').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); leave(BACK); }));
function renderControls() { document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = controlsHelpHTML(input.touchMode, Save.unlocks()); }); }
input.onTouchModeChange = renderControls;
renderControls();
$('btn-start').addEventListener('click', () => {
  Sfx.unlock(); $('start-screen').hidden = true; setState('playing');
  track('cafe-entered');
  toast(Matcha.freeReady() ? 'Say hi to the barista for your free drink! ☕' : 'Welcome back to the café! ☕');
});
$('btn-pause').addEventListener('click', () => { $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; setState('paused'); $('pause').hidden = false; });
$('btn-resume').addEventListener('click', () => { $('pause').hidden = true; setState('playing'); });
$('btn-mute').addEventListener('click', () => { Save.setMuted(!Save.isMuted()); $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; });

/* =============== loop =============== */
const clock = new THREE.Clock();
let t = 0;
function tick() {
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  if (state === 'playing') {
    if (input.consumePause()) { setState('paused'); $('pause').hidden = false; }
    player.update(dt, input, cam.yaw);
    const n = nearest();
    if (n !== current) { current = n; setPrompt(input, n ? n.label() : null); }
    if (input.consumeInteract() && current) interact(current);
    if (player.pos.z > HZ + 0.6) leave(BACK);
    cam.update(dt, player.pos, input);
  } else {
    if (state === 'start') player.update(dt, input, cam.yaw);
    cam.update(dt, player.pos, null);
  }
  // barista: gentle idle, turns to face you
  if (barista.userData.anim) barista.userData.anim(t, false);
  barista.rotation.y = Math.atan2(player.pos.x - barista.position.x, player.pos.z - barista.position.z) * 0.6;
  counterCup.rotation.y = t * 0.6;
  juice.update(dt);
  gfx.monitor(dt, state === 'playing');
  gfx.render();
  requestAnimationFrame(tick);
}
$('loading').hidden = true;
$('start-screen').hidden = false;
setState('start');
fadeIn();
addEventListener('pageshow', (e) => { if (e.persisted) fadeIn(); });
window.__cafe = { player, interact: (id) => interact(interactables.find((o) => o.id === id)), Matcha };
tick();
