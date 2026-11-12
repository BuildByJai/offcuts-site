// Rapier (WASM) physics: static box colliders for the town, a kinematic
// capsule character controller with auto-step, ground snapping and slopes,
// stepped at a fixed 60 Hz with render interpolation. Keeps the Phase 1 feel:
// coyote time, jump buffer, variable jump height, accel/decel curves.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PROOF } from '../config.js';

const M = PROOF.movement;
const TAU = Math.PI * 2;

export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -M.gravity, z: 0 });
  world.timestep = 1 / M.fixedHz;
  return new Physics(world);
}

export class Physics {
  constructor(world) {
    this.world = world;
    this.RAPIER = RAPIER;
    this.accumulator = 0;
    this.debugMesh = null;
  }
  addBoxes(list) {
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const b of list) {
      const desc = RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.y, b.z);
      if (b.rot) { q.setFromEuler(e.set(b.rot[0], b.rot[1], b.rot[2])); desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); }
      this.world.createCollider(desc);
    }
  }
  // Ray from origin along dir (normalised); returns distance or null.
  ray(origin, dir, maxDist, exclude = null) {
    const r = new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.world.castRay(r, maxDist, true, undefined, undefined, exclude || undefined);
    if (!hit) return null;
    return hit.timeOfImpact !== undefined ? hit.timeOfImpact : hit.toi;
  }
  // Steps the world at a fixed rate; calls fn(dtFixed) before each step. Returns the interpolation alpha.
  step(dt, fn) {
    const h = this.world.timestep;
    this.accumulator = Math.min(this.accumulator + dt, h * 6);
    while (this.accumulator >= h) {
      fn(h);
      this.world.step();
      this.accumulator -= h;
    }
    return this.accumulator / h;
  }
  debugRender(scene, on) {
    if (!on) { if (this.debugMesh) { this.debugMesh.visible = false; } return; }
    const { vertices, colors } = this.world.debugRender();
    if (!this.debugMesh) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
      this.debugMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
      this.debugMesh.frustumCulled = false;
      scene.add(this.debugMesh);
    } else {
      this.debugMesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      this.debugMesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    }
    this.debugMesh.visible = true;
  }
}

