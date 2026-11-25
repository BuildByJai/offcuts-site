// District Kit scenery: the "set" round every 3D street, so no game is played
// on a bare plain. Called from A.ground() in street/street.js.
//
//   skyDome     gradient sky + clouds (+ stars when dark) in the book's colours
//   buildSet    outdoors: a visible edge where the invisible walls are (hedge,
//               fence, rocks or reeds), two rings of trees/rocks/props beyond it
//               and low hills on the horizon. Indoors (floor: 'floor'): papered
//               walls, skirting, windows, pictures and a rug, low enough for
//               the camera to see over.
// Everything is seeded per street, so it looks the same on every visit.
import * as THREE from 'three';
import { Sky } from '../js/gfx.js';
import { canvasTexture } from '../js/world.js';
import { prop, rng, seedOf, hex } from './props.js';

const ICO = new THREE.IcosahedronGeometry(1, 1);
const tint = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();

let _gt = null;
function groundTex(P) {
  if (_gt) return _gt;
  _gt = canvasTexture(128, 128, (x) => {
    x.fillStyle = P.ground; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { x.fillStyle = Math.random() < 0.5 ? P.ground2 || P.ground : 'rgba(255,255,255,0.06)'; x.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
  });
  _gt.wrapS = _gt.wrapT = THREE.RepeatWrapping; _gt.repeat.set(20, 20);
  return _gt;
}

export function skyDome(scene, P, { dark = false } = {}) {
  const sky = new Sky(scene);
  const u = sky.uniforms;
  if (dark) {
    u.topColor.value.set(0x0a1430); u.horizonColor.value.set(0x24305a); u.groundColor.value.set(0x141826);
    u.sunColor.value.set(0x000000);
    sky.starMat.opacity = 0.9;
    sky.cloudMat.color.set(0x3a4468);
  } else {
    const top = new THREE.Color(P.sky).multiplyScalar(0.82);
    u.topColor.value.copy(top); u.horizonColor.value.set(P.fog); u.groundColor.value.set(P.ground2 || P.ground);
    u.sunColor.value.set(0xfff1d6);
    sky.starMat.opacity = 0;
  }
  u.sunDir.value.set(0.45, 0.7, 0.35).normalize();
  return sky;
}

const OUTDOOR_PROPS = new Set(['tree', 'pine', 'bush', 'rock', 'flower', 'mushroom', 'tent', 'cart', 'reeds', 'statue', 'column', 'lamp', 'barrel', 'crate', 'fence']);

export function buildSet(A, { w, d, cx = 0, cz = 0, floor = 'grass', dark = false, edge: edgeOpt = true }) {
  const { B, P, theme, scene } = A;
  const r = rng(seedOf(((A.book && A.book.id) || 'demo') + ':' + ((A.def && A.def.id) || 'x') + ':set'));
  if (floor === 'floor') return indoor(A, { w, d, cx, cz, r });
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;

  // a track with its own floor (CHASE): lay countryside either side of it
  if (floor === 'track') {
    const g = new THREE.MeshLambertMaterial({ map: groundTex(P), color: 0xffffff });
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(120, d + 160), g);
      m.rotation.x = -Math.PI / 2; m.position.set(cx + sx * (w / 2 + 0.4 + 60), -0.02, cz); m.receiveShadow = true; scene.add(m);
    }
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 2, 80), g);
      m.rotation.x = -Math.PI / 2; m.position.set(cx, -0.02, cz + sz * (d / 2 + 40)); m.receiveShadow = true; scene.add(m);
    }
  }
  /* ---- the edge, right on the invisible walls ---- */
  const edge = edgeOpt === false ? 'none' : (theme && theme.edge) || (floor === 'water' ? 'reeds' : floor === 'sand' || floor === 'snow' ? 'rock' : floor === 'stone' ? 'fence' : 'hedge');
  const along = (fn) => {
    for (let x = x0; x <= x1; x += 2.2) { fn(x, z0 - 0.6, 'x'); fn(x, z1 + 0.6, 'x'); }
    for (let z = z0; z <= z1; z += 2.2) { fn(x0 - 0.6, z, 'z'); fn(x1 + 0.6, z, 'z'); }
  };
  if (edge === 'hedge') {
    const c = tint(P.leaf, 0.82), c2 = tint(P.leaf, 0.95);
    B.box(x0 - 1.1, x1 + 1.1, 0, 1.3, z0 - 1.1, z0 - 0.1, c); B.box(x0 - 1.1, x1 + 1.1, 0, 1.3, z1 + 0.1, z1 + 1.1, c);
    B.box(x0 - 1.1, x0 - 0.1, 0, 1.3, z0 - 0.1, z1 + 0.1, c); B.box(x1 + 0.1, x1 + 1.1, 0, 1.3, z0 - 0.1, z1 + 0.1, c);
    along((x, z) => B.geom(ICO, r() < 0.5 ? c2 : c, { x, y: 1.3, z, sx: 0.9, sy: 0.4 + r() * 0.2, sz: 0.7, ry: r() * 3 }));
  } else if (edge === 'fence' || edge === 'rail') {
    const wood = edge === 'rail' ? 0x5a6068 : 0xf4efe4;
    along((x, z, ax) => {
      B.box(x - 0.07, x + 0.07, 0, 1.1, z - 0.07, z + 0.07, wood);
      if (ax === 'x') { B.box(x, x + 2.2, 0.75, 0.85, z - 0.04, z + 0.04, wood, { cast: false }); B.box(x, x + 2.2, 0.35, 0.45, z - 0.04, z + 0.04, wood, { cast: false }); }
      else { B.box(x - 0.04, x + 0.04, 0.75, 0.85, z, z + 2.2, wood, { cast: false }); B.box(x - 0.04, x + 0.04, 0.35, 0.45, z, z + 2.2, wood, { cast: false }); }
    });
  } else if (edge === 'reeds') {
    along((x, z) => { if (r() < 0.75) prop('reeds', B, null, x, z, 0.9 + r() * 0.4, P, r); else prop('rock', B, null, x, z, 0.6, P, r); });
  } else if (edge !== 'none') {
    along((x, z) => prop(OUTDOOR_PROPS.has(edge) ? edge : 'rock', B, null, x, z, 0.7 + r() * 0.5, P, r));
  }

  /* ---- two rings of scenery beyond the edge (no colliders: you can't reach them) ---- */
  const themed = ((theme && theme.props) || []).filter((n) => OUTDOOR_PROPS.has(n));
  const pool = themed.length ? themed.concat(['tree', 'tree', 'bush', 'rock']) : ['tree', 'tree', 'pine', 'bush', 'rock', 'flower'];
  const per = Math.round((w + d) * 2 / 4.5);
  for (const [inner, outer, scale] of [[4, 12, 1], [12, 26, 1.35]]) {
    for (let i = 0; i < per; i++) {
      const side = i % 4, t = r();
      const lo = side === 1 ? Math.max(inner, 14) : inner, dist = lo + r() * (Math.max(outer, lo + 6) - lo);
      let x, z;
      if (side === 0) { x = x0 - outer + t * (w + outer * 2); z = z0 - dist; }
      else if (side === 1) { x = x0 - outer + t * (w + outer * 2); z = z1 + dist; }
      else if (side === 2) { x = x0 - dist; z = z0 + t * d; }
      else { x = x1 + dist; z = z0 + t * d; }
      prop(pool[Math.floor(r() * pool.length)], B, null, x, z, scale * (0.8 + r() * 0.6), P, r);
    }
  }
  // grass tufts / flowers scattered on the play area itself (no colliders)
  if (floor === 'grass') {
    for (let i = 0; i < Math.round(w * d / 30); i++) {
      const x = x0 + r() * w, z = z0 + r() * d;
      if (r() < 0.35) prop('flower', B, null, x, z, 0.8, P, r);
      else B.geom(ICO, tint(P.ground, 0.85), { x, y: 0.05, z, sx: 0.35, sy: 0.12, sz: 0.35, cast: false, ry: r() * 3 });
    }
  }

  /* ---- hills on the horizon ---- */
  const R0 = Math.max(w, d) / 2 + 40;
  const hillMat = new THREE.MeshLambertMaterial({ vertexColors: false, color: dark ? 0x2a3550 : tint(P.ground2 || P.ground, 0.92), flatShading: true });
  const hillMat2 = new THREE.MeshLambertMaterial({ color: dark ? 0x222b44 : tint(P.leaf, 0.85), flatShading: true });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.2, rad = R0 + r() * 40;
    const h = new THREE.Mesh(ICO, i % 3 ? hillMat : hillMat2);
    const s = 18 + r() * 22;
    h.scale.set(s, 6 + r() * 12, s * (0.7 + r() * 0.5));
    h.position.set(cx + Math.cos(a) * rad, -2, cz + Math.sin(a) * rad);
    h.rotation.y = r() * 3;
    scene.add(h);
  }
}

