// Unified input: keyboard + mouse on desktop, floating joystick / camera drag /
// buttons on touch. Game code reads a small state object each frame.
import { CONFIG } from '../config.js';

const MOVE_KEYS = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
  KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r'
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = false;            // false while menus are open
    this.keys = { f: false, b: false, l: false, r: false };
    this.shift = false;
    this.jumpKey = false;
    this.jumpBtn = false;
    this._jumpPressed = false;
    this._interact = false;
    this._pause = false;
    this.lookDX = 0; this.lookDY = 0; this.zoom = 0;
    this.stick = { x: 0, y: 0, active: false };
    this.touchMode = false;
    this.onTouchModeChange = null;

    this._bindKeyboard();
    this._bindPointer();
    this._buildTouchUI();
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) this.setTouchMode(true);
    addEventListener('touchstart', () => this.setTouchMode(true), { passive: true, once: true });
    const prompt = document.getElementById('interact-prompt');
    if (prompt) prompt.addEventListener('click', () => { this._interact = true; });
  }

  /* ---------- state readers ---------- */
  // Returns {x, y, mag}: x = right, y = forward, mag 0..1.
  getMove() {
    let x = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0);
    let y = (this.keys.f ? 1 : 0) - (this.keys.b ? 1 : 0);
    if (this.stick.active) { x += this.stick.x; y += -this.stick.y; }
    let mag = Math.hypot(x, y);
    if (mag > 1) { x /= mag; y /= mag; mag = 1; }
    if (!this.enabled) return { x: 0, y: 0, mag: 0 };
    return { x, y, mag };
  }
  get sprint() {
    if (!this.enabled) return false;
    if (this.shift) return true;
    return this.stick.active && Math.hypot(this.stick.x, this.stick.y) >= CONFIG.movement.joystickSprintAt;
  }
  get jumpHeld() { return this.enabled && (this.jumpKey || this.jumpBtn); }
  consumeJump() { const j = this._jumpPressed; this._jumpPressed = false; return j && this.enabled; }
  consumeInteract() { const i = this._interact; this._interact = false; return i && this.enabled; }
  consumePause() { const p = this._pause; this._pause = false; return p; }
  consumeLook() { const r = { dx: this.lookDX, dy: this.lookDY }; this.lookDX = 0; this.lookDY = 0; return r; }
  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }

  clear() {
    this.keys = { f: false, b: false, l: false, r: false };
    this.shift = this.jumpKey = this.jumpBtn = false;
    this._jumpPressed = this._interact = false;
    this.lookDX = this.lookDY = this.zoom = 0;
    this._releaseStick();
  }

  /* ---------- keyboard ---------- */
  _bindKeyboard() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (MOVE_KEYS[e.code]) { this.keys[MOVE_KEYS[e.code]] = true; if (this.enabled) e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = true;
      if (e.code === 'Space') {
        if (!e.repeat) this._jumpPressed = true;
        this.jumpKey = true;
        if (this.enabled) e.preventDefault();
      }
      if (e.code === 'KeyE' && !e.repeat) this._interact = true;
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) this._pause = true;
    });
    addEventListener('keyup', (e) => {
      if (MOVE_KEYS[e.code]) this.keys[MOVE_KEYS[e.code]] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = false;
      if (e.code === 'Space') this.jumpKey = false;
    });
    addEventListener('blur', () => this.clear());
  }

  /* ---------- pointer: mouse drag / touch joystick + look ---------- */
  _bindPointer() {
    const c = this.canvas;
    this._lookId = null; this._stickId = null;
    this._last = { x: 0, y: 0 };
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this.setTouchMode(true);
        if (e.clientX < innerWidth / 2 && this._stickId === null) {
          this._stickId = e.pointerId;
          this._startStick(e.clientX, e.clientY);
        } else if (this._lookId === null) {
          this._lookId = e.pointerId;
          this._last = { x: e.clientX, y: e.clientY };
        }
      } else {
        this._lookId = e.pointerId;
        this._last = { x: e.clientX, y: e.clientY };
      }
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId === this._stickId) { this._moveStick(e.clientX, e.clientY); return; }
      if (e.pointerId === this._lookId) {
        const sens = e.pointerType === 'touch' ? CONFIG.camera.touchSensitivity : CONFIG.camera.mouseSensitivity;
        this.lookDX += (e.clientX - this._last.x) * sens;
        this.lookDY += (e.clientY - this._last.y) * sens;
        this._last = { x: e.clientX, y: e.clientY };
      }
    });
    const end = (e) => {
      if (e.pointerId === this._stickId) { this._stickId = null; this._releaseStick(); }
      if (e.pointerId === this._lookId) this._lookId = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('lostpointercapture', end);
    c.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

    // Stop the page itself from scrolling / zooming / selecting during play.
    document.addEventListener('touchmove', (e) => {
      if (this.enabled && !e.target.closest('.scrollable')) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => { if (this.enabled) e.preventDefault(); });
  }

  /* ---------- touch UI ---------- */
  _buildTouchUI() {
    const wrap = document.createElement('div');
    wrap.id = 'touch-ui';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div id="stick-base"><div id="stick-knob"></div></div>
      <button id="btn-interact" class="touch-btn" type="button" hidden>
        <span class="touch-btn-icon">✋</span><span id="btn-interact-label">Enter</span>
      </button>
      <button id="btn-jump" class="touch-btn" type="button" aria-label="Jump">
        <span class="touch-btn-icon">⤒</span><span>Jump</span>
      </button>`;
    document.body.appendChild(wrap);
    this.touchUI = wrap;
    this.stickBase = wrap.querySelector('#stick-base');
    this.stickKnob = wrap.querySelector('#stick-knob');
    this.btnInteract = wrap.querySelector('#btn-interact');
    this.btnInteractLabel = wrap.querySelector('#btn-interact-label');
    const jump = wrap.querySelector('#btn-jump');

    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._jumpPressed = true; this.jumpBtn = true;
      jump.classList.add('down');
      try { jump.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const jumpUp = () => { this.jumpBtn = false; jump.classList.remove('down'); };
    jump.addEventListener('pointerup', jumpUp);
    jump.addEventListener('pointercancel', jumpUp);
    jump.addEventListener('lostpointercapture', jumpUp);

    this.btnInteract.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._interact = true;
    });
  }

  setTouchMode(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    document.body.classList.toggle('touch', on);
    this._syncTouchUI();
    if (this.onTouchModeChange) this.onTouchModeChange(on);
  }
  setPlaying(on) {
    this.enabled = on;
    if (!on) this.clear();
    this._syncTouchUI();
  }
  _syncTouchUI() { this.touchUI.hidden = !(this.touchMode && this.enabled); }

  setInteract(label) {
    if (label) {
      this.btnInteractLabel.textContent = label;
      this.btnInteract.hidden = false;
    } else {
      this.btnInteract.hidden = true;
    }
  }

  _startStick(x, y) {
    this._stickOrigin = { x, y };
    this.stick.active = true; this.stick.x = 0; this.stick.y = 0;
    this.stickBase.style.left = x + 'px';
    this.stickBase.style.top = y + 'px';
    this.stickBase.classList.add('show');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
  }
  _moveStick(x, y) {
    const R = 60;
    let dx = x - this._stickOrigin.x, dy = y - this._stickOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    this.stick.x = dx / R; this.stick.y = dy / R;
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.stickBase.classList.toggle('sprint', Math.hypot(this.stick.x, this.stick.y) >= CONFIG.movement.joystickSprintAt);
  }
  _releaseStick() {
    this.stick.active = false; this.stick.x = 0; this.stick.y = 0;
    if (this.stickBase) this.stickBase.classList.remove('show', 'sprint');
  }
}
