// Habit Tower — a timed obby climb with checkpoints, special platforms and a
// ghost of your personal best. Runs on Book Town's shared modules.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { World, canvasTexture } from '../js/world.js';
import { Player, buildCharacter } from '../js/player.js';
import { FollowCamera } from '../js/camera.js';
import { Input } from '../js/input.js';
import { Save } from '../js/save.js';
import { Sfx } from '../js/audio.js';
import { toast, awardBadge, fadeOut, fadeIn, controlsHelpHTML } from '../js/hud.js';
import { TOWER, SECTIONS, FOG_BAND, PLATFORMS, COINS, START } from './levels.js';

const $ = (id) => document.getElementById(id);
const TCFG = CONFIG.tower;

// Lesson recap — our own words, same style as The Study.
const LESSONS = [
  'Put the cue for a good habit where you can\'t miss it.',
  'Pair something you need to do with something you want to do.',
  'Shrink a new habit until it takes two minutes to start.',
  'Track it — seeing your streak makes you want to keep it.'
];

/* =============== renderer / scene =============== */
const canvas = $('game-canvas');
const isCoarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isCoarse, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const BG = new THREE.Color(0x9fc4e6), FOGC = new THREE.Color(0x8d98a8);
const scene = new THREE.Scene();
scene.background = BG.clone();
scene.fog = new THREE.Fog(BG.clone(), 40, 160);
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.1, 300);
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a70, 1.35));
const sun = new THREE.DirectionalLight(0xfff3dc, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(isCoarse ? 1024 : 2048, isCoarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

/* =============== tower shell =============== */
const world = new World();
const H = TOWER.half, TOP = TOWER.height;
world.add(-60, 60, -1, 0, -60, 60);
world.add(-H - 2, H + 2, 0, TOP + 4, -H - 2, -H);
world.add(-H - 2, H + 2, 0, TOP + 4, H, H + 2);
world.add(-H - 2, -H, 0, TOP + 4, -H, H);
world.add(H, H + 2, 0, TOP + 4, -H, H);
world.add(-H - 2, H + 2, TOP, TOP + 4, -H - 2, H + 2);

{
  const wallTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#e9e4d8'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ddd6c6';
    for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) {
      ctx.fillRect(c * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14);
    }
    ctx.fillStyle = '#9ccfe8'; ctx.fillRect(96, 64, 64, 112);
    ctx.fillStyle = '#c9c1ae'; ctx.fillRect(92, 172, 72, 8); ctx.fillRect(126, 64, 4, 112);
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(2.5, TOP / 8);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const walls = [
    { p: [0, TOP / 2, -H], ry: 0 }, { p: [0, TOP / 2, H], ry: Math.PI },
    { p: [-H, TOP / 2, 0], ry: Math.PI / 2 }, { p: [H, TOP / 2, 0], ry: -Math.PI / 2 }
  ];
  walls.forEach((w) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, TOP), wallMat);
    m.position.set(...w.p); m.rotation.y = w.ry; m.receiveShadow = true;
    scene.add(m);
  });
  // coloured band at each section's start height so you can read progress
  const firstCp = [0, 1, 2, 3].map((s) => PLATFORMS.find((p) => p.section === s && p.type === 'checkpoint'));
  firstCp.forEach((cp, s) => {
    const y = Math.max(0.6, cp.top - 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: SECTIONS[s].color });
    for (const w of walls) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, 0.5), mat);
      m.position.set(w.p[0] * 0.995, y, w.p[2] * 0.995); m.rotation.y = w.ry;
      scene.add(m);
    }
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), new THREE.MeshLambertMaterial({ color: 0x8a7a66 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = TOP; scene.add(ceil);
  // entrance door (decorative — leave via the menu)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), new THREE.MeshLambertMaterial({ color: 0x5a3a24 }));
  door.position.set(0, 1.3, H - 0.02); door.rotation.y = Math.PI; scene.add(door);
}

// interior ad slot(s)
for (const slot of CONFIG.adSlots.filter((s) => s.scene === 'tower')) {
  const tex = new THREE.TextureLoader().load('../' + slot.image);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(slot.size[0], slot.size[1]), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  m.position.set(...slot.position); m.rotation.y = slot.rotationY || 0;
  scene.add(m);
}

/* =============== platform look =============== */
function tex(draw, w = 128, h = 128) { return canvasTexture(w, h, draw); }
const crackTex = tex((ctx) => {
  ctx.fillStyle = '#f2c94c'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, 128, 18);
  ctx.strokeStyle = '#3b2a05'; ctx.lineWidth = 3;
  [[10, 20, 50, 60, 40, 100], [70, 8, 80, 50, 118, 70], [60, 70, 90, 118, 30, 124]].forEach(([a, b, c, d, e, f]) => {
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.stroke();
  });
});
const arrowTex = tex((ctx) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#23303d';
  ctx.beginPath(); ctx.moveTo(8, 64); ctx.lineTo(40, 34); ctx.lineTo(40, 94); ctx.fill();
  ctx.beginPath(); ctx.moveTo(120, 64); ctx.lineTo(88, 34); ctx.lineTo(88, 94); ctx.fill();
  ctx.fillRect(38, 56, 52, 16);
});
const upDownTex = tex((ctx) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#23303d';
  ctx.beginPath(); ctx.moveTo(64, 8); ctx.lineTo(34, 40); ctx.lineTo(94, 40); ctx.fill();
  ctx.beginPath(); ctx.moveTo(64, 120); ctx.lineTo(34, 88); ctx.lineTo(94, 88); ctx.fill();
  ctx.fillRect(56, 38, 16, 52);
});
const chevronTex = tex((ctx) => {
  ctx.fillStyle = '#23303d'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 12; ctx.lineJoin = 'round';
  [24, 60, 96].forEach((y) => { ctx.beginPath(); ctx.moveTo(20, y + 20); ctx.lineTo(64, y - 10); ctx.lineTo(108, y + 20); ctx.stroke(); });
});
const stripeTex = tex((ctx) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#d8452f';
  for (let i = -128; i < 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 144, 128); ctx.lineTo(i + 128, 128); ctx.fill(); }
});

