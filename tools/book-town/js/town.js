// Book Town — town centre scene + game loop.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { World, Batcher, canvasTexture, signMesh } from './world.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { Save } from './save.js';
import { Sfx } from './audio.js';
import { toast, awardBadge, setPrompt, fadeOut, fadeIn, controlsHelpHTML } from './hud.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const spawnParam = params.get('spawn');
const spawnKey = spawnParam && spawnParam !== 'default' && CONFIG.spawns[spawnParam] ? spawnParam : 'default';

/* =============== renderer / scene =============== */
const canvas = $('game-canvas');
const isCoarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isCoarse, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const SKY = 0x8fc6ec;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 70, 150);

const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.1, 400);
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

scene.add(new THREE.HemisphereLight(0xdff1ff, 0x7a8a5a, 1.15));
const sun = new THREE.DirectionalLight(0xfff3dc, 1.9);
sun.position.set(30, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(isCoarse ? 1024 : 2048, isCoarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 10, far: 140 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun);

/* =============== loading =============== */
const manager = new THREE.LoadingManager();
const loadBar = document.querySelector('#loading .bar span');
const loadText = document.querySelector('#loading p');
manager.onProgress = (_url, loaded, total) => {
  const pct = Math.round((loaded / total) * 100);
  loadBar.style.width = pct + '%';
  loadText.textContent = `Building the town… ${pct}%`;
};
const texLoader = new THREE.TextureLoader(manager);

/* =============== world =============== */
const world = new World();
const B = new Batcher();
const interactables = [];   // { x, z, y, r, label, act }

// ground + bounds
world.add(-90, 90, -1, 0, -90, 90, true);
const BOUND = 44.5;
world.add(-BOUND - 1, -BOUND, -1, 40, -BOUND - 1, BOUND + 1, false);
world.add(BOUND, BOUND + 1, -1, 40, -BOUND - 1, BOUND + 1, false);
world.add(-BOUND - 1, BOUND + 1, -1, 40, -BOUND - 1, -BOUND, false);
world.add(-BOUND - 1, BOUND + 1, -1, 40, BOUND, BOUND + 1, false);

{ // grass + plaza paving
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x7cc06a }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.02; grass.receiveShadow = true;
  scene.add(grass);
  const paveTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#d9cfbd'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#cfc4b0'; ctx.fillRect(0, 0, 64, 64); ctx.fillRect(64, 64, 64, 64);
    ctx.strokeStyle = 'rgba(120,105,85,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke(); }
  });
  paveTex.wrapS = paveTex.wrapT = THREE.RepeatWrapping;
  paveTex.repeat.set(22, 22);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(88, 88), new THREE.MeshLambertMaterial({ map: paveTex }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0; plaza.receiveShadow = true;
  scene.add(plaza);
  // a ring of darker stone around the square's edge
  B.box(-30, 30, 0, 0.02, -30, -29, 0xb8ab94, { cast: false });
  B.box(-30, 30, 0, 0.02, 29, 30, 0xb8ab94, { cast: false });
  B.box(-30, -29, 0, 0.02, -30, 30, 0xb8ab94, { cast: false });
  B.box(29, 30, 0, 0.02, -30, 30, 0xb8ab94, { cast: false });
}

/* ---------- facade helper: work in (u along the front, y up, off outward) ---------- */
function faceOf(b) {
  if (b.door) return b.door.face;
  if (b.z1 <= -30) return 'south';
  if (b.z0 >= 30) return 'north';
  if (b.x0 >= 30) return 'west';
  return 'east';
}
function facade(b) {
  const face = faceOf(b);
  const F = {
    south: { u0: b.x0, u1: b.x1, rot: 0,            pt: (u, y, o) => [u, y, b.z1 + o] },
    north: { u0: b.x0, u1: b.x1, rot: Math.PI,      pt: (u, y, o) => [u, y, b.z0 - o] },
    west:  { u0: b.z0, u1: b.z1, rot: -Math.PI / 2, pt: (u, y, o) => [b.x0 - o, y, u] },
    east:  { u0: b.z0, u1: b.z1, rot: Math.PI / 2,  pt: (u, y, o) => [b.x1 + o, y, u] }
  }[face];
  F.face = face;
  // box in facade space → world box
  F.box = (u0, u1, y0, y1, o0, o1, color, collide = false, cam = true) => {
    const a = F.pt(u0, y0, o0), c = F.pt(u1, y1, o1);
    B.box(a[0], c[0], a[1], c[1], a[2], c[2], color);
    if (collide) world.add(a[0], c[0], a[1], c[1], a[2], c[2], cam);
  };
  F.place = (mesh, u, y, o) => {
    const p = F.pt(u, y, o);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.rotation.y = F.rot;
    scene.add(mesh);
    return mesh;
  };
  return F;
}

// slots with `scene` set live inside a building, not on the square
const TOWN_ADS = CONFIG.adSlots.filter((a) => !a.scene || a.scene === 'town');
const adRects = TOWN_ADS.map((a) => ({ a }));
function overlapsAd(F, b, u0, u1, y0, y1) {
  for (const { a } of adRects) {
    const [ax, ay, az] = a.position;
    let onFace = false, au = 0;
    if (F.face === 'south') { onFace = Math.abs(az - b.z1) < 0.4; au = ax; }
    if (F.face === 'north') { onFace = Math.abs(az - b.z0) < 0.4; au = ax; }
    if (F.face === 'west')  { onFace = Math.abs(ax - b.x0) < 0.4; au = az; }
    if (F.face === 'east')  { onFace = Math.abs(ax - b.x1) < 0.4; au = az; }
    if (!onFace) continue;
    const hw = a.size[0] / 2 + 0.3, hh = a.size[1] / 2 + 0.3;
    if (u1 > au - hw && u0 < au + hw && y1 > ay - hh && y0 < ay + hh) return true;
  }
  return false;
}

/* ---------- padlock model for locked doors ---------- */
function padlock() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.14), new THREE.MeshLambertMaterial({ color: 0xd4a017 }));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12, Math.PI), new THREE.MeshLambertMaterial({ color: 0x9aa3ad }));
  shackle.position.y = 0.2;
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  hole.position.set(0, -0.02, 0.08);
  g.add(body, shackle, hole);
  return g;
}

/* ---------- buildings ---------- */
const GLASS = 0x9ccfe8, DOOR = 0x5a3a24;
const liveDoors = [];   // walk-in doors for live buildings
let towerFlag = null, flagMesh = null;

