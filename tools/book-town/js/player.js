// Player: a blocky procedural character plus a "platformer-feel" controller
// (quick accel, coyote time, jump buffer, variable jump, step-up, ledge mantle).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { canvasTexture } from './world.js';

const EPS = 0.001;

/* ---------------- character model ---------------- */
function lam(color) { return new THREE.MeshLambertMaterial({ color }); }
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

export function buildCharacter() {
  const SKIN = lam(0xf0c08a), SHIRT = lam(0x1f8a4c), PANTS = lam(0x2b3442), HAIR = lam(0x3a2618), SHOE = lam(0x1d1d1d);
  const root = new THREE.Group();
  const body = new THREE.Group();          // everything that squashes / leans
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
  const faceTex = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(18, 22, 7, 10); ctx.fillRect(39, 22, 7, 10);
    ctx.lineWidth = 4; ctx.strokeStyle = '#1b1b1b'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(32, 36, 11, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  face.position.set(0, 0.25, 0.245);
  head.add(face);

  body.add(legL, legR, torso, armL, armR, head);
  // overall scale so the model is ~1.8 tall, matching the collider
  root.scale.setScalar(0.85);
  // blob shadow helps read jump height even when real shadows are coarse
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;
  return { root, body, legL, legR, armL, armR, torso, head, blob };
}

/* ---------------- controller ---------------- */
export class Player {
  constructor(scene, world, opts = {}) {
    this.cfg = Object.assign({}, CONFIG.movement, opts);
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.airTime = 0;
    this.landTimer = 0;
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
    this.rig = buildCharacter();
    scene.add(this.rig.root);
    scene.add(this.rig.blob);
  }

  teleport(x, y, z, facing = this.facing) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.boostTimer = 0; this.boostMult = 1; this.springing = false; this.ground = null;
    this.facing = facing;
    this.safe.set(x, y, z);
    this.grounded = false;
    this._sync(0);
  }

  // Speed pads: multiply top speed for a while.
  boost(mult, seconds) { this.boostMult = mult; this.boostTimer = seconds; }
  // Springs: launch upwards to a given height regardless of jump input.
  launch(height) {
    this.vel.y = Math.sqrt(2 * this.cfg.gravity * height);
    // springs are meant to be predictable: drop any speed boost and cap sideways speed
    this.boostTimer = 0; this.boostMult = 1;
    const hs = Math.hypot(this.vel.x, this.vel.z), cap = this.cfg.walkSpeed;
    if (hs > cap) { this.vel.x *= cap / hs; this.vel.z *= cap / hs; }
    this.grounded = false; this.coyote = 0; this.buffer = 0; this.ground = null;
    this.springing = true;
  }

  get jumpVelocity() { return Math.sqrt(2 * this.cfg.gravity * this.cfg.jumpHeight); }

  // camYaw: camera yaw so input is camera-relative.
  update(dt, input, camYaw) {
    const c = this.cfg;
    const mv = input.getMove();
    // camera-relative wish direction
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = rx * mv.x + fx * mv.y, wz = rz * mv.x + fz * mv.y;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) { wx /= wl; wz /= wl; }
    this.sprinting = input.sprint && mv.mag > 0.1;
    if (this.boostTimer > 0) { this.boostTimer -= dt; if (this.boostTimer <= 0) this.boostMult = 1; }
    const top = (this.sprinting ? c.sprintSpeed : c.walkSpeed) * mv.mag * this.boostMult;

    if (input.consumeJump()) this.buffer = c.jumpBuffer;
    const held = input.jumpHeld;

    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this._step(h, wx * top, wz * top, mv.mag, held, wx, wz);

    // facing follows movement direction
    if (mv.mag > 0.1 && Math.hypot(this.vel.x, this.vel.z) > 0.3) {
      const target = Math.atan2(wx, wz);
      let d = target - this.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.facing += d * Math.min(1, dt * c.turnSpeed);
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

  _step(h, tvx, tvz, mag, held, wx, wz) {
    const c = this.cfg;
    // horizontal acceleration toward the target velocity
    const accel = c.sprintSpeed * this.boostMult / c.accelTime;
    const decel = c.sprintSpeed / c.stopTime;
    let rate = mag > 0.05 ? accel : decel;
    if (!this.grounded) rate = accel * c.airControl;
    let dvx = tvx - this.vel.x, dvz = tvz - this.vel.z;
    const dl = Math.hypot(dvx, dvz), maxd = rate * h;
    if (dl > maxd) { dvx *= maxd / dl; dvz *= maxd / dl; }
    this.vel.x += dvx; this.vel.z += dvz;

    // timers
    if (this.grounded) this.coyote = c.coyoteTime; else this.coyote -= h;
    if (this.buffer > 0) this.buffer -= h;
    if (this.landTimer > 0) this.landTimer -= h;
    if (this.climbTimer > 0) this.climbTimer -= h;

    // jump (buffered, with coyote time)
    if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vel.y = this.jumpVelocity;
      this.grounded = false;
      this.coyote = 0; this.buffer = 0;
      if (this.onJump) this.onJump();
    }

    // gravity — extra while rising with jump released = short hop
    if (this.vel.y <= 0) this.springing = false;
    const g = c.gravity * (this.vel.y > 0 && !held && !this.springing ? c.shortHopFactor : 1);
    this.vel.y = Math.max(this.vel.y - g * h, -c.terminalVelocity);

    const wasGrounded = this.grounded;
    const fallSpeed = -this.vel.y;
    this._moveAxis(0, this.vel.x * h, wx, wz);
    this._moveAxis(2, this.vel.z * h, wx, wz);
    const landed = this._moveY(this.vel.y * h);
    this.grounded = landed;
    if (landed && !wasGrounded) {
      if (fallSpeed > 7) { this.landTimer = 0.14; if (this.onLand) this.onLand(fallSpeed); }
      this.airTime = 0;
    }
    if (!this.grounded) this.airTime += h;
  }

  _overlaps(b, x, y, z) {
    const r = this.cfg.radius, H = this.cfg.height;
    return x + r > b.x0 + EPS && x - r < b.x1 - EPS &&
           y + H > b.y0 + EPS && y < b.y1 - EPS &&
           z + r > b.z0 + EPS && z - r < b.z1 - EPS;
  }
  _clearAt(x, y, z) {
    for (const b of this.world.colliders) if (this._overlaps(b, x, y, z)) return false;
    return true;
  }

  // axis 0 = x, 2 = z
  _moveAxis(axis, d, wx, wz) {
    if (d === 0) return;
    const c = this.cfg, p = this.pos;
    if (axis === 0) p.x += d; else p.z += d;
    for (const b of this.world.colliders) {
      if (!this._overlaps(b, p.x, p.y, p.z)) continue;
      const rise = b.y1 - p.y;
      // 1) step-up for small ledges
      if (rise > 0 && rise <= c.stepHeight && this.vel.y <= 0.5 && this._clearAt(p.x, b.y1 + EPS, p.z)) {
        p.y = b.y1 + EPS;
        continue;
      }
      // 2) mantle: airborne, pushing into a ledge whose top is within reach
      const pushing = axis === 0 ? Math.sign(wx) === Math.sign(d) && Math.abs(wx) > 0.2
                                 : Math.sign(wz) === Math.sign(d) && Math.abs(wz) > 0.2;
      if (!this.grounded && pushing && rise > 0 && rise <= c.mantleReach && this.vel.y < 6 &&
          this._clearAt(p.x, b.y1 + EPS, p.z)) {
        p.y = b.y1 + EPS;
        this.vel.y = 0;
        this.climbTimer = 0.25;
        continue;
      }
      // 3) blocked: push back out
      const r = c.radius;
      if (axis === 0) { p.x = d > 0 ? b.x0 - r - EPS : b.x1 + r + EPS; this.vel.x = 0; }
      else { p.z = d > 0 ? b.z0 - r - EPS : b.z1 + r + EPS; this.vel.z = 0; }
    }
  }

  _moveY(d) {
    const p = this.pos, H = this.cfg.height;
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
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const k = Math.min(1, dt * 14);
    const lerp = (obj, prop, v) => { obj[prop] += (v - obj[prop]) * k; };

    let legA = 0, armA = 0, armZ = 0, lean = 0, legLX = 0, legRX = 0, armLX = 0, armRX = 0, bob = 0;
    if (this.climbTimer > 0) {
      armLX = armRX = -2.6; legLX = -0.9; legRX = 0.3; lean = 0.2;
    } else if (!this.grounded && this.airTime > 0.06) {
      if (this.vel.y > 0) { // jump
        armLX = -2.4; armRX = -0.5; legLX = -0.9; legRX = 0.35; armZ = 0.15;
      } else {              // fall
        armLX = armRX = -0.35; armZ = 0.9; legLX = 0.25; legRX = -0.25;
      }
    } else if (speed > 0.4) {
      const sprint = speed > this.cfg.walkSpeed + 0.5;
      this.stepPhase += dt * (sprint ? 13 : 10.5) * Math.min(1, speed / this.cfg.walkSpeed);
      const amp = sprint ? 1.15 : 0.85;
      legA = Math.sin(this.stepPhase) * amp;
      armA = Math.sin(this.stepPhase) * amp * 0.9;
      legLX = legA; legRX = -legA; armLX = -armA; armRX = armA;
      lean = sprint ? 0.22 : 0.08;
      bob = Math.abs(Math.cos(this.stepPhase)) * 0.06;
    } else {
      const t = performance.now() * 0.002;
      armZ = 0.06 + Math.sin(t) * 0.03;
      bob = Math.sin(t) * 0.015;
    }
    lerp(r.legL.rotation, 'x', legLX); lerp(r.legR.rotation, 'x', legRX);
    lerp(r.armL.rotation, 'x', armLX); lerp(r.armR.rotation, 'x', armRX);
    lerp(r.armL.rotation, 'z', -armZ); lerp(r.armR.rotation, 'z', armZ);
    lerp(r.body.rotation, 'x', lean);
    r.body.position.y = bob;
    // landing squash
    const sq = this.landTimer > 0 ? 1 - (this.landTimer / 0.14) * 0.18 : 1;
    r.body.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);

    // blob shadow on whatever is below
    const groundY = this._groundBelow();
    r.blob.position.set(this.pos.x, groundY + 0.02, this.pos.z);
    const hgt = Math.max(0, this.pos.y - groundY);
    r.blob.scale.setScalar(Math.max(0.4, 1 - hgt * 0.08));
    r.blob.material.opacity = Math.max(0.05, 0.28 - hgt * 0.03);
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
