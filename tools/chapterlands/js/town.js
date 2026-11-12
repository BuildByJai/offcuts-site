// Chapterlands — Library Square, the seven library roads and the game loop.
// (Formerly Book Town.) A1 adds: catalogue-driven roads + plots under fog,
// the Lookout Tower, library card, side quests, Reading Room and the District
// Kit hooks (district panel → street games / Vault).
// Phase 3: toon lighting + day/night cycle + quality tiers (gfx.js), ambient
// life (life.js), juice (fx.js), the new move set (player.js), the movement
// playground (gadgets.js), shop, combo meter and time trials.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { World, Batcher, canvasTexture, signMesh } from './world.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { Save } from './save.js';
import { Sfx } from './audio.js';
import { toast, awardBadge, setPrompt, fadeOut, fadeIn, controlsHelpHTML, confetti } from './hud.js';
import { createGfx, qualityPicker, toon, addOutline, Sky, DayCycle, followShadow, U } from './gfx.js';
import { attachJuice, flyToHud, toScreen } from './fx.js';
import { Gadgets } from './gadgets.js';
import { TownLife } from './life.js';
import { MoveHud, Combo } from './movehud.js';
import { Trials } from './trials.js';
import { Shop } from './shop.js';
import { DebugPanel } from './debug.js';
import { Catalogue } from './catalogue.js';
import { buildRoads } from './roads.js';
import { buildLookout } from './lookout.js';
import { SideQuests } from './sidequests.js';
import { posterTexture } from './posters.js';
import { track } from './track.js';
import { grownUps, guardLinks } from './grownups.js';
import { renderLibraryCard, renderQuestLog, openDistrict, openReadingRoom, districtDone } from './library-ui.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const spawnParam = params.get('spawn');
const spawnKey = spawnParam && spawnParam !== 'default' && (CONFIG.spawns[spawnParam] || spawnParam.startsWith('plot:')) ? spawnParam : 'default';
const PAL = CONFIG.palette;

/* =============== catalogue (single source of truth for books) =============== */
document.title = `${CONFIG.gameName} — Offcuts`;
document.querySelectorAll('.game-name').forEach((el) => { el.textContent = CONFIG.gameName; });
document.querySelectorAll('.game-logo').forEach((el) => {
  const [a, b] = CONFIG.gameNameParts;
  el.innerHTML = (el.classList.contains('title-logo') ? '📚 ' : '') + a + '<b>' + b + '</b>';
});
guardLinks();
await Catalogue.load();
const LIVE_KITS = await Catalogue.liveKits();
for (const { book, kit } of LIVE_KITS) {
  book._kit = kit;
  // district badges (book.json unlock.badges) join the badge list
  for (const bd of (kit.unlock && kit.unlock.badges) || []) if (!CONFIG.badges.some((x) => x.id === bd.id)) CONFIG.badges.push(bd);
}
// A finished book's badges (some need more than one book: "Habit Historian").
function checkBookBadges() {
  for (const { kit } of LIVE_KITS) {
    for (const bd of (kit.unlock && kit.unlock.badges) || []) {
      if ((bd.requires || []).every((id) => Save.hasKey(id))) awardBadge(bd.id);
    }
  }
}

/* =============== renderer / scene =============== */
const canvas = $('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.sky, CONFIG.graphics.fog.near, CONFIG.graphics.fog.far);
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.1, 420);

const hemi = new THREE.HemisphereLight(0xdff1ff, 0x7a8a5a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dc, 2.4);
sun.castShadow = true;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const gfx = createGfx({ canvas, scene, camera, sun });
const renderer = gfx.renderer;
const sky = new Sky(scene);
const day = new DayCycle({ scene, sun, hemi, sky });
if (!params.has('time') && Save.timeOfDay() !== null) day.setLock(Save.timeOfDay());

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
const TIPS = [
  'Tap Jump again in mid-air for a double jump.',
  'Hold Charge (C) to wind up a super jump — let go to launch.',
  'Sprint, then Charge to slide. Jump out of a slide for a long jump.',
  'Chain tricks without touching the ground — the combo pays coins.',
  'The market stall sells new moves. Coins are never spent on jumping.',
  'Mushrooms bounce you high. Jump rings fling you to the next ring.',
  'Three time trials start at the chequered flags round the square.',
  'Jump into a zipline cable to ride it.',
  'Golden coins hide in sneaky spots — one is inside a cracked crate.'
];
const tipEl = document.querySelector('#loading .tip');
if (tipEl) tipEl.textContent = 'Tip: ' + TIPS[Math.floor(Math.random() * TIPS.length)];

/* =============== world =============== */
const world = new World();
const B = new Batcher();
const interactables = [];   // { x, z, y, r, label, act }

// ground + bounds
world.add(-90, 90, -1, 0, -90, 90, true);
// Chapterlands: the town opened up — the roads run out into the countryside,
// so the invisible wall moved from the edge of the square to the far meadow.
const BOUND = 235;
world.add(-BOUND - 1, -BOUND, -1, 60, -BOUND - 1, BOUND + 1, false);
world.add(BOUND, BOUND + 1, -1, 60, -BOUND - 1, BOUND + 1, false);
world.add(-BOUND - 1, BOUND + 1, -1, 60, -BOUND - 1, -BOUND, false);
world.add(-BOUND - 1, BOUND + 1, -1, 60, BOUND, BOUND + 1, false);
// is (x, z) on or beside one of the library roads? (keeps trees off them)
function nearRoad(x, z, pad = 14) {
  for (const R of CONFIG.roads) {
    const a = R.angle * Math.PI / 180, dx = Math.cos(a), dz = Math.sin(a);
    const [ox, oz] = R.out;
    const t = (x - ox) * dx + (z - oz) * dz;
    if (t < -20 || t > 210) continue;
    if (Math.abs(-(x - ox) * dz + (z - oz) * dx) < pad) return true;
  }
  return false;
}