function buildBuilding(b) {
  const F = facade(b);
  const h = b.h;
  // body + flat roof cap with small overhang (both solid)
  B.box(b.x0, b.x1, 0, h, b.z0, b.z1, b.wall);
  world.add(b.x0, b.x1, 0, h, b.z0, b.z1);
  B.box(b.x0 - 0.2, b.x1 + 0.2, h, h + 0.3, b.z0 - 0.2, b.z1 + 0.2, b.roof);
  world.add(b.x0 - 0.2, b.x1 + 0.2, h, h + 0.3, b.z0 - 0.2, b.z1 + 0.2);
  // base plinth stripe
  F.box(F.u0, F.u1, 0, 0.35, 0, 0.06, b.trim);

  const doorAt = b.door ? b.door.at : null;
  const doorBase = b.style === 'library' ? 0.6 : 0;

  // windows on the front facade
  const step = 3.2;
  for (let y = 1.3; y + 1.3 < h - 0.5; y += 2.4) {
    for (let u = F.u0 + 2; u <= F.u1 - 2; u += step) {
      if (doorAt !== null && Math.abs(u - doorAt) < (b.style === 'library' ? 7.8 : 2.4)) continue;
      if (b.style === 'cinema' && y > 2 && Math.abs(u - doorAt) < 6) continue;
      if (overlapsAd(F, b, u - 0.7, u + 0.7, y, y + 1.3)) continue;
      F.box(u - 0.65, u + 0.65, y, y + 1.25, 0, 0.06, GLASS);
      F.box(u - 0.8, u + 0.8, y - 0.14, y, 0, 0.16, b.trim);
      F.box(u - 0.05, u + 0.05, y, y + 1.25, 0, 0.08, b.trim);
    }
  }
  // roof parapet trim line
  F.box(F.u0, F.u1, h - 0.35, h, 0, 0.1, b.trim);

  if (b.style === 'house') buildHouseRoof(b);
  if (b.style === 'hall') {
    // columns + flag on the town hall
    for (let u = F.u0 + 3; u < 29; u += 4) F.box(u - 0.35, u + 0.35, 0.35, h - 0.6, 0.05, 0.6, 0xf2efe8, true, false);
    F.box(F.u0 + 1, F.u1 - 1, h - 0.9, h - 0.35, 0, 0.8, b.trim);
    F.box(17 - 0.06, 17 + 0.06, h + 0.3, h + 4.5, -2, -1.88, 0x666666);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshLambertMaterial({ color: 0x156534, side: THREE.DoubleSide }));
    flag.position.set(17.82, h + 3.9, -31.94); scene.add(flag); flagMesh = flag;
    const hallSign = signMesh('TOWN HALL', { w: 7, h: 0.9, bg: '#8a8273', fg: '#fffaf0' });
    F.place(hallSign, 17, h - 1.6, 0.82);
  }

  if (!b.door) return;

  // ----- door -----
  F.box(doorAt - 0.9, doorAt + 0.9, doorBase, doorBase + 2.5, 0, 0.1, DOOR);
  F.box(doorAt - 1.1, doorAt + 1.1, doorBase + 2.5, doorBase + 2.75, 0, 0.18, b.trim);
  F.box(doorAt - 1.1, doorAt - 0.9, doorBase, doorBase + 2.5, 0, 0.18, b.trim);
  F.box(doorAt + 0.9, doorAt + 1.1, doorBase, doorBase + 2.5, 0, 0.18, b.trim);
  F.box(doorAt + 0.5, doorAt + 0.65, doorBase + 1.15, doorBase + 1.3, 0.1, 0.2, 0xd4a017);

  // ----- style extras -----
  if (b.style === 'library') buildLibraryFront(b, F, doorAt);
  if (b.style === 'tower') buildHabitTower(b, F, doorAt);
  if (b.style === 'cafe') buildCafeFront(b, F);
  if (b.style === 'cinema') {
    F.box(doorAt - 3.2, doorAt + 3.2, 3.0, 4.4, 0, 1.4, 0x2a0f12, true);
    for (let u = doorAt - 3; u <= doorAt + 3.01; u += 0.6) F.box(u - 0.08, u + 0.08, 2.92, 3.0, 1.2, 1.36, 0xffe9a0);
  }

  // ----- sign -----
  const signY = b.style === 'library' ? 4.1 : (b.style === 'cinema' ? 3.7 : 3.35);
  const signO = b.style === 'cinema' ? 1.42 : 0.14;
  const sw = b.style === 'library' ? 7.6 : Math.min(7, Math.max(3.2, b.sign.length * 0.62));
  const sign = signMesh(b.sign, {
    w: sw, h: b.style === 'library' ? 1.1 : 0.9,
    bg: b.style === 'library' ? '#1f3b2c' : '#' + b.trim.toString(16).padStart(6, '0'),
    fg: b.style === 'library' ? '#f5e7c4' : (b.trim > 0xaaaaaa ? '#2a2420' : '#ffffff'),
    border: b.style === 'library' ? '#c9a24a' : null
  });
  F.place(sign, doorAt, signY, signO);

  const doorPoint = F.pt(doorAt, 0, 1.3);
  const nrm = { south: [0, 1], north: [0, -1], west: [-1, 0], east: [1, 0] }[F.face];
  if (b.status === 'live') {
    liveDoors.push({ b, x: F.pt(doorAt, 0, 0.6)[0], z: F.pt(doorAt, 0, 0.6)[2], nx: nrm[0], nz: nrm[1], y: doorBase });
    // glowing "OPEN" board + welcome mat
    const open = signMesh('OPEN', { w: 1.4, h: 0.6, bg: '#156534', fg: '#ffffff' });
    F.place(open, doorAt + 2.1, doorBase + 1.6, 0.14);
    interactables.push({ x: doorPoint[0], z: doorPoint[2], y: 0, r: 1.9, label: `Enter ${b.name}`, act: () => enterBuilding(b) });
  } else {
    const lock = padlock();
    F.place(lock, doorAt, doorBase + 1.25, 0.2);
    const soon = signMesh('COMING SOON', { w: 2.1, h: 0.5, bg: '#fff4c2', fg: '#7a5a00', px: 60 });
    const sp = F.pt(doorAt, doorBase + 2.05, 0.22);
    soon.position.set(sp[0], sp[1], sp[2]); soon.rotation.y = F.rot; soon.rotation.z = -0.06;
    scene.add(soon);
    interactables.push({ x: doorPoint[0], z: doorPoint[2], y: 0, r: 2.0, label: `${b.name} (coming soon)`,
      act: () => { toast('Opening soon — keep exploring!'); Sfx.click(); } });
  }
}

