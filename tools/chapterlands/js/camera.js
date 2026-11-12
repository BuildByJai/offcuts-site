// Third-person orbit camera that follows the player, never clips through
// walls (snaps in on contact) and eases back out once the view is clear.
// Phase 3: screen shake, FOV kick while sprinting / dashing, a pull-back at
// high speed and during super jumps, and an orbit mode for title screens.
// Phase 3.1: damped rotation, a slight look-ahead in the direction of travel,
// fractional zoom steps (pinch) and, where opts.overview is set, zooming past
// overviewFrom tilts the camera up into a high overview of the area.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _want = new THREE.Vector3();

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
    this.viewYaw = 0; this.viewPitch = this.pitch;   // damped values actually used for the view
    this.look = new THREE.Vector3();                 // current look-ahead offset
    this.overviewK = 0;                              // 0 = normal, 1 = full overview
  }

  // Place the camera behind a facing direction (radians, model space).
  snapBehind(facing) {
    this.yaw = facing + Math.PI;
    this.viewYaw = this.yaw;
    this.look.set(0, 0, 0);
  }
  get inOverview() { return this.overviewK > 0.5; }
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount * this.cfg.shake); }
  fovKick(deg) { this.kick = Math.max(this.kick, deg); }

  update(dt, target, input) {
    const c = this.cfg;
    if (this.orbit) return this._orbit(dt);
    if (input) {
      const look = input.consumeLook();
      this.yaw -= look.dx;
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy, c.minPitch, c.maxPitch);
      const z = input.consumeZoom();   // steps: ±1 per wheel notch, fractional while pinching
      if (z) this.wantDist = THREE.MathUtils.clamp(this.wantDist * Math.pow(1.12, z), c.minDistance, this._maxDist());
    }
    // rotation damping: the view eases towards yaw/pitch instead of jumping with the drag
    const kr = 1 - Math.exp(-dt * c.rotDamping);
    let dy = this.yaw - this.viewYaw;
    while (dy > Math.PI) { dy -= Math.PI * 2; this.viewYaw += Math.PI * 2; }
    while (dy < -Math.PI) { dy += Math.PI * 2; this.viewYaw -= Math.PI * 2; }
    this.viewYaw += dy * kr;
    // overview: past overviewFrom the camera tilts up and the pivot rises
    const ov = c.overview ? THREE.MathUtils.smoothstep(this.wantDist, c.overviewFrom, c.overviewDistance) : 0;
    this.overviewK += (ov - this.overviewK) * Math.min(1, dt * 4);
    const wantPitch = THREE.MathUtils.lerp(this.pitch, Math.max(this.pitch, c.overviewPitch), this.overviewK);
    this.viewPitch += (wantPitch - this.viewPitch) * kr;
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

    // look-ahead: lead the view slightly in the direction of travel (never into a wall)
    _want.set(0, 0, 0);
    if (pl && c.lookAhead > 0 && this.overviewK < 0.5 && !(pl.ride && pl.ride.kind === 'cannon')) {
      _want.set(pl.vel.x, 0, pl.vel.z).multiplyScalar(c.lookAhead);
      const l = _want.length();
      if (l > c.lookAheadMax) _want.multiplyScalar(c.lookAheadMax / l);
      if (l > 0.05) {
        const hy = target.y + c.pivotHeight, d = _want.length();
        const hit = this.world.raycast(target.x, hy, target.z, _want.x / d, 0, _want.z / d, d + 0.4);
        if (hit < d + 0.4) _want.multiplyScalar(Math.max(0, hit - 0.4) / d);
      }
    }
    this.look.lerp(_want, 1 - Math.exp(-dt * 2.5));
    // smooth pivot so landings don't jolt the view
    const goal = new THREE.Vector3(target.x + this.look.x, target.y + c.pivotHeight + this.overviewK * c.overviewLift, target.z + this.look.z);
    if (this.pivot.lengthSq() === 0) this.pivot.copy(goal);
    this.pivot.x = goal.x; this.pivot.z = goal.z;
    this.pivot.y += (goal.y - this.pivot.y) * Math.min(1, dt * 12);

    const want = this.wantDist + this.extra;
    const cp = Math.cos(this.viewPitch);
    this._dir.set(Math.sin(this.viewYaw) * cp, Math.sin(this.viewPitch), Math.cos(this.viewYaw) * cp);
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

  _maxDist() { return this.cfg.overview ? this.cfg.overviewDistance : this.cfg.maxDistance; }

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
