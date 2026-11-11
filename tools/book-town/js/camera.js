// Third-person orbit camera that follows the player, never clips through
// walls (snaps in on contact) and eases back out once the view is clear.
// Phase 3: screen shake, FOV kick while sprinting / dashing, a pull-back at
// high speed and during super jumps, and an orbit mode for title screens.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class FollowCamera {
  constructor(camera, world, opts = {}) {
    this.cfg = Object.assign({}, CONFIG.camera, opts);
    this.camera = camera;
    this.world = world;
    this.yaw = 0;                 // 0 = camera sits on +z side looking toward −z
    this.pitch = this.cfg.pitch;
    this.wantDist = this.cfg.distance;
    this.dist = this.cfg.distance;
    this.pivot = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this.player = null;           // optional: enables speed FOV / pull-back
    this.trauma = 0;
    this.kick = 0;
    this.extra = 0;
    this.baseFov = this.cfg.fov;
    this.orbit = null;            // { center, dist, pitch, speed } for title screens
  }

  // Place the camera behind a facing direction (radians, model space).
  snapBehind(facing) {
    this.yaw = facing + Math.PI;
  }
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount * this.cfg.shake); }
  fovKick(deg) { this.kick = Math.max(this.kick, deg); }

  update(dt, target, input) {
    const c = this.cfg;
    if (this.orbit) return this._orbit(dt);
    if (input) {
      const look = input.consumeLook();
      this.yaw -= look.dx;
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy, c.minPitch, c.maxPitch);
      const z = input.consumeZoom();
      if (z) this.wantDist = THREE.MathUtils.clamp(this.wantDist * (z > 0 ? 1.12 : 1 / 1.12), c.minDistance, c.maxDistance);
    }
    // speed-based pull-back and FOV
    let fovAdd = 0, wantExtra = 0;
    const pl = this.player;
    if (pl) {
      const hs = pl.speedH;
      const fast = THREE.MathUtils.clamp((hs - CONFIG.movement.walkSpeed) / (CONFIG.movement.sprintSpeed * 1.5 - CONFIG.movement.walkSpeed), 0, 1);
      fovAdd = fast * c.sprintFovKick;
      wantExtra = fast * c.speedPullBack * 0.6;
      if (pl.superJumping || pl.vel.y > 16) wantExtra = Math.max(wantExtra, c.speedPullBack);
      if (pl.ride && pl.ride.kind !== 'ladder') wantExtra = Math.max(wantExtra, c.speedPullBack * 0.7);
    }
    this.extra += (wantExtra - this.extra) * Math.min(1, dt * 2.5);
    this.kick = Math.max(0, this.kick - dt * 30);
    const fov = this.baseFov + fovAdd + this.kick;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();
    }

    // smooth pivot so landings don't jolt the view
    const goal = new THREE.Vector3(target.x, target.y + c.pivotHeight, target.z);
    if (this.pivot.lengthSq() === 0) this.pivot.copy(goal);
    this.pivot.x = goal.x; this.pivot.z = goal.z;
    this.pivot.y += (goal.y - this.pivot.y) * Math.min(1, dt * 12);

    const want = this.wantDist + this.extra;
    const cp = Math.cos(this.pitch);
    this._dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const hit = this.world.raycast(this.pivot.x, this.pivot.y, this.pivot.z, this._dir.x, this._dir.y, this._dir.z, want + 0.4);
    const allowed = Math.max(0.6, Math.min(want, hit - 0.35));
    if (allowed < this.dist) this.dist = allowed;                          // snap in
    else this.dist += (allowed - this.dist) * Math.min(1, dt * c.easeOut); // ease out

    const cam = this.camera;
    cam.position.set(
      this.pivot.x + this._dir.x * this.dist,
      Math.max(0.25, this.pivot.y + this._dir.y * this.dist),
      this.pivot.z + this._dir.z * this.dist
    );
    cam.lookAt(this.pivot);
    this._applyShake(dt);
  }

  _applyShake(dt) {
    if (this.trauma <= 0) return;
    const s = this.trauma * this.trauma;
    const t = performance.now() * 0.001;
    this.camera.rotation.z += Math.sin(t * 47) * 0.03 * s;
    this.camera.position.x += Math.sin(t * 61) * 0.18 * s;
    this.camera.position.y += Math.sin(t * 73 + 1) * 0.18 * s;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  // Slow orbit around a point (title screen).
  _orbit(dt) {
    const o = this.orbit;
    o.yaw = (o.yaw || 0) + dt * o.speed;
    const cp = Math.cos(o.pitch);
    this.camera.position.set(o.center.x + Math.sin(o.yaw) * cp * o.dist, o.center.y + Math.sin(o.pitch) * o.dist, o.center.z + Math.cos(o.yaw) * cp * o.dist);
    this.camera.lookAt(o.center);
    if (Math.abs(this.camera.fov - this.baseFov) > 0.05) { this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix(); }
  }
}