const BOX = new THREE.BoxGeometry(1, 1, 1);
const glowGeo = new THREE.OctahedronGeometry(0.28, 0);
const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16).rotateX(Math.PI / 2);

function sideMat(color) { return new THREE.MeshLambertMaterial({ color }); }
function makeMesh(p) {
  const col = SECTIONS[p.section].color;
  const darker = new THREE.Color(col).multiplyScalar(0.7).getHex();
  let top, side = sideMat(darker);
  switch (p.type) {
    case 'marker': top = sideMat(0x2a3444); side = sideMat(0x1f2733); break;
    case 'moving': {
      const t = (p.move.axis === 'y' ? upDownTex : arrowTex).clone();
      t.needsUpdate = true; t.center.set(0.5, 0.5);
      const dir = p.move.axis === 'tan' ? Math.atan2(Math.cos(p.angle), -Math.sin(p.angle)) : Math.atan2(Math.sin(p.angle), Math.cos(p.angle));
      t.rotation = p.move.axis === 'y' ? 0 : dir;
      top = new THREE.MeshLambertMaterial({ map: t, color: new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35) });
      side = new THREE.MeshLambertMaterial({ map: p.move.axis === 'y' ? upDownTex : arrowTex, color: darker });
      break;
    }
    case 'crumble': top = new THREE.MeshStandardMaterial({ map: crackTex, metalness: 0.55, roughness: 0.3, emissive: 0x3a2a00 }); side = top; break;
    case 'speed': {
      const t = chevronTex.clone(); t.needsUpdate = true; t.center.set(0.5, 0.5);
      const nx = PLATFORMS[PLATFORMS.indexOf(p) + 1];
      t.rotation = nx ? Math.atan2(nx.x - p.x, -(nx.z - p.z)) : 0;
      top = new THREE.MeshLambertMaterial({ map: t }); break;
    }
    case 'spring': top = sideMat(0xd8452f); side = sideMat(0x8a8f96); break;
    case 'light': top = new THREE.MeshLambertMaterial({ color: 0x9aa0a8, emissive: 0x000000 }); side = sideMat(0x6d737b); break;
    case 'vanish': top = new THREE.MeshLambertMaterial({ map: stripeTex, transparent: true, opacity: 1 }); side = top; break;
    case 'checkpoint': top = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a6f9a, emissiveIntensity: 0.6 }); break;
    case 'goal': top = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.4, roughness: 0.4, emissive: 0x5a4200 }); side = top; break;
    default: top = sideMat(col);
  }
  const mesh = new THREE.Mesh(BOX, [side, side, top, side, side, side]);
  mesh.scale.set(p.w, p.h, p.d);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/* =============== build platforms =============== */
