// Rigged character + animation state machine.
//   Locomotion is a continuous blend of idle → walk → run driven by the real
//   speed (stride-matched time scales, phase-synced), so there is never a snap.
//   Jump = take-off / airborne / soft- or hard-landing phases scrubbed through
//   the jump clip. Starts, stops and turns add a procedural lean on the spine;
//   the head turns towards a point of interest; idle gets an occasional
//   look-around. Every transition crossfades.
// The placeholder rig is Quaternius' CC0 "Animated Woman" (clips: Idle, Walking,
// Running, Jump, Jump2, SitIdle, Sitting, PickUp, Punch, Death). Jai's Mixamo
// set drops in by mapping clip names in CLIP_MAP.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { PROOF } from '../config.js';

const M = PROOF.movement;
const CLIP_MAP = { idle: /^(Idle|idle)$/, walk: /^(Walking|walk)/i, run: /^(Running|run)/i, jump: /^(Jump2|jump)$/i, jumpAlt: /^Jump$/i, sit: /^SitIdle$/i, idleVar: /^(PickUp|idle_?var|stretch)/i };
// natural travel speeds of the in-place clips (m/s) for stride matching
const CLIP_SPEED = { walk: 1.55, run: 4.6 };

let _cache = null;
export async function loadCharacter(url = 'assets/character/woman.glb') {
  if (_cache) return _cache;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  _cache = gltf;
  return gltf;
}

