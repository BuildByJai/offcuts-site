// The Study — Atomic Habits edition. A reskinned copy of The Study escape
// room running on Book Town's shared player / camera / input modules.
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

const $ = (id) => document.getElementById(id);

/* =============== puzzle data — edit wording / answers here =============== */
const LOCK1_CODE = '365';          // sticky note on the mirror (revealed by the lamp)
const LOCK4_CODE = '7';            // the one un-crossed day on the habit tracker
const MISSING_DAY = 7;
const CLOCK_TARGET = { h: 2, m: 0 };
const PAIRS = {                    // chore → treat
  treadmill: 'podcast',
  washing:   'playlist',
  laundry:   'show'
};
const CHORES = [
  { id: 'treadmill', label: 'Treadmill run' },
  { id: 'washing',   label: 'Washing up' },
  { id: 'laundry',   label: 'Folding laundry' }
];
const TREATS = [
  { id: 'podcast',  label: 'Podcast' },
  { id: 'playlist', label: 'Playlist' },
  { id: 'show',     label: 'Comedy show' }
];
// Lesson cards — our own words, no quotes from the book.
const LAWS = [
  { law: 'Make it obvious',    text: 'Put the cue for a good habit where you can\'t miss it. The code was on the mirror all along — you just couldn\'t see it in the dark.' },
  { law: 'Make it attractive', text: 'Pair something you need to do with something you want to do. Save the good stuff for while the chore is happening.' },
  { law: 'Make it easy',       text: 'Shrink a new habit until it takes two minutes to start. Less friction, more doing.' },
  { law: 'Make it satisfying', text: 'Track it — seeing your streak makes you want to keep it. And if you miss a day, don\'t miss two.' }
];
const LESSON_SHORT = [
  'Put the cue for a good habit where you can\'t miss it.',
  'Pair something you need to do with something you want to do.',
  'Shrink a new habit until it takes two minutes to start.',
  'Track it — seeing your streak makes you want to keep it.'
];

/* =============== renderer / scene =============== */
const canvas = $('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120e0b);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 60);

// Dim until the desk lamp is switched on (that's puzzle 1).
const ambient = new THREE.AmbientLight(0x8a9bc4, 0.32);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x9db4ff, 0.35);
moon.position.set(-2, 6, 6);
scene.add(moon);
const lampLight = new THREE.PointLight(0xffc77a, 0, 16, 1.6);
lampLight.position.set(-3.75, 1.75, -4.0);
lampLight.castShadow = true;
scene.add(lampLight);
// shared renderer: tone mapping + quality tiers (lamp shadow size, pixel ratio)
const gfx = createGfx({ canvas, scene, camera, extraShadowLights: [lampLight], exposure: 1.25, post: false });
const renderer = gfx.renderer;
const ceilingGlow = new THREE.PointLight(0xfff0d8, 0, 20, 1.2);
ceilingGlow.position.set(0, 3.6, 0);
scene.add(ceilingGlow);

/* =============== room =============== */
const world = new World();
const B = new Batcher();
const HX = 6, HZ = 5, WH = 4, DOOR_HW = 1.05;

world.add(-20, 20, -1, 0, -20, 20);                 // floor
world.add(-20, 20, WH, WH + 1, -20, 20);            // ceiling
world.add(-HX - 1, HX + 1, 0, WH, -HZ - 1, -HZ);    // north wall
world.add(-HX - 1, -HX, 0, WH, -HZ - 1, HZ + 3);    // west
world.add(HX, HX + 1, 0, WH, -HZ - 1, HZ + 3);      // east
world.add(-HX - 1, -DOOR_HW, 0, WH, HZ, HZ + 1);    // south, left of door
world.add(DOOR_HW, HX + 1, 0, WH, HZ, HZ + 1);      // south, right of door
world.add(-DOOR_HW, DOOR_HW, 2.7, WH, HZ, HZ + 1);  // door header
// short corridor outside the door
world.add(-DOOR_HW - 1, -DOOR_HW, 0, WH, HZ, HZ + 3);
world.add(DOOR_HW, DOOR_HW + 1, 0, WH, HZ, HZ + 3);
world.add(-3, 3, 0, WH, HZ + 3, HZ + 4);
const doorBlocker = world.add(-DOOR_HW, DOOR_HW, 0, 2.7, HZ - 0.05, HZ + 0.2);