const dyn = { moving: [], crumble: [], vanish: [], light: [] };
let goal = null;
for (const p of PLATFORMS) {
  p.base = { x: p.x, top: p.top, z: p.z };
  p.mesh = makeMesh(p);
  scene.add(p.mesh);
  p.collider = world.add(p.x - p.w / 2, p.x + p.w / 2, p.top - p.h, p.top, p.z - p.d / 2, p.z + p.d / 2);
  p.collider.plat = p;
  syncMesh(p);
  if (dyn[p.type]) dyn[p.type].push(p);
  if (p.type === 'marker') {
    // glowing marker that shows through the fog
    const g = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0x7fe3ff, fog: false }));
    g.position.set(p.x, p.top + 0.7, p.z); scene.add(g); p.glow = g;
    const ring = new THREE.Mesh(new THREE.RingGeometry(p.w * 0.36, p.w * 0.46, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, fog: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, p.top + 0.02, p.z); scene.add(ring);
  }
  if (p.type === 'checkpoint') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.w * 0.38, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, fog: false }));
    ring.rotation.x = Math.PI / 2; ring.position.set(p.x, p.top + 0.08, p.z); scene.add(ring); p.ring = ring;
    const flagPole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.08), sideMat(0xdddddd));
    flagPole.position.set(p.x + p.w / 2 - 0.3, p.top + 1, p.z - p.d / 2 + 0.3); scene.add(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ color: SECTIONS[p.section].color, side: THREE.DoubleSide }));
    flag.position.set(p.x + p.w / 2 - 0.3 + 0.42, p.top + 1.7, p.z - p.d / 2 + 0.3); scene.add(flag); p.flag = flag;
  }
  if (p.type === 'spring') {
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.35, 16), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    coil.position.set(p.x, p.top + 0.18, p.z); coil.castShadow = true; scene.add(coil); p.coil = coil;
  }
  if (p.type === 'goal') {
    goal = p;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x8a6a00, metalness: 0.5, roughness: 0.3 }));
    star.position.set(p.x, p.top + 2.2, p.z); scene.add(star); p.star = star;
  }
}
function syncMesh(p) {
  const c = p.collider;
  p.mesh.position.set((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2);
}

// coin trails (section 2) — purely for guidance + a little ding
const coinMat = new THREE.MeshLambertMaterial({ color: 0xffc928, emissive: 0x6b4a00 });
const coins = COINS.map((c) => {
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.position.set(c.x, c.y, c.z); scene.add(m);
  return Object.assign({ m, got: false }, c);
});

/* =============== ghost =============== */
function buildGhost() {
  const g = buildCharacter();
  g.root.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true; o.material.opacity = 0.38; o.material.depthWrite = false;
      if (o.material.color) o.material.color.lerp(new THREE.Color(0x9fdcff), 0.5);
      o.castShadow = false;
    }
  });
  g.blob.visible = false;
  scene.add(g.root);
  g.root.visible = false;
  return g;
}
const ghost = buildGhost();
let ghostOn = true;
let ghostData = Save.tower().ghost;          // { hz, f: [x,y,z,facing,state, …] }
const STRIDE = 5;

function stateCode(pl) {
  if (!pl.grounded) return pl.vel.y > 0 ? 2 : 3;
  return Math.hypot(pl.vel.x, pl.vel.z) > 0.4 ? 1 : 0;
}
function poseGhost(g, state, t) {
  const k = (o, p, v) => { o[p] += (v - o[p]) * 0.35; };
  let lL = 0, lR = 0, aL = 0, aR = 0, aZ = 0;
  if (state === 1) { const s = Math.sin(t * 11) * 0.95; lL = s; lR = -s; aL = -s; aR = s; }
  else if (state === 2) { aL = -2.4; aR = -0.5; lL = -0.9; lR = 0.35; }
  else if (state === 3) { aL = aR = -0.35; aZ = 0.9; lL = 0.25; lR = -0.25; }
  k(g.legL.rotation, 'x', lL); k(g.legR.rotation, 'x', lR);
  k(g.armL.rotation, 'x', aL); k(g.armR.rotation, 'x', aR);
  k(g.armL.rotation, 'z', -aZ); k(g.armR.rotation, 'z', aZ);
}
function updateGhost(ms) {
  const d = ghostData;
  if (!ghostOn || !d || !d.f || d.f.length < STRIDE || state === 'finished') { ghost.root.visible = false; return; }
  ghost.root.visible = true;
  const n = d.f.length / STRIDE;
  const fi = Math.min(n - 1, (ms / 1000) * d.hz);
  const i = Math.floor(fi), j = Math.min(n - 1, i + 1), t = fi - i;
  const f = d.f;
  const a = i * STRIDE, b = j * STRIDE;
  ghost.root.position.set(
    (f[a] + (f[b] - f[a]) * t) / 100,
    (f[a + 1] + (f[b + 1] - f[a + 1]) * t) / 100,
    (f[a + 2] + (f[b + 2] - f[a + 2]) * t) / 100
  );
  let fa = f[a + 3] / 100, fb = f[b + 3] / 100, df = fb - fa;
  while (df > Math.PI) df -= Math.PI * 2;
  while (df < -Math.PI) df += Math.PI * 2;
  ghost.root.rotation.y = fa + df * t;
  poseGhost(ghost, f[a + 4], ms / 1000);
}