function buildHouseRoof(b) {
  // stepped "blocky" pitched roof, ridge along the longer side
  const alongX = (b.x1 - b.x0) >= (b.z1 - b.z0);
  const base = b.h + 0.3;
  for (let i = 0; i < 4; i++) {
    const inset = 1.3 * (i + 1);
    const y0 = base + i * 0.7, y1 = y0 + 0.7;
    let x0 = b.x0, x1 = b.x1, z0 = b.z0, z1 = b.z1;
    if (alongX) { z0 += inset; z1 -= inset; } else { x0 += inset; x1 -= inset; }
    if (x1 - x0 < 0.6 || z1 - z0 < 0.6) break;
    B.box(x0, x1, y0, y1, z0, z1, i % 2 ? b.roof : new THREE.Color(b.roof).multiplyScalar(0.85).getHex());
    world.add(x0, x1, y0, y1, z0, z1);
  }
  // chimney
  const cx = alongX ? b.x0 + 3 : (b.x0 + b.x1) / 2 + 2, cz = alongX ? (b.z0 + b.z1) / 2 + 2 : b.z0 + 3;
  B.box(cx - 0.6, cx + 0.6, base, base + 3.4, cz - 0.6, cz + 0.6, 0x8a5a44);
  world.add(cx - 0.6, cx + 0.6, base, base + 3.4, cz - 0.6, cz + 0.6);
}

// Habit Tower: the old gym block becomes the base of a tall striped tower
// that's visible from anywhere on the square.
let towerBeacon = null;
function buildHabitTower(b, F, at) {
  const x0 = -40, x1 = -32, z0 = -20, z1 = -12, top = 40;
  const bands = [0x2f7fd6, 0xe9a23b, 0x3fae5c, 0xd8452f];   // one colour per law/section
  for (let i = 0; i < 4; i++) {
    const y0 = b.h + 0.3 + i * ((top - b.h) / 4), y1 = b.h + 0.3 + (i + 1) * ((top - b.h) / 4);
    B.box(x0, x1, y0, y1, z0, z1, i % 2 ? 0xe9e4d8 : 0xf6f2e8);
    B.box(x0 - 0.15, x1 + 0.15, y1 - 0.6, y1, z0 - 0.15, z1 + 0.15, bands[i]);
    // windows on all four sides
    for (let y = y0 + 1.5; y < y1 - 1.6; y += 3) {
      for (let u = -2.4; u <= 2.4; u += 2.4) {
        B.box(x1, x1 + 0.06, y, y + 1.4, -16 + u - 0.45, -16 + u + 0.45, 0x9ccfe8);
        B.box(x0 - 0.06, x0, y, y + 1.4, -16 + u - 0.45, -16 + u + 0.45, 0x9ccfe8);
        B.box(-36 + u - 0.45, -36 + u + 0.45, y, y + 1.4, z1, z1 + 0.06, 0x9ccfe8);
        B.box(-36 + u - 0.45, -36 + u + 0.45, y, y + 1.4, z0 - 0.06, z0, 0x9ccfe8);
      }
    }
  }
  world.add(x0, x1, b.h, top + 0.3, z0, z1);
  // crown + glowing beacon
  B.box(x0 - 0.6, x1 + 0.6, top + 0.3, top + 1.1, z0 - 0.6, z1 + 0.6, 0x23303d);
  world.add(x0 - 0.6, x1 + 0.6, top + 0.3, top + 1.1, z0 - 0.6, z1 + 0.6);
  B.box(-37.5, -34.5, top + 1.1, top + 3.5, -17.5, -14.5, 0x23303d);
  towerBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  towerBeacon.position.set(-36, top + 5, -16);
  scene.add(towerBeacon);
  // big vertical name board facing the square, under the banner ad
  const board = signMesh('HABIT TOWER', { w: 7, h: 1.1, bg: '#23303d', fg: '#ffd23f' });
  board.position.set(-31.94, 9, -16); board.rotation.y = Math.PI / 2; scene.add(board);
  // a little entrance canopy with the four law colours
  for (let i = 0; i < 4; i++) F.box(at - 2 + i, at - 1 + i, 2.9, 3.1, 0, 1.6, bands[i], i === 0);
  world.add(-30 + 0, -30 + 1.6, 2.9, 3.1, at - 2, at + 2);
}

function buildLibraryFront(b, F, at) {
  const stone = 0xf3ead6;
  // steps
  F.box(at - 5, at + 5, 0, 0.3, 0, 2.0, 0xcfc4ae, true);
  F.box(at - 4.2, at + 4.2, 0.3, 0.6, 0, 1.1, 0xdcd2bd, true);
  // columns
  [-6.6, -4.2, 4.2, 6.6].forEach((du) => {
    F.box(at + du - 0.35, at + du + 0.35, du * du > 30 ? 0 : 0.6, b.h - 1.3, 0.35, 1.05, stone, true, false);
    F.box(at + du - 0.5, at + du + 0.5, b.h - 1.45, b.h - 1.3, 0.2, 1.2, b.trim);
  });
  // entablature + stepped pediment
  F.box(at - 7.6, at + 7.6, b.h - 1.3, b.h - 0.6, 0, 1.3, stone, true);
  for (let i = 0; i < 4; i++) {
    const w = 7.6 - i * 1.9;
    F.box(at - w, at + w, b.h + 0.3 + i * 0.45, b.h + 0.75 + i * 0.45, 0, 1.0, i % 2 ? stone : 0xe6dcc6, true);
  }
  // book-spine frieze
  const spines = [0x8a3a3a, 0x3a6b4a, 0x35507a, 0xb08a3a, 0x6a4a80];
  for (let u = at - 7.2, i = 0; u < at + 7.2; u += 0.5, i++) {
    F.box(u, u + 0.42, b.h - 1.2, b.h - 0.72, 1.3, 1.36, spines[i % spines.length]);
  }
  // lanterns either side of the door
  [-1.6, 1.6].forEach((du) => F.box(at + du - 0.15, at + du + 0.15, 2.4, 2.9, 0, 0.35, 0xffd27a));
}