{ // floor, walls, ceiling visuals
  const floorTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#6b4c34'; ctx.fillRect(0, 0, 256, 256);
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
  const WALL = 0xd9c9a8, SKIRT = 0x5a3f2a;
  B.box(-HX, HX, 0, WH, -HZ - 0.25, -HZ, WALL);
  B.box(-HX - 0.25, -HX, 0, WH, -HZ, HZ, WALL);
  B.box(HX, HX + 0.25, 0, WH, -HZ, HZ, WALL);
  B.box(-HX, -DOOR_HW, 0, WH, HZ, HZ + 0.25, WALL);
  B.box(DOOR_HW, HX, 0, WH, HZ, HZ + 0.25, WALL);
  B.box(-DOOR_HW, DOOR_HW, 2.7, WH, HZ, HZ + 0.25, WALL);
  // skirting
  B.box(-HX, HX, 0, 0.15, -HZ, -HZ + 0.04, SKIRT);
  B.box(-HX, -HX + 0.04, 0, 0.15, -HZ, HZ, SKIRT);
  B.box(HX - 0.04, HX, 0, 0.15, -HZ, HZ, SKIRT);
  // corridor + a bright "outside" beyond
  B.box(-DOOR_HW - 0.25, -DOOR_HW, 0, WH, HZ, HZ + 3, 0xbfb59f);
  B.box(DOOR_HW, DOOR_HW + 0.25, 0, WH, HZ, HZ + 3, 0xbfb59f);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
  outside.position.set(0, 1.6, HZ + 2.95); outside.rotation.y = Math.PI; scene.add(outside);
  // rug
  B.box(-2.2, 2.2, 0, 0.02, -1.2, 1.8, 0x7a3b3b, { cast: false });
  B.box(-1.9, 1.9, 0.02, 0.025, -0.9, 1.5, 0xa8584a, { cast: false });
}

/* =============== props =============== */
const interactables = [];
const WOOD = 0x4a3324, WOOD2 = 0x6e4b31;

// --- desk + lamp (lock 1: make it obvious) ---
B.box(-4.2, -1.8, 0.88, 0.98, -4.6, -3.5, WOOD);
[[-4.1, -4.5], [-1.9, -4.5], [-4.1, -3.6], [-1.9, -3.6]].forEach(([x, z]) => B.box(x - 0.06, x + 0.06, 0, 0.88, z - 0.06, z + 0.06, WOOD));
world.add(-4.2, -1.8, 0, 0.98, -4.6, -3.5);
// clutter on the desk
B.box(-2.9, -2.4, 0.98, 1.0, -4.3, -3.9, 0x2a2a2a);
B.box(-2.88, -2.42, 1.0, 1.32, -4.32, -4.28, 0x1e2a33);
B.box(-3.3, -3.0, 0.98, 1.2, -3.85, -3.6, 0x8a3a3a);
B.box(-2.2, -1.9, 0.98, 1.06, -4.0, -3.7, 0xf2efe6);
// lamp
B.box(-3.95, -3.55, 0.98, 1.02, -4.25, -3.85, 0x2a2a2a);
B.box(-3.78, -3.72, 1.02, 1.6, -4.08, -4.02, 0x2a2a2a);
const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 14, 1, true), new THREE.MeshLambertMaterial({ color: 0x2f6b4a, side: THREE.DoubleSide, emissive: 0x000000 }));
lampShade.position.set(-3.75, 1.7, -4.05); scene.add(lampShade);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0x555544 }));
bulb.position.set(-3.75, 1.6, -4.05); scene.add(bulb);
// chair
B.box(-3.3, -2.7, 0.45, 0.52, -3.3, -2.7, WOOD2);
B.box(-3.3, -2.7, 0.52, 1.1, -2.72, -2.66, WOOD2);
world.add(-3.3, -2.7, 0, 0.52, -3.3, -2.66, false);

// --- mirror on the west wall with the hidden sticky note ---
B.box(-HX + 0.0, -HX + 0.06, 1.0, 2.8, -1.85, -0.15, 0x9c8256);
const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), new THREE.MeshLambertMaterial({ color: 0x8aa0b0, emissive: 0x0a0d10 }));
mirror.position.set(-HX + 0.07, 1.9, -1.0); mirror.rotation.y = Math.PI / 2; scene.add(mirror);
const noteTex = canvasTexture(128, 128, (ctx) => {
  ctx.fillStyle = '#ffe873'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#2a2420'; ctx.textAlign = 'center';
  ctx.font = 'bold 20px system-ui'; ctx.fillText('LOCK 1', 64, 36);
  ctx.font = 'bold 44px monospace'; ctx.fillText(LOCK1_CODE.split('').join(' '), 64, 88);
});
const note = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshLambertMaterial({ map: noteTex }));
note.position.set(-HX + 0.08, 2.25, -0.55); note.rotation.y = Math.PI / 2; note.rotation.x = 0.1;
note.visible = false; scene.add(note);

// --- shelf on the east wall (lock 2: make it attractive) ---
B.box(HX - 0.5, HX, 0, 2.4, -3.2, -1.2, WOOD);
[0.7, 1.4, 2.1].forEach((y) => B.box(HX - 0.52, HX, y, y + 0.04, -3.15, -1.25, WOOD2));
const labelTex = canvasTexture(256, 64, (ctx) => {
  ctx.fillStyle = '#f7f4ec'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#2a2420'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('ONLY WHILE…', 128, 40);
});
const shelfLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshLambertMaterial({ map: labelTex }));
shelfLabel.position.set(HX - 0.53, 1.2, -2.2); shelfLabel.rotation.y = -Math.PI / 2; scene.add(shelfLabel);
const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 1.6), new THREE.MeshLambertMaterial({ color: WOOD2 }));
drawer.position.set(HX - 0.26, 0.35, -2.2); drawer.castShadow = true; scene.add(drawer);
world.add(HX - 0.55, HX, 0, 2.4, -3.2, -1.2);
// treat items that appear on the shelf when solved
const shelfItems = new THREE.Group(); shelfItems.visible = false; scene.add(shelfItems);
[[0x222222, -2.8], [0xd8452f, -2.2], [0x2f7fd6, -1.6]].forEach(([c, z]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshLambertMaterial({ color: c }));
  m.position.set(HX - 0.3, 1.57, z); shelfItems.add(m);
});

