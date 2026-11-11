// Player: a blocky procedural character plus a "platformer-feel" controller.
//
// Phase 1 feel is unchanged: quick accel, coyote time, jump buffer, variable
// jump height, step-up and ledge mantle — and Jump still fires on the press.
// Phase 3 adds a move set on top:
//   free:   double jump · super jump (charge button) · slide · ledge grab
//   bought: dash · wall jump · glide · ground pound · triple jump
// plus stamina, timed boosts and "rides" (ziplines, rails, ladders, cannons)
// which gadgets.js attaches via player.attach(ride).
//
// Everything the rest of the game reacts to goes out as events:
//   player.on('doubleJump', fn) … see EVENTS below. onJump / onLand still work.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { canvasTexture } from './world.js';
import { toon, addOutline } from './gfx.js';

const EPS = 0.001;
const TAU = Math.PI * 2;

/* ---------------- character model ---------------- */
const DEFAULT_LOOK = { skin: 0xf0c08a, shirt: 0x1f8a4c, pants: 0x2b3442, hair: 0x3a2618, shoe: 0x1d1d1d };
function part(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
// A limb hangs from a pivot group so it can swing from the shoulder / hip.
function limb(w, h, d, mat, px, py) {
  const g = new THREE.Group();
  g.position.set(px, py, 0);
  g.add(part(w, h, d, mat, 0, -h / 2, 0));
  return g;
}

let faceTex = null;
export function buildCharacter(look = {}) {
  const L = Object.assign({}, DEFAULT_LOOK, look);
  const SKIN = toon({ color: L.skin }), SHIRT = toon({ color: L.shirt }), PANTS = toon({ color: L.pants });
  const HAIR = toon({ color: L.hair }), SHOE = toon({ color: L.shoe });
  const root = new THREE.Group();
  const body = new THREE.Group();          // everything that squashes / leans / spins
  root.add(body);

  const legL = limb(0.3, 0.86, 0.32, PANTS, -0.17, 0.86);
  const legR = limb(0.3, 0.86, 0.32, PANTS, 0.17, 0.86);
  legL.children[0].add(part(0.32, 0.12, 0.38, SHOE, 0, -0.38, 0.03));
  legR.children[0].add(part(0.32, 0.12, 0.38, SHOE, 0, -0.38, 0.03));
  const torso = part(0.7, 0.78, 0.38, SHIRT, 0, 1.25, 0);
  const armL = limb(0.24, 0.76, 0.28, SHIRT, -0.48, 1.6);
  const armR = limb(0.24, 0.76, 0.28, SHIRT, 0.48, 1.6);
  armL.children[0].add(part(0.22, 0.16, 0.26, SKIN, 0, -0.38, 0));
  armR.children[0].add(part(0.22, 0.16, 0.26, SKIN, 0, -0.38, 0));
  const head = new THREE.Group();
  head.position.set(0, 1.66, 0);
  head.add(part(0.5, 0.48, 0.48, SKIN, 0, 0.26, 0));
  head.add(part(0.54, 0.14, 0.52, HAIR, 0, 0.53, -0.01));
  head.add(part(0.54, 0.3, 0.12, HAIR, 0, 0.36, -0.22));
  if (!faceTex) {
    faceTex = canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(18, 22, 7, 10); ctx.fillRect(39, 22, 7, 10);
      ctx.fillStyle = 'rgba(255,120,120,0.35)'; ctx.fillRect(12, 34, 8, 4); ctx.fillRect(44, 34, 8, 4);
      ctx.lineWidth = 4; ctx.strokeStyle = '#1b1b1b'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(32, 36, 11, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    });
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  face.position.set(0, 0.25, 0.245);
  head.add(face);

  body.add(legL, legR, torso, armL, armR, head);
  // overall scale so the model is ~1.8 tall, matching the collider
  root.scale.setScalar(0.85);
  // blob shadow helps read jump height even when real shadows are off
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;
  return { root, body, legL, legR, armL, armR, torso, head, blob };
}

// Umbrella for the glide — hidden until used.
function buildUmbrella() {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.5, 8, 1, true), toon({ color: 0xe94f6a, side: THREE.DoubleSide, flatShading: true }));
  canopy.position.y = 0.95;
  const stripe = new THREE.Mesh(new THREE.ConeGeometry(1.01, 0.5, 8, 1, true, 0, Math.PI / 4), toon({ color: 0xfbf7ee, side: THREE.DoubleSide, flatShading: true }));
  stripe.position.y = 0.95;
  const stripe2 = stripe.clone(); stripe2.rotation.y = Math.PI / 2;
  const stripe3 = stripe.clone(); stripe3.rotation.y = Math.PI;
  const stripe4 = stripe.clone(); stripe4.rotation.y = Math.PI * 1.5;
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), toon({ color: 0x3a2a20 }));
  stick.position.y = 0.5;
  g.add(canopy, stripe, stripe2, stripe3, stripe4, stick);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  return g;
}