// Ground: cobbled square, flagstone pavements beyond it, grass lawns with a
// stone kerb, and meadow outside the town. No flat single-colour ground.
const LAWNS = [
  { x0: -11, x1: -3, z0: 31, z1: 39, flowers: true }, { x0: 3, x1: 11, z0: 31, z1: 39, flowers: true },
  { x0: -28.6, x1: -21, z0: -19, z1: -8, flowers: true }, { x0: 21, x1: 28.6, z0: 17.5, z1: 28 },
  { x0: -44, x1: -30.5, z0: 29.5, z1: 30, bushes: false }
];
{
  const meadowTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#76b863'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = ['#6aa957', '#84c46c', '#7dbd66', '#5f9f4f'][i % 4];
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3 + Math.random() * 4);
    }
  });
  meadowTex.wrapS = meadowTex.wrapT = THREE.RepeatWrapping;
  meadowTex.repeat.set(130, 130);
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), toon({ map: meadowTex }));
  meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.02; meadow.receiveShadow = true;
  scene.add(meadow);

  // flagstone pavement for the whole town block
  const flagTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#b9ad98'; ctx.fillRect(0, 0, 256, 256);
    const rows = [0, 64, 128, 192];
    rows.forEach((y, r) => {
      let x = r % 2 ? -40 : 0;
      while (x < 256) {
        const w = 56 + ((x * 7 + r * 13) % 40);
        const shade = 196 + ((x + r * 31) % 22);
        ctx.fillStyle = `rgb(${shade + 20},${shade + 10},${shade - 8})`;
        ctx.fillRect(x + 2, y + 2, w - 4, 60);
        ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(x + 2, y + 50, w - 4, 12);
        x += w;
      }
    });
  });
  flagTex.wrapS = flagTex.wrapT = THREE.RepeatWrapping;
  flagTex.repeat.set(16, 16);
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(89, 89), toon({ map: flagTex }));
  pave.rotation.x = -Math.PI / 2; pave.position.y = 0; pave.receiveShadow = true;
  scene.add(pave);

  // cobbles on the square itself
  const cobTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#8f7f6c'; ctx.fillRect(0, 0, 256, 256);
    const s = 32;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) {
      const x = c * s + (r % 2) * (s / 2) - s / 2 + 2, y = r * s + 2;
      const v = 168 + ((r * 37 + c * 53) % 30);
      ctx.fillStyle = `rgb(${v + 18},${v + 4},${v - 18})`;
      ctx.beginPath();
      ctx.ellipse(x + s / 2 - 2, y + s / 2 - 2, s / 2 - 3, s / 2 - 4, ((r + c) % 3) * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.ellipse(x + s / 2 - 5, y + s / 2 - 6, s / 4, s / 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  });
  cobTex.wrapS = cobTex.wrapT = THREE.RepeatWrapping;
  cobTex.repeat.set(26, 26);
  const square = new THREE.Mesh(new THREE.PlaneGeometry(58, 58), toon({ map: cobTex }));
  square.rotation.x = -Math.PI / 2; square.position.y = 0.006; square.receiveShadow = true;
  scene.add(square);
  // decorative compass rose of lighter stones round the fountain
  const rose = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.4, 48), toon({ color: 0xe6dcc6 }));
  rose.rotation.x = -Math.PI / 2; rose.position.y = 0.012; rose.receiveShadow = true;
  scene.add(rose);

  // kerb between the cobbles and the pavement
  const KERB = 0xcfc5b2;
  B.box(-29.2, 29.2, 0, 0.12, -29.2, -28.8, KERB, { cast: false });
  B.box(-29.2, 29.2, 0, 0.12, 28.8, 29.2, KERB, { cast: false });
  B.box(-29.2, -28.8, 0, 0.12, -28.8, 28.8, KERB, { cast: false });
  B.box(28.8, 29.2, 0, 0.12, -28.8, 28.8, KERB, { cast: false });

  // lawns with kerbs
  const grassTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#6fb35b'; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = ['#64a852', '#7cc06a', '#5c9d4c', '#88c873'][i % 4]; ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2 + Math.random() * 3); }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  const grassMat = toon({ map: grassTex });
  for (const L of LAWNS) {
    const w = L.x1 - L.x0, d = L.z1 - L.z0;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassMat);
    g.rotation.x = -Math.PI / 2; g.position.set((L.x0 + L.x1) / 2, 0.02, (L.z0 + L.z1) / 2); g.receiveShadow = true;
    scene.add(g);
    if (L.bushes === false) continue;
    B.box(L.x0 - 0.15, L.x1 + 0.15, 0, 0.14, L.z0 - 0.15, L.z0 + 0.05, KERB, { cast: false });
    B.box(L.x0 - 0.15, L.x1 + 0.15, 0, 0.14, L.z1 - 0.05, L.z1 + 0.15, KERB, { cast: false });
    B.box(L.x0 - 0.15, L.x0 + 0.05, 0, 0.14, L.z0, L.z1, KERB, { cast: false });
    B.box(L.x1 - 0.05, L.x1 + 0.15, 0, 0.14, L.z0, L.z1, KERB, { cast: false });
  }
  grassTex.repeat.set(4, 4);
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
  F.box = (u0, u1, y0, y1, o0, o1, color, collide = false, cam = true, opts = {}) => {
    const a = F.pt(u0, y0, o0), c = F.pt(u1, y1, o1);
    B.box(a[0], c[0], a[1], c[1], a[2], c[2], color, opts);
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

/* ---------- flags / awnings that ripple in the wind ---------- */
// Geometry should start at x = 0 (the pole) and extend along +x.
function rippleMat(color, { amp = 0.14, freq = 5, axis = 'z' } = {}) {
  const m = toon({ color, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = clamp(position.x, 0.0, 3.0);
        transformed.${axis} += sin(uTime * ${freq.toFixed(1)} - position.x * 4.0) * ${amp.toFixed(3)} * w;`);
  };
  m.customProgramCacheKey = () => `ripple-${amp}-${freq}-${axis}`;
  return m;
}

/* ---------- padlock model for locked doors ---------- */
function padlock() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.14), toon({ color: 0xd4a017 }));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12, Math.PI), toon({ color: 0x9aa3ad }));
  shackle.position.y = 0.2;
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  hole.position.set(0, -0.02, 0.08);
  g.add(body, shackle, hole);
  return g;
}

/* ---------- buildings ---------- */
const GLASS = 0x9ccfe8, DOOR = 0x5a3a24;
const liveDoors = [];   // walk-in doors for live buildings
const swingDoors = [];  // hinged door meshes
const nightSigns = [];  // signs that light up after dark
const shopWindows = []; // painted shop interiors, built after the buildings
const INTERIOR_STYLE = { shop: 'shop', cafe: 'cafe', cinema: 'cinema' };
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

  // windows on the front facade — glass glows warm at night; ground-floor shop
  // windows get a painted interior so the shops look lived-in
  const step = 3.2;
  const interior = INTERIOR_STYLE[b.style];
  for (let y = 1.3; y + 1.3 < h - 0.5; y += 2.4) {
    for (let u = F.u0 + 2; u <= F.u1 - 2; u += step) {
      if (doorAt !== null && Math.abs(u - doorAt) < (b.style === 'library' ? 7.8 : 2.4)) continue;
      if (b.style === 'cinema' && y > 2 && Math.abs(u - doorAt) < 6) continue;
      if (overlapsAd(F, b, u - 0.7, u + 0.7, y, y + 1.3)) continue;
      if (interior && y < 2 && b.door) {
        shopWindows.push({ style: interior, F, u, y });
      } else {
        F.box(u - 0.65, u + 0.65, y, y + 1.25, 0, 0.06, (Math.round(u * 3 + y) % 3) ? GLASS : 0xb8dcef, false, true, { bucket: 'glow', shade: false });
      }
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
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1, 12, 2).translate(0.8, 0, 0), rippleMat(0x156534));
    flag.position.set(17.02, h + 3.9, -31.94); scene.add(flag); flagMesh = flag;
    const hallSign = signMesh('TOWN HALL', { w: 7, h: 0.9, bg: '#8a8273', fg: '#fffaf0', style: 'serif' });
    F.place(hallSign, 17, h - 1.6, 0.82);
  }

  if (!b.door) return;

  // ----- door ----- (live doors are real hinged meshes that swing open as you approach)
  if (b.status === 'live') {
    const hinge = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.1), toon({ color: DOOR }));
    panel.position.set(0.9, 1.25, 0.05); panel.castShadow = true;
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), toon({ color: 0xd4a017 }));
    knob.position.set(1.48, 1.22, 0.13);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.02), Batcher.glowMaterial());
    win.position.set(0.9, 1.85, 0.11);
    hinge.add(panel, knob, win);
    addOutline(hinge);
    // dark doorway behind the panel
    F.box(doorAt - 0.9, doorAt + 0.9, doorBase, doorBase + 2.5, 0, 0.02, 0x1b140f);
    // hinge on whichever jamb makes the panel's local +x run across the doorway
    const lx = Math.cos(F.rot), lz = -Math.sin(F.rot);
    const uAlong = (F.face === 'south' || F.face === 'north') ? lx : lz;
    const hp = F.pt(doorAt + (uAlong < 0 ? 0.9 : -0.9), doorBase, 0.02);
    hinge.position.set(hp[0], hp[1], hp[2]);
    hinge.rotation.y = F.rot;
    scene.add(hinge);
    swingDoors.push({ hinge, base: F.rot, x: F.pt(doorAt, 0, 1)[0], z: F.pt(doorAt, 0, 1)[2], open: 0 });
  } else F.box(doorAt - 0.9, doorAt + 0.9, doorBase, doorBase + 2.5, 0, 0.1, DOOR);
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
  if (b.sign) {
  const signO = b.style === 'cinema' ? 1.42 : 0.14;
  const sw = b.style === 'library' ? 7.6 : Math.min(7, Math.max(3.2, b.sign.length * 0.62));
  const sign = signMesh(b.sign, {
    w: sw, h: b.style === 'library' ? 1.1 : 0.9,
    bg: b.style === 'library' ? '#1f3b2c' : '#' + b.trim.toString(16).padStart(6, '0'),
    fg: b.style === 'library' ? '#f5e7c4' : (b.trim > 0xaaaaaa ? '#2a2420' : '#ffffff'),
    border: b.style === 'library' ? '#c9a24a' : null,
    style: b.style === 'library' || b.style === 'cinema' || b.style === 'cafe' ? 'serif' : 'sans',
    glow: true
  });
  nightSigns.push(sign);
  F.place(sign, doorAt, signY, signO);
  }

  const doorPoint = F.pt(doorAt, 0, 1.3);
  const nrm = { south: [0, 1], north: [0, -1], west: [-1, 0], east: [1, 0] }[F.face];
  if (b.status === 'live') {
    liveDoors.push({ b, x: F.pt(doorAt, 0, 0.6)[0], z: F.pt(doorAt, 0, 0.6)[2], nx: nrm[0], nz: nrm[1], y: doorBase });
    // glowing "OPEN" board + welcome mat
    const open = signMesh('OPEN', { w: 1.4, h: 0.6, bg: '#156534', fg: '#ffffff', glow: true });
    F.place(open, doorAt + 2.1, doorBase + 1.6, 0.14);
    nightSigns.push(open);
    interactables.push({ x: doorPoint[0], z: doorPoint[2], y: 0, r: 1.9, label: `Enter ${b.name}`, icon: b.icon || '🚪', marker: true, iconY: doorBase + 3.6, act: () => enterBuilding(b) });
  } else if (b.status === 'open') {
    // open for a chat, not a separate game (the café)
    const open = signMesh('OPEN', { w: 1.4, h: 0.6, bg: '#156534', fg: '#ffffff', glow: true });
    F.place(open, doorAt + 2.1, doorBase + 1.6, 0.14);
    nightSigns.push(open);
    interactables.push({ x: doorPoint[0], z: doorPoint[2], y: 0, r: 2.0, label: `Visit the ${b.name.toLowerCase()}`, icon: '☕', marker: true, iconY: doorBase + 3.4,
      act: () => sayLine('the café owner', cafeLine()) });
  } else if (b.plot) {
    // plots handle their own interactions (see roads.js)
  } else {
    const lock = padlock();
    F.place(lock, doorAt, doorBase + 1.25, 0.2);
    const soon = signMesh('COMING SOON', { w: 2.1, h: 0.5, bg: '#fff4c2', fg: '#7a5a00', px: 60 });
    const sp = F.pt(doorAt, doorBase + 2.05, 0.22);
    soon.position.set(sp[0], sp[1], sp[2]); soon.rotation.y = F.rot; soon.rotation.z = -0.06;
    scene.add(soon);
    interactables.push({ x: doorPoint[0], z: doorPoint[2], y: 0, r: 2.0, label: `${b.name} (coming soon)`, icon: '🔒', marker: true, iconY: doorBase + 3.4,
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
  // scalloped fringe that ripples in the breeze
  const fringe = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 0.32, 22, 1).translate((z1 - z0) / 2, 0, 0), rippleMat(0xd8452f, { amp: 0.03, freq: 3, axis: 'z' }));
  fringe.position.set(x0 - 0.04, 2.46, z0); fringe.rotation.y = -Math.PI / 2;
  scene.add(fringe);
  // café tables (step-up height)
  [[26.5, 12.8], [25.6, 9.4]].forEach(([x, z]) => {
    B.box(x - 0.08, x + 0.08, 0, 0.75, z - 0.08, z + 0.08, 0x333333);
    B.box(x - 0.55, x + 0.55, 0.75, 0.82, z - 0.55, z + 0.55, 0xffffff);
    world.add(x - 0.55, x + 0.55, 0, 0.82, z - 0.55, z + 0.55, false);
  });
}

CONFIG.buildings.forEach(buildBuilding);

/* ---------- the seven library roads, their plots and the Lookout Towers ---------- */
const lookouts = [];
const ROADS = buildRoads({
  scene, world, B, buildBuilding, interactables,
  onPlot: (book) => enterDistrict(book),
  onLockedPlot: (book, what) => lockedPlot(book, what)
});
for (const arch of ROADS.arches) nightSigns.push(arch);
for (const cfg of CONFIG.lookoutTowers.concat(Save.DEBUG ? CONFIG.debugTowers : [])) {
  const road = ROADS.roads[cfg.quarter];
  if (!road) continue;
  lookouts.push(buildLookout({ cfg, road, scene, world, B, interactables, hooks: {
    telescope: (T) => useTelescope(T),
    toast: (m) => toast(m),
    sfx: () => Sfx.beep(true),
    teleport: (x, y, z) => { player.teleport(x, y, z, player.facing); cam.snapBehind(player.facing); }
  } }));
}
// series bridges: a sequel's plot is cut off by a little stream until you hold the Key
for (const plot of Object.values(ROADS.plots)) {
  const need = plot.book.requiresKey;
  if (!need) continue;
  const f = plot.front, D = plot.road.D;
  const sx = f.x + (plot.face === 'east' ? 1.6 : plot.face === 'west' ? -1.6 : 0), sz = f.z + (plot.face === 'south' ? 1.6 : plot.face === 'north' ? -1.6 : 0);
  const along = plot.face === 'east' || plot.face === 'west' ? 'z' : 'x';
  const half = 7.5;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(along === 'x' ? half * 2 : 2.2, along === 'x' ? 2.2 : half * 2), toon({ color: 0x3fa6d8, emissive: 0x1a4a6a, emissiveIntensity: 0.25 }));
  water.rotation.x = -Math.PI / 2; water.position.set(sx, 0.03, sz); scene.add(water);
  const built = Save.hasKey(need);
  // bridge deck (planks) — whole when built, just the posts until then
  for (let k = -1; k <= 1; k += 2) {
    const px = along === 'x' ? sx + k * 1.3 : sx, pz = along === 'x' ? sz : sz + k * 1.3;
    B.box(px - 0.15, px + 0.15, 0, 1.1, pz - 0.15, pz + 0.15, 0x6b4a2e);
  }
  if (built) B.box(sx - (along === 'x' ? 1.4 : 1.3), sx + (along === 'x' ? 1.4 : 1.3), 0.02, 0.22, sz - (along === 'x' ? 1.3 : 1.4), sz + (along === 'x' ? 1.3 : 1.4), 0xa0682e, { cast: false });
  else {
    // without the bridge you can't get to the door
    world.add(sx - (along === 'x' ? half : 1.1), sx + (along === 'x' ? half : 1.1), 0, 3, sz - (along === 'x' ? 1.1 : half), sz + (along === 'x' ? 1.1 : half), false);
    const prev = Catalogue.getBook(need);
    interactables.push({ x: f.x - (sx - f.x) * 0.2, z: f.z - (sz - f.z) * 0.2, y: 0, r: 3.2, label: 'The bridge isn\'t built yet',
      act: () => toast(`You need the ${Catalogue.keyName(prev)} Key. Finish ${prev.title} to earn it — that builds the bridge.`) });
  }
}

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
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8, 12, 2).translate(0.7, 0, 0), rippleMat(0xf2b705));
  pennant.position.set(cx + 0.02, h + 3.5, cz); scene.add(pennant);
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
  const faceMat = toon({ map: faceTex, emissive: 0xfff2c8, emissiveMap: faceTex, emissiveIntensity: 0 });
  nightSigns.push({ material: faceMat });
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
let waterMesh = null, sprayMesh = null, fountainTex = null;
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
  const rippleTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#3fa6d8'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) { ctx.beginPath(); const x = (i * 37) % 128, y = (i * 53) % 128; ctx.ellipse(x, y, 10 + (i % 4) * 4, 4 + (i % 3) * 2, 0, 0, Math.PI * 2); ctx.stroke(); }
  });
  rippleTex.wrapS = rippleTex.wrapT = THREE.RepeatWrapping;
  rippleTex.repeat.set(2, 2);
  fountainTex = rippleTex;
  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), toon({ map: rippleTex, transparent: true, opacity: 0.88, emissive: 0x1a4a6a, emissiveIntensity: 0.25 }));
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
// Trees are instanced + wind-swayed in life.js; here we just record spots and
// add trunk colliders. Each square tree sits in a round grass bed.
const treeSpots = [];
const bedTex = canvasTexture(64, 64, (ctx) => {
  ctx.fillStyle = '#6fb35b'; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#cfc5b2'; ctx.lineWidth = 4; ctx.stroke();
});
const bedMat = toon({ map: bedTex, transparent: true, alphaTest: 0.5 });
function tree(x, z, s = 1, bed = true) {
  world.add(x - 0.35, x + 0.35, 0, 2.6 * s, z - 0.35, z + 0.35, false);
  treeSpots.push({ x, z, s, bed });
  if (bed) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), bedMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.018, z); m.receiveShadow = true;
    scene.add(m);
  }
}
[[-16, -6], [16, -16], [-16, 16], [16, 16], [-20, 26], [20, 26], [-22, -24], [10, 24], [24.5, 22.5], [-24.5, -13.5], [-7, 35], [7, 35]].forEach(([x, z]) => tree(x, z));

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

const lampSpots = [];
function lamp(x, z) {
  lampSpots.push([x, z]);
  B.box(x - 0.1, x + 0.1, 0, 4, z - 0.1, z + 0.1, 0x2f3b3a);
  B.box(x - 0.18, x + 0.18, 0, 0.35, z - 0.18, z + 0.18, 0x2f3b3a, { ao: 0 });
  B.box(x - 0.3, x + 0.3, 4, 4.5, z - 0.3, z + 0.3, 0xffe9a8, { bucket: 'glow', shade: false });
  B.box(x - 0.35, x + 0.35, 4.5, 4.62, z - 0.35, z + 0.35, 0x2f3b3a);
  world.add(x - 0.15, x + 0.15, 0, 4.6, z - 0.15, z + 0.15, false);
}
[[-10, -10], [10, -10], [-10, 10], [10, 10], [-24, 0], [24, 0], [-6, 29], [6, 29], [-26, -27], [14, -27], [-26, 27], [26, -1]].forEach(([x, z]) => lamp(x, z));

function bin(x, z) {
  B.box(x - 0.45, x + 0.45, 0, 1.2, z - 0.45, z + 0.45, 0x3d6b4f);
  B.box(x - 0.5, x + 0.5, 1.2, 1.3, z - 0.5, z + 0.5, 0x2d5240);
  world.add(x - 0.5, x + 0.5, 0, 1.3, z - 0.5, z + 0.5);
}
bin(-27, 5.5);

// flower planters along the square edge (flowers themselves are instanced in life.js)
const PLANTERS = [[-20, 28.6], [20, 28.6], [28.6, 24], [-28.6, -24], [-12, -28.6], [12, 28.6]];
PLANTERS.forEach(([x, z]) => {
  B.box(x - 1.2, x + 1.2, 0, 0.45, z - 0.5, z + 0.5, 0x8a6a4a);
  B.box(x - 1.1, x + 1.1, 0.45, 0.55, z - 0.4, z + 0.4, 0x5a3a24, { cast: false });
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
  const shopSign = signMesh('MOVES & BOOSTS', { w: 3.4, h: 0.7, bg: '#2f7fd6', fg: '#ffffff', glow: true });
  shopSign.position.set(-20.66, 2.85, 23); shopSign.rotation.y = Math.PI / 2; scene.add(shopSign);
  nightSigns.push(shopSign);
  B.box(-20.75, -20.62, 2.4, 3.25, 21.2, 21.4, 0x6b4a2e); B.box(-20.75, -20.62, 2.4, 3.25, 24.6, 24.8, 0x6b4a2e);
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
// south hedge, with a gap for the Adventure road
B.box(-11, -3.2, 0, 1.2, 39.5, 40.5, 0x3f8a3a); world.add(-11, -3.2, 0, 1.2, 39.5, 40.5);
B.box(3.2, 11, 0, 1.2, 39.5, 40.5, 0x3f8a3a); world.add(3.2, 11, 0, 1.2, 39.5, 40.5);
{
  // low fence closing the gaps between corner buildings (instanced look via batching)
  // (Chapterlands: the NW, SW and SE corner gaps are now road exits)
  const fenceRuns = [
    [28, 30, 29.6, 29.6]
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
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), toon({ map: boardTex }));
  board.position.set(x, 1.85, z + 0.16); scene.add(board);
  interactables.push({ x, z: z + 1.2, y: 0, r: 2.0, label: 'Read noticeboard', act: openNotice });
}

/* ---------- distant scenery: tree ring + hills + clouds ---------- */
function nearAnyPlot(x, z) {
  for (const p of Object.values(ROADS.plots)) if (Math.abs(x - p.c.x) < 12 && Math.abs(z - p.c.z) < 12) return true;
  for (const T of lookouts) if (Math.hypot(x - T.base.x, z - T.base.z) < 10) return true;
  return false;
}
{
  // a ring of trees round the old town edge, and copses between the roads further out
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, r = 52 + (i % 3) * 5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!nearRoad(x, z) && !nearAnyPlot(x, z)) treeSpots.push({ x, z, s: 1.2 + (i % 4) * 0.25, bed: false });
  }
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + (i % 5) * 0.03, r = 95 + ((i * 37) % 5) * 22;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!nearRoad(x, z, 20) && !nearAnyPlot(x, z)) treeSpots.push({ x, z, s: 1.3 + (i % 4) * 0.3, bed: false });
  }
  // hills sit in the gaps between roads, beyond the last plots
  [[247.5, 205, 50, 22], [202.5, 205, 56, 18], [157.5, 205, 52, 20], [112.5, 205, 50, 16], [67.5, 205, 54, 18], [22.5, 205, 50, 20], [315, 120, 70, 30], [300, 200, 60, 24], [330, 200, 60, 20]]
    .map(([ang, r, w, h]) => [Math.cos(ang * Math.PI / 180) * r, Math.sin(ang * Math.PI / 180) * r, w, h])
    .filter(([x, z, w]) => !nearRoad(x, z, w / 2 + 6)).forEach(([x, z, w, h]) => {
    B.cbox(x, h / 2 - 1, z, w, h, w * 0.8, 0x8cc47a, { cast: false, shade: false });
    B.cbox(x + 3, h - 1 + 2, z - 2, w * 0.6, 4, w * 0.5, 0x9ccf88, { cast: false, shade: false });
  });
  // (clouds are instanced and drift — see Sky in gfx.js)
}


/* ---------- ad slots: framed, spot-lit at night, with a shine sweep ---------- */
const adMeshes = [];
const adSpots = [];
function shineMaterial(tex) {
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float sweep = fract(uTime * 0.11) * 3.2 - 1.1;
        float band = smoothstep(0.09, 0.0, abs(vMapUv.x * 0.8 + vMapUv.y * 0.4 - sweep));
        diffuseColor.rgb += band * 0.32;`);
  };
  return m;
}
const beamTex = canvasTexture(32, 128, (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 128);
});
TOWN_ADS.forEach((slot, si) => {
  // library noticeboard posters, drawn from the catalogue (no external images or links)
  const tex = posterTexture(slot, si);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(slot.size[0], slot.size[1]), shineMaterial(tex));
  m.position.set(...slot.position);
  m.rotation.y = slot.rotationY || 0;
  m.userData.slot = slot;
  scene.add(m);
  adMeshes.push(m);
  // frame: four bars just proud of the panel
  const [w, hh] = slot.size, ry = slot.rotationY || 0;
  const nx = Math.sin(ry), nz = Math.cos(ry), tx = Math.cos(ry), tz = -Math.sin(ry);
  const fr = 0.14;
  const bar = (u, v, bw, bh) => {
    const cx = slot.position[0] + tx * u + nx * 0.03, cz = slot.position[2] + tz * u + nz * 0.03, cy = slot.position[1] + v;
    const ax = Math.abs(tx) * bw + Math.abs(nx) * 0.12, az = Math.abs(tz) * bw + Math.abs(nz) * 0.12;
    B.box(cx - ax / 2, cx + ax / 2, cy - bh / 2, cy + bh / 2, cz - az / 2, cz + az / 2, 0x2a2420, { ao: 0 });
  };
  bar(0, hh / 2 + fr / 2, w + fr * 2, fr); bar(0, -hh / 2 - fr / 2, w + fr * 2, fr);
  bar(-w / 2 - fr / 2, 0, fr, hh); bar(w / 2 + fr / 2, 0, fr, hh);
  // spotlight housing above, beam visible after dark
  const lx = slot.position[0] + nx * 0.7, lz = slot.position[2] + nz * 0.7, ly = slot.position[1] + hh / 2 + 0.35;
  B.box(lx - 0.18, lx + 0.18, ly - 0.1, ly + 0.1, lz - 0.18, lz + 0.18, 0x2f3b3a, { ao: 0 });
  B.box(lx - 0.12, lx + 0.12, ly - 0.14, ly - 0.08, lz - 0.12, lz + 0.12, 0xfff2c8, { bucket: 'glow', ao: 0, shade: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, hh) * 0.5, hh + 0.4, 16, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(slot.position[0] + nx * 0.45, slot.position[1] + 0.1, slot.position[2] + nz * 0.45);
  beam.rotation.y = ry;
  beam.scale.set(1, 1, 0.3);
  scene.add(beam);
  adSpots.push(beam);
  // A1 §6: no external links on noticeboards in this phase. If a sponsor
  // placement ever returns, its link goes through the grown-up check.
  if (slot.link) {
    interactables.push({
      x: slot.position[0] + nx * 1.5, z: slot.position[2] + nz * 1.5, y: Math.max(0, slot.position[1] - 2), r: 2.4,
      label: slot.label || 'Noticeboard',
      act: () => grownUps({ title: 'Sponsor', links: [{ label: slot.label || 'Visit', href: slot.link, sponsored: true }] })
    });
  }
});