function buildCafeFront(b, F) {
  // striped awning — part of the rooftop route (solid, standable)
  const x0 = 28, x1 = 30, z0 = 3.5, z1 = 14.5;
  world.add(x0, x1, 2.6, 2.8, z0, z1);
  for (let z = z0, i = 0; z < z1 - 0.01; z += 1, i++) {
    B.box(x0, x1, 2.6, 2.8, z, Math.min(z + 1, z1), i % 2 ? 0xffffff : 0xd8452f);
  }
  B.box(x0 - 0.05, x0, 2.3, 2.8, z0, z1, 0xd8452f);
  // café tables (step-up height)
  [[26.5, 12.8], [25.6, 9.4]].forEach(([x, z]) => {
    B.box(x - 0.08, x + 0.08, 0, 0.75, z - 0.08, z + 0.08, 0x333333);
    B.box(x - 0.55, x + 0.55, 0.75, 0.82, z - 0.55, z + 0.55, 0xffffff);
    world.add(x - 0.55, x + 0.55, 0, 0.82, z - 0.55, z + 0.55, false);
  });
}

CONFIG.buildings.forEach(buildBuilding);

/* ---------- crates (start of the rooftop route) ---------- */
function crate(x0, x1, y0, z0, z1) {
  const y1 = y0 + (x1 - x0);
  B.box(x0, x1, y0, y1, z0, z1, 0xb7834a);
  B.box(x0 - 0.02, x1 + 0.02, y0 + 0.05, y0 + 0.15, z0 - 0.02, z1 + 0.02, 0x7a5230);
  B.box(x0 - 0.02, x1 + 0.02, y1 - 0.15, y1 - 0.05, z0 - 0.02, z1 + 0.02, 0x7a5230);
  world.add(x0, x1, y0, y1, z0, z1);
}
crate(26.8, 27.8, 0, 4.4, 5.4);
crate(26.8, 27.8, 0, 6.1, 7.1);
crate(26.8, 27.8, 1, 6.1, 7.1);
crate(25.4, 26.4, 0, 6.2, 7.2);

/* ---------- clock tower ---------- */
const TOWER = CONFIG.clockTower;
let clockHands = [];
{
  const { x0, x1, z0, z1, h } = TOWER;
  B.box(x0, x1, 0, h, z0, z1, 0xc9b79a);
  world.add(x0, x1, 0, h, z0, z1);
  // horizontal bands
  for (let y = 3; y < h; y += 3.5) B.box(x0 - 0.1, x1 + 0.1, y, y + 0.25, z0 - 0.1, z1 + 0.1, 0xa8957a);
  // top rim (flush, so it doesn't block the mantle) + flag
  B.box(x0, x1, h - 0.05, h + 0.05, z0, z1, 0x8f7d63);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.box(cx - 0.07, cx + 0.07, h, h + 4, cz - 0.07, cz + 0.07, 0x555555);
  world.add(cx - 0.07, cx + 0.07, h, h + 4, cz - 0.07, cz + 0.07, false);
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshLambertMaterial({ color: 0xf2b705, side: THREE.DoubleSide }));
  pennant.position.set(cx + 0.72, h + 3.5, cz); scene.add(pennant);
  towerFlag = pennant;

  // climbing ledges (with little corbels under them)
  const ledges = [
    [28, 29.4, 6.9, 7.3, -26, -24],
    [26, 29.4, 8.7, 9.1, -22, -20.6],
    [22.5, 24.5, 10.5, 10.9, -22, -20.6],
    [20.6, 22, 12.3, 12.7, -24.5, -20.6]
  ];
  ledges.forEach(([a, b, c, d, e, f]) => {
    B.box(a, b, c, d, e, f, 0x9c8a6e);
    world.add(a, b, c, d, e, f);
    B.box(a + 0.2, b - 0.2, c - 0.5, c, e + 0.2, f - 0.2, 0x7d6c52);
  });

  // clock faces with live hands on all four sides
  const faceTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#fbf6e9'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3b3128'; ctx.lineWidth = 10; ctx.stroke();
    ctx.fillStyle = '#3b3128';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(128 + Math.sin(a) * 100 - 6, 128 - Math.cos(a) * 100 - 6, 12, 12);
    }
  });
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
  const handMat = new THREE.MeshBasicMaterial({ color: 0x2a2420 });
  const sides = [
    { p: [cx, 12.4, z1 + 0.06], ry: 0 }, { p: [cx, 12.4, z0 - 0.06], ry: Math.PI },
    { p: [x1 + 0.06, 12.4, cz], ry: Math.PI / 2 }, { p: [x0 - 0.06, 12.4, cz], ry: -Math.PI / 2 }
  ];
  sides.forEach((s) => {
    const g = new THREE.Group();
    g.position.set(...s.p); g.rotation.y = s.ry;
    g.add(new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), faceMat));
    const hour = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.02), handMat); hour.geometry.translate(0, 0.28, 0.02);
    const min = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.02), handMat); min.geometry.translate(0, 0.45, 0.03);
    g.add(hour, min);
    scene.add(g);
    clockHands.push({ hour, min });
  });
}

/* ---------- fountain ---------- */
let waterMesh = null, sprayMesh = null;
{
  const stone = 0xbfb6a6, dark = 0xa69d8c;
  const walls = [[-4, 4, -4, -3.5], [-4, 4, 3.5, 4], [-4, -3.5, -3.5, 3.5], [3.5, 4, -3.5, 3.5]];
  walls.forEach(([a, b, c, d]) => { B.box(a, b, 0, 0.6, c, d, stone); world.add(a, b, 0, 0.6, c, d); });
  B.box(-4.1, 4.1, 0.6, 0.7, -4.1, -3.4, dark); B.box(-4.1, 4.1, 0.6, 0.7, 3.4, 4.1, dark);
  B.box(-4.1, -3.4, 0.6, 0.7, -3.4, 3.4, dark); B.box(3.4, 4.1, 0.6, 0.7, -3.4, 3.4, dark);
  B.box(-0.8, 0.8, 0, 1.6, -0.8, 0.8, stone); world.add(-0.8, 0.8, 0, 1.6, -0.8, 0.8);
  B.box(-1.6, 1.6, 1.6, 1.9, -1.6, 1.6, dark); world.add(-1.6, 1.6, 1.6, 1.9, -1.6, 1.6);
  B.box(-0.3, 0.3, 1.9, 2.8, -0.3, 0.3, stone); world.add(-0.3, 0.3, 1.9, 2.8, -0.3, 0.3);
  // a little book on top — it's Book Town after all
  B.box(-0.45, 0.45, 2.8, 2.95, -0.32, 0.32, 0x8a3a3a);
  B.box(-0.4, 0.4, 2.95, 3.02, -0.28, 0.28, 0xfaf3e0);
  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshLambertMaterial({ color: 0x4fb3e0, transparent: true, opacity: 0.85 }));
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.y = 0.4;
  scene.add(waterMesh);
  const bowlWater = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), waterMesh.material);
  bowlWater.rotation.x = -Math.PI / 2; bowlWater.position.y = 1.91; scene.add(bowlWater);
  sprayMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 1.4, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  sprayMesh.position.y = 1.2;
  scene.add(sprayMesh);
}

