// Debug panel (?debug=1 or the menu button): quality tier, time-of-day
// preset, each post effect, FPS / draw calls / memory, physics debug view.
import { PROOF } from '../config.js';
import { TIERS } from './gfx.js';

export class DebugPanel {
  constructor({ gfx, app }) {
    this.gfx = gfx; this.app = app;
    const el = document.getElementById('debug-panel');
    this.el = el;
    el.innerHTML = `<button class="close" type="button" aria-label="Close">×</button>
      <h4>Render</h4>
      <div class="row"><span>Backend</span><b id="dbg-backend">—</b></div>
      <div class="row"><span>Quality</span><select id="dbg-tier">${TIERS.map((t) => `<option value="${t}">${t}</option>`).join('')}</select></div>
      <div class="row"><span>Time of day</span><select id="dbg-preset">${Object.keys(PROOF.presets).map((k) => `<option value="${k}">${PROOF.presets[k].label}</option>`).join('')}</select></div>
      <div class="row"><span>Exposure</span><input id="dbg-exp" type="range" min="0.4" max="2" step="0.05"></div>
      <h4>Post effects</h4>
      ${['ao', 'bloom', 'dof', 'aa', 'grade', 'shadows', 'fog'].map((k) => `<label><input type="checkbox" data-toggle="${k}" checked> ${k.toUpperCase()}</label>`).join('')}
      <h4>Stats</h4>
      <div class="stat"><span>FPS</span><b id="dbg-fps">—</b><span>Draw calls</span><b id="dbg-calls">—</b><span>Triangles</span><b id="dbg-tris">—</b><span>Geometries</span><b id="dbg-geo">—</b><span>Textures</span><b id="dbg-tex">—</b><span>JS heap</span><b id="dbg-mem">—</b><span>Grass blades</span><b id="dbg-grass">—</b></div>
      <h4>Physics</h4>
      <label><input type="checkbox" id="dbg-phys"> Physics debug view</label>
      <div class="row"><span>Player</span><b id="dbg-pos">—</b></div>`;
    const $ = (s) => el.querySelector(s);
    $('.close').addEventListener('click', () => this.show(false));
    $('#dbg-tier').addEventListener('change', (e) => gfx.setTier(e.target.value));
    $('#dbg-preset').addEventListener('change', (e) => app.setPreset(e.target.value));
    $('#dbg-exp').addEventListener('input', (e) => { gfx.renderer.toneMappingExposure = +e.target.value; });
    el.querySelectorAll('[data-toggle]').forEach((c) => c.addEventListener('change', () => { gfx.toggles[c.dataset.toggle] = c.checked; if (c.dataset.toggle === 'fog') gfx.scene.fog.far = c.checked ? gfx.preset.fogFar : 5000; gfx._applyShadows(); gfx.buildPost(); }));
    $('#dbg-phys').addEventListener('change', (e) => { app.physicsDebug = e.target.checked; });
    this.$ = $;
    this.acc = 0;
  }
  show(on) { this.el.hidden = !on; if (on) this.sync(); }
  sync() {
    this.$('#dbg-backend').textContent = this.gfx.backend;
    this.$('#dbg-tier').value = this.gfx.tier;
    this.$('#dbg-preset').value = this.gfx.presetKey;
    this.$('#dbg-exp').value = this.gfx.renderer.toneMappingExposure;
  }
  update(dt) {
    if (this.el.hidden) return;
    this.acc += dt; if (this.acc < 0.25) return; this.acc = 0;
    const i = this.gfx.info;
    this.$('#dbg-fps').textContent = i.fps.toFixed(0);
    this.$('#dbg-calls').textContent = i.calls;
    this.$('#dbg-tris').textContent = (i.tris / 1000).toFixed(0) + 'k';
    this.$('#dbg-geo').textContent = i.geometries;
    this.$('#dbg-tex').textContent = i.textures;
    this.$('#dbg-mem').textContent = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/a';
    this.$('#dbg-grass').textContent = this.app.grass ? this.app.grass.mesh.count : '—';
    const p = this.app.ctrl.render;
    this.$('#dbg-pos').textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}`;
  }
}
