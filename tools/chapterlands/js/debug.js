// Debug panel: FPS / frame time / draw calls / triangles / memory, quality
// tier, shadow and post-processing overrides, optional scene toggles and a
// time-of-day slider, plus the player's position and state. Opens with
// ?debug=1 or from the pause menu. Overrides are for this visit only.
//
// Usage: const dbg = new DebugPanel({ gfx, player, day, toggles: [{ label, get, set }] });
//        each frame: dbg.beginFrame() before rendering, dbg.update(dt) after.
import { TIERS } from './gfx.js';

export class DebugPanel {
  constructor({ gfx, player = null, day = null, toggles = [] }) {
    this.gfx = gfx; this.player = player; this.day = day; this.toggles = toggles;
    this.frames = 0; this.acc = 0; this.fps = 0; this.worst = 0; this.worstAcc = 0;
    let el = document.getElementById('debug-panel');
    if (!el) { el = document.createElement('div'); el.id = 'debug-panel'; document.body.appendChild(el); }
    el.hidden = true;
    this.el = el;
    el.innerHTML = `
      <button class="dbg-close" type="button" aria-label="Close debug panel">×</button>
      <h4>Performance</h4>
      <div class="dbg-grid">
        <span>FPS</span><b data-k="fps">—</b>
        <span>Slowest frame</span><b data-k="worst">—</b>
        <span>Draw calls</span><b data-k="calls">—</b>
        <span>Triangles</span><b data-k="tris">—</b>
        <span>Geometries</span><b data-k="geo">—</b>
        <span>Textures</span><b data-k="tex">—</b>
        <span>JS heap</span><b data-k="mem">—</b>
        <span>Pixel ratio</span><b data-k="pr">—</b>
      </div>
      <h4>Graphics</h4>
      <div class="dbg-row"><span>Quality</span><select data-k="tier">${TIERS.map((t) => `<option value="${t}">${t}</option>`).join('')}</select></div>
      <label class="dbg-check"><input type="checkbox" data-k="shadows"> Shadows</label>
      <label class="dbg-check"><input type="checkbox" data-k="post"> Post-processing (bloom, grade, AA)</label>
      ${this.toggles.map((t, i) => `<label class="dbg-check"><input type="checkbox" data-t="${i}"> ${t.label}</label>`).join('')}
      ${day ? `<div class="dbg-row"><span>Time <b data-k="hour">—</b></span><input type="range" min="0" max="24" step="0.1" data-k="time"></div>
      <label class="dbg-check"><input type="checkbox" data-k="lock"> Freeze time</label>` : ''}
      ${player ? `<h4>Player</h4><div class="dbg-grid"><span>Position</span><b data-k="pos">—</b><span>State</span><b data-k="state">—</b><span>Speed</span><b data-k="speed">—</b></div>` : ''}`;
    const q = (k) => el.querySelector(`[data-k="${k}"]`);
    this.q = q;
    el.querySelector('.dbg-close').addEventListener('click', () => this.show(false));
    q('tier').addEventListener('change', (e) => { gfx.setTier(e.target.value); this.sync(); });
    q('shadows').addEventListener('change', (e) => { gfx.overrides.shadows = e.target.checked; gfx.refresh(); });
    q('post').addEventListener('change', (e) => { gfx.overrides.post = e.target.checked; gfx.refresh(); });
    this.toggles.forEach((t, i) => el.querySelector(`[data-t="${i}"]`).addEventListener('change', (e) => t.set(e.target.checked)));
    if (day) {
      q('time').addEventListener('input', (e) => { day.setLock(+e.target.value); q('lock').checked = true; });
      q('lock').addEventListener('change', (e) => day.setLock(e.target.checked ? day.hour : null));
    }
    gfx.onTier(() => this.sync());
    if (new URLSearchParams(location.search).get('debug') === '1') this.show(true);
  }
  get open() { return !this.el.hidden; }
  show(on) {
    this.el.hidden = !on;
    // with several render passes per frame we count the whole frame ourselves
    this.gfx.renderer.info.autoReset = !on;
    if (on) this.sync();
  }
  sync() {
    const g = this.gfx, q = this.q;
    q('tier').value = g.tier;
    q('shadows').checked = g.overrides.shadows !== null ? g.overrides.shadows : g.tierCfg.shadows > 0;
    q('post').checked = g.postOn;
    this.toggles.forEach((t, i) => { this.el.querySelector(`[data-t="${i}"]`).checked = t.get(); });
    if (this.day) q('lock').checked = this.day.locked != null && !isNaN(this.day.locked);
  }
  beginFrame() { if (this.open) this.gfx.renderer.info.reset(); }
  update(dt) {
    this.frames++; this.acc += dt; this.worstAcc = Math.max(this.worstAcc, dt);
    if (this.acc < 0.5) return;
    this.fps = this.frames / this.acc; this.worst = this.worstAcc;
    this.frames = 0; this.acc = 0; this.worstAcc = 0;
    if (!this.open) return;
    const q = this.q, info = this.gfx.renderer.info, r = info.render;
    q('fps').textContent = this.fps.toFixed(0);
    q('worst').textContent = (this.worst * 1000).toFixed(0) + ' ms';
    q('calls').textContent = r.calls;
    q('tris').textContent = r.triangles > 9999 ? (r.triangles / 1000).toFixed(0) + 'k' : r.triangles;
    q('geo').textContent = info.memory.geometries;
    q('tex').textContent = info.memory.textures;
    q('mem').textContent = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/a';
    q('pr').textContent = this.gfx.renderer.getPixelRatio().toFixed(2);
    if (this.day) {
      const h = this.day.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
      q('hour').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      if (document.activeElement !== q('time')) q('time').value = h;
    }
    if (this.player) {
      const p = this.player;
      q('pos').textContent = `${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)}`;
      q('state').textContent = p.state;
      q('speed').textContent = p.speedH.toFixed(1) + ' m/s';
    }
  }
}