/* =============== player / camera / input =============== */
const input = new Input(canvas);
const player = new Player(scene, world);
const cam = new FollowCamera(camera, world, { distance: 7.5, pitch: 0.45 });
player.onJump = () => Sfx.jump();
player.onLand = () => Sfx.land();
function facingToward(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
const startFacing = facingToward(START, PLATFORMS[1]);

/* =============== run state =============== */
let state = 'start';      // start | ready | running | paused | finished
let pausedFrom = 'ready';
let runMs = 0;            // run clock (only advances while running)
let worldT = 0;           // platform clock (resets each run, frozen while paused)
let cpIndex = 0;          // index into PLATFORMS of the current checkpoint
let sectionShown = -1;
let record = [];          // ghost recording
let recAcc = 0;
let litCount = 0;
let lastGround = null;

const checkpoints = PLATFORMS.filter((p) => p.type === 'checkpoint');

function resetWorld() {
  worldT = 0;
  for (const p of PLATFORMS) {
    p.state = null; p.timer = 0;
    if (!world.colliders.includes(p.collider)) world.colliders.push(p.collider);
    const c = p.collider;
    c.x0 = p.base.x - p.w / 2; c.x1 = p.base.x + p.w / 2; c.z0 = p.base.z - p.d / 2; c.z1 = p.base.z + p.d / 2;
    c.y0 = p.base.top - p.h; c.y1 = p.base.top;
    p.mesh.visible = true; p.mesh.rotation.set(0, 0, 0);
    syncMesh(p);
    if (p.type === 'vanish') p.mesh.material[2].opacity = 1;
    if (p.type === 'light') { p.lit = false; p.mesh.material[2].color.set(0x9aa0a8); p.mesh.material[2].emissive.set(0x000000); }
    if (p.type === 'checkpoint') { p.active = PLATFORMS.indexOf(p) === 0; p.ring.material.color.set(p.active ? 0x7dff9a : 0x7fe3ff); }
  }
  coins.forEach((c) => { c.got = false; c.m.visible = true; });
  litCount = 0;
}

function restart() {
  ['finish', 'pause', 'lb-panel'].forEach((id) => { $(id).hidden = true; });
  $('confetti').hidden = true;
  resetWorld();
  cpIndex = 0;
  player.teleport(START.x, START.y, START.z, startFacing);
  cam.snapBehind(startFacing);
  runMs = 0; record = []; recAcc = 0; sectionShown = -1; lastGround = null;
  ghostData = Save.tower().ghost;
  setState('ready');
  showSection(0);
  updateHud();
}

function setState(s) {
  state = s;
  const live = s === 'ready' || s === 'running';
  input.setPlaying(live);
  input.consumePause();
  $('hud').hidden = s === 'start';
  $('btn-pause').hidden = !live;
  $('btn-restart').hidden = !live;
  $('ready-hint').hidden = s !== 'ready';
}

/* ---------- section banner ---------- */
let bannerTimer = null;
function showSection(i) {
  if (i <= sectionShown) return;
  sectionShown = i;
  const S = SECTIONS[i];
  const b = $('banner');
  b.style.setProperty('--sec', '#' + S.color.toString(16).padStart(6, '0'));
  $('b-sec').textContent = `Section ${i + 1} of 4`;
  $('b-law').textContent = S.law;
  $('b-line').textContent = S.lesson;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 3400);
}

/* ---------- HUD ---------- */
function fmtTime(ms) {
  const total = Math.max(0, ms) / 1000, m = Math.floor(total / 60), s = (total - m * 60).toFixed(1);
  return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}
function updateHud() {
  $('hud-timer').textContent = fmtTime(runMs);
  const floor = Math.max(1, Math.min(20, Math.floor(player.pos.y / (goal.top / 20)) + 1));
  $('hud-floor').textContent = `Floor ${floor} / 20`;
  const pb = Save.tower().bestMs;
  $('hud-pb').hidden = !pb;
  if (pb) $('hud-pb').textContent = `PB ${fmtTime(pb)}`;
}