/* ---- indoors: a room the camera can see into ---- */
function indoor(A, { w, d, cx, cz, r }) {
  const { B, P, scene } = A;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const H = 2.6, wall = hex(P.wall), trim = hex(P.trim);
  const paper = canvasTexture(128, 256, (x) => {
    x.fillStyle = P.wall; x.fillRect(0, 0, 128, 256);
    x.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 128; i += 32) x.fillRect(i, 0, 14, 256);
    x.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 16; i < 256; i += 48) for (let j = 16; j < 128; j += 32) { x.beginPath(); x.arc(j + ((i / 48) % 2) * 16, i, 4, 0, Math.PI * 2); x.fill(); }
  });
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshLambertMaterial({ map: paper });
  // walls fade out when they're between the camera and the player
  const walls = [];
  const wallMesh = (len, x, z, ry, out) => {
    const t = paper.clone(); t.needsUpdate = true; t.repeat.set(len / 2.5, 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, H, 0.25), new THREE.MeshLambertMaterial({ map: t, transparent: true }));
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m);
    walls.push({ m, out });
  };
  wallMesh(w + 0.5, cx, z0 - 0.13, 0, (c) => c.z < z0); wallMesh(w + 0.5, cx, z1 + 0.13, 0, (c) => c.z > z1);
  wallMesh(d, x0 - 0.13, cz, Math.PI / 2, (c) => c.x < x0); wallMesh(d, x1 + 0.13, cz, Math.PI / 2, (c) => c.x > x1);
  const fadeWalls = (dt) => {
    for (const W of walls) {
      const want = W.out(A.camera.position) ? 0.18 : 1;
      const o = W.m.material.opacity + (want - W.m.material.opacity) * Math.min(1, dt * 8);
      W.m.material.opacity = o; W.m.material.depthWrite = o > 0.9;
    }
  };
  fadeWalls(1);
  A.onUpdate((dt) => fadeWalls(dt));
  if (A.onIdle) A.onIdle((dt) => fadeWalls(dt));
  // skirting + top rail
  for (const [a, b, c, e] of [[x0 - 0.3, x1 + 0.3, z0 - 0.3, z0 + 0.04], [x0 - 0.3, x1 + 0.3, z1 - 0.04, z1 + 0.3], [x0 - 0.3, x0 + 0.04, z0, z1], [x1 - 0.04, x1 + 0.3, z0, z1]]) {
    B.box(a, b, 0, 0.22, c, e, trim, { cast: false });
  }
  // windows of light on the back wall, pictures on the side walls
  for (let x = x0 + 4; x < x1 - 3; x += 8) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3), new THREE.MeshBasicMaterial({ color: 0xd8efff }));
    win.position.set(x, 1.55, z0 + 0.02); scene.add(win);
    B.box(x - 1.0, x + 1.0, 0.85, 0.95, z0, z0 + 0.12, trim, { cast: false });
    B.box(x - 0.04, x + 0.04, 0.9, 2.2, z0, z0 + 0.05, trim, { cast: false });
  }
  const cols = [P.accent, P.accent2, P.roof, P.leaf];
  for (let z = z0 + 3; z < z1 - 2; z += 6) for (const [x, dx] of [[x0, 1], [x1, -1]]) {
    B.box(x + dx * 0.02 - 0.03, x + dx * 0.02 + 0.03, 1.3, 2.1, z - 0.5, z + 0.5, trim, { cast: false });
    B.box(x + dx * 0.06 - 0.02, x + dx * 0.06 + 0.02, 1.4, 2.0, z - 0.4, z + 0.4, hex(cols[Math.floor(r() * cols.length)]), { cast: false });
  }
  // a big rug
  const rug = new THREE.Color(P.accent2).lerp(new THREE.Color(0x7a4a3a), 0.35);
  B.box(cx - w * 0.3, cx + w * 0.3, 0, 0.02, cz - d * 0.25, cz + d * 0.25, rug.getHex(), { cast: false });
  B.box(cx - w * 0.27, cx + w * 0.27, 0.02, 0.025, cz - d * 0.22, cz + d * 0.22, rug.clone().multiplyScalar(1.12).getHex(), { cast: false });
  // a garden all round outside, seen over the walls
  for (let i = 0; i < Math.round((w + d) / 2); i++) {
    const side = i % 4, t = r(), dist = 3 + r() * 10;
    const x = side < 2 ? x0 - 6 + t * (w + 12) : (side === 2 ? x0 - dist : x1 + dist);
    const z = side < 2 ? (side === 0 ? z0 - dist : z1 + dist) : z0 + t * d;
    prop(r() < 0.6 ? 'tree' : 'bush', B, null, x, z, 0.9 + r() * 0.5, P, r);
  }
}
