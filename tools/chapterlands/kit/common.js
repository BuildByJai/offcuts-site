// Helpers shared by the 3D templates: pickups with light beams, NPCs, flags,
// finish arches and checkpoint pads.
import * as THREE from 'three';
import { pickup, hex } from './props.js';
import { buildNPC } from '../js/critters.js';
import { signMesh } from '../js/world.js';
import { Sfx } from '../js/audio.js';
import { toast } from '../js/hud.js';

// Items to collect. defs: [{name, icon, colour}], positions: [[x,y,z]...]
export function spawnItems(A, defs, positions, { beam = true, onGet = null, onAll = null, label = null } = {}) {
  const items = positions.map((p, i) => {
    const d = defs[i % defs.length];
    const g = pickup(d.icon || '⭐', d.colour || A.P.item);
    g.position.set(p[0], p[1] || 0, p[2]);
    A.scene.add(g);
    let b = null;
    if (beam) {
      b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 8, 1, true), new THREE.MeshBasicMaterial({ color: hex(d.colour || '#ffe27a'), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
      b.position.set(p[0], (p[1] || 0) + 6, p[2]);
      A.scene.add(b);
    }
    return { d, g, b, x: p[0], y: p[1] || 0, z: p[2], got: false };
  });
  let got = 0;
  const total = items.length;
  const tag = label || 'found';
  A.setProgress(`${got} / ${total} ${tag}`);
  A.onUpdate((dt, t) => {
    const pl = A.player.pos;
    for (const it of items) {
      if (it.got) continue;
      it.g.userData.gem.rotation.y += dt * 2;
      it.g.position.y = it.y + Math.sin(t * 2.4 + it.x) * 0.12;
      if (Math.hypot(pl.x - it.x, pl.z - it.z) < 1.25 && pl.y > it.y - 1.4 && pl.y < it.y + 1.6) {
        it.got = true; got++;
        A.scene.remove(it.g); if (it.b) A.scene.remove(it.b);
        Sfx.coin();
        A.juice.sparkle(it.x, it.y + 0.8, it.z, 14, 0xfff2a8, { speed: 3 });
        A.setProgress(`${got} / ${total} ${tag}`);
        toast(`${it.d.icon || ''} ${it.d.name || 'Got it'}! ${got < total ? `(${got}/${total})` : ''}`);
        if (onGet) onGet(it, got, total);
        if (got === total && onAll) onAll();
      }
    }
  });
  return { items, get got() { return got; }, total };
}

// An NPC standing somewhere; returns the group. Interact to talk.
export function npcAt(A, npc, x, z, facing = 0, { label, onTalk } = {}) {
  const g = buildNPC(npc);
  g.position.set(x, npc.y || 0, z);
  g.rotation.y = facing;
  A.scene.add(g);
  const t0 = Math.random() * 5;
  A.onUpdate((dt, t) => { if (g.userData.anim) g.userData.anim(t + t0, !!g.userData.moving); });
  if (onTalk) A.interact({ get x() { return g.position.x; }, get z() { return g.position.z; }, y: g.position.y, r: 2.2, label: label || `Talk to ${npc.name || 'them'}`, act: onTalk });
  return g;
}

// Finish arch across a track at z, w wide.
export function finishArch(A, x, z, w = 8, text = 'FINISH') {
  const c = hex(A.P.accent);
  A.B.box(x - w / 2 - 0.3, x - w / 2 + 0.3, 0, 4.5, z - 0.3, z + 0.3, c);
  A.B.box(x + w / 2 - 0.3, x + w / 2 + 0.3, 0, 4.5, z - 0.3, z + 0.3, c);
  A.B.box(x - w / 2 - 0.5, x + w / 2 + 0.5, 4.5, 5.2, z - 0.4, z + 0.4, hex(A.P.trim));
  const s = signMesh(text, { w: Math.min(w, 6), h: 0.7, bg: A.P.trim, fg: '#ffffff', glow: true });
  s.position.set(x, 4.85, z + 0.42); A.scene.add(s);
  const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = z - 0.42; A.scene.add(s2);
}

// A glowing checkpoint pad; calls back the first time the player stands on it.
export function checkpointPad(A, x, y, z, facing, onHit) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 20), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.6 }));
  m.position.set(x, y + 0.05, z); A.scene.add(m);
  let hit = false;
  A.onUpdate((dt, t) => {
    m.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    if (hit) return;
    const p = A.player.pos;
    if (Math.hypot(p.x - x, p.z - z) < 1.3 && Math.abs(p.y - y) < 0.8) {
      hit = true;
      m.material.color.set(0x7dff9a);
      A.checkpoint(x, y, z, facing);
      Sfx.beep(true);
      toast('Checkpoint!');
      if (onHit) onHit();
    }
  });
  return m;
}

// A goal marker (glowing ring + emoji) — returns {pos, mesh}.
export function goalMarker(A, x, y, z, icon = '🏁') {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.1;
  g.add(ring);
  const sp = pickup(icon, '#ffd23f');
  sp.position.y = 0.6;
  g.add(sp);
  g.position.set(x, y, z);
  A.scene.add(g);
  A.onUpdate((dt, t) => { ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08); });
  return g;
}

export function near(A, x, y, z, r = 1.5, dy = 1.5) {
  const p = A.player.pos;
  return Math.hypot(p.x - x, p.z - z) < r && Math.abs(p.y - y) < dy;
}

// Ambient creatures that wander and hop away when you come close
// (params.critters: [{ kind, look, name, count }]) — e.g. wild rabbits.
export function critters(A, defs, { w, d, cx = 0, cz = 0 }) {
  const list = [];
  for (const def of defs || []) {
    for (let i = 0; i < (def.count || 2); i++) {
      const x = cx + (A.rng() - 0.5) * w, z = cz + (A.rng() - 0.5) * d;
      const g = buildNPC(def);
      g.position.set(x, 0, z);
      A.scene.add(g);
      list.push({ g, vx: 0, vz: 0, t: 0, home: [x, z] });
    }
  }
  A.onUpdate((dt, t) => {
    const pl = A.player.pos;
    for (const c of list) {
      const p = c.g.position;
      const dx = p.x - pl.x, dz = p.z - pl.z, dist = Math.hypot(dx, dz);
      c.t -= dt;
      if (dist < 5 && c.t <= 0) { c.vx = dx / dist * 7; c.vz = dz / dist * 7; c.t = 0.7; }
      else if (c.t <= 0 && Math.random() < dt * 0.3) { const a = Math.random() * Math.PI * 2; c.vx = Math.cos(a) * 1.5; c.vz = Math.sin(a) * 1.5; c.t = 1; }
      if (c.t > 0) {
        p.x += c.vx * dt; p.z += c.vz * dt;
        p.x = Math.max(cx - w / 2, Math.min(cx + w / 2, p.x)); p.z = Math.max(cz - d / 2, Math.min(cz + d / 2, p.z));
        c.g.rotation.y = Math.atan2(c.vx, c.vz);
      }
      if (c.g.userData.anim) c.g.userData.anim(t, c.t > 0);
    }
  });
  return list;
}