// --- treadmill with headphones (south-east) ---
B.box(3.0, 5.4, 0, 0.25, 2.3, 3.3, 0x2b2b2b);
B.box(3.1, 5.3, 0.25, 0.28, 2.4, 3.2, 0x444444);
B.box(5.2, 5.35, 0, 1.3, 2.35, 2.45, 0x555555); B.box(5.2, 5.35, 0, 1.3, 3.15, 3.25, 0x555555);
B.box(5.0, 5.45, 1.3, 1.45, 2.3, 3.3, 0x333333);
B.box(4.9, 5.1, 1.0, 1.35, 2.7, 2.9, 0xd8452f);   // headphones
world.add(3.0, 5.45, 0, 0.28, 2.3, 3.3);
world.add(5.0, 5.45, 0, 1.45, 2.3, 3.3, false);

// --- sink counter with a speaker (north-east) ---
B.box(2.8, 5.0, 0, 0.92, -4.95, -4.25, 0xe8e2d6);
B.box(2.8, 5.0, 0.92, 0.98, -4.97, -4.2, 0x9aa3ad);
B.box(3.4, 4.2, 0.9, 0.99, -4.8, -4.4, 0x6b7a85);   // basin
B.box(3.7, 3.9, 0.98, 1.3, -4.92, -4.85, 0xc0c6cc); // tap
B.box(4.5, 4.85, 0.98, 1.38, -4.75, -4.45, 0x2f7fd6); // speaker
for (let i = 0; i < 3; i++) B.box(2.95 + i * 0.12, 3.05 + i * 0.12, 0.98, 1.22, -4.7, -4.45, 0xfaf3e0); // stacked plates
world.add(2.8, 5.0, 0, 0.98, -4.97, -4.2);

// --- laundry basket + TV (south-west) ---
B.box(-4.1, -3.1, 0, 0.7, 3.8, 4.7, 0xc9a26a);
B.box(-4.0, -3.2, 0.7, 0.9, 3.9, 4.6, 0xeaeaea);
B.box(-3.95, -3.5, 0.9, 0.98, 3.95, 4.3, 0x9cc4e4);
world.add(-4.1, -3.1, 0, 0.98, 3.8, 4.7);
B.box(-5.9, -5.5, 0, 0.7, 3.6, 4.9, WOOD);
B.box(-5.85, -5.75, 0.7, 1.55, 3.5, 4.95, 0x1b1b1b);
const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.72), new THREE.MeshBasicMaterial({ color: 0x3a4a6a }));
tvScreen.position.set(-5.74, 1.12, 4.22); tvScreen.rotation.y = Math.PI / 2; scene.add(tvScreen);
world.add(-5.95, -5.5, 0, 1.55, 3.5, 4.95);

// --- cabinet (lock 3: make it easy) on the west wall ---
const CAB_COLOR = 0x6b7178;
B.box(-HX, -HX + 0.7, 0, 1.5, 0.3, 1.6, CAB_COLOR);
world.add(-HX, -HX + 0.7, 0, 1.5, 0.3, 1.6);
const cabDoor = new THREE.Group();
cabDoor.position.set(-HX + 0.72, 0.75, 0.32);
const cabDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 1.24), new THREE.MeshLambertMaterial({ color: 0x565c62 }));
cabDoorMesh.position.z = 0.62; cabDoorMesh.castShadow = true;
cabDoor.add(cabDoorMesh);
const cabNoteTex = canvasTexture(128, 96, (ctx) => {
  ctx.fillStyle = '#d6f0ff'; ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#2a2420'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('START WITH', 64, 40); ctx.fillText('TWO.', 64, 64);
});
const cabNote = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshLambertMaterial({ map: cabNoteTex }));
cabNote.position.set(0.03, 0.2, 0.62); cabNote.rotation.y = Math.PI / 2;
cabDoor.add(cabNote);
scene.add(cabDoor);
// a clutter pile in front of the cabinet (friction!)
B.box(-4.9, -4.3, 0, 0.5, 0.5, 1.1, 0xa07a4a);
B.box(-4.85, -4.4, 0.5, 0.85, 0.6, 1.0, 0x8a6a4a);
world.add(-4.9, -4.3, 0, 0.85, 0.5, 1.1);

