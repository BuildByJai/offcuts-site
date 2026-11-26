// Matcha Orange: the guest-artist drink (designed by a young guest artist;
// credit comes only from CONFIG.guestArt.matcha.credit). Shared by the town
// (drinking it, hidden pickups) and the Chapter Café page (buying it, the
// free daily drink, the framed drawing).
//
// The drink: "Focus Fizz" for 45 s: stamina doesn't drain (super jump, dash
// and glide are free) and sprint is 15% faster. Drinking again resets the
// timer; it never stacks. It's a magic fizzy drink, nothing more.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Save } from './save.js';

const DRINK = () => CONFIG.cafe.drink;

/* ---------------- the 3D cup (procedural, about 900 triangles) ---------------- */
let _bandTex = null, _cupTex = null;
function bandTexture() {
  if (_bandTex) return _bandTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#4FB8A2'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * 512, Math.random() * 128, 30, 3);
  x.fillStyle = '#fffbea'; x.font = 'bold 64px "Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.save(); x.translate(256, 66); x.rotate(-0.06); x.fillText('Matcha', 0, 0); x.restore();
  _bandTex = new THREE.CanvasTexture(c); _bandTex.colorSpace = THREE.SRGBColorSpace;
  return _bandTex;
}
function cupTexture() {
  if (_cupTex) return _cupTex;
  // marker-style hand shading: vertical strokes in two greens
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#2F6B35'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(80,150,70,0.35)' : 'rgba(20,60,25,0.35)';
    x.lineWidth = 3 + Math.random() * 6;
    const px = Math.random() * 256;
    x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (Math.random() - 0.5) * 20, 256); x.stroke();
  }
  _cupTex = new THREE.CanvasTexture(c); _cupTex.colorSpace = THREE.SRGBColorSpace; _cupTex.wrapS = THREE.RepeatWrapping;
  return _cupTex;
}
export function matchaCup(scale = 1) {
  const g = new THREE.Group();
  const H = 1.0, rTop = 0.36, rBot = 0.3;
  // body: slightly tapered, with a rounded bottom
  const body = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, H, 20, 1, true), new THREE.MeshToonMaterial({ map: cupTexture(), side: THREE.DoubleSide }));
  body.position.y = H / 2 + 0.12;
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(rBot, 20, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshToonMaterial({ map: cupTexture() }));
  bottom.position.y = 0.12 + 0.001; bottom.scale.y = 0.4;
  const lid = new THREE.Mesh(new THREE.CircleGeometry(rTop * 0.97, 20), new THREE.MeshToonMaterial({ color: 0x3f8a48 }));
  lid.rotation.x = -Math.PI / 2; lid.position.y = H + 0.1;
  // teal band, wrapped diagonally (bottom-left to top-right), with "Matcha" on it
  const band = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.99 + 0.012, rBot * 1.02 + 0.012, 0.3, 24, 1, true, -Math.PI * 0.55, Math.PI * 1.1), new THREE.MeshToonMaterial({ map: bandTexture(), side: THREE.DoubleSide }));
  band.position.y = 0.55; band.rotation.z = -0.32;
  // straw: teal, straight up from the top-left, darker green tip
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.85, 8), new THREE.MeshToonMaterial({ color: 0x4FB8A2 }));
  straw.position.set(-0.12, H + 0.45, 0.02); straw.rotation.z = 0.12;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.12, 8), new THREE.MeshToonMaterial({ color: 0x1f4a26 }));
  tip.position.set(-0.17, H + 0.87, 0.02); tip.rotation.z = 0.12;
  // orange half-slice on the top-right rim, with pale segment lines
  const wc = document.createElement('canvas'); wc.width = wc.height = 128;
  const wx = wc.getContext('2d');
  wx.fillStyle = '#F2B01E'; wx.beginPath(); wx.arc(64, 64, 62, 0, Math.PI * 2); wx.fill();
  wx.fillStyle = '#ffd56a'; wx.beginPath(); wx.arc(64, 64, 50, 0, Math.PI * 2); wx.fill();
  wx.strokeStyle = '#fff4c8'; wx.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; wx.beginPath(); wx.moveTo(64, 64); wx.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); wx.stroke(); }
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace;
  const wedge = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16, 0, Math.PI), new THREE.MeshToonMaterial({ map: wt, side: THREE.DoubleSide }));
  wedge.position.set(0.3, H + 0.1, 0); wedge.rotation.y = Math.PI / 2;
  g.add(body, bottom, lid, band, straw, tip, wedge);
  // salmon-orange outline shell, like the marker outline in the drawing
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(rTop + 0.035, rBot + 0.035, H + 0.04, 20), new THREE.MeshBasicMaterial({ color: 0xE9A27F, side: THREE.BackSide }));
  shell.position.copy(body.position);
  g.add(shell);
  g.scale.setScalar(scale);
  return g;
}

/* ---------------- save + rules ---------------- */
function today(d = new Date()) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

export const Matcha = {
  get info() { return DRINK(); },
  freeReady() { return Save.cafe().lastFreeDate !== today(); },
  // Puts a drink "to go" in the player's hand; it fizzes up back in town.
  claimFree() {
    if (!this.freeReady() || this.hasReady()) return false;
    Save.updateCafe((c) => { c.lastFreeDate = today(); c.ready = (c.ready || 0) + 1; });
    return true;
  },
  buy() {
    if (this.hasReady()) return false;            // one drink to go at a time
    if (!Save.spend(DRINK().price)) return false;
    Save.updateCafe((c) => { c.ready = (c.ready || 0) + 1; });
    return true;
  },
  hasReady() { return (Save.cafe().ready || 0) > 0; },
  // Drink one now. `award(id)` is the page's badge function (it toasts).
  drink(player, award = (id) => Save.awardBadge(id)) {
    if (player) player.addBoost('matcha', DRINK().secs, { reset: true });
    Save.updateCafe((c) => {
      c.daysDrunk = c.daysDrunk || [];
      if (!c.daysDrunk.includes(today())) c.daysDrunk.push(today());
    });
    award('first-sip');
    if ((Save.cafe().daysDrunk || []).length >= 5) award('regular');
  },
  // takes one drink to go (there is never more than one waiting)
  takeReady() {
    let n = 0;
    Save.updateCafe((c) => { n = Math.min(1, c.ready || 0); c.ready = Math.max(0, (c.ready || 0) - n); });
    return n;
  },
  pickupTaken(id) { return !!(Save.cafe().pickups || {})[id]; },
  takePickup(id) { Save.updateCafe((c) => { c.pickups = c.pickups || {}; c.pickups[id] = 1; }); }
};
