// Unified input: keyboard + mouse on desktop, floating joystick / camera drag /
// buttons on touch. Game code reads a small state object each frame.
//
// Phase 3 adds the Charge button (C / Ctrl: super jump, slide, ground pound)
// and Dash (Q, or double-tap a direction / flick the joystick twice). On touch
// the right thumb gets an arc of Jump + Charge + Dash; Dash stays hidden until
// it's bought (setMoves).
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
    this.chargeKey = false; this.chargeBtn = false; this._chargePressed = false;
    this._dash = false;
    this._lastTap = { key: null, t: 0 };
    this._flick = { armed: true, t: 0, x: 0, y: 0 };
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
  get chargeHeld() { return this.enabled && (this.chargeKey || this.chargeBtn); }
  consumeJump() { const j = this._jumpPressed; this._jumpPressed = false; return j && this.enabled; }
  consumeCharge() { const c = this._chargePressed; this._chargePressed = false; return c && this.enabled; }
  consumeDash() { const d = this._dash; this._dash = false; return d && this.enabled; }
  consumeInteract() { const i = this._interact; this._interact = false; return i && this.enabled; }
  consumePause() { const p = this._pause; this._pause = false; return p; }
  consumeLook() { const r = { dx: this.lookDX, dy: this.lookDY }; this.lookDX = 0; this.lookDY = 0; return r; }
  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }

  clear() {
    this.keys = { f: false, b: false, l: false, r: false };
    this.shift = this.jumpKey = this.jumpBtn = false;
    this.chargeKey = this.chargeBtn = false;
    this._jumpPressed = this._interact = this._chargePressed = this._dash = false;
    this.lookDX = this.lookDY = this.zoom = 0;
    this._releaseStick();
  }

  /* ---------- keyboard ---------- */
  _bindKeyboard() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (MOVE_KEYS[e.code]) {
        const k = MOVE_KEYS[e.code];
        // double-tap a direction = dash
        if (!e.repeat) {
          const now = performance.now();
          if (this._lastTap.key === k && now - this._lastTap.t < 260) { this._dash = true; this._lastTap.key = null; }
          else this._lastTap = { key: k, t: now };
        }
        this.keys[k] = true;
        if (this.enabled) e.preventDefault();
      }
      if ((e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) {
        this._chargePressed = true; this.chargeKey = true;
        if (this.enabled) e.preventDefault();
      }
      if (e.code === 'KeyQ' && !e.repeat) this._dash = true;
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
      if (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') this.chargeKey = false;
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
      </button>
      <button id="btn-charge" class="touch-btn small" type="button" aria-label="Charge: super jump, slide, ground pound">
        <span class="touch-btn-icon">⚡</span><span>Charge</span>
      </button>
      <button id="btn-dash" class="touch-btn small" type="button" aria-label="Dash" hidden>
        <span class="touch-btn-icon">💨</span><span>Dash</span>
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

    const charge = wrap.querySelector('#btn-charge');
    charge.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._chargePressed = true; this.chargeBtn = true;
      charge.classList.add('down');
      try { charge.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const chargeUp = () => { this.chargeBtn = false; charge.classList.remove('down'); };
    charge.addEventListener('pointerup', chargeUp);
    charge.addEventListener('pointercancel', chargeUp);
    charge.addEventListener('lostpointercapture', chargeUp);
    this.btnDash = wrap.querySelector('#btn-dash');
    this.btnDash.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._dash = true;
      this.btnDash.classList.add('down');
      setTimeout(() => this.btnDash.classList.remove('down'), 120);
    });

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

  // Show the touch buttons for moves the player owns.
  setMoves(unlocks) {
    if (this.btnDash) this.btnDash.hidden = !(unlocks && unlocks.dash);
    if (this.touchUI) this.touchUI.classList.toggle('has-dash', !!(unlocks && unlocks.dash));
  }

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
    // two quick flicks in the same direction = dash
    const mag = Math.hypot(this.stick.x, this.stick.y), f = this._flick;
    if (mag < 0.3) f.armed = true;
    else if (mag > 0.85 && f.armed) {
      f.armed = false;
      const now = performance.now(), nx = this.stick.x / mag, ny = this.stick.y / mag;
      if (now - f.t < 320 && nx * f.x + ny * f.y > 0.75) { this._dash = true; f.t = 0; }
      else { f.t = now; f.x = nx; f.y = ny; }
    }
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.stickBase.classList.toggle('sprint', Math.hypot(this.stick.x, this.stick.y) >= CONFIG.movement.joystickSprintAt);
  }
  _releaseStick() {
    this.stick.active = false; this.stick.x = 0; this.stick.y = 0;
    if (this._flick) this._flick.armed = true;
    if (this.stickBase) this.stickBase.classList.remove('show', 'sprint');
  }
}