/* ---------------- controller ---------------- */
// Events: jump · doubleJump(n) · land(fallSpeed) · superCharge · superJump(k) · slide · longJump ·
// ledgeGrab · pullUp · dash · wallJump · wallSlide · glideStart · glideEnd · poundStart · poundLand(info) ·
// sprintStart · turn · step · ride(kind) · unride(kind) · tired · trick(name)
export class Player {
  constructor(scene, world, opts = {}) {
    this.cfg = Object.assign({}, CONFIG.movement, opts);
    this.m = Object.assign({}, CONFIG.moves, opts.moves || {});
    this.st = Object.assign({}, CONFIG.stamina, opts.stamina || {});
    this.world = world;
    this.scene = scene;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.airTime = 0;
    this.landTimer = 0;
    this.landSquash = 0.18;
    this.stretchTimer = 0;
    this.climbTimer = 0;
    this.stepPhase = 0;
    this.safe = new THREE.Vector3();
    this.safeTimer = 0;
    this.groundedFor = 0;
    this.sprinting = false;
    this.ground = null;          // collider we're standing on (null in the air)
    this.boostTimer = 0;         // speed-pad boost
    this.boostMult = 1;
    this.onJump = null; this.onLand = null;
    this._ev = {};

    // abilities: free ones on, bought ones off until setUnlocks()
    this.abilities = { doubleJump: true, superJump: true, slide: true, ledgeGrab: true,
      dash: false, wallJump: false, glide: false, groundPound: false, tripleJump: false };
    this.stamina = this.st.max;
    this.staminaDelay = 0;
    this.boosts = { rocket: 0, speed: 0, magnet: 0 };
    this.airJumps = 0;
    this.airDashUsed = false;
    this.airPressed = false;
    this.charging = false; this.chargeT = 0;
    this.sliding = false; this.slideT = 0;
    this.dashT = 0; this.dashDir = new THREE.Vector2();
    this.gliding = false;
    this.pound = null;
    this.ledge = null;
    this.ride = null;
    this.wall = { nx: 0, nz: 0, t: 0 };
    this.wallSliding = false;
    this.momentum = false;       // keep air speed after long jumps / flings
    this.controlLock = 0;
    this.superJumping = false;
    this.springing = false;
    this.spinT = 0;
    this.updraft = 0;            // set each frame by vents
    this.turnRate = 0;
    this._turnCd = 0;
    this._wasSprinting = false;
    this.frozen = false;         // e.g. inside a cannon

    this.rig = buildCharacter(opts.look);
    this.umbrella = buildUmbrella();
    this.rig.root.add(this.umbrella);
    this.umbrella.position.set(0, 2.05, 0);
    if (opts.outline !== false) addOutline(this.rig.root);
    scene.add(this.rig.root);
    scene.add(this.rig.blob);
  }

  /* ---------- events ---------- */
  on(ev, fn) { (this._ev[ev] || (this._ev[ev] = [])).push(fn); return this; }
  emit(ev, a, b) {
    const l = this._ev[ev];
    if (l) for (const fn of l) fn(a, b);
  }
  trick(name) { this.emit('trick', name); }

  setUnlocks(u) { for (const k of Object.keys(u)) if (k in this.abilities) this.abilities[k] = !!u[k]; }
  get H() { return this.sliding ? this.m.slideHeight : this.cfg.height; }
  get speedH() { return Math.hypot(this.vel.x, this.vel.z); }
  get chargeLevel() { return this.charging ? Math.min(1, this.chargeT / this.m.superJumpChargeTime) : 0; }
  get airborne() { return !this.grounded && !this.ride && !this.ledge; }
  get jumpVelocity() {
    const r = this.boosts.rocket > 0 ? CONFIG.shop.rocketJumpMult : 1;
    return Math.sqrt(2 * this.cfg.gravity * this.cfg.jumpHeight * r);
  }
  get state() {
    if (this.ride) return this.ride.kind;
    if (this.ledge) return 'ledge';
    if (this.charging) return 'charge';
    if (this.sliding) return 'slide';
    if (this.dashT > 0) return 'dash';
    if (this.pound) return 'pound';
    if (this.gliding) return 'glide';
    if (!this.grounded) return this.vel.y > 0 ? 'jump' : 'fall';
    return this.speedH > 0.4 ? 'run' : 'idle';
  }

  teleport(x, y, z, facing = this.facing) {
    if (this.ride) this.detach(null, true);
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.boostTimer = 0; this.boostMult = 1; this.springing = false; this.ground = null;
    this.facing = facing;
    this.safe.set(x, y, z);
    this.grounded = false;
    this._resetMoves();
    this._sync(0);
  }
  _resetMoves() {
    this.charging = false; this.sliding = false; this.dashT = 0; this.gliding = false; this.pound = null;
    this.ledge = null; this.airJumps = 0; this.airDashUsed = false; this.airPressed = false; this.momentum = false;
    this.superJumping = false; this.controlLock = 0; this.frozen = false; this.umbrella.visible = false;
    this.rig.root.visible = true;
  }

  // Speed pads: multiply top speed for a while.
  boost(mult, seconds) { this.boostMult = mult; this.boostTimer = seconds; }
  // Timed shop / orb boosts.
  addBoost(id, secs) { this.boosts[id] = Math.max(this.boosts[id] || 0, secs); }
  // Springs: launch upwards to a given height regardless of jump input.
  launch(height, { keepSpeed = false } = {}) {
    this.vel.y = Math.sqrt(2 * this.cfg.gravity * height);
    if (!keepSpeed) {
      // springs are meant to be predictable: drop any speed boost and cap sideways speed
      this.boostTimer = 0; this.boostMult = 1;
      const hs = Math.hypot(this.vel.x, this.vel.z), cap = this.cfg.walkSpeed;
      if (hs > cap) { this.vel.x *= cap / hs; this.vel.z *= cap / hs; }
    }
    this._goAirborne();
    this.springing = true;
  }
  // Set velocity outright (jump rings, cannons, ride exits). Keeps the speed in the air.
  fling(vx, vy, vz) {
    this.vel.set(vx, vy, vz);
    this._goAirborne();
    this.springing = true; this.momentum = true;
    if (Math.abs(vx) + Math.abs(vz) > 0.1) this.facing = Math.atan2(vx, vz);
  }
  _goAirborne() {
    this.grounded = false; this.coyote = 0; this.buffer = 0; this.ground = null;
    this.airJumps = 0; this.airDashUsed = false; this.airPressed = false;
    this.gliding = false; this.pound = null; this.dashT = 0; this.sliding = false; this.charging = false;
    this.umbrella.visible = false;
  }