// --- wall clock (north wall) ---
let clockH = 9, clockM = 45;
const clockFace = canvasTexture(256, 256, (ctx) => {
  ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 8; ctx.stroke();
  ctx.fillStyle = '#2a2420';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillRect(128 + Math.sin(a) * 100 - 4, 128 - Math.cos(a) * 100 - 4, 8, 8);
  }
  ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('2', 128 + Math.sin(Math.PI / 3) * 76, 128 - Math.cos(Math.PI / 3) * 76 + 8);
});
const clockGroup = new THREE.Group();
clockGroup.position.set(1.0, 2.8, -HZ + 0.02);
clockGroup.add(new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshLambertMaterial({ map: clockFace })));
const handMat = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.01), handMat); hourHand.geometry.translate(0, 0.1, 0.01);
const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.01), handMat); minHand.geometry.translate(0, 0.16, 0.02);
clockGroup.add(hourHand, minHand);
scene.add(clockGroup);
function drawClockHands() {
  hourHand.rotation.z = -((clockH % 12) + clockM / 60) / 12 * Math.PI * 2;
  minHand.rotation.z = -clockM / 60 * Math.PI * 2;
}
drawClockHands();

// --- habit-tracker calendar (lock 4: make it satisfying) ---
const calTex = canvasTexture(240, 280, (ctx) => {
  ctx.fillStyle = '#f7f4ec'; ctx.fillRect(0, 0, 240, 280);
  ctx.fillStyle = '#156534'; ctx.fillRect(0, 0, 240, 40);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('HABIT TRACKER', 120, 27);
  ctx.textAlign = 'left';
  for (let d = 1; d <= 28; d++) {
    const col = (d - 1) % 7, row = Math.floor((d - 1) / 7);
    const x = 10 + col * 32, y = 52 + row * 54;
    ctx.strokeStyle = '#d9d2c3'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 30, 50);
    ctx.fillStyle = '#3a332c'; ctx.font = '11px monospace'; ctx.fillText(String(d), x + 3, y + 12);
    if (d !== MISSING_DAY) {
      ctx.strokeStyle = '#c0362c'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x + 6, y + 18); ctx.lineTo(x + 24, y + 44); ctx.moveTo(x + 24, y + 18); ctx.lineTo(x + 6, y + 44); ctx.stroke();
    }
  }
});
const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.84), new THREE.MeshLambertMaterial({ map: calTex }));
cal.position.set(-1.3, 2.35, -HZ + 0.02); scene.add(cal);

// --- "1% better" sign ---
const signTex = canvasTexture(320, 120, (ctx) => {
  ctx.fillStyle = '#1f3b2c'; ctx.fillRect(0, 0, 320, 120);
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 308, 108);
  ctx.fillStyle = '#f5e7c4'; ctx.textAlign = 'center';
  ctx.font = 'bold 30px Georgia, serif'; ctx.fillText('1% better', 160, 52);
  ctx.font = '16px Georgia, serif'; ctx.fillText('never miss twice', 160, 88);
});
const sign1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshLambertMaterial({ map: signTex }));
sign1.position.set(3.4, 2.7, -HZ + 0.02); scene.add(sign1);

// --- general clutter so it reads as messy ---
[[1.6, -3.9, 0.5, 0x8a6a4a], [2.1, -3.7, 0.35, 0xa07a4a], [-0.6, 3.6, 0.45, 0x8a6a4a], [1.7, 3.8, 0.6, 0xa07a4a]].forEach(([x, z, s, c]) => {
  B.box(x - s / 2, x + s / 2, 0, s, z - s / 2, z + s / 2, c);
  world.add(x - s / 2, x + s / 2, 0, s, z - s / 2, z + s / 2);
});
for (let i = 0; i < 5; i++) B.box(-0.3 + i * 0.05, 0.2 + i * 0.03, i * 0.08, i * 0.08 + 0.08, -3.9, -3.55, [0x8a3a3a, 0x3a6b4a, 0x35507a, 0xb08a3a, 0x6a4a80][i]);
B.box(1.2, 2.2, 0, 0.04, 0.4, 1.0, 0xeeeeee, { cast: false }); // dropped papers

// --- exit door + four lock lights ---
const doorPivot = new THREE.Group();
doorPivot.position.set(-DOOR_HW + 0.06, 0, HZ + 0.02);
const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HW * 2 - 0.12, 2.68, 0.12), new THREE.MeshLambertMaterial({ color: 0x7a2f27 }));
doorMesh.position.set(DOOR_HW - 0.06, 1.34, 0); doorMesh.castShadow = true;
doorPivot.add(doorMesh);
scene.add(doorPivot);
const lockLights = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.06), new THREE.MeshBasicMaterial({ color: 0xc9463a }));
  m.position.set(-0.45 + i * 0.3, 2.95, HZ - 0.03);
  scene.add(m); lockLights.push(m);
}
const doorLabelTex = canvasTexture(256, 48, (ctx) => {
  ctx.fillStyle = '#2a2420'; ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = '#f5e7c4'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
  ctx.fillText('4 LAWS · 4 LOCKS', 128, 31);
});
const doorLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), new THREE.MeshBasicMaterial({ map: doorLabelTex }));
doorLabel.position.set(0, 3.28, HZ - 0.03); doorLabel.rotation.y = Math.PI; scene.add(doorLabel);
lockLights.forEach((m) => { m.rotation.y = Math.PI; });