/* ---------- painted shop interiors (glow at night) ---------- */
const interiorTex = {};
function paintInterior(style) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = style === 'cinema' ? '#3a1d23' : '#f3e2c0'; ctx.fillRect(0, 0, 128, 128);
    if (style === 'shop') {
      ctx.fillStyle = '#7a5236';
      for (let y = 30; y < 128; y += 32) ctx.fillRect(4, y, 120, 5);
      const cols = ['#8a3a3a', '#3a6b4a', '#35507a', '#b08a3a', '#6a4a80', '#d8452f'];
      for (let y = 6; y < 120; y += 32) for (let x = 6, i = 0; x < 120; i++) { const w = 6 + ((x + y) % 5); ctx.fillStyle = cols[(i + y) % cols.length]; ctx.fillRect(x, y + ((i * 3) % 6), w, 24 - ((i * 3) % 6)); x += w + 1; }
    } else if (style === 'cafe') {
      ctx.fillStyle = '#6b4226'; ctx.fillRect(0, 84, 128, 44);
      ctx.fillStyle = '#ffffff'; [16, 48, 80, 104].forEach((x) => { ctx.fillRect(x, 70, 14, 14); ctx.fillRect(x + 13, 74, 4, 6); });
      ctx.fillStyle = '#c0583f'; ctx.beginPath(); ctx.arc(64, 30, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6d77a'; ctx.font = 'bold 16px Georgia'; ctx.textAlign = 'center'; ctx.fillText('☕', 64, 36);
    } else {
      [['#f6d77a', 8], ['#d8452f', 68]].forEach(([c, x]) => { ctx.fillStyle = c; ctx.fillRect(x, 14, 52, 76); ctx.fillStyle = '#2a0f12'; ctx.fillRect(x + 6, 22, 40, 40); });
      ctx.fillStyle = '#ffe9a0'; for (let x = 4; x < 128; x += 12) ctx.fillRect(x, 104, 6, 6);
    }
    const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.3, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
}
const interiorMats = [];
{
  const byStyle = {};
  for (const w of shopWindows) (byStyle[w.style] || (byStyle[w.style] = [])).push(w);
  for (const [style, list] of Object.entries(byStyle)) {
    const tex = interiorTex[style] || (interiorTex[style] = paintInterior(style));
    const mat = toon({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05 });
    interiorMats.push(mat);
    for (const { F, u, y } of list) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.25), mat);
      F.place(m, u, y + 0.625, 0.065);
    }
  }
}