/* ---------- props: trees, benches, lamps, bins ---------- */
function tree(x, z, s = 1) {
  B.box(x - 0.35, x + 0.35, 0, 2.6 * s, z - 0.35, z + 0.35, 0x7a5532);
  world.add(x - 0.35, x + 0.35, 0, 2.6 * s, z - 0.35, z + 0.35, false);
  B.cbox(x, 3.4 * s, z, 2.8 * s, 1.8 * s, 2.8 * s, 0x4f9a46);
  B.cbox(x, 4.6 * s, z, 1.9 * s, 1.0 * s, 1.9 * s, 0x5fae52);
}
[[-16, -6], [16, -16], [-16, 16], [16, 16], [-20, 26], [20, 26], [-22, -24], [10, 24]].forEach(([x, z]) => tree(x, z));

function bench(x, z, alongZ) {
  const [w, d] = alongZ ? [0.7, 2.4] : [2.4, 0.7];
  B.box(x - w / 2, x + w / 2, 0.38, 0.5, z - d / 2, z + d / 2, 0xa0682e);
  const bx = alongZ ? (x > 0 ? x + 0.3 : x - 0.3) : x, bz = alongZ ? z : (z > 0 ? z + 0.3 : z - 0.3);
  B.box(alongZ ? bx - 0.06 : x - w / 2, alongZ ? bx + 0.06 : x + w / 2, 0.5, 1.0, alongZ ? z - d / 2 : bz - 0.06, alongZ ? z + d / 2 : bz + 0.06, 0xa0682e);
  B.box(x - w / 2 + 0.1, x + w / 2 - 0.1, 0, 0.38, z - d / 2 + 0.1, z + d / 2 - 0.1, 0x444444);
  world.add(x - w / 2, x + w / 2, 0, 0.5, z - d / 2, z + d / 2, false);
}
bench(9, 0, true); bench(-9, 0, true); bench(0, -9.5, false);
bench(-14, -26, false); bench(18, 28, false);

function lamp(x, z) {
  B.box(x - 0.1, x + 0.1, 0, 4, z - 0.1, z + 0.1, 0x2f3b3a);
  B.box(x - 0.3, x + 0.3, 4, 4.5, z - 0.3, z + 0.3, 0xffe9a8);
  B.box(x - 0.35, x + 0.35, 4.5, 4.62, z - 0.35, z + 0.35, 0x2f3b3a);
  world.add(x - 0.15, x + 0.15, 0, 4.6, z - 0.15, z + 0.15, false);
}
[[-10, -10], [10, -10], [-10, 10], [10, 10], [-24, 0], [24, 0], [-6, 29], [6, 29]].forEach(([x, z]) => lamp(x, z));

function bin(x, z) {
  B.box(x - 0.45, x + 0.45, 0, 1.2, z - 0.45, z + 0.45, 0x3d6b4f);
  B.box(x - 0.5, x + 0.5, 1.2, 1.3, z - 0.5, z + 0.5, 0x2d5240);
  world.add(x - 0.5, x + 0.5, 0, 1.3, z - 0.5, z + 0.5);
}
bin(-38, 0.9); bin(36.5, -2.2); bin(-27, 3);

// flower planters along the square edge
[[-20, 28.6], [20, 28.6], [28.6, 24], [-28.6, -24]].forEach(([x, z]) => {
  B.box(x - 1.2, x + 1.2, 0, 0.45, z - 0.5, z + 0.5, 0x8a6a4a);
  B.box(x - 1.1, x + 1.1, 0.45, 0.6, z - 0.4, z + 0.4, 0x4c8c3c);
  for (let i = -1; i <= 1; i++) B.cbox(x + i * 0.7, 0.72, z, 0.25, 0.25, 0.25, [0xe94f6a, 0xf6c445, 0xb06ad9][i + 1]);
  world.add(x - 1.2, x + 1.2, 0, 0.45, z - 0.5, z + 0.5);
});

/* ---------- market stall + west billboard (secret route) ---------- */
{
  // counter under the stall roof
  B.box(-23.6, -21.4, 0, 1.0, 22, 24, 0xc98d4c);
  world.add(-23.6, -21.4, 0, 1.0, 22, 24);
  [[-24.1, 21.4], [-24.1, 24.6], [-20.9, 21.4], [-20.9, 24.6]].forEach(([x, z]) => {
    B.box(x - 0.08, x + 0.08, 0, 2.2, z - 0.08, z + 0.08, 0x6b4a2e);
    world.add(x - 0.08, x + 0.08, 0, 2.2, z - 0.08, z + 0.08, false);
  });
  for (let i = 0; i < 6; i++) {
    const z0 = 21.2 + i * 0.6;
    B.box(-24.3, -20.7, 2.2, 2.4, z0, z0 + 0.6, i % 2 ? 0xffffff : 0x2f7fd6);
  }
  world.add(-24.3, -20.7, 2.2, 2.4, 21.2, 24.8);
  // fruit on the counter
  for (let i = 0; i < 6; i++) B.cbox(-23.2 + i * 0.35, 1.12, 23, 0.24, 0.24, 0.24, [0xe94f3a, 0xf6c445, 0x6abf4b][i % 3]);
  crate(-20.6, -19.6, 0, 22.5, 23.5);
  // catwalk + billboard
  B.box(-25.6, -24.8, 3.2, 3.4, 20, 26, 0x5a5f66); world.add(-25.6, -24.8, 3.2, 3.4, 20, 26);
  B.box(-24.85, -24.8, 3.4, 4.0, 20, 26, 0x5a5f66);
  B.box(-26.4, -25.6, 3, 6, 20, 26, 0xf2f2f2); world.add(-26.4, -25.6, 3, 6, 20, 26);
  [20.5, 25.5].forEach((z) => {
    B.box(-26.2, -25.8, 0, 3, z - 0.2, z + 0.2, 0x5a5f66);
    world.add(-26.2, -25.8, 0, 3, z - 0.2, z + 0.2, false);
  });
}

/* ---------- bookshop-roof billboard frame ---------- */
B.box(-1.7, 7.7, 6.4, 10.4, -31.2, -30.8, 0xf2f2f2);
world.add(-1.7, 7.7, 6.3, 10.4, -31.2, -30.8);
[0, 6].forEach((x) => B.box(x - 0.15, x + 0.15, 6.3, 6.6, -31.6, -31.2, 0x5a5f66));