B.build(scene);

/* =============== interactables =============== */
function addI(id, x, z, label, r = 1.5) { interactables.push({ id, x, z, label, r }); }
addI('lamp', -3.0, -2.95, 'Switch on the lamp', 1.4);
addI('mirror', -4.9, -1.0, 'Look in the mirror');
addI('shelf', 4.7, -2.2, 'Check the shelf');
addI('treadmill', 4.2, 1.6, 'Look at the treadmill');
addI('sink', 3.9, -3.5, 'Look at the sink');
addI('laundry', -3.6, 3.0, 'Look at the laundry', 1.3);
addI('cabinet', -4.5, 1.7, 'Try the cabinet', 1.3);
addI('clock', 1.0, -3.9, 'Examine the wall clock', 1.3);
addI('calendar', -1.3, -3.9, 'Examine the calendar', 1.3);
addI('sign', 3.0, -3.0, 'Read the sign', 0.9);
addI('door', 0, HZ - 1.0, 'Examine the exit door', 1.6);

/* =============== player / camera / input =============== */
const input = new Input(canvas);
const player = new Player(scene, world);
player.setUnlocks(Save.unlocks());
input.setMoves(Save.unlocks());
const cam = new FollowCamera(camera, world, { distance: 4.4, minDistance: 1.8, maxDistance: 6, pitch: 0.42, maxPitch: 1.0, speedPullBack: 0.6 });
cam.player = player;
const juice = attachJuice({ scene, player, cam, camera, renderer });
const moveHud = new MoveHud(player);
moveHud.show(false);
player.teleport(0, 0, 3.2, Math.PI);
cam.snapBehind(Math.PI);
player.onJump = () => Sfx.jump();

/* =============== game state =============== */
const solved = [false, false, false, false];
let lampOn = false;
let doorOpen = false;
let state = 'start';          // start | playing | panel | paused | won
let startTime = 0;
let lastRunMs = 0;

// Like the original Study, the clock never stops once you hit Start.
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

function renderControls() {
  document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = controlsHelpHTML(input.touchMode, Save.unlocks()); });
}
input.onTouchModeChange = renderControls;
renderControls();

function updateLocksHud() {
  const n = solved.filter(Boolean).length;
  $('hud-locks').textContent = `${n === 4 ? '🔓' : '🔒'} ${n} / 4`;
}

/* ---------- clue panel ---------- */
function clue(label, text, extraHTML = '') {
  $('clue-label').textContent = label;
  $('clue-text').innerHTML = text;
  $('clue-extra').innerHTML = extraHTML;
  openPanel('clue');
}
$('btn-clue-close').addEventListener('click', () => closePanel('clue'));

/* ---------- lesson card ---------- */
let afterLesson = null;
function showLesson(i, then) {
  $('lesson-tag').textContent = `lock ${i + 1} of 4 · open`;
  $('lesson-law').textContent = LAWS[i].law;
  $('lesson-text').textContent = LAWS[i].text;
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
  // let any panel that triggered this close first
  setTimeout(() => showLesson(i, then), 50);
}