B.build(scene);

/* =============== coins =============== */
const coinMat = toon({ color: 0xffc928, emissive: 0x8a5a00, emissiveIntensity: 0.55 });
const goldMat = toon({ color: 0xffe066, emissive: 0xc08000, emissiveIntensity: 0.7 });
function coinMesh(list, radius, mat) {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.12, 20);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  // inverted-hull outline, sharing the instance transforms
  const hull = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: CONFIG.graphics.outlineColor, side: THREE.BackSide }), list.length);
  hull.frustumCulled = false;
  scene.add(hull);
  mesh.userData.hull = hull;
  return mesh;
}
const coins = CONFIG.coins.map((c) => ({ ...c, golden: false, got: Save.hasCoin(c.id), cx: c.x, cy: c.y, cz: c.z, pull: 0 }));
const goldens = CONFIG.goldenCoins.map((c) => ({ ...c, golden: true, got: Save.hasGolden(c.id), cx: c.x, cy: c.y, cz: c.z, pull: 0 }));
const coinIM = coinMesh(coins, 0.36, coinMat);
const goldIM = coinMesh(goldens, 0.55, goldMat);
// soft glow behind every coin: one Points draw call each
const glowTex = canvasTexture(64, 64, (ctx) => {
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,120,0.95)'); g.addColorStop(0.4, 'rgba(255,210,90,0.35)'); g.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
});
function glowPoints(list, size) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(list.length * 3), 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
  p.frustumCulled = false;
  scene.add(p);
  return p;
}
const coinGlow = glowPoints(coins, 1.3), goldGlow = glowPoints(goldens, 3.0);
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function coinVisible(c) {
  if (c.got) return false;
  if (c.crate) { const k = gadgets.crateById(c.crate); return !!(k && k.broken); }
  return true;
}
function updateCoins(t, dt) {
  const write = (im, list, glow, spin, bobAmp) => {
    const gp = glow.geometry.attributes.position;
    list.forEach((c, i) => {
      const vis = coinVisible(c);
      if (!vis) _s.set(0, 0, 0); else _s.set(1, 1, 1);
      _q.setFromAxisAngle(_up, t * spin + i);
      _v.set(c.cx, c.cy + (c.pull ? 0 : Math.sin(t * 2.4 + i) * bobAmp), c.cz);
      _m4.compose(_v, _q, _s);
      im.setMatrixAt(i, _m4);
      _s.multiplyScalar(1.16);
      im.userData.hull.setMatrixAt(i, _m4.compose(_v, _q, _s));
      if (vis) gp.setXYZ(i, _v.x, _v.y, _v.z); else gp.setXYZ(i, 0, -999, 0);
    });
    im.instanceMatrix.needsUpdate = true;
    im.userData.hull.instanceMatrix.needsUpdate = true;
    gp.needsUpdate = true;
  };
  write(coinIM, coins, coinGlow, 2.6, 0.12);
  write(goldIM, goldens, goldGlow, 1.8, 0.18);
  // a sparkle now and then from a nearby coin
  if (Math.random() < dt * 6) {
    const c = coins[(Math.random() * coins.length) | 0];
    if (coinVisible(c) && Math.hypot(c.cx - player.pos.x, c.cz - player.pos.z) < 25) juice.spark.emit(c.cx + (Math.random() - 0.5) * 0.6, c.cy + (Math.random() - 0.5) * 0.6, c.cz, { vy: 0.4, color: 0xfff2a8, size: 0.3, size1: 0.02, life: 0.6 });
  }
  for (const c of goldens) if (coinVisible(c) && Math.random() < dt * 4) juice.spark.emit(c.cx + (Math.random() - 0.5), c.cy + (Math.random() - 0.5), c.cz + (Math.random() - 0.5), { vy: 0.6, color: 0xffe066, size: 0.4, size1: 0.02, life: 0.8 });
}
// Coin magnet boost: nearby coins drift into you.
function magnetCoins(dt) {
  const on = player.boosts.magnet > 0, R = CONFIG.shop.magnetRadius;
  const bx = player.pos.x, by = player.pos.y + 0.9, bz = player.pos.z;
  for (const c of coins.concat(goldens)) {
    if (!coinVisible(c)) continue;
    const d = Math.hypot(c.cx - bx, c.cy - by, c.cz - bz);
    if (on && d < R) c.pull = Math.min(1, c.pull + dt * 2.5);
    if (c.pull > 0) {
      const k = Math.min(1, dt * (6 + c.pull * 10));
      c.cx += (bx - c.cx) * k; c.cy += (by - c.cy) * k; c.cz += (bz - c.cz) * k;
    }
  }
}
const pops = [];
const popGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16).rotateX(Math.PI / 2);
function spawnPop(c) {
  const m = new THREE.Mesh(popGeo, new THREE.MeshBasicMaterial({ color: c.golden ? 0xfff2a8 : 0xffd84a, transparent: true }));
  m.position.set(c.cx, c.cy, c.cz);
  m.userData.base = c.golden ? 1.5 : 1;
  scene.add(m);
  pops.push({ m, t: 0 });
  juice.sparkle(c.cx, c.cy, c.cz, c.golden ? 22 : 8, c.golden ? 0xffe066 : 0xfff2a8, { speed: c.golden ? 4 : 2.5 });
  const s = toScreen(m.position, camera);
  if (!s.behind) flyToHud(s.x, s.y, $('hud-wallet'), { icon: c.golden ? '⭐' : '🪙', onArrive: () => refreshHud() });
  else refreshHud();
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
  const test = (c) => coinVisible(c) && Math.abs(c.cy - py) < 1.25 && (c.cx - px) ** 2 + (c.cz - pz) ** 2 < 0.95 * 0.95;
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
    toast(`⭐ Golden coin! (${Save.goldenCount()} / ${goldens.length}) +${CONFIG.economy.golden} coins`);
    awardBadge('first-coin');
    if (Save.goldenCount() >= goldens.length) awardBadge('golden-hunter');
    refreshHud(false, true);
  }
}

