// World pieces that use the moves: bounce mushrooms, jump rings, ziplines,
// grind rails, a launch cannon, ladders + ivy, updraft vents, speed pads,
// cracked crates, floating islands and boost orbs. Placements live in
// CONFIG.gadgets; every number that changes the feel is in CONFIG.moves.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { toon, addOutline, U, faceted } from './gfx.js';
import { canvasTexture } from './world.js';
import { Sfx } from './audio.js';
import { Save } from './save.js';

const M = CONFIG.moves;
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

function groundAt(world, x, z, below = 999) {
  let best = 0;
  for (const c of world.colliders) {
    if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && c.y1 <= below + 0.01 && c.y1 > best && c.y1 < 60) best = c.y1;
  }
  return best;
}
// closest point on segment a→b to p: returns t in [0,1]
const _sa = new THREE.Vector3(), _sb = new THREE.Vector3();
function segT(p, a, b) {
  _sa.subVectors(b, a);
  const l2 = _sa.lengthSq();
  return l2 > 0 ? THREE.MathUtils.clamp(_sb.subVectors(p, a).dot(_sa) / l2, 0, 1) : 0;
}
function cyl(a, b, r, mat, segs = 6) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.subVectors(b, a).normalize());
  m.castShadow = true;
  return m;
}

export class Gadgets {
  constructor({ scene, world, player, juice, onCrateCoins = null, onCrateGolden = null, onBoost = null }) {
    this.scene = scene; this.world = world; this.player = player; this.juice = juice;
    this.onCrateCoins = onCrateCoins; this.onCrateGolden = onCrateGolden; this.onBoost = onBoost;
    this.cfg = CONFIG.gadgets;
    this.interactables = [];
    this.t = 0;
    this.cool = 0;               // grab cooldown after leaving a ride
    this.mats = {
      metal: toon({ color: 0x5a5f66 }), darkMetal: toon({ color: 0x2f3b3a }), wood: toon({ color: 0x8a5a3a }),
      rope: toon({ color: 0x3a2a20 }), gold: toon({ color: 0xffd23f, emissive: 0x6b4a00, emissiveIntensity: 0.6 }),
      cream: toon({ color: 0xf3ead6 }), red: toon({ color: 0xd8452f }), white: toon({ color: 0xfbf7ee })
    };
    this._buildMushrooms();
    this._buildRings();
    this._buildZips();
    this._buildRails();
    this._buildCannons();
    this._buildLadders();
    this._buildVents();
    this._buildSpeedPads();
    this._buildIslands();
    this._buildCrates();
    this._buildOrbs();

    player.on('poundLand', (info) => this._onPound(info));
    player.on('unride', () => { this.cool = 0.35; });
  }