/* ---------- bus stop ---------- */
{
  B.box(-9, -5, 0, 2.4, 32.8, 33.0, 0xbcd4e0); world.add(-9, -5, 0, 2.4, 32.8, 33.0);
  B.box(-9.1, -8.9, 0, 2.4, 31, 33, 0xbcd4e0); world.add(-9.1, -8.9, 0, 2.4, 31, 33);
  B.box(-9.2, -4.8, 2.4, 2.6, 30.6, 33.2, 0x2f3b3a); world.add(-9.2, -4.8, 2.4, 2.6, 30.6, 33.2);
  B.box(-4.95, -4.85, 0, 2.4, 30.7, 30.8, 0x2f3b3a); world.add(-4.95, -4.85, 0, 2.4, 30.7, 30.8, false);
  B.box(-8.6, -5.4, 0.45, 0.55, 32.2, 32.75, 0xa0682e); world.add(-8.6, -5.4, 0, 0.55, 32.2, 32.75, false);
  const stop = signMesh('BUS', { w: 0.8, h: 0.8, bg: '#c0392b', fg: '#ffffff' });
  stop.position.set(-4.9, 2.1, 30.68); stop.rotation.y = Math.PI; scene.add(stop);
  const stop2 = stop.clone(); stop2.rotation.y = 0; stop2.position.z = 30.82; scene.add(stop2);
}

/* ---------- south hedge + low fences ---------- */
B.box(-11, 11, 0, 1.2, 39.5, 40.5, 0x3f8a3a); world.add(-11, 11, 0, 1.2, 39.5, 40.5);
{
  // low fence closing the gaps between corner buildings (instanced look via batching)
  const fenceRuns = [
    [-30, -28, 29.6, 29.6], [28, 30, 29.6, 29.6], [-29.6, -29.6, 28, 30], [29.6, 29.6, 16, 18],
    [-30, -28, -29.6, -29.6]
  ];
  for (const [xa, xb, za, zb] of fenceRuns) {
    const len = Math.hypot(xb - xa, zb - za);
    const n = Math.max(2, Math.round(len / 0.8) + 1);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = xa + (xb - xa) * t, z = za + (zb - za) * t;
      B.box(x - 0.08, x + 0.08, 0, 1.0, z - 0.08, z + 0.08, 0xffffff);
    }
    const ax = Math.min(xa, xb) - 0.05, bx = Math.max(xa, xb) + 0.05, az = Math.min(za, zb) - 0.05, bz = Math.max(za, zb) + 0.05;
    B.box(ax, bx, 0.75, 0.85, az, bz, 0xffffff);
    B.box(ax, bx, 0.35, 0.45, az, bz, 0xffffff);
    world.add(ax, bx, 0, 1.0, az, bz, false);
  }
}

/* ---------- noticeboard ---------- */
{
  const x = 4, z = 29;
  B.box(x - 0.1, x + 0.1, 0, 1.2, z - 0.05, z + 0.05, 0x6b4a2e);
  B.box(x - 1.3, x - 1.1, 0, 2.6, z - 0.1, z + 0.1, 0x6b4a2e);
  B.box(x + 1.1, x + 1.3, 0, 2.6, z - 0.1, z + 0.1, 0x6b4a2e);
  B.box(x - 1.4, x + 1.4, 2.6, 2.8, z - 0.25, z + 0.25, 0x8a5a3a);
  world.add(x - 1.3, x + 1.3, 0, 2.8, z - 0.15, z + 0.15);
  const boardTex = canvasTexture(256, 160, (ctx) => {
    ctx.fillStyle = '#c99a62'; ctx.fillRect(0, 0, 256, 160);
    const notes = [['#fff8c4', 14, 12, -0.05], ['#d6f0ff', 132, 18, 0.06], ['#ffd6e0', 40, 84, 0.04], ['#e0ffd6', 150, 92, -0.07]];
    notes.forEach(([c, nx, ny, r]) => {
      ctx.save(); ctx.translate(nx + 45, ny + 30); ctx.rotate(r);
      ctx.fillStyle = c; ctx.fillRect(-45, -30, 90, 60);
      ctx.fillStyle = '#555'; for (let i = 0; i < 3; i++) ctx.fillRect(-34, -14 + i * 12, 60 - i * 12, 3);
      ctx.restore();
    });
    ctx.fillStyle = '#156534'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('NOTICES', 128, 82);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshLambertMaterial({ map: boardTex }));
  board.position.set(x, 1.85, z + 0.16); scene.add(board);
  interactables.push({ x, z: z + 1.2, y: 0, r: 2.0, label: 'Read noticeboard', act: openNotice });
}

/* ---------- distant scenery: tree ring + hills + clouds ---------- */
{
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, r = 52 + (i % 3) * 5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 1.2 + (i % 4) * 0.25;
    B.box(x - 0.4, x + 0.4, 0, 2.6 * s, z - 0.4, z + 0.4, 0x7a5532);
    B.cbox(x, 3.4 * s, z, 3.2 * s, 2.2 * s, 3.2 * s, i % 2 ? 0x4f9a46 : 0x5aa651);
  }
  [[-70, -60, 30, 18], [60, -75, 40, 22], [85, 20, 30, 14], [-80, 40, 34, 16], [10, 85, 40, 12]].forEach(([x, z, w, h]) => {
    B.cbox(x, h / 2 - 1, z, w, h, w * 0.8, 0x8cc47a, { cast: false });
    B.cbox(x + 3, h - 1 + 2, z - 2, w * 0.6, 4, w * 0.5, 0x9ccf88, { cast: false });
  });
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39, r = 30 + (i * 13) % 50;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = 34 + (i % 4) * 4;
    B.cbox(x, y, z, 8 + (i % 3) * 3, 1.8, 5, 0xffffff, { cast: false });
    B.cbox(x + 1.5, y + 1.2, z, 4, 1.4, 3.4, 0xffffff, { cast: false });
  }
}

