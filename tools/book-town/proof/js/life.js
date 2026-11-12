// Ambient life: townspeople on set routes with the same animation system as
// the player, pigeons that hop about and fly off when you run at them, and
// butterflies over the flower beds.
import * as THREE from 'three';
import { Character, LOOKS } from './character.js';
import { PROOF } from '../config.js';
import { plain } from './materials.js';

const ROUTES = [
  [[-20, -19], [12, -19], [20, -12], [20, 12], [13, 22], [-12, 21], [-19.5, 12], [-20, -12]],
  [[0, 38], [0, 12], [-6, 8], [-9, -4], [0, 12], [0, 38]],
  [[-4, -6], [-18, -26.5], [-12, -27], [-4, -6]],
  [[19, 18], [19.5, -14], [26, -6], [19.5, -14], [19, 18]],
  [[-18.5, 17], [-21, -16], [-26, -8], [-21, -16], [-18.5, 17]]
];
const TAU = Math.PI * 2;

export class Life {
  constructor(scene, gltf, player, world) {
    this.scene = scene; this.player = player;
    this.npcs = [];
    const looks = [LOOKS.npc1, LOOKS.npc2, LOOKS.npc3, LOOKS.npc4, LOOKS.npc5];
    for (let i = 0; i < Math.min(PROOF.life.npcs, ROUTES.length); i++) {
      const ch = new Character(gltf, looks[i]);
      ch.addBlobShadow(scene);
      scene.add(ch.root);
      const path = ROUTES[i].map(([x, z]) => new THREE.Vector3(x, 0, z));
      const n = { ch, path, seg: i % (path.length - 1), k: Math.random(), speed: 1.3 + Math.random() * 0.8, facing: 0, prevSpeed: 0, wait: 0, pos: new THREE.Vector3() };
      n.pos.copy(path[n.seg]);
      this.npcs.push(n);
    }
    this._birds(world);
    this._butterflies(world);
  }
  setCount(n) { this.npcs.forEach((o, i) => { const on = i < n; o.ch.root.visible = on; if (o.ch.blob) o.ch.blob.visible = on; }); }

