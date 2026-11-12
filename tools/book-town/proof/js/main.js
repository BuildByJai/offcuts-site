// Book Town graphics proof — boot + game loop.
import * as THREE from 'three';
import { PROOF } from '../config.js';
import { Input } from '../../js/input.js';
import { Gfx, qualityPicker, presetPicker, isCoarse } from './gfx.js';
import { setAnisotropy } from './materials.js';
import { World } from './world.js';
import { createPhysics, CharacterController } from './physics.js';
import { SpringCamera } from './camera.js';
import { loadCharacter, Character, LOOKS } from './character.js';
import { Grass } from './grass.js';
import { Trees } from './trees.js';
import { Fountain } from './water.js';
import { Life } from './life.js';
import { DebugPanel } from './debug.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const TIPS = ['Scroll (or pinch) right out for the dollhouse view of the square.', 'Try the time-of-day presets in the menu.', 'Hold Shift to run — the camera widens with you.', 'Walk up to the townspeople; they look at you.'];
$('load-tip').textContent = 'Tip: ' + TIPS[Math.floor(Math.random() * TIPS.length)];

const app = {};
window.__proof = app;

function progress(pct, text) {
  document.querySelector('#loading .bar span').style.width = Math.round(pct * 100) + '%';
  $('load-text').textContent = `${text}… ${Math.round(pct * 100)}%`;
}