  /* ================= bounce mushrooms ================= */
  _buildMushrooms() {
    const dotTex = canvasTexture(128, 64, (ctx) => {
      ctx.fillStyle = '#e94f3a'; ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#fff6e6';
      [[16, 14, 7], [52, 22, 9], [92, 12, 6], [112, 40, 8], [30, 44, 6], [72, 48, 7]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    });
    dotTex.wrapS = THREE.RepeatWrapping;
    const capMat = toon({ map: dotTex });
    this.pads = this.cfg.bouncePads.map((p) => {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.7, 10), this.mats.cream);
      stem.position.y = 0.35;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      cap.scale.y = 0.55; cap.position.y = 0.62;
      const under = new THREE.Mesh(new THREE.CircleGeometry(1.25, 14), toon({ color: 0xf0d9b5 }));
      under.rotation.x = Math.PI / 2; under.position.y = 0.62;
      g.add(stem, cap, under);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      addOutline(g);
      g.position.set(p.x, groundAt(this.world, p.x, p.z), p.z);
      this.scene.add(g);
      const y0 = g.position.y;
      const collider = this.world.add(p.x - 1.05, p.x + 1.05, y0, y0 + 1.0, p.z - 1.05, p.z + 1.05);
      return { ...p, g, cap, collider, squash: 0, mega: false };
    });
  }

  /* ================= jump rings ================= */
  _buildRings() {
    this.rings = [];
    const geo = new THREE.TorusGeometry(1.35, 0.13, 8, 28);
    for (const chain of this.cfg.ringChains) {
      chain.rings.forEach((r, i) => {
        const pos = new THREE.Vector3(...r);
        const nextP = new THREE.Vector3(...(chain.rings[i + 1] || chain.exit));
        const mat = toon({ color: 0xffd23f, emissive: 0xffa000, emissiveIntensity: 0.5 });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        const d = _v.subVectors(nextP, pos); d.y = 0;
        m.rotation.y = Math.atan2(d.x, d.z);
        m.castShadow = true;
        addOutline(m, { width: 0.03 });
        this.scene.add(m);
        // aim the exit of the last ring at feet height, rings at body centre
        const target = nextP.clone();
        if (chain.rings[i + 1]) target.y -= 0.9;
        this.rings.push({ pos, target, m, idx: i, speed: chain.speed || 11, cd: 0, flash: 0 });
      });
    }
  }

  /* ================= ziplines ================= */
  _buildZips() {
    this.zips = this.cfg.ziplines.map((z) => {
      const a = new THREE.Vector3(...z.a), b = new THREE.Vector3(...z.b);
      const line = cyl(a, b, 0.035, this.mats.rope, 5);
      this.scene.add(line);
      for (const p of [a, b]) {
        const gy = groundAt(this.world, p.x, p.z, p.y);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, p.y + 0.4 - gy, 0.22), this.mats.darkMetal);
        post.position.set(p.x, (gy + p.y + 0.4) / 2, p.z + (p === a ? 0 : 0));
        post.castShadow = true;
        this.scene.add(post);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), this.mats.gold);
        cap.position.set(p.x, p.y + 0.45, p.z);
        this.scene.add(cap);
        // (no collider: a solid post at the top end blocks the run-up to the cable)
      }
      const handle = new THREE.Group();
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), this.mats.metal);
      wheel.rotation.z = Math.PI / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), this.mats.red);
      bar.position.y = -0.35;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), this.mats.rope);
      strap.position.y = -0.18;
      handle.add(wheel, strap, bar);
      handle.position.copy(a).lerp(b, 0.03);
      this.scene.add(handle);
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      return { a, b, dir, len: a.distanceTo(b), handle, rest: 0.03 };
    });
  }

  /* ================= grind rails ================= */
  _buildRails() {
    this.rails = this.cfg.rails.map((r) => {
      const a = new THREE.Vector3(...r.a), b = new THREE.Vector3(...r.b);
      const railMat = r.cable ? this.mats.rope : toon({ color: 0xc9ced6 });
      this.scene.add(cyl(a, b, r.cable ? 0.05 : 0.07, railMat, 6));
      if (r.posts) {
        const len = a.distanceTo(b), n = Math.max(2, Math.round(len / 4) + 1);
        for (let i = 0; i < n; i++) {
          const p = a.clone().lerp(b, i / (n - 1));
          const gy = groundAt(this.world, p.x, p.z, p.y - 0.1);
          if (p.y - gy < 0.15) continue;
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, p.y - gy, 0.1), this.mats.darkMetal);
          post.position.set(p.x, (p.y + gy) / 2, p.z); post.castShadow = true;
          this.scene.add(post);
        }
      }
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      return { a, b, dir, len: a.distanceTo(b) };
    });
  }

  /* ================= cannon ================= */
  _buildCannons() {
    this.cannons = this.cfg.cannons.map((c) => {
      const base = new THREE.Group();
      base.position.set(c.x, groundAt(this.world, c.x, c.z), c.z);
      const wheelMat = this.mats.wood;
      const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.8), wheelMat);
      carriage.position.y = 0.55;
      [-0.8, 0.8].forEach((x) => [-0.55, 0.55].forEach((z) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12), this.mats.darkMetal);
        w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z);
        base.add(w);
      }));
      const yawG = new THREE.Group(); yawG.position.y = 1.0;
      const pitchG = new THREE.Group();
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 2.6, 14), toon({ color: 0x2f3b4a }));
      barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.7;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.1, 6, 16), this.mats.gold);
      rim.position.z = 2.0;
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.25, 14), this.mats.red);
      stripe.rotation.x = Math.PI / 2; stripe.position.z = 0.2;
      pitchG.add(barrel, rim, stripe);
      yawG.add(pitchG);
      base.add(carriage, yawG);
      base.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      addOutline(base);
      this.scene.add(base);
      this.world.add(c.x - 0.8, c.x + 0.8, base.position.y, base.position.y + 1.0, c.z - 0.9, c.z + 0.9);
      // trajectory preview dots
      const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }), 24);
      dots.visible = false; dots.frustumCulled = false;
      this.scene.add(dots);
      const can = { ...c, base, yawG, pitchG, dots, aimYaw: c.yaw, aimPitch: c.pitch };
      yawG.rotation.y = c.yaw; pitchG.rotation.x = -c.pitch;
      this.interactables.push({ x: c.x, z: c.z, y: base.position.y, r: 2.4, label: 'Climb into the cannon', icon: '💥',
        act: () => this._enterCannon(can) });
      return can;
    });
  }
  _enterCannon(can) {
    const pl = this.player;
    const g = this;
    const ride = {
      kind: 'cannon', pose: 'idle', camYaw: can.aimYaw + Math.PI,
      update(p, dt, inp) {
        can.aimYaw -= inp.mv.x * dt * 1.3;
        can.aimPitch = THREE.MathUtils.clamp(can.aimPitch + inp.mv.y * dt * 0.8, 0.25, 1.15);
        can.yawG.rotation.y = can.aimYaw; can.pitchG.rotation.x = -can.aimPitch;
        this.camYaw = can.aimYaw + Math.PI;
        p.facing = can.aimYaw;
        p.pos.set(can.x, can.base.position.y + 0.4, can.z);
        p.vel.set(0, 0, 0);
        g._drawArc(can);
        if (inp.jumpPressed) g._fireCannon(can);
        else if (inp.chargePressed) { p.detach(null); p.pos.set(can.x + 1.6, can.base.position.y, can.z); }
      },
      onDetach(p) { p.rig.root.visible = true; can.dots.visible = false; }
    };
    pl.attach(ride);
    pl.rig.root.visible = false;
    Sfx.click();
    if (this.onCannon) this.onCannon(true);
  }
  _cannonVel(can) {
    const cp = Math.cos(can.aimPitch);
    return new THREE.Vector3(Math.sin(can.aimYaw) * cp * can.speed, Math.sin(can.aimPitch) * can.speed, Math.cos(can.aimYaw) * cp * can.speed);
  }
  _drawArc(can) {
    const v = this._cannonVel(can), g = CONFIG.movement.gravity;
    const o = new THREE.Vector3(can.x, can.base.position.y + 1.0, can.z).addScaledVector(v.clone().normalize(), 2.2);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 24; i++) {
      const t = (i + 1) * 0.09;
      m.makeTranslation(o.x + v.x * t, o.y + v.y * t - 0.5 * g * t * t, o.z + v.z * t);
      can.dots.setMatrixAt(i, m);
    }
    can.dots.instanceMatrix.needsUpdate = true;
    can.dots.visible = true;
  }
  _fireCannon(can) {
    const v = this._cannonVel(can);
    const pl = this.player;
    pl.detach(v);
    const muzzle = v.clone().normalize();
    pl.pos.set(can.x + muzzle.x * 2.2, can.base.position.y + 0.4 + muzzle.y * 2.2, can.z + muzzle.z * 2.2);
    pl.fling(v.x, v.y, v.z);
    Sfx.cannon();
    if (this.juice) {
      this.juice.puff(14, { speed: 4, up: 1 });
      this.juice.sparkle(pl.pos.x, pl.pos.y + 1, pl.pos.z, 14, 0xffb347);
    }
    if (this.onShake) this.onShake(0.4);
    pl.trick('cannon');
    if (this.onCannon) this.onCannon(false);
  }

  /* ================= ladders + ivy ================= */
  _buildLadders() {
    const ivyTex = canvasTexture(128, 256, (ctx) => {
      ctx.clearRect(0, 0, 128, 256);
      for (let i = 0; i < 160; i++) {
        const x = Math.random() * 128, y = Math.random() * 256, r = 6 + Math.random() * 8;
        ctx.fillStyle = ['#3f7f3e', '#5aa24f', '#4b8f43', '#6cb85a'][i % 4];
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, Math.random() * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(30 + k * 34, 256); for (let y = 256; y > 0; y -= 20) ctx.lineTo(30 + k * 34 + Math.sin(y * 0.05 + k) * 10, y); ctx.stroke(); }
    });
    ivyTex.wrapT = THREE.RepeatWrapping;
    this.ladders = this.cfg.ladders.map((L) => {
      const gy = groundAt(this.world, L.x + L.nx * 0.6, L.z + L.nz * 0.6, L.top);
      const h = L.top - gy;
      const g = new THREE.Group();
      g.position.set(L.x + L.nx * 0.08, gy, L.z + L.nz * 0.08);
      g.rotation.y = Math.atan2(L.nx, L.nz);
      const halfW = L.style === 'ivy' ? 1.2 : 0.5;
      if (L.style === 'ivy') {
        const tex = ivyTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, h / 4);
        const ivy = new THREE.Mesh(new THREE.PlaneGeometry(2.6, h + 0.4), toon({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
        ivy.position.set(0, h / 2 + 0.1, 0.02);
        g.add(ivy);
      } else {
        [-0.4, 0.4].forEach((x) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, h + 0.9, 0.08), this.mats.wood); r.position.set(x, (h + 0.9) / 2, 0.06); r.castShadow = true; g.add(r); });
        for (let y = 0.35; y < h + 0.8; y += 0.38) { const rung = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), this.mats.wood); rung.position.set(0, y, 0.06); g.add(rung); }
      }
      this.scene.add(g);
      return { ...L, gy, halfW };
    });
  }
  _tryLadder(pl, wx, wz, mag) {
    for (const L of this.ladders) {
      const dx = pl.pos.x - L.x, dz = pl.pos.z - L.z;
      const out = dx * L.nx + dz * L.nz;
      const side = Math.abs(dx * L.nz - dz * L.nx);
      if (out < 0 || out > CONFIG.movement.radius + 0.35 || side > L.halfW) continue;
      if (pl.pos.y > L.top - 0.3 || pl.pos.y < L.gy - 0.1) continue;
      const into = -(wx * L.nx + wz * L.nz);
      if (mag < 0.3 || into < 0.55) continue;
      this._attachLadder(pl, L);
      return true;
    }
    return false;
  }
  _attachLadder(pl, L) {
    const r = CONFIG.movement.radius;
    const ride = {
      kind: 'ladder', phase: 0,
      update(p, dt, inp) {
        const up = inp.mv.y;
        p.pos.x = L.x + L.nx * (r + 0.12) + (p.pos.x - L.x) * Math.abs(L.nz);
        p.pos.z = L.z + L.nz * (r + 0.12) + (p.pos.z - L.z) * Math.abs(L.nx);
        p.facing = Math.atan2(-L.nx, -L.nz);
        const v = up * M.ladderSpeed;
        p.pos.y += v * dt;
        this.phase += v * dt * 2.6;
        p.vel.set(0, v, 0);
        if (inp.jumpPressed) { p.detach({ x: L.nx * 5, y: 7, z: L.nz * 5 }); p.facing = Math.atan2(L.nx, L.nz); return; }
        if (p.pos.y <= L.gy && up < 0) { p.pos.y = L.gy; p.detach(null); p.grounded = true; return; }
        if (p.pos.y >= L.top - 1.25) {
          // climb over the top onto the roof
          p.detach(null);
          p.pos.set(L.x - L.nx * (r + 0.35), L.top + 0.01, L.z - L.nz * (r + 0.35));
          p.vel.set(0, 0, 0); p.grounded = true;
          p.landTimer = 0.1; p.landSquash = 0.1;
          p.emit('pullUp');
        }
      }
    };
    pl.attach(ride);
  }

  /* ================= updraft vents ================= */
  _buildVents() {
    const swirl = canvasTexture(64, 256, (ctx) => {
      ctx.clearRect(0, 0, 64, 256);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const x = (i * 23) % 64, y = (i * 71) % 256; ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.lineTo(x + 4, y); ctx.stroke(); }
    });
    swirl.wrapS = swirl.wrapT = THREE.RepeatWrapping;
    this.ventTex = swirl;
    this.vents = this.cfg.vents.map((v) => {
      const gy = groundAt(this.world, v.x, v.z);
      const grate = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.3, 16), toon({ color: 0x4a5560 }));
      grate.position.set(v.x, gy + 0.15, v.z); grate.receiveShadow = true;
      const fan = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.3), this.mats.metal);
      fan.position.set(v.x, gy + 0.32, v.z);
      const fan2 = fan.clone(); fan2.rotation.y = Math.PI / 2;
      // column fades out towards the top (alphaMap gradient)
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, v.top - gy, 16, 1, true),
        new THREE.MeshBasicMaterial({ map: swirl, alphaMap: this._ventFade || (this._ventFade = canvasTexture(4, 64, (ctx) => { const g = ctx.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64); })),
          transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      col.position.set(v.x, gy + (v.top - gy) / 2, v.z);
      swirl.repeat.set(3, (v.top - gy) / 6);
      this.scene.add(grate, fan, fan2, col);
      this.world.add(v.x - 1.5, v.x + 1.5, gy, gy + 0.3, v.z - 1.5, v.z + 1.5);
      return { ...v, gy, fan, fan2 };
    });
  }

  /* ================= speed pads ================= */
  _buildSpeedPads() {
    const tex = canvasTexture(64, 128, (ctx) => {
      ctx.fillStyle = '#23303d'; ctx.fillRect(0, 0, 64, 128);
      ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 9; ctx.lineJoin = 'round';
      [20, 60, 100].forEach((y) => { ctx.beginPath(); ctx.moveTo(10, y + 16); ctx.lineTo(32, y - 6); ctx.lineTo(54, y + 16); ctx.stroke(); });
    });
    tex.wrapT = THREE.RepeatWrapping;
    this.padTex = tex;
    this.speedPads = this.cfg.speedPads.map((s) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(s.dx, -s.dz) + Math.PI;
      m.position.set(s.x, 0.03, s.z);
      this.scene.add(m);
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.5), toon({ color: 0x2f3b3a }));
      rim.rotation.copy(m.rotation); rim.position.set(s.x, 0.02, s.z);
      this.scene.add(rim);
      return { ...s, cd: 0 };
    });
  }

  /* ================= floating islands ================= */
  _buildIslands() {
    this.islands = this.cfg.islands.map((I) => {
      const g = new THREE.Group();
      g.position.set(I.x, I.top, I.z);
      // a giant open book
      const cover = new THREE.Mesh(new THREE.BoxGeometry(I.w + 0.3, 0.3, I.d + 0.3), toon({ color: 0x8a3a3a }));
      cover.position.y = -0.55;
      const pagesL = new THREE.Mesh(new THREE.BoxGeometry(I.w / 2 - 0.05, 0.4, I.d), toon({ color: 0xfaf3e0 }));
      pagesL.position.set(-I.w / 4, -0.2, 0); pagesL.rotation.z = 0.04;
      const pagesR = pagesL.clone(); pagesR.position.x = I.w / 4; pagesR.rotation.z = -0.04;
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, I.d + 0.3), toon({ color: 0x6a2a2a }));
      spine.position.y = -0.45;
      const lines = canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = '#faf3e0'; ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = 'rgba(60,50,40,0.35)';
        for (let y = 24; y < 240; y += 14) { ctx.fillRect(14, y, 100, 3); ctx.fillRect(142, y, 100, 3); }
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(124, 0, 8, 256);
      });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(I.w, I.d), toon({ map: lines }));
      top.rotation.x = -Math.PI / 2; top.position.y = 0.005;
      // rocky underside
      const rockGeo = faceted(new THREE.DodecahedronGeometry(I.w * 0.5, 0));
      rockGeo.scale(1.15, 0.55, 1.05);
      const rock = new THREE.Mesh(rockGeo, toon({ color: 0x9a8a72 }));
      rock.position.y = -1.6;
      const grass = new THREE.Mesh(faceted(new THREE.CylinderGeometry(I.w * 0.62, I.w * 0.5, 0.45, 8)), toon({ color: 0x5aa24f }));
      grass.position.y = -0.92;
      g.add(cover, pagesL, pagesR, spine, top, rock, grass);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(g);
      this.world.add(I.x - I.w / 2, I.x + I.w / 2, I.top - 0.7, I.top, I.z - I.d / 2, I.z + I.d / 2);
      return { ...I, g };
    });
  }

  /* ================= cracked crates ================= */
  _buildCrates() {
    const tex = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#c48a4a'; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#8a5a2e';
      ctx.fillRect(0, 0, 128, 12); ctx.fillRect(0, 116, 128, 12); ctx.fillRect(0, 0, 12, 128); ctx.fillRect(116, 0, 12, 128);
      ctx.save(); ctx.translate(64, 64); ctx.rotate(Math.PI / 4); ctx.fillRect(-80, -6, 160, 12); ctx.restore();
      ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(30, 18); ctx.lineTo(52, 50); ctx.lineTo(44, 74); ctx.lineTo(70, 108); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(52, 50); ctx.lineTo(86, 42); ctx.lineTo(104, 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(44, 74); ctx.lineTo(20, 90); ctx.stroke();
    });
    const mat = toon({ map: tex });
    const now = Date.now();
    this.crates = this.cfg.crates.map((c) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mat);
      m.position.set(c.x, c.y + 0.55, c.z);
      m.castShadow = true; m.receiveShadow = true;
      addOutline(m);
      this.scene.add(m);
      const crate = { ...c, m, collider: null, broken: false, timer: 0 };
      const at = Save.crateBrokenAt(c.id);
      const left = CONFIG.economy.crateRespawn - (now - at) / 1000;
      if (at && left > 0) { crate.broken = true; crate.timer = left; m.visible = false; }
      else crate.collider = this.world.add(c.x - 0.55, c.x + 0.55, c.y, c.y + 1.1, c.z - 0.55, c.z + 0.55);
      return crate;
    });
  }
  crateById(id) { return this.crates.find((c) => c.id === id); }
  _onPound(info) {
    for (const c of this.pads) {
      if (info.ground === c.collider) c.mega = true;
    }
    for (const c of this.crates) {
      if (c.broken) continue;
      const dx = info.x - c.x, dz = info.z - c.z;
      const onTop = info.ground === c.collider;
      if (onTop || (dx * dx + dz * dz < 2.2 * 2.2 && Math.abs(info.y - (c.y + 0.5)) < 1.4)) this._breakCrate(c);
    }
  }
  _breakCrate(c) {
    c.broken = true; c.timer = CONFIG.economy.crateRespawn;
    c.m.visible = false;
    if (c.collider) { this.world.remove(c.collider); c.collider = null; }
    Save.breakCrate(c.id);
    Sfx.crate();
    if (this.juice) {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        this.juice.dust.emit(c.x, c.y + 0.6, c.z, { vx: Math.cos(a) * 4, vy: 3 + Math.random() * 4, vz: Math.sin(a) * 4, color: i % 2 ? 0xc48a4a : 0x8a5a2e, size: 0.3, size1: 0.25, life: 0.8, gravity: 14, drag: 0.5, alpha: 1 });
      }
      this.juice.sparkle(c.x, c.y + 0.8, c.z, 12);
    }
    const goldenFirst = c.golden && !Save.hasGolden(c.golden);
    if (goldenFirst && this.onCrateGolden) this.onCrateGolden(c.golden, c);
    else if (this.onCrateCoins) this.onCrateCoins(CONFIG.economy.crate, c);
  }

  /* ================= boost orbs ================= */
  _buildOrbs() {
    const icons = Object.fromEntries(CONFIG.shop.boosts.map((b) => [b.id, b.icon]));
    const colors = { rocket: 0xff8a3c, speed: 0x4fc3ff, magnet: 0xe94f6a };
    this.orbs = this.cfg.orbs.map((o) => {
      const g = new THREE.Group();
      g.position.set(o.x, o.y, o.z);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), toon({ color: colors[o.boost], emissive: colors[o.boost], emissiveIntensity: 0.8 }));
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshBasicMaterial({ color: colors[o.boost], transparent: true, opacity: 0.25, depthWrite: false }));
      const iconTex = canvasTexture(64, 64, (ctx) => { ctx.font = '44px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icons[o.boost], 32, 36); });
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex, depthWrite: false }));
      icon.scale.set(0.8, 0.8, 1); icon.position.y = 1.0;
      g.add(core, shell, icon);
      this.scene.add(g);
      return { ...o, g, core, shell, timer: 0 };
    });
  }

  /* ================= per frame ================= */
  update(dt, input) {
    const pl = this.player;
    this.t += dt;
    if (this.cool > 0) this.cool -= dt;
    pl.updraft = 0;
    const body = _b.set(pl.pos.x, pl.pos.y + 0.9, pl.pos.z);

    // mushrooms
    for (const p of this.pads) {
      if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 3);
      const s = 1 - Math.sin(p.squash * Math.PI) * 0.35;
      p.cap.scale.set(1 + (1 - s) * 0.5, 0.55 * s, 1 + (1 - s) * 0.5);
      if (pl.grounded && pl.ground === p.collider && !pl.ride) {
        const h = p.mega ? p.launch * M.poundBounceFactor : p.launch;
        pl.launch(h, { keepSpeed: true });
        p.squash = 1;
        Sfx.bounce();
        if (this.juice) { this.juice.rings.spawn(p.x, p.collider.y1 + 0.05, p.z, { color: p.mega ? 0xffd23f : 0xffffff, from: 0.5, to: 2.6, life: 0.35 }); if (p.mega) this.juice.sparkle(pl.pos.x, pl.pos.y, pl.pos.z, 16, 0xffd23f); }
        pl.trick(p.mega ? 'mega bounce' : 'bounce');
        p.mega = false;
      } else if (!pl.grounded || pl.ground !== p.collider) p.mega = p.mega && pl.pound != null;
    }

    // rings
    for (const r of this.rings) {
      r.m.rotation.z += dt * 0.8;
      if (r.cd > 0) r.cd -= dt;
      if (r.flash > 0) { r.flash -= dt; r.m.material.emissiveIntensity = 0.5 + r.flash * 4; r.m.scale.setScalar(1 + r.flash * 0.8); }
      else { r.m.material.emissiveIntensity = 0.5 + Math.sin(this.t * 4 + r.idx) * 0.15; r.m.scale.setScalar(1); }
      if (r.cd <= 0 && !pl.ride && body.distanceTo(r.pos) < 1.75) {
        const d = _a.subVectors(r.target, pl.pos);
        const hd = Math.hypot(d.x, d.z);
        const T = Math.max(0.35, hd / r.speed);
        const g = CONFIG.movement.gravity;
        pl.fling(d.x / T, (d.y + 0.5 * g * T * T) / T, d.z / T);
        r.cd = 0.8; r.flash = 0.25;
        Sfx.ring(r.idx);
        if (this.juice) this.juice.sparkle(r.pos.x, r.pos.y, r.pos.z, 10, 0xffd23f);
        pl.trick('ring');
      }
    }

    // ziplines
    for (const z of this.zips) {
      if (pl.ride && pl.ride.zip === z) continue;
      z.handle.position.lerpVectors(z.a, z.b, z.rest);
      if (pl.ride || pl.grounded || this.cool > 0) continue;
      _v.set(pl.pos.x, pl.pos.y + 1.95, pl.pos.z);
      const t = segT(_v, z.a, z.b);
      if (t > 0.97) continue;
      _a.lerpVectors(z.a, z.b, t);
      if (_a.distanceTo(_v) < 1.0) this._attachZip(pl, z, t);
    }

    // rails
    if (!pl.ride && this.cool <= 0 && pl.vel.y <= 0.5 && !pl.grounded) {
      for (const r of this.rails) {
        const t = segT(pl.pos, r.a, r.b);
        if (t <= 0.01 || t >= 0.99) continue;
        _a.lerpVectors(r.a, r.b, t);
        const dy = pl.pos.y - _a.y;
        if (dy < -0.35 || dy > 0.3) continue;
        if (Math.hypot(pl.pos.x - _a.x, pl.pos.z - _a.z) > 0.6) continue;
        this._attachRail(pl, r, t);
        break;
      }
    }

    // ladders: walk / jump into them
    if (!pl.ride && this.cool <= 0 && input) {
      const mv = input.getMove();
      if (mv.mag > 0.3) {
        const yaw = this.camYaw || 0;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
        let wx = rx * mv.x + fx * mv.y, wz = rz * mv.x + fz * mv.y;
        const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
        this._tryLadder(pl, wx, wz, mv.mag);
      }
    }

    // vents
    this.ventTex.offset.y -= dt * 1.4;
    for (const v of this.vents) {
      v.fan.rotation.y += dt * 9; v.fan2.rotation.y += dt * 9;
      const dx = pl.pos.x - v.x, dz = pl.pos.z - v.z;
      if (dx * dx + dz * dz < 1.9 * 1.9 && pl.pos.y < v.top) {
        if (pl.gliding) {
          pl.updraft = 30;
          if (!v.tricked) { pl.trick('updraft'); v.tricked = true; }
        }
        if (this.juice && Math.random() < dt * 12) this.juice.dust.emit(v.x + (Math.random() - 0.5) * 2, v.gy + 0.4, v.z + (Math.random() - 0.5) * 2, { vy: 9, color: 0xffffff, size: 0.2, size1: 0.5, life: 1.2, alpha: 0.4, drag: 0.2 });
      } else v.tricked = false;
      if (this.juice && Math.random() < dt * 3) this.juice.dust.emit(v.x + (Math.random() - 0.5) * 2, v.gy + 0.4, v.z + (Math.random() - 0.5) * 2, { vy: 7, color: 0xffffff, size: 0.18, size1: 0.45, life: 1.4, alpha: 0.35, drag: 0.2 });
    }

    // speed pads
    this.padTex.offset.y -= dt * 1.6;
    for (const s of this.speedPads) {
      if (s.cd > 0) { s.cd -= dt; continue; }
      if (!pl.grounded || pl.ride) continue;
      if (Math.abs(pl.pos.x - s.x) < 1.1 && Math.abs(pl.pos.z - s.z) < 1.7 && pl.pos.y < 0.3) {
        pl.boost(1.8, 1.6);
        pl.vel.x += s.dx * 8; pl.vel.z += s.dz * 8;
        s.cd = 0.8;
        Sfx.speedPad();
        if (this.onShake) this.onShake(0.05);
      }
    }

    // crates respawn
    for (const c of this.crates) {
      if (!c.broken) continue;
      c.timer -= dt;
      if (c.timer <= 0) {
        const r = CONFIG.movement.radius;
        const inside = pl.pos.x + r > c.x - 0.55 && pl.pos.x - r < c.x + 0.55 && pl.pos.z + r > c.z - 0.55 && pl.pos.z - r < c.z + 0.55 && pl.pos.y < c.y + 1.2 && pl.pos.y + 1.8 > c.y;
        if (!inside) { c.broken = false; c.m.visible = true; c.collider = this.world.add(c.x - 0.55, c.x + 0.55, c.y, c.y + 1.1, c.z - 0.55, c.z + 0.55); }
      }
    }

    // orbs
    for (const o of this.orbs) {
      if (o.timer > 0) { o.timer -= dt; o.g.visible = o.timer <= 0; continue; }
      o.g.position.y = o.y + Math.sin(this.t * 2 + o.x) * 0.15;
      o.core.rotation.y += dt * 1.5; o.shell.rotation.x += dt;
      o.shell.scale.setScalar(1 + Math.sin(this.t * 5) * 0.08);
      if (body.distanceTo(o.g.position) < 1.3) {
        const b = CONFIG.shop.boosts.find((x) => x.id === o.boost);
        pl.addBoost(o.boost, b.secs);
        o.timer = CONFIG.economy.orbRespawn; o.g.visible = false;
        Sfx.boost();
        if (this.juice) this.juice.sparkle(o.x, o.y, o.z, 16, 0xffffff);
        if (this.onBoost) this.onBoost(b);
      }
    }
  }

  _attachZip(pl, z, t) {
    const g = this;
    let s = t * z.len;
    let v = Math.max(M.rideMinSpeed, pl.speedH * 0.8);
    const ride = {
      kind: 'zip', zip: z,
      update(p, dt, inp) {
        const slope = -z.dir.y;
        v = THREE.MathUtils.clamp(v + CONFIG.movement.gravity * slope * dt * 0.8, M.rideMinSpeed, M.zipSpeed);
        s += v * dt;
        const k = Math.min(1, s / z.len);
        _a.lerpVectors(z.a, z.b, k);
        p.pos.set(_a.x, _a.y - 1.95, _a.z);
        p.vel.copy(z.dir).multiplyScalar(v);
        p.facing = Math.atan2(z.dir.x, z.dir.z);
        z.handle.position.copy(_a);
        if (g.juice && Math.random() < dt * 20) g.juice.spark.emit(_a.x, _a.y + 0.05, _a.z, { vy: 1, color: 0xffe08a, size: 0.2, size1: 0.02, life: 0.3, spread: 2, gravity: 8 });
        if (inp.jumpPressed) {
          p.detach({ x: z.dir.x * v, y: p.jumpVelocity * 0.85, z: z.dir.z * v });
          p.emit('jump');
          z.rest = k;
          return;
        }
        if (k >= 1) { p.detach({ x: z.dir.x * v * 0.8, y: 3, z: z.dir.z * v * 0.8 }); z.rest = 0.97; }
      }
    };
    pl.attach(ride);
  }

  _attachRail(pl, r, t) {
    const g = this;
    const hv = new THREE.Vector2(pl.vel.x, pl.vel.z);
    let sign = hv.lengthSq() > 0.01 ? Math.sign(hv.x * r.dir.x + hv.y * r.dir.z) || 1 : (Math.sign(Math.sin(pl.facing) * r.dir.x + Math.cos(pl.facing) * r.dir.z) || 1);
    let s = t * r.len;
    let v = Math.max(M.rideMinSpeed, hv.length(), M.railSpeed * 0.8);
    const ride = {
      kind: 'rail',
      update(p, dt, inp) {
        const dirY = r.dir.y * sign;
        v = THREE.MathUtils.clamp(v - CONFIG.movement.gravity * dirY * dt * 0.6, M.rideMinSpeed, M.railSpeed * 1.6);
        s += v * sign * dt;
        const k = s / r.len;
        _a.lerpVectors(r.a, r.b, THREE.MathUtils.clamp(k, 0, 1));
        p.pos.set(_a.x, _a.y + 0.02, _a.z);
        p.vel.set(r.dir.x * v * sign, r.dir.y * v * sign, r.dir.z * v * sign);
        p.facing = Math.atan2(r.dir.x * sign, r.dir.z * sign);
        if (g.juice && Math.random() < dt * 30) g.juice.spark.emit(_a.x, _a.y, _a.z, { vx: -p.vel.x * 0.2, vy: 1.5, vz: -p.vel.z * 0.2, color: 0xffd27a, size: 0.22, size1: 0.02, life: 0.35, spread: 2, gravity: 10 });
        if (inp.jumpPressed) {
          p.detach({ x: p.vel.x, y: p.jumpVelocity, z: p.vel.z });
          p.emit('jump');
          return;
        }
        if (k <= 0 || k >= 1) p.detach({ x: p.vel.x, y: Math.max(2.5, p.vel.y), z: p.vel.z });
      }
    };
    pl.attach(ride);
  }
}