/* =============== HUD =============== */
const hudCoins = $('hud-coins'), hudGold = $('hud-gold'), hudWallet = $('hud-wallet');
function refreshHud(popCoin, popGold) {
  hudWallet.querySelector('b').textContent = Save.DEBUG ? '∞' : Save.wallet();
  hudCoins.textContent = `${Save.coinCount()} / ${coins.length} found`;
  hudGold.textContent = `⭐ ${Save.goldenCount()} / ${goldens.length}`;
  const pop = (el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  if (popCoin) pop(hudCoins);
  if (popGold) pop(hudGold);
}
Save.onChange((w) => { if (w === 'wallet' || w === 'reset') refreshHud(); });

/* =============== player / camera / input / systems =============== */
const input = new Input(canvas);
const player = new Player(scene, world);
player.setUnlocks(Save.unlocks());
input.setMoves(Save.unlocks());
// overview: zoom right out and the camera tilts up over the square (town only)
const cam = new FollowCamera(camera, world, { overview: true });
cam.player = player;
function plotSpawn(id) {
  const p = ROADS.plots[id];
  if (!p) return CONFIG.spawns.default;
  // stand on the road just in front of the district, facing back to the square
  const f = p.front, D = p.road.D;
  const back = p.face === 'east' ? [1, 0] : p.face === 'west' ? [-1, 0] : p.face === 'south' ? [0, 1] : [0, -1];
  return { x: f.x + back[0] * 1.5, y: 0, z: f.z + back[1] * 1.5, facing: Math.atan2(-D.x, -D.z) };
}
function resolveSpawn(key) {
  if (key.startsWith('plot:')) return plotSpawn(key.slice(5));
  const sp = CONFIG.spawns[key];
  return sp.plot ? plotSpawn(sp.plot) : sp;
}
const spawn = resolveSpawn(spawnKey);
player.teleport(spawn.x, spawn.y, spawn.z, spawn.facing);
cam.snapBehind(spawn.facing);
player.onJump = () => Sfx.jump();
const juice = attachJuice({ scene, player, cam, camera, renderer });
const moveHud = new MoveHud(player);
moveHud.show(false);

function earnWithFlight(n, from, label) {
  Save.earn(n);
  const s = toScreen(from, camera);
  const flights = Math.min(6, n);
  for (let i = 0; i < flights; i++) setTimeout(() => flyToHud(s.x + (Math.random() - 0.5) * 40, s.y + (Math.random() - 0.5) * 40, hudWallet, { onArrive: i === flights - 1 ? () => refreshHud() : null }), i * 70);
  if (label) toast(label);
}

const gadgets = new Gadgets({
  scene, world, player, juice,
  onCrateCoins: (n, c) => earnWithFlight(n, new THREE.Vector3(c.x, c.y + 1, c.z), `📦 Crate smashed! +${n} coins`),
  onCrateGolden: () => { toast('📦 Something golden inside!'); confetti({ count: 60 }); },
  onBoost: (b) => toast(`${b.icon} ${b.name} for ${b.secs}s!`)
});
gadgets.onShake = (a) => cam.shake(a);
for (const g of gadgets.interactables) interactables.push(g);

const life = new TownLife({ scene, world, player, gfx, lamps: lampSpots, trees: treeSpots, lawns: LAWNS.filter((l) => l.bushes !== false), planters: PLANTERS });
gfx.onTier((t, cfg) => life.setTier(cfg));
gfx.onAutoDrop = (t) => toast(`Graphics set to ${t} for smoother play (change it in the pause menu).`);
interactables.push({
  get x() { return life.cat.g.position.x; }, get z() { return life.cat.g.position.z; }, y: 0, r: 1.6, label: 'Pet the cat',
  act: () => { life.petCat(); const p = life.cat.g.position; for (let i = 0; i < 6; i++) juice.spark.emit(p.x, p.y + 0.8, p.z, { vy: 1.5, spread: 1.2, color: 0xff6a9a, size: 0.5, size1: 0.1, life: 1 }); }
});

const combo = new Combo(player, {
  onPayout: (n) => earnWithFlight(n, new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z), null),
  onCount: (n) => { if (n >= 8) awardBadge('combo-king'); }
});