/* ---------- platform behaviour ---------- */
const _d = new THREE.Vector3();
function updatePlatforms(dt) {
  worldT += dt;
  // moving platforms (+ carry the player if standing on one)
  for (const p of dyn.moving) {
    const m = p.move;
    const off = m.amp * Math.sin((worldT / m.period) * Math.PI * 2 + m.phase * Math.PI);
    let nx = p.base.x, ny = p.base.top, nz = p.base.z;
    if (m.axis === 'tan') { nx += -Math.sin(p.angle) * off; nz += Math.cos(p.angle) * off; }
    else if (m.axis === 'rad') { nx += Math.cos(p.angle) * off; nz += Math.sin(p.angle) * off; }
    else ny += off;
    const c = p.collider;
    _d.set(nx - (c.x0 + c.x1) / 2, ny - c.y1, nz - (c.z0 + c.z1) / 2);
    c.x0 += _d.x; c.x1 += _d.x; c.y0 += _d.y; c.y1 += _d.y; c.z0 += _d.z; c.z1 += _d.z;
    syncMesh(p);
    if (player.ground === c && player.grounded) {
      player.pos.x += _d.x; player.pos.z += _d.z;
      if (_d.y < 0) player.pos.y += _d.y;
    }
  }
  // crumbling decoys
  for (const p of dyn.crumble) {
    if (p.state === 'shake') {
      p.timer += dt;
      p.mesh.rotation.z = Math.sin(p.timer * 60) * 0.04;
      if (p.timer > 0.45) { p.state = 'fall'; p.timer = 0; world.remove(p.collider); Sfx.land(); }
    } else if (p.state === 'fall') {
      p.timer += dt;
      p.mesh.position.y -= dt * (4 + p.timer * 18);
      p.mesh.rotation.x += dt * 1.5;
      if (p.timer > 1.2) p.mesh.visible = false;
      if (p.timer > 3.2 && !overlapsPlayer(p)) {
        p.state = null; world.colliders.push(p.collider); p.mesh.visible = true; p.mesh.rotation.set(0, 0, 0); syncMesh(p);
      }
    }
  }
  // disappearing platforms
  for (const p of dyn.vanish) {
    const top = p.mesh.material[2];
    if (p.state === 'warn') {
      p.timer += dt;
      top.opacity = 0.55 + 0.45 * Math.abs(Math.cos(p.timer * 18));
      if (p.timer > 0.6) { p.state = 'gone'; p.timer = 0; world.remove(p.collider); p.mesh.visible = false; }
    } else if (p.state === 'gone') {
      p.timer += dt;
      if (p.timer > 2.4 && !overlapsPlayer(p)) { p.state = null; top.opacity = 1; world.colliders.push(p.collider); p.mesh.visible = true; }
    }
  }
}
function overlapsPlayer(p) {
  const c = p.collider, r = player.cfg.radius;
  return player.pos.x + r > c.x0 && player.pos.x - r < c.x1 && player.pos.z + r > c.z0 && player.pos.z - r < c.z1 &&
         player.pos.y < c.y1 + 0.2 && player.pos.y + player.cfg.height > c.y0;
}

// What happens when you're standing on something.
function onGround() {
  const c = player.grounded ? player.ground : null;
  const p = c && c.plat;
  const fresh = c !== lastGround;
  lastGround = c;
  if (!p) return;
  switch (p.type) {
    case 'crumble': if (!p.state) { p.state = 'shake'; p.timer = 0; } break;
    case 'vanish': if (!p.state) { p.state = 'warn'; p.timer = 0; } break;
    case 'speed': if (fresh || player.boostTimer < 0.6) { if (fresh) Sfx.click(); player.boost(1.75, 1.3); } break;
    case 'spring':
      player.launch(p.launch); Sfx.golden(); p.coil.scale.y = 0.3;
      break;
    case 'light':
      if (!p.lit) {
        p.lit = true; litCount++;
        const col = SECTIONS[p.section].color;
        p.mesh.material[2].color.set(col); p.mesh.material[2].emissive.set(new THREE.Color(col).multiplyScalar(0.5));
        playLight(litCount);
      }
      break;
    case 'checkpoint': {
      const idx = PLATFORMS.indexOf(p);
      if (idx > cpIndex) {
        PLATFORMS[cpIndex].ring.material.color.set(0x7fe3ff);
        cpIndex = idx;
        p.ring.material.color.set(0x7dff9a);
        Sfx.unlockLock();
        toast('Checkpoint!');
        showSection(p.section);
        Save.reachTowerSection(p.section + 1);
      }
      break;
    }
    case 'goal': if (state === 'running') finishRun(); break;
  }
}
function playLight(n) {
  const notes = [523, 587, 659, 698, 784, 880, 988, 1046];
  if (Save.isMuted()) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = notes[(n - 1) % notes.length];
    g.gain.setValueAtTime(0.07, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.3);
    setTimeout(() => ac.close(), 500);
  } catch (e) { /* ignore */ }
}