  _birds(world) {
    const body = new THREE.Group();
    const grey = plain(0x8a8f9a, { roughness: 0.9 }), dark = plain(0x5a6572, { roughness: 0.9 }), beak = plain(0xe0a040, { roughness: 0.6 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8).scale(1, 0.85, 1.5), grey); b.position.y = 0.12;
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), dark); h.position.set(0, 0.22, 0.14);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6).rotateX(Math.PI / 2), beak); bk.position.set(0, 0.21, 0.22);
    body.add(b, h, bk);
    this.birds = [];
    for (let i = 0; i < PROOF.life.birds; i++) {
      const g = body.clone();
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16).translate(0.13, 0, 0), dark), wr = wl.clone();
      wl.position.set(0.05, 0.16, 0); wr.position.set(-0.05, 0.16, 0); wr.rotation.y = Math.PI;
      wl.material.side = wr.material.side = THREE.DoubleSide;
      g.add(wl, wr);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const spot = birdSpot();
      g.position.set(spot.x, 0, spot.z);
      this.scene.add(g);
      this.birds.push({ g, wl, wr, state: 'ground', t: Math.random() * 3, vel: new THREE.Vector3(), hop: 0, home: spot, body: b });
    }
  }
  _butterflies(world) {
    const wing = new THREE.PlaneGeometry(0.11, 0.09).translate(0.055, 0, 0);
    const cols = [0xffd23f, 0xff8ac0, 0x8ad8ff, 0xffffff, 0xff9a3c, 0xc0a8ff, 0xffd23f, 0x8ad8ff];
    this.bflies = [];
    const beds = world.flowerBeds.length ? world.flowerBeds : [{ x: 0, z: 20 }];
    for (let i = 0; i < PROOF.life.butterflies; i++) {
      const g = new THREE.Group();
      const m = plain(cols[i % cols.length], { roughness: 0.7, side: THREE.DoubleSide });
      const l = new THREE.Mesh(wing, m), r = new THREE.Mesh(wing, m); r.rotation.y = Math.PI;
      g.add(l, r);
      this.scene.add(g);
      const bed = beds[i % beds.length];
      this.bflies.push({ g, l, r, x: bed.x + (Math.random() - 0.5) * 4, z: bed.z + (Math.random() - 0.5) * 2, ph: Math.random() * 10, sp: 0.6 + Math.random() * 0.5 });
    }
  }

  update(dt, t) {
    const pl = this.player;
    // townspeople
    for (const n of this.npcs) {
      if (!n.ch.root.visible) continue;
      const a = n.path[n.seg], b = n.path[n.seg + 1];
      const len = a.distanceTo(b) || 1;
      const near = pl.distanceTo(n.pos) < 1.6;
      let speed = near ? 0 : n.speed;
      if (n.wait > 0) { n.wait -= dt; speed = 0; }
      n.k += speed * dt / len;
      if (n.k >= 1) { n.k = 0; n.seg = (n.seg + 1) % (n.path.length - 1); if (Math.random() < 0.3) n.wait = 1.5 + Math.random() * 2; }
      n.pos.lerpVectors(a, b, n.k);
      const want = near ? Math.atan2(pl.x - n.pos.x, pl.z - n.pos.z) : Math.atan2(b.x - a.x, b.z - a.z);
      let d = want - n.facing; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      const turn = d * Math.min(1, dt * 5);
      n.facing += turn;
      const sm = speed + (n.prevSpeed - speed) * Math.exp(-dt * 4);   // ease speed for the blend
      n.prevSpeed = sm;
      n.ch.root.position.copy(n.pos);
      n.ch.root.rotation.y = n.facing;
      n.ch.lookTarget = near ? new THREE.Vector3(pl.x, pl.y + 1.5, pl.z) : null;
      n.ch.update(dt, { speed: sm, grounded: true, vy: 0, justJumped: false, landed: 0, accel: (sm - n.prevSpeed) / Math.max(dt, 1e-3), turnRate: turn / Math.max(dt, 1e-3), airTime: 0, groundY: 0 });
    }
    // pigeons
    for (const b of this.birds) {
      const dx = b.g.position.x - pl.x, dz = b.g.position.z - pl.z, d = Math.hypot(dx, dz);
      if (b.state === 'ground') {
        b.t -= dt;
        if (b.t <= 0) { b.t = 0.6 + Math.random() * 2.2; b.hop = 0.25; b.g.rotation.y += (Math.random() - 0.5) * 2; }
        if (b.hop > 0) { b.hop -= dt; b.g.position.x += Math.sin(b.g.rotation.y) * dt * 0.7; b.g.position.z += Math.cos(b.g.rotation.y) * dt * 0.7; b.g.position.y = Math.sin(b.hop / 0.25 * Math.PI) * 0.05; }
        b.body.rotation.x = b.hop > 0 ? 0 : Math.sin(t * 7 + b.home.x) > 0.8 ? 0.45 : 0;    // peck
        b.wl.rotation.z = b.wr.rotation.z = 0;
        if ((d < 4 && this.playerSpeed > 3.5) || d < 1.3) {
          b.state = 'fly'; b.t = 5 + Math.random() * 5;
          const a = Math.atan2(dx, dz) + (Math.random() - 0.5);
          b.vel.set(Math.sin(a) * 5, 6 + Math.random() * 2, Math.cos(a) * 5); b.g.rotation.y = a;
        }
      } else if (b.state === 'fly') {
        b.t -= dt;
        b.vel.y += (b.g.position.y < 12 ? 3.5 : -2) * dt; b.vel.y *= 0.985;
        b.vel.x += -b.g.position.z * dt * 0.05; b.vel.z += b.g.position.x * dt * 0.05;
        const hs = Math.hypot(b.vel.x, b.vel.z); if (hs > 7) { b.vel.x *= 7 / hs; b.vel.z *= 7 / hs; }
        b.g.position.addScaledVector(b.vel, dt);
        b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z);
        const flap = Math.sin(t * 26 + b.home.x) * 0.9; b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
        if (b.t <= 0) { b.state = 'land'; b.home = birdSpot(); }
      } else {
        const tx = b.home.x - b.g.position.x, tz = b.home.z - b.g.position.z, ty = -b.g.position.y, dist = Math.hypot(tx, ty, tz);
        if (dist < 0.3) { b.state = 'ground'; b.g.position.set(b.home.x, 0, b.home.z); b.t = 1; continue; }
        const sp = Math.min(6, dist * 1.4 + 1);
        b.g.position.x += tx / dist * sp * dt; b.g.position.y += ty / dist * sp * dt; b.g.position.z += tz / dist * sp * dt;
        b.g.rotation.y = Math.atan2(tx, tz);
        const flap = Math.sin(t * 18) * 0.5; b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
      }
    }
    // butterflies
    for (const f of this.bflies) {
      const tt = t * f.sp + f.ph;
      f.g.position.set(f.x + Math.sin(tt) * 1.6 + Math.sin(tt * 2.3) * 0.5, 1.0 + Math.sin(tt * 3.1) * 0.3, f.z + Math.cos(tt * 0.8) * 1.2);
      f.g.rotation.y = Math.atan2(Math.cos(tt) * 1.6, -Math.sin(tt * 0.8) * 1.0);
      const flap = 0.25 + Math.abs(Math.sin(t * 16 + f.ph)) * 1.1;
      f.l.rotation.z = flap; f.r.rotation.z = -flap;
    }
  }
}
function birdSpot() {
  for (let k = 0; k < 20; k++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 10;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(Math.abs(x) - 9.5) < 1.2 && Math.abs(z) < 1.8) continue;
    return { x, z };
  }
  return { x: 6, z: 12 };
}