function openExit() {
  doorOpen = true;
  world.remove(doorBlocker);
  toast('All four locks click open. The door swings wide — get out!');
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
  if (o.id === 'lamp') return lampOn ? 'Switch off the lamp' : 'Switch on the lamp';
  if (o.id === 'door') return doorOpen ? 'Leave the study' : 'Examine the exit door';
  if (o.id === 'cabinet' && solved[2]) return 'Look in the cabinet';
  return o.label;
}
function interact(o) {
  Sfx.click();
  switch (o.id) {
    case 'lamp': {
      lampOn = !lampOn;
      lampLight.intensity = lampOn ? 9 : 0;
      ceilingGlow.intensity = lampOn ? 4 : 0;
      ambient.intensity = lampOn ? 0.75 : 0.32;
      bulb.material.color.set(lampOn ? 0xfff2c0 : 0x555544);
      lampShade.material.emissive.set(lampOn ? 0x1a3a26 : 0x000000);
      note.visible = lampOn;
      if (lampOn) toast('Click. Warm light floods the desk — and something glints on the mirror.');
      break;
    }
    case 'mirror':
      if (!lampOn) clue('Mirror', "It's too dark to make anything out. You can just about see your own outline. Some light would help.");
      else clue('Mirror', `Now you can see it: a bright yellow sticky note, right at eye level.<br><br><b>"LOCK 1 → ${LOCK1_CODE.split('').join(' ')}"</b><br><br>It was there the whole time.`);
      break;
    case 'shelf':
      if (solved[1]) clue('Shelf', 'Podcast, playlist and comedy show — each parked next to its chore. The drawer underneath hangs open, empty.');
      else openShelf();
      break;
    case 'treadmill':
      clue('Treadmill', 'A pair of red headphones is looped over the handlebar. On the console, a sticky tab: <i>"podcast — only on here!"</i>');
      break;
    case 'sink':
      clue('Sink', 'A tower of dirty plates. A little blue speaker sits right next to the tap, a playlist called <i>"washing-up bangers"</i> queued up.');
      break;
    case 'laundry':
      clue('Laundry basket', 'A heap of clean clothes waiting to be folded. The TV is angled straight at the basket, a comedy show paused mid-episode.');
      break;
    case 'cabinet':
      if (solved[2]) clue('Cabinet', 'Open. Whatever was holding it shut has let go — and the key that was inside is now in lock 3.');
      else clue('Cabinet', 'Locked tight. Boxes are piled in front of it. A blue note on the door: <b>"START WITH TWO."</b> The wall clock behind you is ticking loudly.');
      break;
    case 'clock':
      if (solved[2]) clue('Wall clock', 'Set to 2:00. Something clicked open when you did that.');
      else openClock();
      break;
    case 'calendar': {
      let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="h">${d}</div>`).join('');
      for (let d = 1; d <= 28; d++) cells += `<div class="${d === MISSING_DAY ? '' : 'x'}">${d}</div>`;
      clue('Habit tracker', 'A big red X for every day the habit got done. A long chain… with one gap.', `<div class="cal">${cells}</div>`);
      break;
    }
    case 'sign':
      clue('Framed sign', '<b>"1% better · never miss twice"</b><br><br>Underneath, in pencil: <i>"the last lock is the day I slipped."</i>');
      break;
    case 'door':
      if (doorOpen) winGame();
      else openDoorPanel();
      break;
  }
}

/* ---------- door locks ---------- */
const LOCKS = [
  { name: 'Lock 1 · Make it obvious',    kind: 'code', len: 3, code: LOCK1_CODE, hint: 'A 3-digit combination lock.' },
  { name: 'Lock 2 · Make it attractive', kind: 'key',  hint: 'A keyhole. You need the right key.' },
  { name: 'Lock 3 · Make it easy',       kind: 'key',  hint: 'Another keyhole. Another key.' },
  { name: 'Lock 4 · Make it satisfying', kind: 'code', len: 1, code: LOCK4_CODE, hint: 'A single number dial.' }
];
function openDoorPanel() {
  $('door-list-view').hidden = false;
  $('door-code-view').hidden = true;
  renderLockList();
  openPanel('door-panel');
}
function renderLockList() {
  const ul = $('lock-list');
  ul.innerHTML = '';
  LOCKS.forEach((L, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="li-icon">${solved[i] ? '🔓' : '🔒'}</span><span class="li-main"><div class="li-name"></div><div class="li-sub"></div></span>`;
    li.querySelector('.li-name').textContent = L.name;
    li.querySelector('.li-sub').textContent = solved[i] ? 'Open' : L.hint;
    if (!solved[i] && L.kind === 'code') {
      const b = document.createElement('button');
      b.className = 'mini'; b.type = 'button'; b.textContent = 'Enter code';
      b.addEventListener('click', () => openCode(i));
      li.appendChild(b);
    }
    ul.appendChild(li);
  });
}
$('btn-door-close').addEventListener('click', () => closePanel('door-panel'));

let codeLock = 0, entry = '';
const keypad = $('keypad');
['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Back'].forEach((k) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key-btn' + (k.length > 1 ? ' wide' : '');
  b.textContent = k;
  b.addEventListener('click', () => pressKey(k));
  keypad.appendChild(b);
});
function openCode(i) {
  codeLock = i; entry = '';
  $('code-title').textContent = `${LOCKS[i].name} — enter ${LOCKS[i].len === 1 ? 'one digit' : LOCKS[i].len + ' digits'}.`;
  const d = $('code-display');
  d.className = 'digit-row';
  d.innerHTML = '<div class="digit-box"></div>'.repeat(LOCKS[i].len);
  $('door-list-view').hidden = true;
  $('door-code-view').hidden = false;
}
function renderCode() {
  $('code-display').querySelectorAll('.digit-box').forEach((b, i) => {
    b.textContent = entry[i] || '';
    b.classList.toggle('filled', !!entry[i]);
  });
}
function pressKey(k) {
  const L = LOCKS[codeLock];
  if (k === 'Clear') { entry = ''; renderCode(); return; }
  if (k === 'Back') { entry = entry.slice(0, -1); renderCode(); return; }
  if (entry.length >= L.len) return;
  entry += k; renderCode();
  if (entry.length === L.len) setTimeout(checkCode, 180);
}
function checkCode() {
  const L = LOCKS[codeLock], d = $('code-display');
  if (entry === L.code) {
    d.classList.add('success');
    Sfx.beep(true);
    setTimeout(() => { closePanel('door-panel'); solve(codeLock); }, 450);
  } else {
    Sfx.beep(false);
    d.classList.add('shake');
    setTimeout(() => { d.classList.remove('shake'); entry = ''; renderCode(); }, 380);
  }
}
$('btn-code-back').addEventListener('click', () => { $('door-code-view').hidden = true; $('door-list-view').hidden = false; renderLockList(); });

