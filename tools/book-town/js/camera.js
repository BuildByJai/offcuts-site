// Third-person orbit camera that follows the player, never clips through
// walls (snaps in on contact) and eases back out once the view is clear.
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
  }

  // Place the camera behind a facing direction (radians, model space).
  snapBehind(facing) {
    this.yaw = facing + Math.PI;
  }

  update(dt, target, input) {
    const c = this.cfg;
    if (input) {
      const look = input.consumeLook();
      this.yaw -= look.dx;
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy, c.minPitch, c.maxPitch);
      const z = input.consumeZoom();
      if (z) this.wantDist = THREE.MathUtils.clamp(this.wantDist * (z > 0 ? 1.12 : 1 / 1.12), c.minDistance, c.maxDistance);
    }
    // smooth pivot so landings don't jolt the view
    const goal = new THREE.Vector3(target.x, target.y + c.pivotHeight, target.z);
    if (this.pivot.lengthSq() === 0) this.pivot.copy(goal);
    this.pivot.x = goal.x; this.pivot.z = goal.z;
    this.pivot.y += (goal.y - this.pivot.y) * Math.min(1, dt * 12);

    const cp = Math.cos(this.pitch);
    this._dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const hit = this.world.raycast(this.pivot.x, this.pivot.y, this.pivot.z, this._dir.x, this._dir.y, this._dir.z, this.wantDist + 0.4);
    const allowed = Math.max(0.6, Math.min(this.wantDist, hit - 0.35));
    if (allowed < this.dist) this.dist = allowed;                          // snap in
    else this.dist += (allowed - this.dist) * Math.min(1, dt * c.easeOut); // ease out

    const cam = this.camera;
    cam.position.set(
      this.pivot.x + this._dir.x * this.dist,
      Math.max(0.25, this.pivot.y + this._dir.y * this.dist),
      this.pivot.z + this._dir.z * this.dist
    );
    cam.lookAt(this.pivot);
  }
}