const trials = new Trials({
  scene, world, player, cam, toast,
  onFinish: (tr, ms, medal, pay) => {
    Save.earn(pay); refreshHud();
    confetti({ count: medal ? 160 : 80 });
    if (medal === 'gold') awardBadge('trial-gold');
    if (CONFIG.trials.every((t) => Save.trial(t.id).bestMs)) awardBadge('all-trials');
    setState('trial-card');
  },
  onState: (s) => { if (s === 'closed') setState('playing'); renderPause(); }
});
for (const g of trials.interactables) interactables.push(g);

const shop = new Shop({
  player, input, toast, awardBadge,
  onOpen: () => setState('shop'),
  onClose: () => { if (state === 'shop') setState('playing'); },
  onUnlock: () => renderControls()
});
{
  const s = CONFIG.gadgets.shop;
  interactables.push({ x: s.x, z: s.z, y: 0, r: s.r, label: 'Shop: moves & boosts', icon: '🛒', marker: true, iconY: 3.9, act: () => shop.open() });
}
if (Save.DEBUG) setTimeout(() => toast('Debug mode: every move unlocked for this visit.'), 1200);

/* =============== Chapterlands: talking, side quests, districts =============== */
let afterSay = null;
function sayLine(who, text, after = null) {
  $('say-who').textContent = who.charAt(0).toUpperCase() + who.slice(1);
  $('say-text').textContent = text;
  afterSay = after;
  setState('sign');
  $('say').hidden = false;
  Sfx.click();
}
function closeSay() {
  $('say').hidden = true;
  setState('playing');
  const f = afterSay; afterSay = null;
  if (f) f();
}
$('btn-say-close').addEventListener('click', closeSay);
function cafeLine() {
  const q = Save.quest('white-rabbit');
  if (q.done) return 'That rabbit came back through here earlier, very pleased with himself. Something about a garden party.';
  if (q.step > 0) return 'He went thataway! Ever so fast for someone so worried.';
  return 'A white rabbit in a waistcoat just dashed past, looking at his watch. Muttering about being late. Odd sort of customer!';
}

// position specs used by quests (see sidequests.js)
function resolvePos(spec, frame) {
  if (typeof spec === 'string') {
    if (spec.startsWith('plot:')) { const p = ROADS.plots[spec.slice(5)]; return p ? { x: p.front.x, z: p.front.z, y: 0 } : { x: 0, z: 0, y: 0 }; }
    if (spec.startsWith('shelf:')) { const sh = ROADS.shelves[spec.slice(6)]; return sh ? { x: sh.x, z: sh.z, y: 0 } : { x: 0, z: 0, y: 0 }; }
  }
  if (Array.isArray(spec)) {
    if (frame && frame.startsWith('plot:') && spec.length === 2) {
      const p = ROADS.plots[frame.slice(5)];
      if (p) { const w = p.frame(spec[0], spec[1]); return { x: w.x, z: w.z, y: 0, facing: p.front.facing }; }
    }
    if (spec.length === 3) return { x: spec[0], y: spec[1] > 0.9 ? spec[1] : 0, z: spec[2] };
    return { x: spec[0], z: spec[1], y: 0 };
  }
  return { x: 0, z: 0, y: 0 };
}
const questList = CONFIG.sideQuests.map((q) => Object.assign({}, q, { where: q.id === 'lost-books' ? 'Library Square' : 'Library Square → the Fantasy road' }));
const npcList = CONFIG.npcs.slice();
for (const { book, kit } of LIVE_KITS) {
  if (!ROADS.plots[book.id]) continue;
  const frame = 'plot:' + book.id;
  for (const n of kit.npcs || []) npcList.push(Object.assign({ frame }, n));
  if (kit.sideQuest) questList.push(Object.assign({ frame, where: `${Catalogue.getQuarter(book.quarter).name} road, ${Catalogue.placeName(book)}` }, kit.sideQuest));
}
const quests = new SideQuests({
  scene, player, quests: questList, npcs: npcList, resolve: resolvePos, say: sayLine, interactables,
  earn: (n) => earnWithFlight(n, new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z), null)
});

function goTo(url) {
  if (leaving) return;
  leaving = true;
  input.setPlaying(false);
  setPrompt(input, null);
  fadeOut().then(() => { location.href = url; });
}
function enterDistrict(book) {
  if (book.entry) { goTo(book.entry); return; }
  if (book.requiresKey && !Save.hasKey(book.requiresKey)) {
    const prev = Catalogue.getBook(book.requiresKey);
    toast(`You need the ${Catalogue.keyName(prev)} Key. Finish ${prev.title} to earn it.`);
    return;
  }
  setState('sign');
  openDistrict(book.id, districtHooks);
}
const districtHooks = {
  play: (book, street) => goTo(`street/?book=${encodeURIComponent(book.id)}&street=${encodeURIComponent(street)}${Save.DEBUG ? '&debug=1' : ''}`),
  vault: (book) => goTo(`vault/?book=${encodeURIComponent(book.id)}${Save.DEBUG ? '&debug=1' : ''}`),
  close: () => setState('playing'),
  refresh: () => refreshHud()
};
function fogged(book) {
  return book.status !== 'live' && !Save.towerClimbed(book.quarter);
}
function lockedPlot(book, what) {
  const Q = Catalogue.getQuarter(book.quarter);
  const hasTower = CONFIG.lookoutTowers.some((t) => t.quarter === book.quarter);
  if (what === 'sign') {
    toast(`${book.title} · ${'📖'.repeat(book.level)} Level ${book.level} · ${book.status === 'live' ? 'open now' : 'coming soon'}`, { ms: 3200 });
    return;
  }
  if (fogged(book)) {
    toast(hasTower ? `It's too foggy to see much. Climb the ${Q.name} Lookout Tower to lift the fog.` : `Thick fog. This road's Lookout Tower isn't built yet — but you can read the signpost.`, { ms: 3400 });
    return;
  }
  toast(`${Catalogue.placeName(book)} — coming soon!`, { ms: 2600 });
}
function openReading() {
  setState('sign');
  openReadingRoom({
    onClose: () => setState('playing'),
    onOpenBook: async (book, street) => {
      const h = await openDistrict(book.id, districtHooks);
      if (street && h && h.startCheck) h.startCheck(street);
    }
  });
}

/* ---------- Lookout Tower telescope: camera sweep, fog lifts, banner ---------- */
let sweep = null;
function useTelescope(T) {
  const q = T.road.Q;
  const first = !Save.towerClimbed(q.id);
  setState('sweep');
  Sfx.badge();
  sweep = { T, t: 0, dur: 7.5, first, lifted: false };
}
function updateSweep(dt) {
  const S = sweep, road = S.T.road;
  S.t += dt;
  const k = Math.min(1, S.t / S.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const top = S.T.top;
  const d = THREE.MathUtils.lerp(-6, road.len * 0.9, e);
  const p = road.at(d);
  const h = THREE.MathUtils.lerp(top.y + 3, 16, e);
  const from = new THREE.Vector3(THREE.MathUtils.lerp(top.x, p.x, Math.min(1, e * 3)), h, THREE.MathUtils.lerp(top.z, p.z, Math.min(1, e * 3)));
  const ahead = road.at(Math.min(road.len, d + 34));
  camera.position.copy(from);
  camera.lookAt(ahead.x, 3, ahead.z);
  if (!S.lifted && S.t > 1.2) {
    S.lifted = true;
    ROADS.mist.set('q:' + road.Q.id, false);
    if (S.first) { Save.climbTower(road.Q.id); track('tower-climbed', { quarter: road.Q.id }); track('fog-lifted', { quarter: road.Q.id }); }
  }
  if (S.t >= S.dur) {
    sweep = null;
    cam.snapBehind(player.facing);
    showReveal(road, S.first);
  }
}
function showReveal(road, first) {
  const Q = road.Q;
  $('banner-tag').textContent = `lookout tower · ${Q.name}`;
  $('banner-title').textContent = first ? `The fog lifts over the ${Q.name} road!` : `The ${Q.name} road`;
  $('banner-list').innerHTML = road.shown.map((b) => `<li style="--qc:${Q.colour}"><b></b><span>${b.status === 'live' ? 'open now' : 'coming soon'}</span></li>`).join('')
    + (road.books.length > road.shown.length ? `<li class="more"><b>…and ${road.books.length - road.shown.length} more further along</b><span></span></li>` : '');
  $('banner-list').querySelectorAll('li:not(.more) b').forEach((el, i) => { el.textContent = `${Catalogue.placeName(road.shown[i])}`; });
  $('banner').hidden = false;
  setState('sign');
  confetti({ count: 120 });
}
$('btn-banner-close').addEventListener('click', () => {
  $('banner').hidden = true;
  setState('playing');
  awardBadge('lookout');
});

/* =============== interaction markers (ring + floating icon) =============== */
const ringTex = canvasTexture(128, 128, (ctx) => {
  ctx.strokeStyle = 'rgba(255,240,180,1)'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(64, 64, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,180,0.4)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(64, 64, 40, 0, Math.PI * 2); ctx.stroke();
});
const markerRingMat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const iconTexCache = {};
for (const o of interactables) {
  if (!o.icon) continue;
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), markerRingMat);
  ring.rotation.x = -Math.PI / 2; ring.position.set(o.x, (o.y || 0) + 0.05, o.z);
  ring.renderOrder = 3;
  scene.add(ring);
  const tex = iconTexCache[o.icon] || (iconTexCache[o.icon] = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(64, 60, 46, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(48, 98); ctx.lineTo(80, 98); ctx.lineTo(64, 122); ctx.fill();
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(64, 60, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '54px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.icon, 64, 64);
  }));
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set(1.1, 1.1, 1);
  sp.position.set(o.x, (o.iconY || 2.8) + (o.y || 0), o.z);
  scene.add(sp);
  o._ring = ring; o._icon = sp; o._iconY = sp.position.y;
}
function updateMarkers(t) {
  for (const o of interactables) {
    if (!o._ring) continue;
    const d = Math.hypot(player.pos.x - o.x, player.pos.z - o.z);
    const near = d < o.r + 0.5;
    const vis = d < 26 && !trials.running;
    o._ring.visible = o._icon.visible = vis;
    if (!vis) continue;
    const pulse = 1 + Math.sin(t * 3 + o.x) * 0.06 + (near ? 0.15 : 0);
    o._ring.scale.setScalar(pulse);
    o._ring.material.opacity = near ? 1 : 0.7;
    o._icon.position.y = o._iconY + Math.sin(t * 2.2 + o.z) * 0.15;
    o._icon.scale.setScalar(near ? 1.35 : 1.1);
  }
}