/* ---------- ad slots ---------- */
const adMeshes = [];
for (const slot of TOWN_ADS) {
  const tex = texLoader.load(slot.image);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(slot.size[0], slot.size[1]), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(...slot.position);
  m.rotation.y = slot.rotationY || 0;
  m.userData.slot = slot;
  scene.add(m);
  adMeshes.push(m);
  if (slot.link) {
    const nx = Math.sin(m.rotation.y), nz = Math.cos(m.rotation.y);
    interactables.push({
      x: slot.position[0] + nx * 1.5, z: slot.position[2] + nz * 1.5, y: Math.max(0, slot.position[1] - 2), r: 2.4,
      label: slot.label || 'Open ad',
      act: () => {
        const a = document.createElement('a');
        a.href = slot.link; a.target = '_blank'; a.rel = 'sponsored noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
    });
  }
}

B.build(scene);

/* =============== coins =============== */
function coinMesh(list, radius, color, emissive) {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.12, 20);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 0.55 });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
const coins = CONFIG.coins.map((c) => ({ ...c, golden: false, got: Save.hasCoin(c.id) }));
const goldens = CONFIG.goldenCoins.map((c) => ({ ...c, golden: true, got: Save.hasGolden(c.id) }));
const coinIM = coinMesh(coins, 0.36, 0xffc928, 0x6b4a00);
const goldIM = coinMesh(goldens, 0.55, 0xffe066, 0xb37400);
// golden coins get a soft glow so they're spottable from a distance
const glowTex = canvasTexture(64, 64, (ctx) => {
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,120,0.9)'); g.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
});
goldens.forEach((c) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, depthWrite: false, transparent: true }));
  s.scale.set(2.2, 2.2, 1); s.position.set(c.x, c.y, c.z); s.visible = !c.got;
  scene.add(s); c.glow = s;
});
const pops = [];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function updateCoins(t) {
  const write = (im, list, spin, bobAmp) => {
    list.forEach((c, i) => {
      if (c.got) _s.set(0, 0, 0); else _s.set(1, 1, 1);
      _q.setFromAxisAngle(_up, t * spin + i);
      _v.set(c.x, c.y + Math.sin(t * 2.4 + i) * bobAmp, c.z);
      _m4.compose(_v, _q, _s);
      im.setMatrixAt(i, _m4);
    });
    im.instanceMatrix.needsUpdate = true;
  };
  write(coinIM, coins, 2.6, 0.12);
  write(goldIM, goldens, 1.8, 0.18);
}
const popGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16).rotateX(Math.PI / 2);
function spawnPop(c) {
  const m = new THREE.Mesh(popGeo, new THREE.MeshBasicMaterial({ color: c.golden ? 0xfff2a8 : 0xffd84a, transparent: true }));
  m.position.set(c.x, c.y, c.z);
  m.userData.base = c.golden ? 1.5 : 1;
  scene.add(m);
  pops.push({ m, t: 0 });
}
function updatePops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t += dt;
    const k = p.t / 0.35;
    p.m.position.y += dt * 4;
    p.m.rotation.y += dt * 20;
    p.m.scale.setScalar((1 + k * 0.8) * (p.m.userData.base || 1));
    p.m.material.opacity = 1 - k;
    if (k >= 1) { scene.remove(p.m); p.m.material.dispose(); pops.splice(i, 1); }
  }
}

function checkPickups() {
  const px = player.pos.x, py = player.pos.y + 0.9, pz = player.pos.z;
  const test = (c) => !c.got && Math.abs(c.y - py) < 1.25 && (c.x - px) ** 2 + (c.z - pz) ** 2 < 0.95 * 0.95;
  for (const c of coins) {
    if (!test(c)) continue;
    c.got = true; Save.addCoin(c.id); Sfx.coin(); spawnPop(c);
    awardBadge('first-coin');
    if (Save.coinCount() >= coins.length) awardBadge('collector');
    refreshHud(true, false);
  }
  for (const c of goldens) {
    if (!test(c)) continue;
    c.got = true; Save.addGolden(c.id); Sfx.golden(); spawnPop(c);
    if (c.glow) c.glow.visible = false;
    toast(`⭐ Golden coin! (${Save.goldenCount()} / ${goldens.length})`);
    awardBadge('first-coin');
    if (Save.goldenCount() >= goldens.length) awardBadge('golden-hunter');
    refreshHud(false, true);
  }
}

/* =============== HUD =============== */
const hudCoins = $('hud-coins'), hudGold = $('hud-gold');
function refreshHud(popCoin, popGold) {
  hudCoins.textContent = `🪙 ${Save.coinCount()} / ${coins.length}`;
  hudGold.textContent = `⭐ ${Save.goldenCount()} / ${goldens.length}`;
  const pop = (el) => { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 130); };
  if (popCoin) pop(hudCoins);
  if (popGold) pop(hudGold);
}

/* =============== player / camera / input =============== */
const input = new Input(canvas);
const world_ = world;
const player = new Player(scene, world_);
const cam = new FollowCamera(camera, world_);
const spawn = CONFIG.spawns[spawnKey];
player.teleport(spawn.x, spawn.y, spawn.z, spawn.facing);
cam.snapBehind(spawn.facing);
player.onJump = () => Sfx.jump();
player.onLand = () => Sfx.land();

/* =============== interaction =============== */
let current = null;
function nearestInteractable() {
  let best = null, bd = Infinity;
  for (const o of interactables) {
    if (Math.abs(player.pos.y - o.y) > 2.5) continue;
    const d = Math.hypot(player.pos.x - o.x, player.pos.z - o.z);
    if (d < o.r && d < bd) { best = o; bd = d; }
  }
  return best;
}
function updateInteract() {
  const n = nearestInteractable();
  if (n !== current) { current = n; setPrompt(input, n ? n.label : null); }
  if (input.consumeInteract() && current) current.act();
}

let leaving = false;
async function enterBuilding(b) {
  if (leaving) return;
  leaving = true;
  input.setPlaying(false);
  setPrompt(input, null);
  await fadeOut();
  location.href = b.href;
}
// walking into a live building's door also enters it
function checkDoorWalkIn() {
  if (leaving) return;
  for (const d of liveDoors) {
    const dx = player.pos.x - d.x, dz = player.pos.z - d.z;
    const along = dx * d.nz - dz * d.nx;     // sideways offset from the door centre
    const out = dx * d.nx + dz * d.nz;       // distance in front of the door
    const into = -(player.vel.x * d.nx + player.vel.z * d.nz);
    if (Math.abs(along) < 0.95 && out < 0.15 && out > -0.5 && player.pos.y < d.y + 1 && into > 0.5) { enterBuilding(d.b); return; }
  }
}

/* =============== menus =============== */
let state = 'loading';   // loading | start | playing | paused | sign
function setState(s) {
  state = s;
  input.setPlaying(s === 'playing');
  input.consumePause();
  if (s !== 'playing') setPrompt(input, null), current = null;
  $('hud').hidden = !(s === 'playing' || s === 'paused' || s === 'sign');
  $('btn-pause').hidden = s !== 'playing';
}