function checkCoins() {
  const px = player.pos.x, py = player.pos.y + 0.9, pz = player.pos.z;
  for (const c of coins) {
    if (c.got) continue;
    if (Math.abs(c.y - py) < 1.2 && (c.x - px) ** 2 + (c.z - pz) ** 2 < 0.9) { c.got = true; c.m.visible = false; Sfx.coin(); }
  }
}

function checkFall() {
  const cp = PLATFORMS[cpIndex];
  if (player.pos.y < cp.top - 4 || player.pos.y < -5) respawn();
}
function respawn() {
  const cp = PLATFORMS[cpIndex];
  const next = PLATFORMS[cpIndex + 1] || cp;
  const f = facingToward(cp, next);
  player.teleport(cp.x, cp.top + 0.05, cp.z, f);
  cam.snapBehind(f);
  lastGround = null;
  Sfx.beep(false);
}

/* ---------- ghost recording ---------- */
function recordFrame(dt) {
  recAcc += dt;
  const step = 1 / TCFG.ghostHz;
  while (recAcc >= step) {
    recAcc -= step;
    record.push(Math.round(player.pos.x * 100), Math.round(player.pos.y * 100), Math.round(player.pos.z * 100),
      Math.round(player.facing * 100), stateCode(player));
  }
}

/* ---------- finishing ---------- */
let lastRunMs = 0;
function finishRun() {
  lastRunMs = Math.round(runMs);
  setState('finished');
  $('banner').classList.remove('show');
  record.push(Math.round(player.pos.x * 100), Math.round(player.pos.y * 100), Math.round(player.pos.z * 100), Math.round(player.facing * 100), 0);
  const prevBest = Save.tower().bestMs;
  const isBest = Save.recordTower(lastRunMs, { hz: TCFG.ghostHz, f: record });
  Save.reachTowerSection(4);
  Sfx.badge();
  const earned = [];
  if (awardBadge('tower-climber')) earned.push('🗼 Tower Climber');
  if (lastRunMs < TCFG.targetMs && awardBadge('speed-habit')) earned.push('⚡ Speed Habit');
  $('fin-badges').innerHTML = earned.map((b) => `<span>${b} unlocked</span>`).join('');
  $('fin-time').textContent = fmtTime(lastRunMs);
  $('fin-best').textContent = isBest
    ? (prevBest ? `New personal best! (was ${fmtTime(prevBest)})` : 'First climb — that\'s your PB to beat.')
    : `Personal best: ${fmtTime(Save.tower().bestMs)}`;
  $('fin-rank').textContent = lastRunMs < TCFG.targetMs ? '' : `Finish under ${fmtTime(TCFG.targetMs)} for the Speed Habit badge.`;
  $('fin-status').textContent = '';
  let saved = ''; try { saved = localStorage.getItem('bookTown.player.name') || localStorage.getItem('bookTown.study.name') || ''; } catch (e) {}
  $('fin-name').value = saved;
  $('recap').innerHTML = SECTIONS.map((s, i) =>
    `<li style="--c:#${s.color.toString(16).padStart(6, '0')}"><b>${i + 1}. ${s.law}</b>${LESSONS[i]}</li>`).join('');
  const url = CONFIG.affiliate.atomicHabits;
  const book = $('btn-book');
  if (/^https?:\/\//.test(url)) { book.href = url; book.dataset.ready = '1'; } else { book.href = '#'; book.dataset.ready = ''; }
  confetti();
  setTimeout(() => { $('finish').hidden = false; }, 900);
  // where would this time land on the board?
  fetchLeaderboard().then((list) => {
    const pos = list.filter((e) => e.timeMs < lastRunMs).length + 1;
    const pre = $('fin-rank').textContent;
    $('fin-rank').textContent = `That's #${pos} on the leaderboard if you save it.` + (pre ? ' ' + pre : '');
  }).catch(() => {});
}
$('btn-book').addEventListener('click', (e) => {
  if (!e.currentTarget.dataset.ready) { e.preventDefault(); toast('Book link coming soon.'); }
});
$('btn-fin-again').addEventListener('click', restart);
$('btn-fin-town').addEventListener('click', goTown);
async function goTown() {
  await fadeOut();
  location.href = '../?spawn=tower';
}

/* ---------- confetti ---------- */
function confetti() {
  const c = $('confetti');
  c.hidden = false;
  c.width = innerWidth; c.height = innerHeight;
  const ctx = c.getContext('2d');
  const cols = ['#2f7fd6', '#e9a23b', '#3fae5c', '#d8452f', '#ffd23f', '#ffffff'];
  const parts = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.55,
    vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 12, r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4, s: 5 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0]
  }));
  const t0 = performance.now();
  (function frame() {
    const t = performance.now() - t0;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - t / 3200); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (t < 3200 && !c.hidden) requestAnimationFrame(frame); else c.hidden = true;
  })();
}