/* ---------- shelf pairing (lock 2) ---------- */
const choice = {};
function openShelf() {
  const box = $('pairs');
  box.innerHTML = '';
  CHORES.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'pair-row';
    row.innerHTML = `<div class="pr-label">Only while: ${c.label}</div><div class="seg"></div>`;
    const seg = row.querySelector('.seg');
    TREATS.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t.label;
      if (choice[c.id] === t.id) b.classList.add('on');
      b.addEventListener('click', () => {
        choice[c.id] = t.id;
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        Sfx.click();
      });
      seg.appendChild(b);
    });
    box.appendChild(row);
  });
  openPanel('shelf-panel');
}
$('btn-pairs-check').addEventListener('click', () => {
  const missing = CHORES.some((c) => !choice[c.id]);
  if (missing) { toast('Pick a treat for each chore first.'); return; }
  const ok = CHORES.every((c) => choice[c.id] === PAIRS[c.id]);
  if (ok) {
    Sfx.beep(true);
    closePanel('shelf-panel');
    shelfItems.visible = true;
    drawerOpen = true;
    toast('The drawer under the shelf slides open — a brass key. You slot it into lock 2.');
    solve(1);
  } else {
    Sfx.beep(false);
    toast("Nothing happens. Have another look around the room — each treat belongs with one chore.");
  }
});
$('btn-pairs-close').addEventListener('click', () => closePanel('shelf-panel'));
let drawerOpen = false;

/* ---------- wall clock (lock 3) ---------- */
function openClock() {
  $('h-val').textContent = clockH;
  $('m-val').textContent = String(clockM).padStart(2, '0');
  openPanel('clock-panel');
}
function bumpClock(dh, dm) {
  clockM += dm;
  if (clockM >= 60) { clockM -= 60; dh += 1; }
  if (clockM < 0) { clockM += 60; dh -= 1; }
  clockH = ((clockH - 1 + dh) % 12 + 12) % 12 + 1;
  $('h-val').textContent = clockH;
  $('m-val').textContent = String(clockM).padStart(2, '0');
  drawClockHands();
  Sfx.click();
}
$('h-up').addEventListener('click', () => bumpClock(1, 0));
$('h-down').addEventListener('click', () => bumpClock(-1, 0));
$('m-up').addEventListener('click', () => bumpClock(0, 15));
$('m-down').addEventListener('click', () => bumpClock(0, -15));
$('btn-clock-set').addEventListener('click', () => {
  if (clockH === CLOCK_TARGET.h && clockM === CLOCK_TARGET.m) {
    Sfx.beep(true);
    closePanel('clock-panel');
    cabOpen = true;
    toast('Two o\'clock. Behind you, the cabinet pops open — a key inside. Into lock 3 it goes.');
    solve(2);
  } else {
    Sfx.beep(false);
    toast('Tick… tock. Nothing.');
  }
});
$('btn-clock-close').addEventListener('click', () => closePanel('clock-panel'));
let cabOpen = false;

/* ---------- start / pause / win ---------- */
function startGame() {
  Sfx.unlock();
  $('start-screen').hidden = true;
  startTime = performance.now();
  setState('playing');
  toast("It's dark in here. Find a light.");
}
$('btn-start').addEventListener('click', startGame);
$('btn-pause').addEventListener('click', openPause);
function openPause() {
  $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on';
  setState('paused');
  $('pause').hidden = false;
}
function closePause() { $('pause').hidden = true; setState('playing'); }
$('btn-resume').addEventListener('click', closePause);
$('btn-mute').addEventListener('click', () => { Save.setMuted(!Save.isMuted()); $('btn-mute').textContent = Save.isMuted() ? 'Sound: off' : 'Sound: on'; });
$('btn-restart').addEventListener('click', () => location.reload());