/* =============== interaction =============== */
let current = null;
function nearestInteractable() {
  let best = null, bd = Infinity;
  for (const o of interactables) {
    if (Math.abs(player.pos.y - (o.y || 0)) > 2.5) continue;
    const d = Math.hypot(player.pos.x - o.x, player.pos.z - o.z);
    if (d < o.r && d < bd) { best = o; bd = d; }
  }
  return best;
}
function updateInteract() {
  const n = player.ride ? null : nearestInteractable();
  if (n !== current) { current = n; setPrompt(input, n ? n.label : null); }
  if (input.consumeInteract() && current) current.act();
}

let leaving = false;
async function enterBuilding(b) {
  if (typeof b.open === 'function') { b.open(); return; }
  if (b.open === 'reading') { openReading(); return; }
  if (leaving) return;
  leaving = true;
  input.setPlaying(false);
  setPrompt(input, null);
  await fadeOut();
  location.href = b.href;
}
// walking into a live building's door also enters it
function checkDoorWalkIn() {
  if (leaving || trials.running) return;
  for (const d of liveDoors) {
    if (!d.b.href) continue;          // panels (districts, Reading Room) open with Interact
    const dx = player.pos.x - d.x, dz = player.pos.z - d.z;
    const along = dx * d.nz - dz * d.nx;     // sideways offset from the door centre
    const out = dx * d.nx + dz * d.nz;       // distance in front of the door
    const into = -(player.vel.x * d.nx + player.vel.z * d.nz);
    if (Math.abs(along) < 0.95 && out < 0.15 && out > -0.5 && player.pos.y < d.y + 1 && into > 0.5) { enterBuilding(d.b); return; }
  }
}
function updateDoors(dt) {
  for (const d of swingDoors) {
    const near = Math.hypot(player.pos.x - d.x, player.pos.z - d.z) < 4.5 && player.pos.y < 3;
    d.open += ((near ? 1 : 0) - d.open) * Math.min(1, dt * 5);
    d.hinge.rotation.y = d.base + d.open * 1.45;
  }
}

/* =============== menus =============== */
let state = 'loading';   // loading | start | playing | paused | sign | shop | trial-card | sweep
function setState(s) {
  state = s;
  input.setPlaying(s === 'playing');
  input.consumePause();
  if (s !== 'playing') setPrompt(input, null), current = null;
  const inGame = s === 'playing' || s === 'paused' || s === 'sign' || s === 'shop' || s === 'trial-card';
  $('hud').hidden = !inGame;
  $('btn-pause').hidden = s !== 'playing';
  $('btn-card').hidden = s !== 'playing';
  if (quests) { if (s === 'playing') quests.renderTracker(); else $('quest-tracker').hidden = true; }
  moveHud.show(inGame);
  cam.orbit = (s === 'start' || s === 'loading') ? titleOrbit : null;
  if (!cam.orbit) camera.fov = cam.baseFov;
}
const titleOrbit = { center: new THREE.Vector3(0, 5, -2), dist: 62, pitch: 0.36, speed: 0.045, yaw: 0.6 };

function renderControls() {
  document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = controlsHelpHTML(input.touchMode, Save.unlocks()); });
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

function openPause(tab = 'game') {
  setState('paused');
  renderPause();
  showTab(tab);
  $('pause').hidden = false;
}
function showTab(tab) {
  document.querySelectorAll('#pause-tabs .seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  for (const t of ['game', 'card', 'quests']) $('tab-' + t).hidden = t !== tab;
  if (tab === 'card') renderLibraryCard($('tab-card'), { onReroll: syncName });
  if (tab === 'quests') renderQuestLog($('tab-quests'), questList);
  $('pause').querySelector('.card').scrollTop = 0;
}
document.querySelectorAll('#pause-tabs .seg-btn').forEach((b) => b.addEventListener('click', () => { showTab(b.dataset.tab); Sfx.click(); }));
$('btn-card').addEventListener('click', () => openPause('card'));
function syncName() { $('start-name').textContent = Save.name(); }
$('btn-start-reroll').addEventListener('click', () => { Save.rerollName(); syncName(); Sfx.click(); });
syncName();
function closePause() {
  $('pause').hidden = true;
  $('reset-confirm').hidden = true;
  setState('playing');
}
function renderPause() {
  syncTime();
  $('stat-coins').textContent = `${Save.coinCount()} / ${coins.length}`;
  $('stat-gold').textContent = `${Save.goldenCount()} / ${goldens.length}`;
  $('stat-wallet').textContent = Save.DEBUG ? '∞' : Save.wallet();
  $('stat-stamps').textContent = Save.card().stamps.length;
  $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on';
  $('btn-quit-trial').hidden = !trials.running;
  const moves = $('move-list');
  moves.innerHTML = '';
  const free = [['⤒', 'Double jump'], ['⚡', 'Super jump'], ['🛝', 'Slide'], ['🧗', 'Ledge grab']];
  for (const [i, n] of free) moves.insertAdjacentHTML('beforeend', `<span class="mv got">${i} ${n}</span>`);
  for (const u of CONFIG.shop.unlocks) moves.insertAdjacentHTML('beforeend', `<span class="mv ${Save.hasUnlock(u.id) ? 'got' : ''}">${u.icon} ${u.name}${Save.hasUnlock(u.id) ? '' : ` · 🪙${u.price}`}</span>`);
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
qualityPicker($('quality-picker'), gfx);
$('btn-pause').addEventListener('click', () => openPause());
$('btn-resume').addEventListener('click', closePause);
$('btn-help').addEventListener('click', () => { $('pause-help').hidden = !$('pause-help').hidden; });
$('btn-mute').addEventListener('click', () => { Save.setMuted(!Save.isMuted()); renderPause(); });
$('btn-quit-trial').addEventListener('click', () => { trials.quit(); closePause(); });
$('btn-respawn').addEventListener('click', () => {
  trials.quit(true);
  const s = CONFIG.spawns.default;
  player.teleport(s.x, s.y, s.z, s.facing); cam.snapBehind(s.facing);
  closePause();
  quests.refresh();
});
$('btn-reset').addEventListener('click', () => { $('reset-confirm').hidden = false; });
$('btn-reset-no').addEventListener('click', () => { $('reset-confirm').hidden = true; });
$('btn-reset-yes').addEventListener('click', () => {
  Save.reset();
  coins.forEach((c) => { c.got = false; c.cx = c.x; c.cy = c.y; c.cz = c.z; c.pull = 0; });
  goldens.forEach((c) => { c.got = false; c.cx = c.x; c.cy = c.y; c.cz = c.z; c.pull = 0; });
  player.setUnlocks(Save.unlocks());
  input.setMoves(Save.unlocks());
  renderControls();
  refreshHud();
  renderPause();
  $('reset-confirm').hidden = true;
  toast('Progress reset.');
  setTimeout(() => location.reload(), 600);   // rebuild fog, bridges and quests from a clean save
});

function openNotice() {
  setState('sign');
  $('notice').hidden = false;
}
$('btn-notice-close').addEventListener('click', () => { $('notice').hidden = true; setState('playing'); });
addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && !e.repeat && state === 'playing' && trials.running) trials.restart();
});