function renderControls() {
  document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = controlsHelpHTML(input.touchMode); });
}
input.onTouchModeChange = renderControls;
renderControls();

function startPlaying() {
  Sfx.unlock();
  $('start-screen').hidden = true;
  cam.snapBehind(player.facing);
  setState('playing');
}
$('btn-play').addEventListener('click', startPlaying);

function openPause() {
  setState('paused');
  renderPause();
  $('pause').hidden = false;
}
function closePause() {
  $('pause').hidden = true;
  $('reset-confirm').hidden = true;
  setState('playing');
}
function renderPause() {
  $('stat-coins').textContent = `${Save.coinCount()} / ${coins.length}`;
  $('stat-gold').textContent = `${Save.goldenCount()} / ${goldens.length}`;
  const best = Save.get().bestEscapeMs;
  $('stat-escape').textContent = best ? fmtTime(best) : '—';
  $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on';
  const ul = $('badge-list');
  ul.innerHTML = '';
  for (const b of CONFIG.badges) {
    const li = document.createElement('li');
    if (Save.hasBadge(b.id)) li.classList.add('earned');
    li.innerHTML = `<span class="bi">${b.icon}</span><span><div class="bn"></div><div class="bd"></div></span>`;
    li.querySelector('.bn').textContent = b.name;
    li.querySelector('.bd').textContent = b.desc;
    ul.appendChild(li);
  }
}
function fmtTime(ms) {
  const total = ms / 1000, m = Math.floor(total / 60), s = (total - m * 60).toFixed(1);
  return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}
$('btn-pause').addEventListener('click', openPause);
$('btn-resume').addEventListener('click', closePause);
$('btn-help').addEventListener('click', () => { $('pause-help').hidden = !$('pause-help').hidden; });
$('btn-mute').addEventListener('click', () => { Save.setMuted(!Save.isMuted()); renderPause(); });
$('btn-respawn').addEventListener('click', () => {
  const s = CONFIG.spawns.default;
  player.teleport(s.x, s.y, s.z, s.facing); cam.snapBehind(s.facing);
  closePause();
});
$('btn-reset').addEventListener('click', () => { $('reset-confirm').hidden = false; });
$('btn-reset-no').addEventListener('click', () => { $('reset-confirm').hidden = true; });
$('btn-reset-yes').addEventListener('click', () => {
  Save.reset();
  coins.forEach((c) => { c.got = false; });
  goldens.forEach((c) => { c.got = false; if (c.glow) c.glow.visible = true; });
  refreshHud();
  renderPause();
  $('reset-confirm').hidden = true;
  toast('Progress reset.');
});

function openNotice() {
  setState('sign');
  $('notice').hidden = false;
}
$('btn-notice-close').addEventListener('click', () => { $('notice').hidden = true; setState('playing'); });

/* =============== main loop =============== */
const clock = new THREE.Clock();
let introYaw = 0;
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (state === 'playing') {
    if (input.consumePause()) openPause();
    player.update(dt, input, cam.yaw);
    checkPickups();
    updateInteract();
    checkDoorWalkIn();
    if (player.grounded && player.pos.y >= TOWER.h - 0.1 &&
        player.pos.x > TOWER.x0 && player.pos.x < TOWER.x1 && player.pos.z > TOWER.z0 && player.pos.z < TOWER.z1) {
      if (awardBadge('rooftop-runner')) toast('You made it to the top of the clock tower!');
    }
    cam.update(dt, player.pos, input);
  } else if (state === 'paused' || state === 'sign') {
    if (input.consumePause()) { if (state === 'paused') closePause(); else { $('notice').hidden = true; setState('playing'); } }
    cam.update(dt, player.pos, null);
  } else {
    // slow orbit behind the start screen
    introYaw += dt * 0.08;
    cam.yaw = spawn.facing + Math.PI + Math.sin(introYaw) * 0.5;
    player.update(dt, input, cam.yaw);
    cam.update(dt, player.pos, null);
  }

  updateCoins(t);
  updatePops(dt);
  if (waterMesh) waterMesh.position.y = 0.4 + Math.sin(t * 1.5) * 0.02;
  if (sprayMesh) { sprayMesh.rotation.y = t * 0.6; sprayMesh.scale.y = 1 + Math.sin(t * 6) * 0.06; }
  if (towerFlag) towerFlag.rotation.y = Math.sin(t * 2) * 0.25;
  if (towerBeacon) { towerBeacon.rotation.y = t; towerBeacon.position.y = 45 + Math.sin(t * 1.5) * 0.4; }
  if (flagMesh) flagMesh.rotation.y = Math.sin(t * 1.7) * 0.2;
  if ((Math.floor(t * 2) & 1) === 0 || clockHands._init !== true) {
    const d = new Date(), hr = (d.getHours() % 12) + d.getMinutes() / 60, mn = d.getMinutes() + d.getSeconds() / 60;
    clockHands.forEach(({ hour, min }) => { hour.rotation.z = -hr / 12 * Math.PI * 2; min.rotation.z = -mn / 60 * Math.PI * 2; });
    clockHands._init = true;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* =============== boot =============== */
refreshHud();
const finishLoading = () => {
  $('loading').hidden = true;
  if (spawnKey !== 'default') {
    // coming back from a building — straight into play
    $('start-screen').hidden = true;
    setState('playing');
    fadeIn();
    toast('Welcome back to town!');
    Save.takeToasts().forEach((m, i) => setTimeout(() => toast(m, { badge: true, ms: 3600 }), 400 + i * 600));
    history.replaceState(null, '', location.pathname);
  } else {
    setState('start');
    $('start-screen').hidden = false;
    const n = Save.coinCount() + Save.goldenCount();
    if (n > 0) $('start-progress').textContent = `Your progress: ${Save.coinCount()}/${coins.length} coins · ${Save.goldenCount()}/${goldens.length} golden · ${Object.keys(Save.get().badges).length}/${CONFIG.badges.length} badges`;
  }
};
manager.onLoad = finishLoading;
manager.onError = (url) => console.warn('Failed to load', url);
// If every texture was cached / there was nothing to load, onLoad may never fire.
if (TOWN_ADS.length === 0) setTimeout(finishLoading, 0);
// bfcache: coming "back" to this page should never leave it faded out
addEventListener('pageshow', (e) => { if (e.persisted) { leaving = false; fadeIn(); if (state !== 'start') setState('playing'); } });

tick();

// handy for debugging from the console
window.__bookTown = { player, cam, world, CONFIG, renderer };
