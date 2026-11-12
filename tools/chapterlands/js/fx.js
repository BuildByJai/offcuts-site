// Feedback effects: pooled particles (dust, sparkles), expanding ring puffs,
// a speed-line overlay, coins flying to the HUD, and attachJuice() which wires
// all of it (plus sounds and camera shake / FOV) to the player's move events.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Sfx } from './audio.js';

/* =============== particles =============== */
// One Points draw call per system. CPU-simulated; dead particles have alpha 0.
export class Particles {
  constructor(scene, { capacity = 500, additive = false, star = false } = {}) {
    this.n = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.s0 = new Float32Array(capacity);
    this.s1 = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.uniforms = { uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale;
        varying vec3 vC; varying float vA;
        void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aAlpha > 0.0 ? aSize * uScale / max(0.1, -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 p = gl_PointCoord - 0.5;
          ${star
            ? 'float a = max(smoothstep(0.5, 0.0, abs(p.x)) * smoothstep(0.1, 0.0, abs(p.y)), smoothstep(0.5, 0.0, abs(p.y)) * smoothstep(0.1, 0.0, abs(p.x))); a = max(a, smoothstep(0.22, 0.0, length(p)));'
            : 'float a = smoothstep(0.5, 0.28, length(p));'}
          if (a * vA < 0.01) discard;
          gl_FragColor = vec4(vC, a * vA);
          #include <colorspace_fragment>
        }`
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this._c = new THREE.Color();
  }
  emit(x, y, z, { vx = 0, vy = 0, vz = 0, color = 0xffffff, size = 0.3, size1 = null, life = 0.6, alpha = 1, gravity = 0, drag = 1.5, spread = 0 } = {}) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx + (Math.random() - 0.5) * spread;
    this.vel[i * 3 + 1] = vy + (Math.random() - 0.5) * spread;
    this.vel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread;
    this._c.set(color);
    this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
    this.life[i] = life; this.max[i] = life;
    this.s0[i] = size; this.s1[i] = size1 == null ? size : size1;
    this.a0[i] = alpha; this.alpha[i] = alpha; this.size[i] = size;
    this.grav[i] = gravity; this.drag[i] = drag;
  }
  update(dt, camera, renderer) {
    if (camera && renderer) {
      const h = renderer.domElement.height;
      this.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    }
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; any = true; } continue; }
      any = true;
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.max[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      this.alpha[i] = this.life[i] > 0 ? this.a0[i] * (1 - k * k) : 0;
    }
    if (any) {
      const a = this.geo.attributes;
      a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
    }
  }
}

/* =============== ring puffs =============== */
export class Rings {
  constructor(scene, count = 10) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.75, 1, 32);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      m.visible = false; m.renderOrder = 6;
      scene.add(m);
      this.items.push({ m, t: 0, life: 0 });
    }
    this.head = 0;
  }
  // flat: lies on the ground (pound shockwave); otherwise horizontal halo (double jump).
  spawn(x, y, z, { color = 0xffffff, from = 0.3, to = 1.6, life = 0.35, opacity = 0.8, flat = true } = {}) {
    const it = this.items[this.head]; this.head = (this.head + 1) % this.items.length;
    it.m.position.set(x, y, z);
    it.m.rotation.set(flat ? -Math.PI / 2 : -Math.PI / 2, 0, 0);
    it.m.material.color.set(color);
    it.from = from; it.to = to; it.t = 0; it.life = life; it.op = opacity;
    it.m.visible = true;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) { it.m.visible = false; continue; }
      const e = 1 - (1 - k) * (1 - k);
      it.m.scale.setScalar(it.from + (it.to - it.from) * e);
      it.m.material.opacity = it.op * (1 - k);
    }
  }
}

/* =============== screen overlays =============== */
let speedEl = null;
export function speedLines(k) {
  if (!speedEl) {
    speedEl = document.createElement('div');
    speedEl.id = 'speedlines';
    document.body.appendChild(speedEl);
  }
  const v = Math.max(0, Math.min(1, k));
  speedEl.style.opacity = v.toFixed(3);
  speedEl.style.display = v > 0.01 ? 'block' : 'none';
}

// A coin icon flies from a screen point into a HUD element, which then bumps.
export function flyToHud(sx, sy, target, { icon = '🪙', onArrive = null } = {}) {
  if (!target) { if (onArrive) onArrive(); return; }
  const r = target.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly-coin';
  el.textContent = icon;
  el.style.left = sx + 'px'; el.style.top = sy + 'px';
  document.body.appendChild(el);
  const tx = r.left + 22 - sx, ty = r.top + r.height / 2 - sy;
  const midX = tx * 0.35 + (Math.random() - 0.5) * 60, midY = Math.min(ty, 0) - 60;
  const anim = el.animate([
    { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1 },
    { transform: `translate(calc(-50% + ${midX}px), calc(-50% + ${midY}px)) scale(1.1)`, opacity: 1, offset: 0.45 },
    { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0.7)`, opacity: 0.9 }
  ], { duration: 620, easing: 'cubic-bezier(.5,0,.6,1)' });
  anim.onfinish = () => {
    el.remove();
    target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump');
    if (onArrive) onArrive();
  };
}