async function boot() {
  const canvas = $('game-canvas');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(PROOF.camera.fov, innerWidth / innerHeight, 0.1, 500);
  app.scene = scene; app.camera = camera;

  progress(0.02, 'Starting the renderer');
  const gfx = new Gfx({ canvas, scene, camera });
  await gfx.init();
  app.gfx = gfx;
  gfx.onTier((t, cfg) => { setAnisotropy(cfg.anisotropy); if (app.grass) app.grass.setDensity(cfg.grass); if (app.life) app.life.setCount(cfg.npcs); $('gfx-note').textContent = `Backend: ${gfx.backend} · ${t}`; });

  progress(0.08, 'Loading the sky');
  const presetKey = params.get('preset') && PROOF.presets[params.get('preset')] ? params.get('preset') : PROOF.defaultPreset;
  await gfx.setPreset(presetKey);

  progress(0.15, 'Building the square');
  const world = new World(scene).build();
  app.world = world;
  await new Promise((r) => setTimeout(r, 0));

  progress(0.25, 'Physics');
  const phys = await createPhysics();
  phys.addBoxes(world.colliders);
  app.phys = phys;

  progress(0.32, 'Props');
  await world.loadProps((k) => progress(0.32 + k * 0.25, 'Props'));

  progress(0.6, 'Gardens');
  app.grass = new Grass(scene, world.lawns, world.meadow);
  app.grass.setDensity(gfx.tierCfg.grass);
  app.trees = new Trees(scene, world.treeSpots, world.hedges);
  app.fountain = new Fountain(scene, { level: world.waterLevel, bowlLevel: world.bowlLevel });

  progress(0.72, 'Character');
  const gltf = await loadCharacter();
  const player = new Character(gltf, LOOKS.player);
  player.addBlobShadow(scene);
  scene.add(player.root);
  app.player = player;
  const spawn = PROOF.town.spawns.default;
  const ctrl = new CharacterController(phys, { x: spawn.x, y: 0.2, z: spawn.z, facing: spawn.facing });
  app.ctrl = ctrl;

  progress(0.85, 'Townspeople');
  app.life = new Life(scene, gltf, ctrl.render, world);
  app.life.setCount(gfx.tierCfg.npcs);

  const input = new Input(canvas);
  app.input = input;
  // Pinch to zoom on touch screens: every ~12% change in finger spread is one zoom step.
  let pinch = null;
  const spread = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = spread(e.touches); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !pinch || !input.enabled) return;
    const d = spread(e.touches);
    if (d > pinch * 1.12) { input.zoom -= 1; pinch = d; }        // fingers apart → zoom in
    else if (d < pinch / 1.12) { input.zoom += 1; pinch = d; }   // fingers together → zoom out
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });
  const cam = new SpringCamera(camera, phys, ctrl.collider);
  cam.snapBehind(spawn.facing);
  app.cam = cam;

  const debug = new DebugPanel({ gfx, app });
  app.debug = debug;
  app.setPreset = async (k) => { await gfx.setPreset(k); syncPreset(); debug.sync(); };
  qualityPicker($('quality-picker'), gfx);
  const syncPreset = presetPicker($('preset-picker'), gfx, app.setPreset);
  if (params.get('debug') === '1') debug.show(true);

  // menus
  let state = 'start';
  app.getState = () => state;
  const setState = (s) => {
    state = s;
    input.setPlaying(s === 'playing');
    $('hud').hidden = s !== 'playing';
    $('btn-pause').hidden = s !== 'playing';
    cam.orbit = s === 'start' ? titleOrbit : null;
  };
  app.setState = setState;
  const titleOrbit = { center: new THREE.Vector3(0, 4, 0), dist: 40, pitch: 0.42, speed: 0.05, yaw: 0.8 };
  const renderControls = () => document.querySelectorAll('.controls-help').forEach((el) => { el.innerHTML = input.touchMode
    ? '<b>Move</b>: drag on the left half (push far to run)<br><b>Look</b>: drag on the right half<br><b>Jump</b>: button bottom-right<br><b>Zoom</b>: pinch'
    : '<b>Move</b>: WASD / arrows &nbsp;·&nbsp; <b>Run</b>: Shift<br><b>Jump</b>: Space (hold for higher)<br><b>Camera</b>: click-drag to orbit, scroll to zoom out to the overview<br><b>Menu</b>: Esc'; });
  input.onTouchModeChange = renderControls; renderControls();
  input.setMoves({});
  $('btn-play').addEventListener('click', () => { $('start-screen').hidden = true; cam.snapBehind(ctrl.facing); setState('playing'); });
  $('btn-pause').addEventListener('click', () => { setState('paused'); $('pause').hidden = false; });
  $('btn-resume').addEventListener('click', () => { $('pause').hidden = true; setState('playing'); });
  $('btn-help').addEventListener('click', () => { $('pause-help').hidden = !$('pause-help').hidden; });
  $('btn-debug').addEventListener('click', () => { debug.show(true); $('pause').hidden = true; setState('playing'); });
  gfx.onAutoDrop = (t) => { $('gfx-note').textContent = `Dropped to ${t} for smoother play.`; };

  progress(1, 'Ready');
  $('loading').hidden = true;
  $('start-screen').hidden = false;
  $('start-note').textContent = `Renderer: ${gfx.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2 (WebGPU fallback)'} · quality: ${gfx.tier}`;
  setState('start');
  loop();
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
const _v = new THREE.Vector3();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const { gfx, ctrl, cam, player, input, phys, scene } = app;
  const playing = app.getState() === 'playing';
  if (playing && input.consumePause()) { app.setState('paused'); $('pause').hidden = false; }
  else if (!playing && app.getState() === 'paused' && input.consumePause()) { $('pause').hidden = true; app.setState('playing'); }

  // physics at 60 Hz, interpolated
  ctrl.setInput(playing ? input : NULL_INPUT, cam.smoothYaw);
  let jumped = false, landed = 0;
  const alpha = phys.step(dt, (h) => { ctrl.step(h); if (ctrl.justJumped) jumped = true; if (ctrl.justLanded) { landed = ctrl.justLanded; ctrl.justLanded = 0; } });
  ctrl.interpolate(alpha);

  // character
  player.root.position.copy(ctrl.render);
  player.root.rotation.y = ctrl.renderFacing;
  const groundY = groundBelow(phys, ctrl.render, ctrl.collider);
  player.lookTarget = nearestNpc(ctrl.render);
  player.update(dt, { speed: ctrl.speed, grounded: ctrl.grounded, vy: ctrl.vel.y, justJumped: jumped, landed, accel: ctrl.accel, turnRate: ctrl.turnRate, airTime: ctrl.airTime, groundY, blobStrength: gfx.tierCfg.shadows ? 0.35 : 1 });

  // camera + sun + focus
  const speedK = THREE.MathUtils.clamp((ctrl.speed - PROOF.movement.jogSpeed) / (PROOF.movement.sprintSpeed - PROOF.movement.jogSpeed), 0, 1);
  cam.update(dt, ctrl.render, ctrl.vel, playing ? input : null, speedK);
  gfx.updateSun(cam.orbit ? cam.orbit.center : ctrl.render);
  gfx.setFocus(cam.dist, cam.zoomedOut);

  app.fountain.update(dt, t);
  app.life.playerSpeed = ctrl.speed;
  app.life.update(dt, t);
  phys.debugRender(scene, !!app.physicsDebug);
  app.debug.update(dt);

  gfx.monitor(dt, playing);
  gfx.render();
}
const NULL_INPUT = { getMove: () => ({ x: 0, y: 0, mag: 0 }), sprint: false, consumeJump: () => false, jumpHeld: false, consumeLook: () => ({ dx: 0, dy: 0 }), consumeZoom: () => 0 };
const _down = new THREE.Vector3(0, -1, 0);
function groundBelow(phys, p, exclude) {
  _v.set(p.x, p.y + 0.3, p.z);
  const d = phys.ray(_v, _down, 30, exclude);
  return d === null ? 0 : p.y + 0.3 - d;
}
function nearestNpc(p) {
  let best = null, bd = 6;
  for (const n of app.life.npcs) { const d = n.pos.distanceTo(p); if (d < bd && n.ch.root.visible) { bd = d; best = n; } }
  return best ? new THREE.Vector3(best.pos.x, best.pos.y + 1.5, best.pos.z) : null;
}

boot().catch((e) => {
  console.error(e);
  $('load-text').textContent = 'Something went wrong starting the proof: ' + e.message;
});