// Events: jump · land(fallSpeed) · step
export class CharacterController {
  constructor(phys, { x = 0, y = 0, z = 0, facing = 0 } = {}) {
    this.phys = phys;
    const W = phys.world;
    this.halfH = (M.height - M.radius * 2) / 2;
    this.body = W.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + this.halfH + M.radius, z));
    this.collider = W.createCollider(RAPIER.ColliderDesc.capsule(this.halfH, M.radius), this.body);
    const c = W.createCharacterController(0.03);
    c.enableAutostep(M.stepHeight, 0.2, true);
    c.enableSnapToGround(M.snapDistance);
    c.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(M.maxSlopeDeg));
    c.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(M.maxSlopeDeg + 5));
    c.setSlideEnabled(true);
    c.setApplyImpulsesToDynamicBodies(false);
    this.ctrl = c;

    this.pos = new THREE.Vector3(x, y, z);        // feet, physics step
    this.prev = this.pos.clone();                 // feet, previous step
    this.render = this.pos.clone();               // feet, interpolated
    this.vel = new THREE.Vector3();
    this.facing = facing; this.renderFacing = facing; this.prevFacing = facing;
    this.grounded = false; this.coyote = 0; this.buffer = 0; this.airTime = 0; this.jumpHeld = false;
    this.speed = 0; this.accel = 0;               // horizontal speed and its rate of change (for lean)
    this.turnRate = 0;
    this.wantDir = new THREE.Vector2();
    this.moveMag = 0; this.sprinting = false;
    this.justJumped = false; this.justLanded = 0;
    this._ev = {};
  }
  on(ev, fn) { (this._ev[ev] || (this._ev[ev] = [])).push(fn); return this; }
  emit(ev, a) { const l = this._ev[ev]; if (l) for (const fn of l) fn(a); }
  get jumpVelocity() { return Math.sqrt(2 * M.gravity * M.jumpHeight); }

  teleport(x, y, z, facing = this.facing) {
    this.pos.set(x, y, z); this.prev.copy(this.pos); this.render.copy(this.pos);
    this.vel.set(0, 0, 0); this.facing = this.renderFacing = this.prevFacing = facing;
    this.body.setNextKinematicTranslation({ x, y: y + this.halfH + M.radius, z });
    this.body.setTranslation({ x, y: y + this.halfH + M.radius, z }, true);
  }

  // Called once per render frame: reads input, remembers it for the fixed steps.
  setInput(input, camYaw) {
    const mv = input.getMove();
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = rx * mv.x + fx * mv.y, wz = rz * mv.x + fz * mv.y;
    const l = Math.hypot(wx, wz);
    if (l > 1e-4) { wx /= l; wz /= l; }
    this.wantDir.set(wx, wz);
    this.moveMag = mv.mag;
    this.sprinting = input.sprint && mv.mag > 0.1;
    if (input.consumeJump()) this.buffer = M.jumpBuffer;
    this.jumpHeld = input.jumpHeld;
  }

  // One fixed step.
  step(h) {
    this.prev.copy(this.pos); this.prevFacing = this.facing;
    const v = this.vel;
    // target horizontal speed: walk / jog / sprint from stick magnitude + sprint
    const mag = this.moveMag;
    let top = 0;
    if (mag > 0.05) top = this.sprinting ? M.sprintSpeed : (mag < 0.55 ? M.walkSpeed : THREE.MathUtils.lerp(M.walkSpeed, M.jogSpeed, (mag - 0.55) / 0.45));
    const tvx = this.wantDir.x * top, tvz = this.wantDir.y * top;
    // smooth accel / decel (ease-out curves, not instant)
    const hs = Math.hypot(v.x, v.z);
    const accel = M.sprintSpeed / M.accelTime, decel = M.sprintSpeed / M.stopTime;
    let rate = mag > 0.05 ? accel : decel;
    if (!this.grounded) rate *= M.airControl;
    // ease: accelerate faster when far from target, gently near it
    let dvx = tvx - v.x, dvz = tvz - v.z;
    const dl = Math.hypot(dvx, dvz);
    const maxd = rate * h * THREE.MathUtils.clamp(0.35 + dl / M.sprintSpeed, 0.35, 1.2);
    if (dl > maxd) { dvx *= maxd / dl; dvz *= maxd / dl; }
    v.x += dvx; v.z += dvz;
    const hs2 = Math.hypot(v.x, v.z);
    this.accel = (hs2 - hs) / h;
    this.speed = hs2;

    // timers
    if (this.grounded) this.coyote = M.coyoteTime; else this.coyote -= h;
    if (this.buffer > 0) this.buffer -= h;
    // jump: instant on press, buffered, coyote
    this.justJumped = false;
    if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
      v.y = this.jumpVelocity; this.grounded = false; this.coyote = 0; this.buffer = 0; this.justJumped = true;
      this.emit('jump');
    }
    // gravity with short-hop
    const g = M.gravity * (v.y > 0 && !this.jumpHeld ? M.shortHopFactor : 1);
    v.y = Math.max(v.y - g * h, -M.terminalVelocity);

    // move through the character controller
    const desired = { x: v.x * h, y: v.y * h, z: v.z * h };
    this.ctrl.computeColliderMovement(this.collider, desired);
    const m = this.ctrl.computedMovement();
    const wasGrounded = this.grounded;
    const fallSpeed = -v.y;
    const t = this.body.translation();
    const nx = t.x + m.x, ny = t.y + m.y, nz = t.z + m.z;
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    this.pos.set(nx, ny - this.halfH - M.radius, nz);
    this.grounded = this.ctrl.computedGrounded();
    if (this.grounded) { if (v.y < 0) v.y = -0.5; }
    else if (m.y < desired.y - 1e-4 && v.y > 0) v.y = 0;   // hit a ceiling
    // walls: cancel velocity into them
    if (Math.abs(m.x - desired.x) > 1e-3 && Math.sign(m.x - desired.x) !== Math.sign(v.x)) v.x *= 0.2;
    if (Math.abs(m.z - desired.z) > 1e-3 && Math.sign(m.z - desired.z) !== Math.sign(v.z)) v.z *= 0.2;
    if (this.grounded && !wasGrounded) { this.justLanded = fallSpeed; this.emit('land', fallSpeed); this.airTime = 0; }
    if (!this.grounded) this.airTime += h;

    // facing eases toward the movement direction
    if (mag > 0.1 && hs2 > 0.25) {
      const target = Math.atan2(this.wantDir.x, this.wantDir.y);
      let d = target - this.facing;
      while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      const k = Math.min(1, h * M.turnSpeed * (0.5 + Math.min(1, hs2 / M.jogSpeed)));
      this.facing += d * k;
      this.turnRate = d * k / h;
    } else this.turnRate *= 0.8;
    if (this.pos.y < -20) this.teleport(0, 0.5, 30);
  }

  // Interpolate for rendering.
  interpolate(alpha) {
    this.render.lerpVectors(this.prev, this.pos, alpha);
    let d = this.facing - this.prevFacing;
    while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    this.renderFacing = this.prevFacing + d * alpha;
  }
}