  /* ---------- rides (zipline / rail / ladder / cannon) ---------- */
  attach(ride) {
    if (this.ride) this.detach(null, true);
    this._resetMoves();
    this.ride = ride;
    this.grounded = false; this.ground = null;
    this.emit('ride', ride.kind);
    this.trick(ride.kind);
  }
  detach(vel, silent = false) {
    const r = this.ride;
    if (!r) return;
    this.ride = null;
    this.rig.root.visible = true;
    this.frozen = false;
    if (vel) {
      this.vel.set(vel.x, vel.y, vel.z);
      this.grounded = false; this.coyote = 0; this.momentum = true;
      this.airJumps = 0; this.airDashUsed = false;
    }
    if (r.onDetach) r.onDetach(this);
    if (!silent) this.emit('unride', r.kind);
  }

  // camYaw: camera yaw so input is camera-relative.
  update(dt, input, camYaw) {
    const c = this.cfg, m = this.m;
    const mv = input.getMove();
    // camera-relative wish direction
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = rx * mv.x + fx * mv.y, wz = rz * mv.x + fz * mv.y;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) { wx /= wl; wz /= wl; }
    const jumpPressed = input.consumeJump();
    const chargePressed = typeof input.consumeCharge === 'function' ? input.consumeCharge() : false;
    const dashPressed = typeof input.consumeDash === 'function' ? input.consumeDash() : false;
    const chargeHeld = !!input.chargeHeld;
    const held = input.jumpHeld;

    // timers
    for (const k of Object.keys(this.boosts)) if (this.boosts[k] > 0) this.boosts[k] = Math.max(0, this.boosts[k] - dt);
    if (this.boostTimer > 0) { this.boostTimer -= dt; if (this.boostTimer <= 0) this.boostMult = 1; }
    if (this.stretchTimer > 0) this.stretchTimer -= dt;
    if (this.spinT > 0) this.spinT -= dt;
    if (this._turnCd > 0) this._turnCd -= dt;
    if (this.controlLock > 0) this.controlLock -= dt;

    // stamina refills on the ground
    if (this.grounded && !this.charging) {
      if (this.staminaDelay > 0) this.staminaDelay -= dt;
      else this.stamina = Math.min(this.st.max, this.stamina + dt * this.st.max / this.st.regenTime);
    }

    if (this.ride) {
      this.ride.update(this, dt, { mv, wx, wz, wl, jumpPressed, held, chargePressed, dashPressed, camYaw });
      this._sync(dt);
      return;
    }
    if (this.ledge) {
      this._ledgeUpdate(dt, jumpPressed, chargePressed, wx, wz, mv.mag);
      this._sync(dt);
      return;
    }

    const speedMult = this.boosts.speed > 0 ? CONFIG.shop.speedSprintMult : 1;
    this.sprinting = input.sprint && mv.mag > 0.1;
    let top = (this.sprinting ? c.sprintSpeed * speedMult : c.walkSpeed) * mv.mag * this.boostMult;

    // ----- charge button: super jump / slide / ground pound -----
    if (chargePressed && !this.frozen) {
      if (this.grounded && !this.sliding) {
        if (this.sprinting && this.speedH > c.walkSpeed + 0.5 && this.abilities.slide) this._startSlide();
        else if (this.abilities.superJump) {
          if (this.stamina < 0.08) this.emit('tired');
          else { this.charging = true; this.chargeT = 0; this.emit('superCharge'); }
        }
      } else if (!this.grounded && this.abilities.groundPound && !this.pound) this._startPound();
    }
    if (this.charging) {
      if (!this.grounded) this.charging = false;
      else {
        this.chargeT = Math.min(m.superJumpChargeTime, this.chargeT + dt);
        if (mv.mag > 0.1) this.facing = turnToward(this.facing, Math.atan2(wx, wz), dt * c.turnSpeed);
        if (!chargeHeld) this._superJump();
      }
      top = 0;
    }

    // ----- dash -----
    if (dashPressed && this.abilities.dash && !this.charging && this.dashT <= 0 && !this.pound &&
        (this.grounded || !this.airDashUsed)) {
      if (this.stamina < this.st.dash) this.emit('tired');
      else {
        this.stamina -= this.st.dash; this.staminaDelay = this.st.regenDelay;
        let dx = wl > 1e-4 ? wx : Math.sin(this.facing), dz = wl > 1e-4 ? wz : Math.cos(this.facing);
        this.dashDir.set(dx, dz);
        this.dashT = m.dashTime;
        if (!this.grounded) this.airDashUsed = true;
        this.gliding = false; this.umbrella.visible = false;
        if (this.sliding) this._tryStand(true);
        this.facing = Math.atan2(dx, dz);
        this.emit('dash');
        if (!this.grounded) this.trick('dash');
      }
    }

    if (jumpPressed) {
      this.buffer = c.jumpBuffer;
      if (!this.grounded) this.airPressed = true;
    }

