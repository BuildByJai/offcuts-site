// Time trials: three marked parkour courses round the square (start flag →
// gates → finish), with medals, a personal-best ghost and a leaderboard on the
// shared Book Town API (/api/book-town/<board>/score|leaderboard).
//
// If a quest system is added later, register a `trial_time` quest type and
// complete it from Trials.onFinish(trialId, ms, medal).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Save } from './save.js';
import { Sfx } from './audio.js';
import { toon, addOutline } from './gfx.js';
import { buildCharacter } from './player.js';
import { canvasTexture } from './world.js';

const MEDALS = ['gold', 'silver', 'bronze'];
const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const STRIDE = 5;
const HZ = 20;

export function fmtTime(ms) {
  const total = Math.max(0, ms) / 1000, m = Math.floor(total / 60), s = (total - m * 60).toFixed(2);
  return `${String(m).padStart(2, '0')}:${s.padStart(5, '0')}`;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function medalFor(trial, ms) {
  for (const m of MEDALS) if (ms <= trial.medals[m]) return m;
  return null;
}

export class Trials {
  constructor({ scene, world, player, cam, toast, onFinish = null, onState = null }) {
    this.scene = scene; this.player = player; this.cam = cam; this.toast = toast;
    this.onFinish = onFinish; this.onState = onState;
    this.list = CONFIG.trials;
    this.active = null;      // { trial, phase: 'count'|'run', t, gate, ms, rec, recAcc }
    this.interactables = [];
    this._buildFlags(world);
    this._buildGates();
    this._buildGhost();
    this._buildDom();
  }

  /* ---------- world pieces ---------- */
  _buildFlags(world) {
    for (const tr of this.list) {
      const s = tr.start;
      const g = new THREE.Group();
      g.position.set(s.x + Math.sin(s.facing + Math.PI / 2) * 1.6, 0, s.z + Math.cos(s.facing + Math.PI / 2) * 1.6);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), toon({ color: 0xdddddd }));
      pole.position.y = 1.7; pole.castShadow = true;
      const tex = canvasTexture(128, 80, (ctx) => {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { ctx.fillStyle = (x + y) % 2 ? '#ffffff' : '#' + tr.color.toString(16).padStart(6, '0'); ctx.fillRect(x * 22, y * 20, 22, 20); }
      });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8, 6, 1), toon({ map: tex, side: THREE.DoubleSide }));
      flag.position.set(0.7, 2.95, 0);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.4), toon({ color: tr.color }));
      plate.position.y = 0.06; plate.receiveShadow = true;
      g.add(pole, flag, plate);
      addOutline(g);
      this.scene.add(g);
      world.add(g.position.x - 0.1, g.position.x + 0.1, 0, 3.4, g.position.z - 0.1, g.position.z + 0.1, false);
      tr._flag = flag;
      // the start pad you stand on
      const pad = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: tr.color, transparent: true, opacity: 0.55, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(s.x, 0.03, s.z);
      this.scene.add(pad);
      this.interactables.push({ x: s.x, z: s.z, y: 0, r: 2.6, icon: '🏁', label: `Time trial: ${tr.name}`, act: () => this.start(tr) });
    }
  }
  _buildGates() {
    const geo = new THREE.TorusGeometry(1, 0.1, 6, 32);
    this.gateMeshes = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }));
      m.visible = false;
      this.scene.add(m);
      this.gateMeshes.push(m);
    }
    const tex = canvasTexture(128, 128, (ctx) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = (x + y) % 2 ? '#fff' : '#222'; ctx.fillRect(x * 16, y * 16, 16, 16); } });
    this.finishDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    this.finishDisc.visible = false;
    this.scene.add(this.finishDisc);
    // beam that points at the next gate from far away
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false;
    this.scene.add(this.beam);
  }
  _buildGhost() {
    const g = buildCharacter({ shirt: 0x9fdcff, pants: 0x6f8fb0 });
    g.root.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true; o.material.opacity = 0.4; o.material.depthWrite = false;
        o.castShadow = false;
      }
    });
    g.blob.visible = false;
    g.root.visible = false;
    this.scene.add(g.root);
    this.ghost = g;
  }

  /* ---------- DOM: run panel, countdown, finish card, leaderboard ---------- */
  _buildDom() {
    const panel = document.createElement('div');
    panel.id = 'trial-hud'; panel.hidden = true;
    panel.innerHTML = `<div class="tr-name"></div><div class="tr-time">00:00.00</div><div class="tr-sub"><span class="tr-gate"></span> · <span class="tr-target"></span></div>`;
    document.body.appendChild(panel);
    this.panel = panel;
    const count = document.createElement('div');
    count.id = 'countdown'; count.hidden = true;
    document.body.appendChild(count);
    this.countEl = count;
    const card = document.createElement('div');
    card.className = 'overlay'; card.id = 'trial-finish'; card.hidden = true;
    card.innerHTML = `<div class="card scrollable">
      <span class="tag-inline">time trial</span>
      <h2 class="tf-title" style="text-align:center"></h2>
      <div class="tf-medal"></div>
      <div class="tf-time"></div>
      <p class="tf-best"></p>
      <p class="tf-pay"></p>
      <div class="tf-medals"></div>
      <input class="tf-name" maxlength="12" placeholder="YOUR INITIALS" autocomplete="off">
      <p class="tf-status"></p>
      <div class="btn-row" style="margin-bottom:10px">
        <button class="btn tf-submit" type="button">Save time</button>
        <button class="btn ghost tf-lb" type="button">Leaderboard</button>
      </div>
      <ul class="lb tf-list" hidden></ul>
      <div class="btn-row" style="margin-bottom:10px">
        <button class="btn tf-again" type="button">Run again</button>
        <button class="btn ghost tf-close" type="button">Back to town</button>
      </div>
    </div>`;
    document.body.appendChild(card);
    this.card = card;
    const q = (s) => card.querySelector(s);
    q('.tf-again').addEventListener('click', () => { card.hidden = true; this.start(this.last.trial); });
    q('.tf-close').addEventListener('click', () => { card.hidden = true; if (this.onState) this.onState('closed'); });
    q('.tf-lb').addEventListener('click', () => this._showBoard());
    q('.tf-submit').addEventListener('click', () => this._submit());
  }

  /* ---------- run flow ---------- */
  start(tr) {
    const p = this.player, s = tr.start;
    this.card.hidden = true;
    p.teleport(s.x, 0, s.z, s.facing);
    this.cam.snapBehind(s.facing);
    this.active = { trial: tr, phase: 'count', t: 3.0, gate: 0, ms: 0, rec: [], recAcc: 0, lastBeep: 4 };
    const pb = Save.trial(tr.id);
    this.ghostData = pb.ghost;
    this.panel.hidden = false;
    this.panel.style.setProperty('--tc', '#' + tr.color.toString(16).padStart(6, '0'));
    this.panel.querySelector('.tr-name').textContent = tr.name;
    this.panel.querySelector('.tr-target').textContent = `${MEDAL_ICON.gold} ${fmtTime(tr.medals.gold)}` + (pb.bestMs ? ` · PB ${fmtTime(pb.bestMs)}` : '');
    this._showGates();
    if (this.onState) this.onState('start', tr);
  }
  quit(silent = false) {
    if (!this.active) return;
    this.active = null;
    this.panel.hidden = true; this.countEl.hidden = true;
    this.gateMeshes.forEach((m) => { m.visible = false; });
    this.finishDisc.visible = false; this.beam.visible = false;
    this.ghost.root.visible = false;
    if (!silent) this.toast('Time trial cancelled.');
    if (this.onState) this.onState('quit');
  }
  restart() { if (this.active) this.start(this.active.trial); }
  get running() { return !!this.active; }
  get frozen() { return !!this.active && this.active.phase === 'count'; }

  _showGates() {
    const A = this.active, tr = A.trial;
    this.gateMeshes.forEach((m, i) => {
      const g = tr.gates[i];
      m.visible = !!g && i >= A.gate;
      if (!g) return;
      m.position.set(...g);
      const nxt = tr.gates[i + 1] || g, prv = i ? tr.gates[i - 1] : [tr.start.x, 1, tr.start.z];
      const dx = (nxt[0] - prv[0]), dz = (nxt[2] - prv[2]);
      m.rotation.set(0, Math.atan2(dx, dz), 0);
      m.scale.setScalar(tr.radius * 0.95);
      const isNext = i === A.gate, isFinish = i === tr.gates.length - 1;
      m.material.color.set(isFinish ? 0xffffff : isNext ? tr.color : 0xffffff);
      m.material.opacity = isNext ? 0.95 : 0.35;
    });
    const f = tr.gates[tr.gates.length - 1];
    this.finishDisc.visible = true;
    this.finishDisc.position.set(...f);
    this.finishDisc.rotation.copy(this.gateMeshes[tr.gates.length - 1].rotation);
    this.finishDisc.scale.setScalar(tr.radius * 0.9);
    const n = tr.gates[A.gate];
    if (n) { this.beam.visible = true; this.beam.position.set(n[0], n[1] + 20, n[2]); this.beam.material.color.set(tr.color); }
    this.panel.querySelector('.tr-gate').textContent = A.gate >= tr.gates.length - 1 ? 'Finish!' : `Gate ${A.gate + 1} / ${tr.gates.length - 1}`;
  }

  update(dt) {
    const A = this.active;
    if (!A) return;
    const p = this.player, tr = A.trial;
    if (A.phase === 'count') {
      A.t -= dt;
      const n = Math.ceil(A.t);
      if (n !== A.lastBeep) {
        A.lastBeep = n;
        this.countEl.hidden = false;
        this.countEl.textContent = n > 0 ? String(n) : 'GO!';
        this.countEl.classList.remove('pop'); void this.countEl.offsetWidth; this.countEl.classList.add('pop');
        Sfx.countdown(n <= 0);
      }
      if (A.t <= 0) { A.phase = 'run'; setTimeout(() => { if (this.countEl.textContent === 'GO!') this.countEl.hidden = true; }, 600); }
      this._ghostPose(0);
      return;
    }
    A.ms += dt * 1000;
    this.panel.querySelector('.tr-time').textContent = fmtTime(A.ms);
    // record ghost
    A.recAcc += dt;
    while (A.recAcc >= 1 / HZ) {
      A.recAcc -= 1 / HZ;
      A.rec.push(Math.round(p.pos.x * 100), Math.round(p.pos.y * 100), Math.round(p.pos.z * 100), Math.round(p.facing * 100), stateCode(p));
    }
    this._ghostPose(A.ms);
    // gates
    const g = tr.gates[A.gate];
    const dx = p.pos.x - g[0], dy = p.pos.y + 0.9 - g[1], dz = p.pos.z - g[2];
    if (dx * dx + dy * dy + dz * dz < tr.radius * tr.radius) {
      A.gate++;
      if (A.gate >= tr.gates.length) return this._finish();
      Sfx.gate();
      this._showGates();
    }
    this.gateMeshes.forEach((m, i) => { if (i === A.gate) m.rotation.z += dt * 2; });
  }

  _ghostPose(ms) {
    const d = this.ghostData, gh = this.ghost;
    if (!d || !d.f || d.f.length < STRIDE) { gh.root.visible = false; return; }
    gh.root.visible = true;
    const n = d.f.length / STRIDE;
    const fi = Math.min(n - 1, (ms / 1000) * d.hz);
    const i = Math.floor(fi), j = Math.min(n - 1, i + 1), t = fi - i, f = d.f, a = i * STRIDE, b = j * STRIDE;
    gh.root.position.set((f[a] + (f[b] - f[a]) * t) / 100, (f[a + 1] + (f[b + 1] - f[a + 1]) * t) / 100, (f[a + 2] + (f[b + 2] - f[a + 2]) * t) / 100);
    gh.root.rotation.y = f[a + 3] / 100;
    const st = f[a + 4], k = (o, p, v) => { o[p] += (v - o[p]) * 0.35; };
    let lL = 0, lR = 0, aL = 0, aR = 0, aZ = 0;
    if (st === 1) { const s = Math.sin(ms / 1000 * 11) * 0.95; lL = s; lR = -s; aL = -s; aR = s; }
    else if (st === 2) { aL = -2.4; aR = -0.5; lL = -0.9; lR = 0.35; }
    else if (st === 3) { aL = aR = -0.35; aZ = 0.9; lL = 0.25; lR = -0.25; }
    else if (st === 4) { aL = aR = -3; }
    k(gh.legL.rotation, 'x', lL); k(gh.legR.rotation, 'x', lR); k(gh.armL.rotation, 'x', aL); k(gh.armR.rotation, 'x', aR);
    k(gh.armL.rotation, 'z', -aZ); k(gh.armR.rotation, 'z', aZ);
  }

  _finish() {
    const A = this.active, tr = A.trial, ms = Math.round(A.ms);
    A.rec.push(Math.round(this.player.pos.x * 100), Math.round(this.player.pos.y * 100), Math.round(this.player.pos.z * 100), Math.round(this.player.facing * 100), 0);
    const medal = medalFor(tr, ms);
    const prev = Save.trial(tr.id).bestMs;
    const { isBest, newMedals } = Save.recordTrial(tr.id, ms, { hz: HZ, f: A.rec }, medal);
    const E = CONFIG.economy;
    let pay = E.trialFinish;
    for (const m of newMedals) pay += E.medal[m];
    this.last = { trial: tr, ms, medal };
    this.quit(true);
    const q = (s) => this.card.querySelector(s);
    q('.tf-title').textContent = tr.name;
    q('.tf-medal').textContent = medal ? MEDAL_ICON[medal] : '🏁';
    q('.tf-time').textContent = fmtTime(ms);
    q('.tf-best').textContent = isBest ? (prev ? `New personal best! (was ${fmtTime(prev)})` : 'First run — your ghost will race you next time.') : `Personal best: ${fmtTime(Save.trial(tr.id).bestMs)}`;
    q('.tf-pay').textContent = `+${pay} coins` + (newMedals.length ? ` (incl. ${newMedals.map((m) => MEDAL_ICON[m]).join(' ')} bonus)` : '');
    q('.tf-medals').innerHTML = MEDALS.slice().reverse().map((m) => `<span class="${Save.trial(tr.id).medals[m] ? 'got' : ''}">${MEDAL_ICON[m]} ${fmtTime(tr.medals[m])}</span>`).join('');
    q('.tf-status').textContent = '';
    q('.tf-list').hidden = true;
    let saved = ''; try { saved = localStorage.getItem('bookTown.player.name') || ''; } catch (e) { /* ignore */ }
    q('.tf-name').value = saved;
    Sfx.badge();
    if (this.onFinish) this.onFinish(tr, ms, medal, pay);
    setTimeout(() => { this.card.hidden = false; }, 700);
  }

  async _fetchBoard(board) {
    const r = await fetch(`/api/book-town/${board}/leaderboard`);
    if (!r.ok) throw new Error('lb');
    return r.json();
  }
  async _showBoard() {
    const ul = this.card.querySelector('.tf-list');
    ul.hidden = false;
    ul.innerHTML = '<li style="border:none;color:var(--ink-soft)">Loading…</li>';
    const name = this.card.querySelector('.tf-name').value.trim().toUpperCase();
    try {
      const list = await this._fetchBoard(this.last.trial.board);
      ul.innerHTML = list.length ? '' : '<li style="border:none;color:var(--ink-soft)">No times yet — be the first.</li>';
      list.forEach((e) => {
        const li = document.createElement('li');
        if (name && e.name === name) li.classList.add('you');
        li.innerHTML = `<span class="rank">#${e.rank}</span><span class="lname">${esc(e.name)}</span><span class="ltime">${fmtTime(e.timeMs)}</span>`;
        ul.appendChild(li);
      });
    } catch (e) {
      const pb = Save.trial(this.last.trial.id).bestMs;
      ul.innerHTML = `<li style="border:none;color:var(--ink-soft)">Leaderboard is unavailable right now${pb ? ` — your best is ${fmtTime(pb)}, saved on this device` : ''}.</li>`;
    }
  }
  async _submit() {
    const q = (s) => this.card.querySelector(s);
    const name = q('.tf-name').value.trim().toUpperCase().slice(0, 12);
    const status = q('.tf-status');
    if (!name) { status.textContent = 'Enter your initials first.'; return; }
    try { localStorage.setItem('bookTown.player.name', name); } catch (e) { /* ignore */ }
    const btn = q('.tf-submit');
    btn.disabled = true; status.textContent = 'Saving…';
    try {
      const r = await fetch(`/api/book-town/${this.last.trial.board}/score`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, timeMs: this.last.ms }) });
      if (!r.ok) throw new Error('submit');
      status.textContent = 'Saved to the leaderboard.';
      this._showBoard();
    } catch (e) {
      status.textContent = "Couldn't reach the leaderboard — your PB is still saved on this device.";
    } finally { btn.disabled = false; }
  }
}

function stateCode(pl) {
  if (pl.ride && pl.ride.kind === 'zip') return 4;
  if (!pl.grounded) return pl.vel.y > 0 ? 2 : 3;
  return pl.speedH > 0.4 ? 1 : 0;
}