/* =============== head turning: what the player glances at =============== */
const _look = new THREE.Vector3();
function pickLookTarget() {
  const p = player.pos;
  let best = null, bd = 5;
  for (const n of life.npcs) {
    if (!n.rig.root.visible) continue;
    const q = n.rig.root.position, d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < bd && Math.abs(q.y - p.y) < 2) { bd = d; best = _look.set(q.x, q.y + 1.4, q.z); }
  }
  if (best) return best;
  const c = life.cat.g.position;
  if (Math.hypot(c.x - p.x, c.z - p.z) < 3.5 && Math.abs(c.y - p.y) < 1.5) return _look.set(c.x, c.y + 0.4, c.z);
  if (current && current._icon) return _look.copy(current._icon.position);
  return null;
}

/* =============== time-of-day picker (pause menu) =============== */
const TIME_PRESETS = [['Live', null], ['Morning', 8], ['Midday', 12.5], ['Golden', 18.5], ['Night', 22.5]];
let syncTime = () => {};
{
  const box = $('time-picker');
  box.classList.add('seg');
  const btns = TIME_PRESETS.map(([label, h]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seg-btn'; b.textContent = label;
    b.addEventListener('click', () => { day.setLock(h); Save.setTimeOfDay(h); syncTime(); debug.sync(); });
    box.appendChild(b);
    return b;
  });
  syncTime = () => {
    const lock = day.isLive ? null : day.locked;
    btns.forEach((b, i) => b.classList.toggle('on', TIME_PRESETS[i][1] === lock));
  };
  syncTime();
}

/* =============== debug panel (?debug=1 or pause menu) =============== */
const debug = new DebugPanel({
  gfx, player, day,
  toggles: [
    { label: 'Townspeople, birds and cat', get: () => life.npcs.some((n) => n.rig.root.visible) || life.cat.g.visible,
      set: (on) => {
        life.setTier(gfx.tierCfg);   // restores the tier's people + birds
        if (!on) { life.npcs.forEach((n) => { n.rig.root.visible = false; n.rig.blob.visible = false; }); life.birds.forEach((b) => { b.g.visible = false; }); }
        life.cat.g.visible = on;
      } },
    { label: 'Grass and flowers', get: () => life.tufts.visible, set: (on) => { life.tufts.visible = on; life.flowers.visible = on; } }
  ]
});
$('btn-debug').addEventListener('click', () => { debug.show(true); closePause(); });

/* =============== main loop =============== */
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  U.time.value = t;

  if (state === 'sweep') {
    gadgets.update(0, null);
    player._sync(dt);
    updateSweep(dt);
  } else if (state === 'playing') {
    if (input.consumePause()) openPause();
    gadgets.camYaw = cam.yaw;
    if (!trials.frozen) {
      gadgets.update(dt, input);
      player.update(dt, input, cam.yaw);
    } else { input.consumeJump(); input.consumeCharge(); input.consumeDash(); player._sync(dt); }
    trials.update(dt);
    magnetCoins(dt);
    checkPickups();
    updateInteract();
    checkDoorWalkIn();
    if (player.grounded && player.pos.y >= TOWER.h - 0.1 &&
        player.pos.x > TOWER.x0 && player.pos.x < TOWER.x1 && player.pos.z > TOWER.z0 && player.pos.z < TOWER.z1) {
      if (awardBadge('rooftop-runner')) toast('You made it to the top of the clock tower!');
    }
    if (player.ride && player.ride.camYaw !== undefined) cam.yaw += (player.ride.camYaw - cam.yaw) * Math.min(1, dt * 6);
    cam.update(dt, player.pos, input);
    player.lookTarget = pickLookTarget();
  } else if (state === 'paused' || state === 'sign' || state === 'shop' || state === 'trial-card') {
    if (input.consumePause()) {
      if (state === 'paused') closePause();
      else if (state === 'sign' && !$('say').hidden) closeSay();
      else if (state === 'sign' && !$('notice').hidden) { $('notice').hidden = true; setState('playing'); }
      else if (state === 'shop') shop.close();
    }
    gadgets.update(0, null);
    player._sync(dt);
    cam.update(dt, player.pos, null);
  } else {
    // title screen: slow orbit of the whole town
    gadgets.update(dt, null);
    player.update(dt, input, cam.yaw);
    cam.update(dt, player.pos, null);
  }

  day.update(dt);
  const tc = gfx.tierCfg;
  const shadowRange = cam.orbit ? 60 : (tc.shadowRange ? THREE.MathUtils.lerp(tc.shadowRange, 60, cam.overviewK) : 0);
  followShadow(sun, cam.orbit ? cam.orbit.center : player.pos, day.lightDir, shadowRange, 90);
  sky.update(dt, camera.position);
  const night = day.night;
  Batcher.glowMaterial().emissiveIntensity = night * 1.15;
  for (const s of nightSigns) s.material.emissiveIntensity = night * 0.55;
  for (const m of interiorMats) m.emissiveIntensity = 0.05 + night * 0.75;
  for (const b of adSpots) b.material.opacity = Math.max(0, night - 0.3) * 0.35;
  coinMat.emissiveIntensity = 0.55 + night * 0.4;

  life.update(dt);
  quests.update(state === 'playing' ? dt : 0);
  ROADS.mist.update(dt, t, scene.fog.color);
  for (const T of lookouts) T.update(dt, t, player);
  updateCoins(t, dt);
  updatePops(dt);
  updateDoors(dt);
  updateMarkers(t);
  juice.update(dt);
  moveHud.update(dt);
  combo.update(dt);
  if (fountainTex) { fountainTex.offset.x = t * 0.05; fountainTex.offset.y = t * 0.03; }
  if (waterMesh) waterMesh.position.y = 0.4 + Math.sin(t * 1.5) * 0.02;
  if (sprayMesh) { sprayMesh.rotation.y = t * 0.6; sprayMesh.scale.y = 1 + Math.sin(t * 6) * 0.06; }
  if (towerBeacon) { towerBeacon.rotation.y = t; towerBeacon.position.y = 45 + Math.sin(t * 1.5) * 0.4; }
  if ((Math.floor(t * 2) & 1) === 0 || clockHands._init !== true) {
    const d = new Date(), hr = (d.getHours() % 12) + d.getMinutes() / 60, mn = d.getMinutes() + d.getSeconds() / 60;
    clockHands.forEach(({ hour, min }) => { hour.rotation.z = -hr / 12 * Math.PI * 2; min.rotation.z = -mn / 60 * Math.PI * 2; });
    clockHands._init = true;
  }

  gfx.monitor(dt, state === 'playing');
  debug.beginFrame();
  gfx.render();
  debug.update(dt);
  requestAnimationFrame(tick);
}

/* =============== boot =============== */
refreshHud();
$('notice-coins').textContent = coins.length;
$('notice-gold').textContent = goldens.length;
$('start-coins').textContent = coins.length;
$('start-gold').textContent = goldens.length;
const finishLoading = () => {
  if (state !== 'loading') return;
  $('loading').hidden = true;
  if (spawnKey !== 'default') {
    // coming back from a building — straight into play
    $('start-screen').hidden = true;
    setState('playing');
    cam.snapBehind(player.facing);
    fadeIn();
    toast(spawnKey.startsWith('plot:') ? 'Back on the road.' : 'Welcome back to Library Square!');
    Save.takeToasts().forEach((m, i) => setTimeout(() => toast(m, { badge: true, ms: 3600 }), 400 + i * 600));
    checkBookBadges();
    if (spawnKey.startsWith('plot:') && params.get('panel') === '1') {
      const b = Catalogue.getBook(spawnKey.slice(5));
      if (b) setTimeout(() => enterDistrict(b), 500);
    }
    history.replaceState(null, '', location.pathname + (Save.DEBUG ? '?debug=1' : ''));
  } else {
    setState('start');
    $('start-screen').hidden = false;
    const n = Save.coinCount() + Save.goldenCount();
    if (n > 0 || Save.card().stamps.length) $('start-progress').textContent = `Your progress: ${Save.card().stamps.length} stamp${Save.card().stamps.length === 1 ? '' : 's'} · ${Save.coinCount()}/${coins.length} coins · ${Save.goldenCount()}/${goldens.length} golden · ${Object.keys(Save.get().badges).length}/${CONFIG.badges.length} badges · 🪙 ${Save.wallet()} to spend`;
    checkBookBadges();
  }
};
setState('loading');
manager.onLoad = finishLoading;
manager.onError = (url) => console.warn('Failed to load', url);
// Posters are drawn on canvases now, so there may be nothing to load at all.
setTimeout(finishLoading, 0);
setTimeout(finishLoading, 8000);
// bfcache: coming "back" to this page should never leave it faded out
addEventListener('pageshow', (e) => { if (e.persisted) { leaving = false; fadeIn(); if (state !== 'start') setState('playing'); } });

tick();

// handy for debugging + automated tests from the console
window.__chapterlands = { scene, camera, player, cam, world, CONFIG, renderer, gfx, day, gadgets, trials, life, shop, combo, Save, input, setState, ROADS, quests, lookouts, Catalogue, enterDistrict, openReading, get state() { return state; } };
window.__bookTown = window.__chapterlands;   // old name, kept for any saved console snippets
