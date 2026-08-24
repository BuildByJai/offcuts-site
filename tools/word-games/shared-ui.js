/* Offcuts Word Games — shared UI helpers: age-band selector, win/lose states, sound toggle.
   Plain global (no bundler): exposes window.WG. */
(function () {
  const STORAGE_KEY = "wg-age-band";

  const AGE_BANDS = [
    { id: "littleExplorer", label: "Little Explorer", range: "Ages 4–7" },
    { id: "wordWhiz", label: "Word Whiz", range: "Ages 8–12" },
    { id: "wordMaster", label: "Word Master", range: "Teen / Adult" }
  ];

  function getAgeBand() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored && AGE_BANDS.some(b => b.id === stored)) return stored;
    } catch (e) {}
    return "wordWhiz";
  }

  function setAgeBand(id) {
    try { sessionStorage.setItem(STORAGE_KEY, id); } catch (e) {}
  }

  function renderAgeBandPicker(el, opts) {
    opts = opts || {};
    const active = opts.active || getAgeBand();
    el.innerHTML = AGE_BANDS.map(b => `
      <button type="button" class="wg-age-btn${b.id === active ? " active" : ""}" data-band="${b.id}">
        <span class="wg-age-label">${b.label}</span>
        <span class="wg-age-range">${b.range}</span>
      </button>
    `).join("");
    el.querySelectorAll(".wg-age-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.querySelectorAll(".wg-age-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const id = btn.dataset.band;
        setAgeBand(id);
        if (typeof opts.onSelect === "function") opts.onSelect(id);
      });
    });
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickRandom(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  const TRY_AGAIN_MESSAGES = {
    littleExplorer: [
      "So close! Have another go — you've got this!",
      "Nice try! Let's give it another shot.",
      "Great effort! Try again, superstar."
    ],
    wordWhiz: [
      "Not quite — have another go.",
      "Close one! Try again.",
      "Good effort — one more try."
    ],
    wordMaster: [
      "Not this time. Try again.",
      "So close — give it another shot.",
      "Almost — one more round."
    ]
  };

  function tryAgainMessage(band) {
    const list = TRY_AGAIN_MESSAGES[band] || TRY_AGAIN_MESSAGES.wordWhiz;
    return list[Math.floor(Math.random() * list.length)];
  }

  const CONFETTI_COLORS = ["#156534", "#E9F3ED", "#BA7517", "#181818", "#FAFAF8"];

  function celebrate(container) {
    const host = container || document.body;
    const layer = document.createElement("div");
    layer.className = "wg-confetti-layer";
    const count = 36;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "wg-confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDelay = (Math.random() * 0.4) + "s";
      piece.style.animationDuration = (1.1 + Math.random() * 0.8) + "s";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
    }
    host.appendChild(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  /* Sound: simple generated tones via Web Audio API, no external audio files. */
  const SOUND_KEY = "wg-sound-muted";
  let audioCtx = null;

  function isMuted() {
    try { return sessionStorage.getItem(SOUND_KEY) === "1"; } catch (e) { return false; }
  }

  function setMuted(muted) {
    try { sessionStorage.setItem(SOUND_KEY, muted ? "1" : "0"); } catch (e) {}
  }

  function ensureCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function playTone(freq, duration, delay) {
    if (isMuted()) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const start = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function playWinSound() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, 0.22, i * 0.1));
  }

  function playLoseSound() {
    [392, 329.6].forEach((f, i) => playTone(f, 0.3, i * 0.14));
  }

  function playTapSound() {
    playTone(440, 0.08, 0);
  }

  function initSoundToggle(el) {
    function render() {
      const muted = isMuted();
      el.textContent = muted ? "🔇 Sound off" : "🔊 Sound on";
      el.classList.toggle("muted", muted);
    }
    el.addEventListener("click", () => {
      setMuted(!isMuted());
      render();
      if (!isMuted()) { ensureCtx(); playTapSound(); }
    });
    render();
  }

  window.WG = {
    AGE_BANDS,
    getAgeBand,
    setAgeBand,
    renderAgeBandPicker,
    shuffle,
    pickRandom,
    tryAgainMessage,
    celebrate,
    initSoundToggle,
    playWinSound,
    playLoseSound,
    playTapSound,
    playTone
  };
})();