// Palette texture: the mesh maps every body part to one of six cells of a
// 16×16 image. Pass colours per part to recolour a character cheaply.
const CELLS = { skin: [7, 15], hair: [8, 9], top: [7, 6], trousers: [7, 3], shoes: [6, 0], eyes: [6, 11] };
export const LOOKS = {
  player: { skin: '#e9b793', hair: '#4a2f1d', top: '#c94f5f', trousers: '#36506e', shoes: '#2b2b2b', eyes: '#f4f0ea' },
  npc1:   { skin: '#8d5524', hair: '#1b1b1b', top: '#e9a23b', trousers: '#2f3b4a', shoes: '#3a3a3a', eyes: '#f4f0ea' },
  npc2:   { skin: '#f1c27d', hair: '#d8b26a', top: '#2f7fd6', trousers: '#4a3a2a', shoes: '#5a3a24', eyes: '#f4f0ea' },
  npc3:   { skin: '#c68642', hair: '#2a2a2a', top: '#3fae5c', trousers: '#2b3442', shoes: '#1d1d1d', eyes: '#f4f0ea' },
  npc4:   { skin: '#ffdbac', hair: '#a0522d', top: '#6a5acd', trousers: '#5a4a3a', shoes: '#2b2b2b', eyes: '#f4f0ea' },
  npc5:   { skin: '#e0ac69', hair: '#3a2618', top: '#2f9e9a', trousers: '#36506e', shoes: '#3a3a3a', eyes: '#f4f0ea' }
};
export function paletteTexture(look) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 16, 16);
  for (const [part, [u, v]] of Object.entries(CELLS)) { ctx.fillStyle = look[part] || '#888'; ctx.fillRect(u, v, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

export class Character {
  constructor(gltf, look = LOOKS.player) {
    this.root = skeletonClone(gltf.scene);
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({ map: paletteTexture(look), roughness: 0.82, metalness: 0, envMapIntensity: 0.8 });
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      }
    });
    this.bones = {};
    this.root.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = {};
    for (const [key, re] of Object.entries(CLIP_MAP)) { const c = gltf.animations.find((a) => re.test(a.name)); if (c) this.clips[key] = c; }
    const act = (k, loop = THREE.LoopRepeat) => { const c = this.clips[k]; if (!c) return null; const a = this.mixer.clipAction(c); a.setLoop(loop, Infinity); a.enabled = true; a.play(); a.setEffectiveWeight(0); return a; };
    this.a = { idle: act('idle'), walk: act('walk'), run: act('run'), jump: act('jump', THREE.LoopOnce), idleVar: act('idleVar', THREE.LoopOnce) };
    if (this.a.jump) { this.a.jump.clampWhenFinished = true; }
    if (this.a.idle) this.a.idle.setEffectiveWeight(1);
    this.w = { idle: 1, walk: 0, run: 0, jump: 0, idleVar: 0 };
    this.jumpPhase = null;   // 'up' | 'air' | 'land'
    this.jumpT = 0;
    this.leanX = 0; this.leanZ = 0; this.bob = 0;
    this.idleTime = 0; this.lookAround = 0; this.nextLook = 5 + Math.random() * 5;
    this.lookTarget = null; this.headYaw = 0; this.headPitch = 0;
    this.blob = null;
  }
  setLook(look) { this.root.traverse((o) => { if (o.isMesh) { o.material.map = paletteTexture(look); o.material.needsUpdate = true; } }); }
  addBlobShadow(scene) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
    scene.add(this.blob);
  }

  // state: { speed, grounded, vy, justJumped, landed (fall speed or 0), accel, turnRate, airTime }
  update(dt, state) {
    const a = this.a, w = this.w;
    const s = state.speed;
    // --- locomotion targets from speed ---
    const idleT = THREE.MathUtils.clamp(1 - s / 0.5, 0, 1);
    const walkT = s < 0.3 ? 0 : THREE.MathUtils.clamp(1 - Math.abs(s - M.walkSpeed * 0.9) / (M.jogSpeed - M.walkSpeed * 0.9), 0, 1);
    const runT = THREE.MathUtils.clamp((s - M.walkSpeed * 1.1) / (M.sprintSpeed * 0.85 - M.walkSpeed * 1.1), 0, 1);
    // --- jump phases ---
    if (state.justJumped) { this.jumpPhase = 'up'; this.jumpT = 0; }
    if (this.jumpPhase === 'up' && state.vy <= 0.5) this.jumpPhase = 'air';
    if (this.jumpPhase && state.grounded && this.jumpPhase !== 'land') { this.jumpPhase = 'land'; this.jumpT = 0; this.landHard = state.landed > 9; }
    if (!this.jumpPhase && !state.grounded && state.airTime > 0.25) { this.jumpPhase = 'air'; }
    if (this.jumpPhase === 'land') { this.jumpT += dt; if (this.jumpT > (this.landHard ? 0.42 : 0.22)) this.jumpPhase = null; }
    const jumpT = this.jumpPhase ? 1 : 0;
    // scrub the jump clip: take-off 0→0.28, airborne hold 0.42, landing 0.62→1
    if (a.jump && this.jumpPhase) {
      a.jump.paused = true;
      const D = a.jump.getClip().duration;
      let t;
      if (this.jumpPhase === 'up') { this.jumpT += dt; t = 0.06 + Math.min(0.26, this.jumpT * 1.1); }
      else if (this.jumpPhase === 'air') t = 0.4 + Math.min(0.08, state.airTime * 0.05);
      else t = 0.62 + (this.jumpT / (this.landHard ? 0.42 : 0.22)) * 0.36;
      a.jump.time = t * D;
    }
    // --- crossfade weights (0.15–0.25 s) ---
    const k = (rate) => 1 - Math.exp(-dt * rate);
    const kj = k(this.jumpPhase === 'up' ? 22 : 9), kl = k(7);
    w.jump += (jumpT - w.jump) * kj;
    const loco = 1 - w.jump;
    let sum = idleT + walkT + runT || 1;
    w.idle += (idleT / sum * loco - w.idle) * kl;
    w.walk += (walkT / sum * loco - w.walk) * kl;
    w.run += (runT / sum * loco - w.run) * kl;
    // idle variation (one-shot) — only when properly idle
    if (s < 0.2 && state.grounded && !this.jumpPhase) { this.idleTime += dt; } else { this.idleTime = 0; this.lookAround = 0; }
    if (this.idleTime > this.nextLook) { this.lookAround = 2.2; this.idleTime = 0; this.nextLook = 6 + Math.random() * 6; }
    if (this.lookAround > 0) this.lookAround -= dt;
    if (a.idle) a.idle.setEffectiveWeight(w.idle);
    if (a.walk) a.walk.setEffectiveWeight(w.walk);
    if (a.run) a.run.setEffectiveWeight(w.run);
    if (a.jump) a.jump.setEffectiveWeight(w.jump);
    // stride matching: scale clip speed to the real speed, keep walk/run in phase
    if (a.walk) a.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(Math.max(s, 0.8) / CLIP_SPEED.walk, 0.55, 1.7));
    if (a.run) a.run.setEffectiveTimeScale(THREE.MathUtils.clamp(Math.max(s, 2.5) / CLIP_SPEED.run, 0.6, 1.5));
    if (a.walk && a.run && w.run > 0.01 && w.walk > 0.01) a.run.time = (a.walk.time / a.walk.getClip().duration) * a.run.getClip().duration;
    this.mixer.update(dt);

    // --- procedural layer (after the mixer) ---
    const B = this.bones;
    // lean forward with acceleration, back when stopping; lean into turns
    const leanX = THREE.MathUtils.clamp(state.accel * 0.02 + (s > 1 ? s * 0.012 : 0), -0.18, 0.28);
    const leanZ = THREE.MathUtils.clamp(-state.turnRate * 0.045 * Math.min(1, s / 3), -0.22, 0.22);
    this.leanX += (leanX - this.leanX) * k(6); this.leanZ += (leanZ - this.leanZ) * k(6);
    if (B.Spine) { B.Spine.rotation.x += this.leanX * 0.6; B.Spine.rotation.z += this.leanZ * 0.6; }
    if (B.Spine1) { B.Spine1.rotation.x += this.leanX * 0.4; B.Spine1.rotation.z += this.leanZ * 0.4; }
    // head: look at a point of interest, or glance around when idle
    let hy = 0, hp = 0;
    if (this.lookTarget && B.Head) {
      const hp3 = new THREE.Vector3(); B.Head.getWorldPosition(hp3);
      const d = this.lookTarget.clone().sub(hp3);
      const dist = d.length();
      if (dist < 7) {
        const ang = Math.atan2(d.x, d.z) - this.root.rotation.y;
        let yaw = ang; while (yaw > Math.PI) yaw -= Math.PI * 2; while (yaw < -Math.PI) yaw += Math.PI * 2;
        if (Math.abs(yaw) < 1.3) { hy = THREE.MathUtils.clamp(yaw, -0.8, 0.8); hp = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.5, 0.4); }
      }
    }
    if (this.lookAround > 0) { const t = 2.2 - this.lookAround; hy += Math.sin(t * 2.4) * 0.55; hp += Math.sin(t * 1.3) * 0.08; }
    this.headYaw += (hy - this.headYaw) * k(5); this.headPitch += (hp - this.headPitch) * k(5);
    if (B.Head) { B.Head.rotation.y += this.headYaw * 0.65; B.Head.rotation.x -= this.headPitch * 0.7; }
    if (B.Neck) { B.Neck.rotation.y += this.headYaw * 0.35; }
    // blob shadow
    if (this.blob) {
      const p = this.root.position;
      this.blob.position.set(p.x, state.groundY + 0.015, p.z);
      const hgt = Math.max(0, p.y - state.groundY);
      this.blob.scale.setScalar(Math.max(0.5, 1 - hgt * 0.1));
      this.blob.material.opacity = Math.max(0.1, 0.9 - hgt * 0.15) * (state.blobStrength === undefined ? 1 : state.blobStrength);
    }
  }
}