/* ---------- leaderboard (same mechanism as The Study) ---------- */
async function submitScore(name, timeMs) {
  const res = await fetch('/api/book-town/tower/score', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, timeMs })
  });
  if (!res.ok) throw new Error('submit failed');
  return res.json();
}
async function fetchLeaderboard() {
  const res = await fetch('/api/book-town/tower/leaderboard');
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
async function openLeaderboard(highlight) {
  $('lb-panel').hidden = false;
  const list = $('lb-list'), empty = $('lb-empty');
  list.innerHTML = '<li style="border:none;color:var(--ink-soft)">Loading…</li>';
  empty.hidden = true;
  try {
    const entries = await fetchLeaderboard();
    list.innerHTML = '';
    if (!entries || !entries.length) { empty.hidden = false; empty.textContent = 'No times yet — be the first to the top.'; return; }
    entries.forEach((e) => {
      const li = document.createElement('li');
      if (highlight && e.name === highlight) li.classList.add('you');
      li.innerHTML = `<span class="rank">#${e.rank}</span><span class="lname">${esc(e.name)}</span><span class="ltime">${fmtTime(e.timeMs)}</span>`;
      list.appendChild(li);
    });
  } catch (e) {
    list.innerHTML = '';
    empty.hidden = false;
    const pb = Save.tower().bestMs;
    empty.textContent = 'Leaderboard is unavailable right now' + (pb ? ` — your best climb is ${fmtTime(pb)}, saved on this device.` : '.');
  }
}
$('btn-start-lb').addEventListener('click', () => openLeaderboard());
$('btn-p-lb').addEventListener('click', () => openLeaderboard());
$('btn-fin-lb').addEventListener('click', () => openLeaderboard($('fin-name').value.trim().toUpperCase()));
$('btn-lb-close').addEventListener('click', () => { $('lb-panel').hidden = true; });
$('btn-fin-submit').addEventListener('click', async () => {
  const name = $('fin-name').value.trim().toUpperCase().slice(0, 12);
  const status = $('fin-status');
  if (!name) { status.textContent = 'Enter your initials first.'; return; }
  try { localStorage.setItem('bookTown.player.name', name); } catch (e) {}
  const btn = $('btn-fin-submit');
  btn.disabled = true; status.textContent = 'Saving…';
  try {
    await submitScore(name, lastRunMs);
    status.textContent = 'Saved to the leaderboard.';
    try {
      const entries = await fetchLeaderboard();
      const pos = entries.findIndex((e) => e.name === name && e.timeMs === lastRunMs);
      if (pos >= 0) status.textContent = `Saved — you're #${pos + 1} on the leaderboard.`;
    } catch (e) { /* nice-to-have */ }
  } catch (e) {
    status.textContent = "Couldn't reach the leaderboard — your PB is still saved on this device.";
  } finally { btn.disabled = false; }
});

/* ---------- menus ---------- */
function renderControls() {
  const extra = input.touchMode ? '<br><b>Restart</b>: ↺ button (top right)' : '<br><b>Restart run</b>: R';
  document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = controlsHelpHTML(input.touchMode) + extra; });
}
input.onTouchModeChange = renderControls;
renderControls();

function openPause() {
  pausedFrom = state;
  setState('paused');
  $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on';
  $('btn-ghost').textContent = ghostOn ? 'Ghost: on' : 'Ghost: off';
  $('pause').hidden = false;
}
function closePause() { $('pause').hidden = true; setState(pausedFrom); }
$('btn-pause').addEventListener('click', openPause);
$('btn-resume').addEventListener('click', closePause);
$('btn-p-restart').addEventListener('click', restart);
$('btn-restart').addEventListener('click', restart);
$('btn-help').addEventListener('click', () => { $('pause-help').hidden = !$('pause-help').hidden; });
$('btn-mute').addEventListener('click', () => { Save.setMuted(!Save.isMuted()); $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; });
$('btn-ghost').addEventListener('click', () => { ghostOn = !ghostOn; $('btn-ghost').textContent = ghostOn ? 'Ghost: on' : 'Ghost: off'; });
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR' || e.repeat) return;
  if (e.target && e.target.tagName === 'INPUT') return;
  if (state === 'ready' || state === 'running' || state === 'paused' || state === 'finished') restart();
});

