// Spring-arm third-person camera: damped position and rotation, collision
// with the town (never clips through walls, eases back out), look-ahead in
// the direction of travel, a gentle FOV widen when running, and a zoom that
// runs from behind-the-shoulder out to a high "dollhouse" overview.
import * as THREE from 'three';
import { PROOF } from '../config.js';

const C = PROOF.camera;
const _dir = new THREE.Vector3(), _goal = new THREE.Vector3(), _tmp = new THREE.Vector3();

export class SpringCamera {
  constructor(camera, phys, excludeCollider) {
    this.camera = camera; this.phys = phys; this.exclude = excludeCollider;
    this.yaw = 0; this.pitch = C.pitch;
    this.smoothYaw = 0; this.smoothPitch = C.pitch;
    this.wantDist = C.distance; this.dist = C.distance;
    this.pivot = new THREE.Vector3();
    this.lookAhead = new THREE.Vector3();
    this.baseFov = C.fov;
    this.orbit = null;    // { center, dist, pitch, speed } for the title screen
    this.first = true;
  }
  snapBehind(facing) { this.yaw = this.smoothYaw = facing + Math.PI; }
  get zoomedOut() { return this.dist > C.overviewFrom; }

  update(dt, target, vel, input, speedK = 0) {
    if (this.orbit) return this._orbit(dt);
    if (input) {
      const look = input.consumeLook();
      this.yaw -= look.dx;
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy, C.minPitch, C.maxPitch);
      const z = input.consumeZoom();
      if (z) this.wantDist = THREE.MathUtils.clamp(this.wantDist * (z > 0 ? 1.15 : 1 / 1.15), C.minDistance, C.maxDistance);
    }
    // rotation damping
    const kr = 1 - Math.exp(-dt * C.rotDamping);
    let dy = this.yaw - this.smoothYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.smoothYaw += dy * kr;
    // past the overview distance the pitch tilts up towards a dollhouse view
    const over = THREE.MathUtils.smoothstep(this.wantDist, C.overviewFrom, C.maxDistance);
    const wantPitch = THREE.MathUtils.lerp(this.pitch, Math.max(this.pitch, C.overviewPitch), over);
    this.smoothPitch += (wantPitch - this.smoothPitch) * kr;

    // pivot: above the feet, with look-ahead along the velocity
    _tmp.set(vel.x, 0, vel.z).multiplyScalar(C.lookAhead * 0.25 * (1 - over));
    this.lookAhead.lerp(_tmp, 1 - Math.exp(-dt * 3));
    _goal.set(target.x + this.lookAhead.x, target.y + C.pivotHeight + over * 1.5, target.z + this.lookAhead.z);
    if (this.first) { this.pivot.copy(_goal); this.first = false; }
    const kp = 1 - Math.exp(-dt * C.posDamping);
    this.pivot.x += (_goal.x - this.pivot.x) * kp;
    this.pivot.z += (_goal.z - this.pivot.z) * kp;
    this.pivot.y += (_goal.y - this.pivot.y) * Math.min(1, dt * 8);

    // arm direction + collision
    const cp = Math.cos(this.smoothPitch);
    _dir.set(Math.sin(this.smoothYaw) * cp, Math.sin(this.smoothPitch), Math.cos(this.smoothYaw) * cp);
    const hit = this.phys.ray(this.pivot, _dir, this.wantDist + 0.5, this.exclude);
    const allowed = hit === null ? this.wantDist : Math.max(0.7, Math.min(this.wantDist, hit - 0.45));
    if (allowed < this.dist) this.dist = allowed;                                   // snap in
    else this.dist += (allowed - this.dist) * (1 - Math.exp(-dt * 3.5));            // ease out

    const cam = this.camera;
    cam.position.set(this.pivot.x + _dir.x * this.dist, Math.max(0.3, this.pivot.y + _dir.y * this.dist), this.pivot.z + _dir.z * this.dist);
    cam.lookAt(this.pivot);
    // FOV widens a little when running
    const fov = this.baseFov + speedK * C.sprintFov;
    if (Math.abs(cam.fov - fov) > 0.02) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); }
  }
  _orbit(dt) {
    const o = this.orbit;
    o.yaw = (o.yaw || 0) + dt * o.speed;
    const cp = Math.cos(o.pitch);
    this.camera.position.set(o.center.x + Math.sin(o.yaw) * cp * o.dist, o.center.y + Math.sin(o.pitch) * o.dist, o.center.z + Math.cos(o.yaw) * cp * o.dist);
    this.camera.lookAt(o.center);
    this.dist = o.dist;
    if (Math.abs(this.camera.fov - this.baseFov) > 0.05) { this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix(); }
  }
}