const LOCAL_BEST = 'bookTown.study.bestMs';
function winGame() {
  if (state === 'won') return;
  lastRunMs = Math.round(elapsed());
  setState('won');
  const isBest = Save.recordEscape(lastRunMs);
  // Habit Breaker badge — the town shows the toast when you get back.
  if (Save.awardBadge('habit-breaker')) {
    const b = badgeInfo('habit-breaker');
    Save.queueToast(`${b.icon} Badge earned: <b>${b.name}</b>`);
  }
  Sfx.badge();
  $('win-time').textContent = fmtTime(lastRunMs);
  const best = Save.get().bestEscapeMs;
  $('win-best').textContent = isBest ? 'New personal best!' : `Your best: ${fmtTime(best)}`;
  let saved = ''; try { saved = localStorage.getItem('bookTown.study.name') || ''; } catch (e) {}
  $('win-name').value = saved;
  $('win-submit-status').textContent = '';
  $('recap').innerHTML = LAWS.map((l, i) => `<li><b>${i + 1}. ${l.law}</b>${LESSON_SHORT[i]}</li>`).join('');
  const url = CONFIG.affiliate.atomicHabits;
  const book = $('btn-book');
  if (/^https?:\/\//.test(url)) { book.href = url; book.dataset.ready = '1'; }
  else { book.href = '#'; book.dataset.ready = ''; }
  $('win').hidden = false;
}
$('btn-book').addEventListener('click', (e) => {
  if (!e.currentTarget.dataset.ready) { e.preventDefault(); toast('Book link coming soon.'); }
});
$('btn-win-retry').addEventListener('click', () => location.reload());
$('btn-win-town').addEventListener('click', async () => {
  if (Save.awardBadge('habit-breaker')) {
    const b = badgeInfo('habit-breaker');
    Save.queueToast(`${b.icon} Badge earned: <b>${b.name}</b>`);
  }
  await fadeOut();
  location.href = '../?spawn=study';
});

/* ---------- leaderboard (separate board from the original Study) ---------- */
async function submitScore(name, timeMs) {
  const res = await fetch('/api/book-town/study/score', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, timeMs })
  });
  if (!res.ok) throw new Error('submit failed');
  return res.json();
}
async function fetchLeaderboard() {
  const res = await fetch('/api/book-town/study/leaderboard');
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
    if (!entries || !entries.length) { empty.hidden = false; empty.textContent = 'No times yet — be the first to escape.'; return; }
    entries.forEach((e) => {
      const li = document.createElement('li');
      if (highlight && e.name === highlight) li.classList.add('you');
      li.innerHTML = `<span class="rank">#${e.rank}</span><span class="lname">${esc(e.name)}</span><span class="ltime">${fmtTime(e.timeMs)}</span>`;
      list.appendChild(li);
    });
  } catch (e) {
    list.innerHTML = '';
    empty.hidden = false;
    const best = Save.get().bestEscapeMs;
    empty.textContent = 'Leaderboard is unavailable right now' + (best ? ` — your best time is ${fmtTime(best)}, saved on this device.` : '.');
  }
}
$('btn-start-lb').addEventListener('click', () => openLeaderboard());
$('btn-win-lb').addEventListener('click', () => openLeaderboard($('win-name').value.trim().toUpperCase()));
$('btn-lb-close').addEventListener('click', () => { $('lb-panel').hidden = true; });
$('btn-win-submit').addEventListener('click', async () => {
  const name = $('win-name').value.trim().toUpperCase().slice(0, 12);
  const status = $('win-submit-status');
  if (!name) { status.textContent = 'Enter your initials first.'; return; }
  try { localStorage.setItem('bookTown.study.name', name); } catch (e) {}
  const btn = $('btn-win-submit');
  btn.disabled = true; status.textContent = 'Saving…';
  try {
    await submitScore(name, lastRunMs);
    status.textContent = 'Saved to the leaderboard.';
    try {
      const entries = await fetchLeaderboard();
      const pos = entries.findIndex((e) => e.name === name && e.timeMs === lastRunMs);
      if (pos >= 0) status.textContent = `Saved — you're #${pos + 1} on the leaderboard.`;
    } catch (e) { /* position is a nice-to-have */ }
  } catch (e) {
    status.textContent = "Couldn't reach the leaderboard — your best time is still saved on this device.";
  } finally { btn.disabled = false; }
});

/* =============== loop =============== */
const clock = new THREE.Clock();
const hudTimer = $('hud-timer');
let cabAngle = 0, drawerZ = 0, doorAngle = 0;
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state === 'playing') {
    if (input.consumePause()) openPause();
    player.update(dt, input, cam.yaw);
    const n = nearest();
    if (n !== current) { current = n; setPrompt(input, n ? labelFor(n) : null); }
    else if (n) setPrompt(input, labelFor(n));
    if (input.consumeInteract() && current) interact(current);
    if (doorOpen && player.pos.z > HZ + 0.9) winGame();
    cam.update(dt, player.pos, input);
  } else {
    if (state === 'paused' && input.consumePause()) closePause();
    if (state === 'start') player.update(dt, input, cam.yaw);
    cam.update(dt, player.pos, null);
  }
  if (state === 'playing' || state === 'panel' || state === 'paused') hudTimer.textContent = fmtTime(elapsed());

  // animated bits
  cabAngle += ((cabOpen ? -1.9 : 0) - cabAngle) * Math.min(1, dt * 4);
  cabDoor.rotation.y = cabAngle;
  drawerZ += ((drawerOpen ? 0.5 : 0) - drawerZ) * Math.min(1, dt * 4);
  drawer.position.x = HX - 0.26 - drawerZ;
  doorAngle += ((doorOpen ? -1.7 : 0) - doorAngle) * Math.min(1, dt * 3);
  doorPivot.rotation.y = doorAngle;
  tvScreen.material.color.setHSL(0.62, 0.3, 0.2 + Math.sin(performance.now() * 0.004) * 0.04);

  juice.update(dt);
  moveHud.update(dt);
  gfx.monitor(dt, state === 'playing');
  gfx.render();
  requestAnimationFrame(tick);
}

/* =============== boot =============== */
updateLocksHud();
$('loading').hidden = true;
$('start-screen').hidden = false;
fadeIn();
addEventListener('pageshow', (e) => { if (e.persisted) fadeIn(); });
window.__study = { player, cam, world, solve, solved, interact: (id) => interact(interactables.find((o) => o.id === id)) };
tick();