$('btn-start').addEventListener('click', () => {
  Sfx.unlock();
  $('start-screen').hidden = true;
  restart();
});

/* =============== loop =============== */
const clock = new THREE.Clock();
function updateFog() {
  // thick fog while you're inside section 1's fog band
  const y = player.pos.y + 1;
  const edge = 1.5;
  let k = 0;
  if (y > FOG_BAND.y0 - edge && y < FOG_BAND.y1 + edge) {
    k = Math.min(1, (y - (FOG_BAND.y0 - edge)) / edge, ((FOG_BAND.y1 + edge) - y) / edge);
  }
  scene.fog.near = THREE.MathUtils.lerp(40, 1.2, k);
  scene.fog.far = THREE.MathUtils.lerp(160, 7.5, k);
  scene.fog.color.copy(BG).lerp(FOGC, k);
  scene.background.copy(scene.fog.color);
}

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (state === 'ready' || state === 'running') {
    if (input.consumePause()) openPause();
  } else if (state === 'paused' && input.consumePause()) closePause();

  if (state === 'ready') {
    const mv = input.getMove();
    if (mv.mag > 0.1 || input.jumpHeld) { setState('running'); }
  }
  if (state === 'ready' || state === 'running' || state === 'finished') {
    updatePlatforms(dt);
    player.update(dt, input, cam.yaw);
    onGround();
    if (state !== 'finished') { checkCoins(); checkFall(); }
    if (state === 'running') { runMs += dt * 1000; recordFrame(dt); }
    cam.update(dt, player.pos, state === 'finished' ? null : input);
  } else {
    cam.update(dt, player.pos, null);
  }
  if (state === 'start') { cam.yaw += dt * 0.15; }

  updateGhost(state === 'ready' ? 0 : runMs);
  if (state !== 'start') updateHud();
  updateFog();

  // decorative animation
  for (const c of coins) if (!c.got) c.m.rotation.y = t * 3;
  for (const p of PLATFORMS) {
    if (p.glow) { p.glow.rotation.y = t * 2; p.glow.position.y = p.top + 0.7 + Math.sin(t * 3 + p.x) * 0.1; }
    if (p.coil && p.coil.scale.y < 1) { p.coil.scale.y = Math.min(1, p.coil.scale.y + dt * 4); }
    if (p.coil) p.coil.position.set(p.mesh.position.x, p.mesh.position.y + p.h / 2 + 0.18, p.mesh.position.z);
    if (p.flag) p.flag.rotation.y = Math.sin(t * 2 + p.top) * 0.3;
  }
  if (goal && goal.star) { goal.star.rotation.y = t * 1.5; goal.star.position.y = goal.top + 2.2 + Math.sin(t * 2) * 0.2; }

  // shadow camera follows the player
  sun.position.set(player.pos.x + 8, player.pos.y + 20, player.pos.z + 6);
  sun.target.position.set(player.pos.x, player.pos.y, player.pos.z);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* =============== boot =============== */
player.teleport(START.x, START.y, START.z, startFacing);
cam.snapBehind(startFacing);
resetWorld();
$('loading').hidden = true;
$('start-screen').hidden = false;
const pb = Save.tower().bestMs;
$('start-pb').textContent = pb ? `Your best climb: ${fmtTime(pb)} — your ghost will race you.` : 'No personal best yet.';
fadeIn();
addEventListener('pageshow', (e) => { if (e.persisted) fadeIn(); });
// Deterministic step for automated tests: same per-frame logic as tick().
function simStep(dt, inp, yaw) {
  if (state === 'ready' && (inp.getMove().mag > 0.1 || inp.jumpHeld)) setState('running');
  updatePlatforms(dt);
  player.update(dt, inp, yaw);
  onGround();
  if (state !== 'finished') { checkCoins(); checkFall(); }
  if (state === 'running') { runMs += dt * 1000; recordFrame(dt); }
}
window.__tower = { player, cam, world, PLATFORMS, restart, simStep, get state() { return state; }, get runMs() { return runMs; }, get cpIndex() { return cpIndex; } };
tick();