    const prevFacing = this.facing;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps && !this.ledge; i++) this._step(h, wx * top, wz * top, mv.mag, held, wx, wz);

    // facing follows movement direction
    if (!this.charging && this.dashT <= 0 && !this.gliding && mv.mag > 0.1 && this.speedH > 0.3 && !this.sliding) {
      this.facing = turnToward(this.facing, Math.atan2(wx, wz), dt * c.turnSpeed);
    } else if (this.sliding && this.speedH > 0.5) {
      this.facing = turnToward(this.facing, Math.atan2(this.vel.x, this.vel.z), dt * 10);
    }
    let df = this.facing - prevFacing;
    while (df > Math.PI) df -= TAU;
    while (df < -Math.PI) df += TAU;
    this.turnRate += ((dt > 0 ? df / dt : 0) - this.turnRate) * Math.min(1, dt * 10);

    // sprint start / sharp turns (for dust puffs)
    const sprintingNow = this.grounded && this.sprinting && this.speedH > 4;
    if (sprintingNow && !this._wasSprinting) this.emit('sprintStart');
    this._wasSprinting = sprintingNow;
    if (this.grounded && this.speedH > 7 && mv.mag > 0.5 && this._turnCd <= 0) {
      const dot = (this.vel.x * wx + this.vel.z * wz) / this.speedH;
      if (dot < -0.3) { this.emit('turn'); this._turnCd = 0.35; }
    }

    // remember a safe spot to respawn at if we fall out of the world
    if (this.grounded) {
      this.groundedFor += dt;
      this.safeTimer += dt;
      if (this.safeTimer > 0.5 && this.groundedFor > 0.3) { this.safe.copy(this.pos); this.safeTimer = 0; }
    } else this.groundedFor = 0;
    if (this.pos.y < -15) this.teleport(this.safe.x, this.safe.y + 0.5, this.safe.z);

    this._sync(dt);
  }

  /* ---------- move starters ---------- */
  _groundJump() {
    this.vel.y = this.jumpVelocity;
    this.grounded = false;
    this.coyote = 0; this.buffer = 0;
    this.stretchTimer = 0.2;
    if (this.onJump) this.onJump();
    this.emit('jump');
  }
  _airJump() {
    this.airJumps++;
    const f = this.airJumps === 1 ? this.m.doubleJumpFactor : this.m.tripleJumpFactor;
    this.vel.y = this.jumpVelocity * Math.sqrt(f);
    this.buffer = 0;
    this.springing = false;
    this.spinT = 0.42;
    this.stretchTimer = 0.18;
    this.gliding = false; this.umbrella.visible = false;
    this.emit('doubleJump', this.airJumps);
    this.trick(this.airJumps === 1 ? 'double jump' : 'triple jump');
  }
  _wallJump() {
    const m = this.m, w = this.wall;
    const r = this.boosts.rocket > 0 ? CONFIG.shop.rocketJumpMult : 1;
    this.vel.y = Math.sqrt(2 * this.cfg.gravity * m.wallJumpHeight * r);
    this.vel.x = w.nx * m.wallJumpPush; this.vel.z = w.nz * m.wallJumpPush;
    this.facing = Math.atan2(w.nx, w.nz);
    this.buffer = 0; this.wall.t = 0;
    this.controlLock = 0.16; this.momentum = true; this.springing = false;
    this.airDashUsed = false;
    this.gliding = false; this.umbrella.visible = false;
    this.stretchTimer = 0.16;
    this.emit('wallJump');
    this.trick('wall jump');
  }
  _superJump() {
    const m = this.m, st = this.st;
    let k = Math.min(1, this.chargeT / m.superJumpChargeTime);
    const need = st.superJump * Math.max(0.25, k);
    if (this.stamina < need) k = Math.max(0, this.stamina / st.superJump);
    this.stamina = Math.max(0, this.stamina - st.superJump * Math.max(0.25, k));
    this.staminaDelay = st.regenDelay;
    this.charging = false;
    const r = this.boosts.rocket > 0 ? CONFIG.shop.rocketJumpMult : 1;
    const hgt = this.cfg.jumpHeight * (m.superJumpMin + (m.superJumpMax - m.superJumpMin) * k) * r;
    this.vel.y = Math.sqrt(2 * this.cfg.gravity * hgt);
    this.grounded = false; this.coyote = 0; this.buffer = 0;
    this.springing = true; this.superJumping = true;
    this.stretchTimer = 0.28;
    this.emit('superJump', k);
    if (this.onJump) this.onJump();
  }
  _startSlide() {
    const m = this.m;
    const s = Math.max(this.speedH, m.slideSpeed);
    const hs = this.speedH || 1;
    const dx = this.speedH > 0.1 ? this.vel.x / hs : Math.sin(this.facing), dz = this.speedH > 0.1 ? this.vel.z / hs : Math.cos(this.facing);
    this.vel.x = dx * s; this.vel.z = dz * s;
    this.sliding = true; this.slideT = m.slideTime;
    this.emit('slide');
  }
  _tryStand(force = false) {
    if (!this.sliding) return true;
    for (const b of this.world.colliders) {
      if (this._overlapsH(b, this.pos.x, this.pos.y, this.pos.z, this.cfg.height)) {
        if (!force) return false;
        return false;
      }
    }
    this.sliding = false;
    return true;
  }
  _longJump() {
    const m = this.m;
    const hs = this.speedH || 1;
    const dx = this.vel.x / hs, dz = this.vel.z / hs;
    const s = Math.max(this.speedH, m.longJumpSpeed);
    if (!this._tryStand()) return;   // no room to stand: keep sliding
    const r = this.boosts.rocket > 0 ? CONFIG.shop.rocketJumpMult : 1;
    this.vel.x = dx * s; this.vel.z = dz * s;
    this.vel.y = Math.sqrt(2 * this.cfg.gravity * m.longJumpHeight * r);
    this.grounded = false; this.coyote = 0; this.buffer = 0;
    this.momentum = true; this.springing = true;
    this.stretchTimer = 0.2;
    this.emit('longJump');
    this.emit('jump');
    this.trick('long jump');
  }
  _startPound() {
    this.pound = { phase: 'hover', t: 0 };
    this.vel.set(0, 0, 0);
    this.gliding = false; this.umbrella.visible = false; this.dashT = 0;
    this.spinT = 0.3;
    this.emit('poundStart');
  }

  /* ---------- ledge grab ---------- */
  _ledgeUpdate(dt, jumpPressed, chargePressed, wx, wz, mag) {
    const L = this.ledge, m = this.m;
    L.t += dt;
    if (L.phase === 'hang') {
      const away = mag > 0.3 && (wx * L.nx + wz * L.nz) > 0.6;
      if (chargePressed || away) {          // let go
        this.ledge = null;
        this.vel.set(L.nx * 2, 0, L.nz * 2);
        this.grounded = false;
        return;
      }
      if (jumpPressed || L.t >= m.ledgeHang) { L.phase = 'pull'; L.t = 0; this.emit('pullUp'); }
    } else {
      const k = Math.min(1, L.t / m.ledgePull);
      const up = Math.min(1, k / 0.6), fwd = Math.max(0, (k - 0.45) / 0.55);
      const e = (x) => 1 - (1 - x) * (1 - x);
      this.pos.y = L.from.y + (L.to.y - L.from.y) * e(up);
      this.pos.x = L.from.x + (L.to.x - L.from.x) * e(fwd);
      this.pos.z = L.from.z + (L.to.z - L.from.z) * e(fwd);
      if (k >= 1) {
        this.pos.copy(L.to);
        this.ledge = null;
        this.grounded = true; this.vel.set(0, 0, 0);
        this.airJumps = 0; this.airDashUsed = false; this.airPressed = false; this.momentum = false;
        this.landTimer = 0.1; this.landSquash = 0.12;
      }
    }
    this.vel.set(0, 0, 0);
  }

  _step(h, tvx, tvz, mag, held, wx, wz) {
    const c = this.cfg, m = this.m;
    const hsNow = Math.hypot(this.vel.x, this.vel.z);

    /* ----- horizontal ----- */
    if (this.dashT > 0) {
      this.dashT -= h;
      this.vel.x = this.dashDir.x * m.dashSpeed; this.vel.z = this.dashDir.y * m.dashSpeed;
      if (this.dashT <= 0) {
        const cap = c.sprintSpeed * 1.15;
        const hs = Math.hypot(this.vel.x, this.vel.z);
        if (hs > cap) { this.vel.x *= cap / hs; this.vel.z *= cap / hs; }
        if (!this.grounded) this.momentum = true;
      }
    } else if (this.pound) {
      this.vel.x = 0; this.vel.z = 0;
    } else if (this.sliding) {
      this.slideT -= h;
      const s = Math.max(0, hsNow - m.slideFriction * h);
      // gentle steering
      let ang = Math.atan2(this.vel.x, this.vel.z);
      if (mag > 0.2) ang = turnToward(ang, Math.atan2(wx, wz), h * 2.2);
      const crawl = Math.max(s, this._tryStandCheck() ? 0 : 2.5);
      this.vel.x = Math.sin(ang) * crawl; this.vel.z = Math.cos(ang) * crawl;
      if ((this.slideT <= 0 || s < c.walkSpeed * 0.55) && this.grounded) this._tryStand();
    } else if (this.gliding) {
      const f = this.facing;
      let nf = f;
      if (mag > 0.2) nf = turnToward(f, Math.atan2(wx, wz), h * m.glideTurn);
      this.facing = nf;
      const tx = Math.sin(nf) * m.glideSpeed, tz = Math.cos(nf) * m.glideSpeed;
      const k = Math.min(1, h * 3);
      this.vel.x += (tx - this.vel.x) * k; this.vel.z += (tz - this.vel.z) * k;
    } else if (this.controlLock <= 0 && !this.charging) {
      const accel = c.sprintSpeed * this.boostMult / c.accelTime;
      const decel = c.sprintSpeed / c.stopTime;
      let rate = mag > 0.05 ? accel : decel;
      let gx = tvx, gz = tvz;
      if (!this.grounded) {
        rate = accel * c.airControl;
        // momentum moves keep their speed in the air: steer, don't brake
        if (this.momentum) {
          const tl = Math.hypot(tvx, tvz);
          if (hsNow > tl) {
            const keep = Math.max(tl, hsNow - 3 * h);
            if (tl > 0.05) { gx = tvx / tl * keep; gz = tvz / tl * keep; }
            else { gx = this.vel.x / (hsNow || 1) * keep; gz = this.vel.z / (hsNow || 1) * keep; }
          }
        }
      }
      let dvx = gx - this.vel.x, dvz = gz - this.vel.z;
      const dl = Math.hypot(dvx, dvz), maxd = rate * h;
      if (dl > maxd) { dvx *= maxd / dl; dvz *= maxd / dl; }
      this.vel.x += dvx; this.vel.z += dvz;
    } else if (this.charging) {
      const k = Math.min(1, h * 18);
      this.vel.x -= this.vel.x * k; this.vel.z -= this.vel.z * k;
    }

    // timers
    if (this.grounded) this.coyote = c.coyoteTime; else this.coyote -= h;
    if (this.buffer > 0) this.buffer -= h;
    if (this.landTimer > 0) this.landTimer -= h;
    if (this.climbTimer > 0) this.climbTimer -= h;
    if (this.wall.t > 0) this.wall.t -= h;

    /* ----- jump (buffered, with coyote time) — always instant on press ----- */
    if (this.buffer > 0 && !this.charging && !this.pound) {
      if (this.grounded || this.coyote > 0) {
        if (this.sliding) this._longJump(); else this._groundJump();
      } else if (this.wall.t > 0 && this.abilities.wallJump) {
        this._wallJump();
      } else if (this.dashT <= 0 && !this._aboutToLand()) {
        const maxAir = this.abilities.doubleJump ? (this.abilities.tripleJump ? 2 : 1) : 0;
        if (this.airJumps < maxAir) this._airJump();
      }
    }

    /* ----- glide ----- */
    if (!this.gliding && this.abilities.glide && !this.grounded && held && this.airPressed && this.vel.y < 0 &&
        !this.pound && this.dashT <= 0 && this.stamina > 0.04) {
      this.gliding = true; this.umbrella.visible = true; this.momentum = false;
      this.emit('glideStart');
      this.trick('glide');
    }
    if (this.gliding) {
      this.stamina = Math.max(0, this.stamina - this.st.glidePerSec * h);
      this.staminaDelay = this.st.regenDelay;
      if (!held || this.stamina <= 0 || this.grounded) this._endGlide();
    }

    /* ----- vertical ----- */
    if (this.vel.y <= 0) { this.springing = false; }
    if (this.dashT > 0 && !this.grounded) {
      this.vel.y = 0;
    } else if (this.pound) {
      this.pound.t += h;
      if (this.pound.phase === 'hover') {
        this.vel.y = 0;
        if (this.pound.t >= m.poundHover) { this.pound.phase = 'slam'; this.pound.t = 0; this.vel.y = -m.poundSpeed; }
      } else this.vel.y = -m.poundSpeed;
    } else if (this.gliding) {
      this.vel.y -= c.gravity * 0.5 * h;
      if (this.vel.y < -m.glideFallSpeed) this.vel.y += Math.min(-m.glideFallSpeed - this.vel.y, c.gravity * 1.6 * h);
      if (this.updraft > 0) this.vel.y = Math.min(this.vel.y + this.updraft * h, 9);
    } else {
      // gravity — extra while rising with jump released = short hop
      const g = c.gravity * (this.vel.y > 0 && !held && !this.springing ? c.shortHopFactor : 1);
      this.vel.y = Math.max(this.vel.y - g * h, -c.terminalVelocity);
      // wall slide (needs wall jump)
      this.wallSliding = false;
      if (this.abilities.wallJump && this.wall.t > 0 && this.vel.y < -m.wallSlideSpeed && !this.grounded) {
        this.vel.y = -m.wallSlideSpeed;
        this.wallSliding = true;
      }
    }

    const wasGrounded = this.grounded;
    const fallSpeed = -this.vel.y;
    const wasPound = this.pound && this.pound.phase === 'slam';
    this._moveAxis(0, this.vel.x * h, wx, wz);
    if (this.ledge) return;
    this._moveAxis(2, this.vel.z * h, wx, wz);
    if (this.ledge) return;
    const landed = this._moveY(this.vel.y * h);
    this.grounded = landed;
    if (landed && !wasGrounded) {
      this.airJumps = 0; this.airDashUsed = false; this.airPressed = false;
      this.momentum = false; this.superJumping = false;
      if (this.gliding) this._endGlide();
      if (wasPound) {
        this.pound = null;
        this.landTimer = 0.22; this.landSquash = 0.32;
        this.emit('poundLand', { x: this.pos.x, y: this.pos.y, z: this.pos.z, ground: this.ground });
      } else {
        this.pound = null;
        if (fallSpeed > 7) { this.landTimer = 0.14; this.landSquash = Math.min(0.3, 0.1 + fallSpeed * 0.008); if (this.onLand) this.onLand(fallSpeed); }
      }
      this.emit('land', fallSpeed);
      this.airTime = 0;
    }
    if (!this.grounded) this.airTime += h;
    if (!this.grounded && this.sliding && this.airTime > 0.15) this._tryStand();
  }

  _endGlide() {
    if (!this.gliding) return;
    this.gliding = false; this.umbrella.visible = false;
    this.emit('glideEnd');
  }
  _aboutToLand() {
    if (this.vel.y >= 0) return false;
    const d = this.pos.y - this._groundBelow();
    return d < -this.vel.y * this.buffer + 0.05;
  }
  _tryStandCheck() {
    for (const b of this.world.colliders) if (this._overlapsH(b, this.pos.x, this.pos.y, this.pos.z, this.cfg.height)) return false;
    return true;
  }

  _overlapsH(b, x, y, z, H) {
    const r = this.cfg.radius;
    return x + r > b.x0 + EPS && x - r < b.x1 - EPS &&
           y + H > b.y0 + EPS && y < b.y1 - EPS &&
           z + r > b.z0 + EPS && z - r < b.z1 - EPS;
  }
  _overlaps(b, x, y, z) { return this._overlapsH(b, x, y, z, this.H); }
  _clearAt(x, y, z, H = this.H, ignore = null) {
    for (const b of this.world.colliders) if ((!ignore || !ignore.includes(b)) && this._overlapsH(b, x, y, z, H)) return false;
    return true;
  }
  // Top of the stack of boxes sitting on b, measured just inside the face we hit.
  _stackTop(b, axis, d, p) {
    const px = axis === 0 ? (d > 0 ? b.x0 + 0.05 : b.x1 - 0.05) : p.x;
    const pz = axis === 2 ? (d > 0 ? b.z0 + 0.05 : b.z1 - 0.05) : p.z;
    let top = b.y1;
    const members = [b];
    for (let k = 0; k < 4; k++) {
      let grew = false;
      for (const c of this.world.colliders) {
        if (c.y0 <= top + 0.06 && c.y1 > top && c.y1 - top < 1.0 && px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1) { top = c.y1; members.push(c); grew = true; }
      }
      if (!grew) break;
    }
    return { top, members };
  }

  // axis 0 = x, 2 = z
  _moveAxis(axis, d, wx, wz) {
    if (d === 0) return;
    const c = this.cfg, m = this.m, p = this.pos;
    if (axis === 0) p.x += d; else p.z += d;
    for (const b of this.world.colliders) {
      if (!this._overlaps(b, p.x, p.y, p.z)) continue;
      const rise = b.y1 - p.y;
      // 1) step-up for small ledges
      if (rise > 0 && rise <= c.stepHeight && this.vel.y <= 0.5 && this._clearAt(p.x, b.y1 + EPS, p.z)) {
        p.y = b.y1 + EPS;
        continue;
      }
      const pushing = axis === 0 ? Math.sign(wx) === Math.sign(d) && Math.abs(wx) > 0.2
                                 : Math.sign(wz) === Math.sign(d) && Math.abs(wz) > 0.2;
      // 2) mantle: airborne, pushing into a ledge whose top is within reach
      if (!this.grounded && pushing && rise > 0 && rise <= c.mantleReach && this.vel.y < 6 && !this.pound &&
          this._clearAt(p.x, b.y1 + EPS, p.z)) {
        p.y = b.y1 + EPS;
        this.vel.y = 0;
        this.climbTimer = 0.25;
        continue;
      }
      const r = c.radius;
      // 3) ledge grab: a bit higher than the mantle reaches — hang, then pull up
      // (the real ledge is the top of whatever is stacked on this box — e.g. a roof cap)
      const stack = rise > 0 && this.abilities.ledgeGrab && !this.grounded ? this._stackTop(b, axis, d, p) : null;
      const ledgeTop = stack ? stack.top : b.y1;
      const lrise = ledgeTop - p.y;
      if (this.abilities.ledgeGrab && !this.grounded && pushing && lrise > c.mantleReach && lrise <= m.ledgeReach &&
          this.vel.y < 4 && !this.pound && !this.sliding && this.dashT <= 0) {
        const fx = axis === 0 ? (d > 0 ? b.x0 - r - EPS : b.x1 + r + EPS) : p.x;
        const fz = axis === 2 ? (d > 0 ? b.z0 - r - EPS : b.z1 + r + EPS) : p.z;
        const tx = axis === 0 ? (d > 0 ? b.x0 + r + 0.06 : b.x1 - r - 0.06) : p.x;
        const tz = axis === 2 ? (d > 0 ? b.z0 + r + 0.06 : b.z1 - r - 0.06) : p.z;
        const along = axis === 0 ? (p.z > b.z0 + 0.1 && p.z < b.z1 - 0.1) : (p.x > b.x0 + 0.1 && p.x < b.x1 - 0.1);
        if (along && this._clearAt(tx, ledgeTop + EPS, tz, c.height) && this._clearAt(fx, ledgeTop - 1.55, fz, c.height, stack.members)) {
          const nx = axis === 0 ? -Math.sign(d) : 0, nz = axis === 2 ? -Math.sign(d) : 0;
          p.x = fx; p.z = fz; p.y = ledgeTop - 1.55;
          this.vel.set(0, 0, 0);
          this.gliding = false; this.umbrella.visible = false;
          this.ledge = { phase: 'hang', t: 0, nx, nz, from: p.clone(), to: new THREE.Vector3(tx, ledgeTop + EPS, tz) };
          this.facing = Math.atan2(-nx, -nz);
          this.emit('ledgeGrab');
          return;
        }
      }
      // 4) blocked: push back out
      if (axis === 0) { p.x = d > 0 ? b.x0 - r - EPS : b.x1 + r + EPS; this.vel.x = 0; }
      else { p.z = d > 0 ? b.z0 - r - EPS : b.z1 + r + EPS; this.vel.z = 0; }
      if (!this.grounded && rise > 0.6 && b.y0 < p.y + this.H - 0.3) {
        this.wall.nx = axis === 0 ? -Math.sign(d) : 0;
        this.wall.nz = axis === 2 ? -Math.sign(d) : 0;
        this.wall.t = 0.12;
      }
    }
  }

  _moveY(d) {
    const p = this.pos, H = this.H;
    p.y += d;
    let landed = false, floor = -Infinity, ceil = Infinity, under = null;
    for (const b of this.world.colliders) {
      if (!this._overlaps(b, p.x, p.y, p.z)) continue;
      if (d <= 0) { if (b.y1 > floor) { floor = b.y1; under = b; } landed = true; }
      else ceil = Math.min(ceil, b.y0);
    }
    this.ground = under;
    if (landed) { p.y = floor; this.vel.y = 0; }
    else if (ceil < Infinity) { p.y = ceil - H - EPS; this.vel.y = 0; }
    return landed;
  }

  /* ---------------- animation ---------------- */
  _sync(dt) {
    const r = this.rig;
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.facing;
    const speed = this.speedH;
    const k = Math.min(1, dt * 14);
    const lerp = (obj, prop, v, kk = k) => { obj[prop] += (v - obj[prop]) * kk; };

    let armZ = 0, lean = 0, legLX = 0, legRX = 0, armLX = 0, armRX = 0, bob = 0, side = 0, legZ = 0;
    const st = this.state;
    const t = performance.now() * 0.001;
    if (this.ledge) {
      if (this.ledge.phase === 'hang') { armLX = armRX = -2.95; legLX = 0.15; legRX = -0.1; bob = -0.05; }
      else { armLX = armRX = -1.4; legLX = -1.2; legRX = 0.2; lean = 0.45; }
    } else if (this.ride) {
      const pose = this.ride.pose || this.ride.kind;
      if (pose === 'zip') { armLX = armRX = -3.0; legLX = -0.5; legRX = -0.3; lean = -0.1; }
      else if (pose === 'rail') { armZ = 1.25; legLX = -0.35; legRX = 0.35; lean = 0.08; side = Math.sin(t * 5) * 0.08; }
      else if (pose === 'ladder') {
        const s = Math.sin(this.ride.phase || 0);
        armLX = -2.4 + s * 0.5; armRX = -2.4 - s * 0.5; legLX = -0.6 - s * 0.4; legRX = -0.6 + s * 0.4;
      }
    } else if (this.charging) {
      const c = this.chargeLevel;
      armLX = armRX = 0.7 + c * 0.4; legLX = -0.3; legRX = 0.25; lean = 0.25 + c * 0.2;
      bob = -0.22 * c + (c >= 1 ? Math.sin(t * 60) * 0.015 : 0);
    } else if (this.sliding) {
      legLX = legRX = -1.45; armLX = armRX = 0.9; armZ = 0.5; lean = -0.95; bob = -0.38;
    } else if (this.dashT > 0) {
      armLX = armRX = 1.2; legLX = 0.8; legRX = -0.5; lean = 0.7;
    } else if (this.pound) {
      if (this.pound.phase === 'hover') { legLX = legRX = -1.6; armLX = armRX = -0.4; armZ = 0.8; bob = 0.2; }
      else { armLX = armRX = -3.0; legLX = legRX = 0.1; }
    } else if (this.gliding) {
      armLX = -2.9; armRX = -0.4; armZ = 1.2; legLX = 0.35; legRX = 0.1; lean = 0.25;
    } else if (this.climbTimer > 0) {
      armLX = armRX = -2.6; legLX = -0.9; legRX = 0.3; lean = 0.2;
    } else if (this.wallSliding) {
      armLX = -2.6; armRX = -0.6; legLX = -0.5; legRX = 0.3; lean = -0.1; armZ = 0.4;
    } else if (!this.grounded && this.airTime > 0.06) {
      if (this.vel.y > 0) { // jump
        armLX = -2.4; armRX = -0.5; legLX = -0.9; legRX = 0.35; armZ = 0.15;
      } else {              // fall
        armLX = armRX = -0.35; armZ = 0.9; legLX = 0.25; legRX = -0.25;
      }
    } else if (speed > 0.4) {
      const sprint = speed > this.cfg.walkSpeed + 0.5;
      const prev = this.stepPhase;
      this.stepPhase += dt * (sprint ? 13 : 10.5) * Math.min(1.4, speed / this.cfg.walkSpeed);
      if (sprint && Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) this.emit('step');
      const amp = sprint ? 1.15 : 0.85;
      const legA = Math.sin(this.stepPhase) * amp;
      const armA = Math.sin(this.stepPhase) * amp * 0.9;
      legLX = legA; legRX = -legA; armLX = -armA; armRX = armA;
      lean = sprint ? 0.26 : 0.08;
      bob = Math.abs(Math.cos(this.stepPhase)) * 0.06;
    } else {
      armZ = 0.06 + Math.sin(t * 2) * 0.03;
      bob = Math.sin(t * 2) * 0.015;
    }
    lerp(r.legL.rotation, 'x', legLX); lerp(r.legR.rotation, 'x', legRX);
    lerp(r.legL.rotation, 'z', -legZ); lerp(r.legR.rotation, 'z', legZ);
    lerp(r.armL.rotation, 'x', armLX); lerp(r.armR.rotation, 'x', armRX);
    lerp(r.armL.rotation, 'z', -armZ); lerp(r.armR.rotation, 'z', armZ);
    lerp(r.body.rotation, 'x', lean);
    // lean into turns while moving fast
    const turnLean = this.grounded && speed > 3 ? THREE.MathUtils.clamp(-this.turnRate * 0.05 * Math.min(1, speed / 10), -0.35, 0.35) : 0;
    lerp(r.body.rotation, 'z', turnLean + side, Math.min(1, dt * 8));
    lerp(r.body.position, 'y', bob, Math.min(1, dt * 18));
    // spins: double jump and ground-pound hover
    r.body.rotation.y = this.spinT > 0 ? (1 - this.spinT / (this.pound ? 0.3 : 0.42)) * TAU * (this.pound ? -1 : 1) : 0;

    // squash & stretch
    let sy = 1, sxz = 1;
    if (this.landTimer > 0) {
      const q = this.landTimer / (this.landSquash > 0.25 ? 0.22 : 0.14);
      sy = 1 - q * this.landSquash; sxz = 1 + q * this.landSquash * 0.6;
    } else if (this.stretchTimer > 0) {
      const q = this.stretchTimer / 0.2;
      sy = 1 + q * 0.16; sxz = 1 - q * 0.08;
    } else if (this.charging) {
      sy = 1 - this.chargeLevel * 0.16; sxz = 1 + this.chargeLevel * 0.08;
    } else if (this.pound && this.pound.phase === 'slam') { sy = 1.15; sxz = 0.9; }
    else if (this.dashT > 0) { sy = 0.92; sxz = 1.05; }
    r.body.scale.set(sxz, sy, sxz);

    // umbrella open animation
    if (this.umbrella.visible) {
      const u = this.umbrella;
      u.scale.x += (1 - u.scale.x) * Math.min(1, dt * 12);
      u.scale.z = u.scale.x;
      u.rotation.z = Math.sin(t * 3) * 0.06;
    } else this.umbrella.scale.set(0.2, 1, 0.2);

    // blob shadow on whatever is below
    const groundY = this._groundBelow();
    r.blob.position.set(this.pos.x, groundY + 0.02, this.pos.z);
    const hgt = Math.max(0, this.pos.y - groundY);
    r.blob.scale.setScalar(Math.max(0.4, 1 - hgt * 0.06));
    r.blob.material.opacity = Math.max(0.08, 0.32 - hgt * 0.025);
    r.blob.visible = r.root.visible;
  }

  _groundBelow() {
    let best = -100;
    const p = this.pos;
    for (const b of this.world.colliders) {
      if (p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && b.y1 <= p.y + 0.05 && b.y1 > best) best = b.y1;
    }
    return best === -100 ? 0 : best;
  }
}

function turnToward(a, target, k) {
  let d = target - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, k);
}