const _proj = new THREE.Vector3();
export function toScreen(v, camera) {
  _proj.copy(v).project(camera);
  return { x: (_proj.x + 1) / 2 * innerWidth, y: (1 - _proj.y) / 2 * innerHeight, behind: _proj.z > 1 };
}

/* =============== juice: move feedback =============== */
// Wires particles, rings, sounds, shake and FOV to a player. Returns an object
// with update(dt) to call once per frame after the player and camera update.
export function attachJuice({ scene, player, cam, camera, renderer }) {
  const dust = new Particles(scene, { capacity: 260 });
  const spark = new Particles(scene, { capacity: 220, additive: true, star: true });
  const rings = new Rings(scene, 10);
  const DUST = 0xcab79a;
  const p = player.pos;

  function puff(n, { speed = 2.2, up = 0.6, size = 0.45, size1 = 1.1, life = 0.5, color = DUST, y = 0.1, spread = 0.5 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.6 + Math.random() * 0.6);
      dust.emit(p.x + Math.cos(a) * 0.25, p.y + y, p.z + Math.sin(a) * 0.25, {
        vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s,
        color, size, size1, life: life * (0.7 + Math.random() * 0.6), alpha: 0.7, drag: 3.5, spread
      });
    }
  }
  function sparkle(x, y, z, n, color = 0xfff0a0, { speed = 3, life = 0.5, size = 0.35 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      spark.emit(x, y, z, { vx: Math.cos(a) * Math.cos(b) * speed, vy: Math.sin(b) * speed + 1, vz: Math.sin(a) * Math.cos(b) * speed, color, size, size1: 0.05, life: life * (0.6 + Math.random() * 0.8), drag: 2.5, gravity: 2 });
    }
  }

  player.on('jump', () => { puff(5, { speed: 1.6, up: 0.3, life: 0.35 }); });
  player.on('land', (fs) => {
    if (fs > 9) { puff(Math.min(14, 4 + Math.round(fs / 3)), { speed: 1.5 + fs * 0.12, size1: 1.3 }); Sfx.land(); }
    else if (fs > 5) puff(4, { speed: 1.4, life: 0.35 });
    if (fs > 20) cam.shake(Math.min(0.5, (fs - 20) * 0.025));
  });
  player.on('sprintStart', () => puff(6, { speed: 1.8, up: 0.4 }));
  player.on('turn', () => puff(5, { speed: 2.2, up: 0.4 }));
  player.on('step', () => { dust.emit(p.x, p.y + 0.08, p.z, { vy: 0.5, color: DUST, size: 0.35, size1: 0.8, life: 0.4, alpha: 0.5, spread: 0.8 }); });
  player.on('doubleJump', (n) => {
    rings.spawn(p.x, p.y + 0.05, p.z, { color: n > 1 ? 0xb7a8ff : 0xffffff, from: 0.3, to: 1.5, life: 0.32 });
    Sfx.doubleJump(n);
  });
  player.on('superCharge', () => Sfx.charge());
  player.on('superJump', (k) => {
    rings.spawn(p.x, p.y + 0.05, p.z, { color: 0xffd23f, from: 0.4, to: 2.4 + k * 1.5, life: 0.45 });
    puff(10 + Math.round(k * 8), { speed: 3 + k * 2, up: 0.5 });
    sparkle(p.x, p.y + 0.5, p.z, 10 + Math.round(k * 10), 0xffd23f);
    cam.shake(0.08 + k * 0.12);
    Sfx.superJump(k);
  });
  player.on('slide', () => { puff(6, { speed: 1.5, up: 0.3 }); Sfx.slide(); });
  player.on('longJump', () => { Sfx.jump(); });
  player.on('dash', () => {
    rings.spawn(p.x, p.y + 0.9, p.z, { color: 0xbfe8ff, from: 0.3, to: 1.2, life: 0.25 });
    cam.fovKick(9);
    Sfx.dash();
  });
  player.on('wallJump', () => {
    for (let i = 0; i < 5; i++) dust.emit(p.x - player.wall.nx * 0.3, p.y + 1, p.z - player.wall.nz * 0.3, { vx: player.wall.nx * 2, vy: 1, vz: player.wall.nz * 2, spread: 1.5, color: DUST, size: 0.3, size1: 0.8, life: 0.4, alpha: 0.6 });
    Sfx.wallJump();
  });
  player.on('ledgeGrab', () => Sfx.click());
  player.on('pullUp', () => Sfx.jump());
  player.on('glideStart', () => Sfx.glide());
  player.on('poundStart', () => Sfx.poundStart());
  player.on('poundLand', () => {
    rings.spawn(p.x, p.y + 0.06, p.z, { color: 0xffffff, from: 0.3, to: 3.4, life: 0.4, opacity: 0.9 });
    puff(16, { speed: 5, up: 0.6, size1: 1.4 });
    cam.shake(0.45);
    Sfx.poundLand();
  });
  player.on('tired', () => Sfx.denied());
  player.on('ride', (kind) => { if (kind === 'zip') Sfx.zip(); if (kind === 'rail') Sfx.rail(); });

  let wasBoost = false;
  const juice = {
    dust, spark, rings, puff, sparkle,
    update(dt) {
      // footstep trail while speed shoes are on
      if (player.boosts.speed > 0 && player.grounded && player.speedH > 6 && Math.random() < dt * 30) {
        spark.emit(p.x, p.y + 0.3, p.z, { color: 0x7fd6ff, size: 0.35, size1: 0.05, life: 0.5, spread: 0.4 });
      }
      if (player.boosts.rocket > 0 && !player.grounded && Math.random() < dt * 25) {
        spark.emit(p.x, p.y + 0.1, p.z, { vy: -2, color: 0xff9a3c, size: 0.4, size1: 0.05, life: 0.4, spread: 0.6 });
      }
      // charge glow at the feet
      if (player.charging) {
        const k = player.chargeLevel;
        if (Math.random() < dt * (10 + k * 40)) {
          const a = Math.random() * Math.PI * 2;
          spark.emit(p.x + Math.cos(a) * 0.8, p.y + 0.1, p.z + Math.sin(a) * 0.8, { vx: -Math.cos(a) * 1.2, vy: 1.5 + k * 2, vz: -Math.sin(a) * 1.2, color: k >= 1 ? 0xffffff : 0xffd23f, size: 0.3, size1: 0.05, life: 0.5 });
        }
      }
      if (player.gliding && Math.random() < dt * 8) {
        dust.emit(p.x, p.y + 2.3, p.z, { vy: 0.2, color: 0xffffff, size: 0.25, size1: 0.6, life: 0.6, alpha: 0.35, spread: 0.6 });
      }
      // speed lines + FOV while sprinting / dashing / flying fast
      const hs = player.speedH, vs = Math.abs(player.vel.y);
      const fast = Math.max(0, (Math.max(hs, player.ride ? hs : 0) - CONFIG.movement.sprintSpeed + 1) / 8);
      const lines = player.dashT > 0 ? 0.9 : Math.min(0.75, fast + (vs > 18 ? 0.3 : 0));
      speedLines(lines);
      wasBoost = player.boosts.speed > 0;
      dust.update(dt, camera, renderer);
      spark.update(dt, camera, renderer);
      rings.update(dt);
    }
  };
  return juice;
}
