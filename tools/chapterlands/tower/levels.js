// Habit Tower — level layout.
//
// The climb spirals up the inside of a square tower. A cursor walks around a
// ring (radius RING) and each call to step() places the next platform a chord
// distance `dist` further round and `dy` higher. Tweak numbers here to tune
// difficulty; tower.js only reads the arrays exported at the bottom.
//
// Platform types:
//   solid      – plain platform (section colour)
//   marker     – solid, dark, with a glowing marker (fog floors)
//   moving     – slides back and forth: move = { axis: 'tan'|'rad'|'y', amp, period, phase }
//   crumble    – shiny decoy, cracks and drops shortly after you touch it
//   speed      – speed pad: boosts top speed for a moment
//   spring     – launches you upwards (launch = height)
//   light      – lights up when you land on it
//   vanish     – disappears shortly after you land, comes back later
//   checkpoint – glowing pad that sets your respawn point (start of a section)
//   goal       – the top

export const TOWER = { half: 10, height: 118, ring: 6.5 };

export const SECTIONS = [
  { law: 'Make it obvious',    lesson: 'Put the cue where you can\'t miss it — follow the glowing markers through the fog.', color: 0x2f7fd6 },
  { law: 'Make it attractive', lesson: 'Pair the effort with a reward — the coins show the good route; shiny shortcuts are traps.', color: 0xe9a23b },
  { law: 'Make it easy',       lesson: 'Less friction, more progress — speed pads and springs are the fast way up.', color: 0x3fae5c },
  { law: 'Make it satisfying', lesson: 'Watch the chain light up behind you — then keep moving, these ones won\'t wait.', color: 0xd8452f }
];

// Height band where section 1's fog sits.
export const FOG_BAND = { y0: 14, y1: 26.5 };

const PLATFORMS = [];
const COINS = [];
let a = Math.PI / 2;   // start on the +z side (by the entrance)
let y = 0.3;
let section = 0;

function at(angle, r = TOWER.ring) { return [Math.cos(angle) * r, Math.sin(angle) * r]; }
function chordAngle(dist, r = TOWER.ring) { return 2 * Math.asin(Math.min(0.999, dist / (2 * r))); }

function place(type, angle, top, s, extra = {}, r = TOWER.ring) {
  const [x, z] = at(angle, r);
  const p = Object.assign({ type, x, z, top, w: s, d: s, h: 0.5, section, angle }, extra);
  PLATFORMS.push(p);
  return p;
}
// Advance the cursor and place the next platform on the main route.
function step(dist, dy, type = 'solid', s = 2.6, extra = {}) {
  const prev = [Math.cos(a) * TOWER.ring, Math.sin(a) * TOWER.ring, y];
  a += chordAngle(dist);
  y += dy;
  const p = place(type, a, y, s, extra);
  return { p, prev };
}
// A row of coins arcing between the previous platform and this one.
function coinTrail({ p, prev }, n = 3) {
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    COINS.push({ x: prev[0] + (p.x - prev[0]) * t, y: prev[2] + (p.top - prev[2]) * t + 1.1 + Math.sin(t * Math.PI) * 1.2, z: prev[1] + (p.z - prev[1]) * t, section });
  }
}
// A shiny decoy just inside the ring next to the current cursor position.
function decoy(dAngle = 0.35, dy = 0.4) {
  place('crumble', a + dAngle, y + dy, 2.2, {}, TOWER.ring - 3.2);
}
function checkpoint(dist, dy) {
  section += 0; // section index set by caller
  return step(dist, dy, 'checkpoint', 3.4);
}

/* ---------------- Section 1 · Make it obvious ---------------- */
section = 0;
place('checkpoint', a, y, 3.6);                                  // start pad
for (let i = 0; i < 8; i++) step(4.0, 1.4, 'solid', 2.8);       // gentle warm-up
step(4.2, 1.6); step(4.2, 1.6);
// fog floors: only the glowing markers show where to go
for (let i = 0; i < 8; i++) step(4.4, 1.3, 'marker', 2.4);

/* ---------------- Section 2 · Make it attractive ---------------- */
section = 1;
checkpoint(4.2, 1.2);
coinTrail(step(5.2, 0.5, 'moving', 2.4, { move: { axis: 'tan', amp: 1.6, period: 3.2, phase: 0 } }));
decoy();
coinTrail(step(4.4, 1.4));
coinTrail(step(4.4, 1.0, 'moving', 2.4, { move: { axis: 'y', amp: 1.2, period: 3.6, phase: 1 } }));
decoy(0.3, 0.6);
coinTrail(step(4.2, 1.6));
coinTrail(step(4.6, 0.8, 'moving', 2.4, { move: { axis: 'rad', amp: 1.4, period: 3.0, phase: 0.5 } }));
decoy();
coinTrail(step(4.2, 1.5));
coinTrail(step(5.0, 0.8, 'moving', 2.4, { move: { axis: 'tan', amp: 1.8, period: 2.8, phase: 1.5 } }));
coinTrail(step(4.2, 1.6));
decoy(0.32, 0.5);
coinTrail(step(4.2, 1.6));
coinTrail(step(4.4, 1.0, 'moving', 2.4, { move: { axis: 'y', amp: 1.0, period: 3.0, phase: 0 } }));
coinTrail(step(4.2, 1.6));
decoy(0.3, 0.5);
coinTrail(step(5.2, 0.6, 'moving', 2.2, { move: { axis: 'rad', amp: 1.5, period: 2.6, phase: 1 } }));
coinTrail(step(5.2, 0.6, 'moving', 2.2, { move: { axis: 'tan', amp: 1.8, period: 2.6, phase: 0 } }));
coinTrail(step(4.2, 1.5));

/* ---------------- Section 3 · Make it easy ---------------- */
section = 2;
checkpoint(4.2, 1.4);
step(4.2, 1.2, 'speed', 3.0);
step(9.2, 0, 'solid', 3.0);                         // long gap — easy with the boost
// spring shortcut, with a slower staircase round the inside
function springSegment() {
  const s = step(4.2, 1.4, 'spring', 2.6, { launch: 9.5 });
  const a0 = a, y0 = y, a1 = a + chordAngle(5.6);
  // slow route: three small steps round the inside of the ring
  [-0.4, 0.4, 1.2].forEach((da, i) => place('solid', a0 + da, y0 + 1.75 * (i + 1), 1.8, { slow: true }, 3.0));
  a = a1; y = y0 + 7;
  place('solid', a, y, 3.0);
  return s;
}
springSegment();
step(4.2, 1.5);
step(4.2, 1.2, 'speed', 3.0);
step(8.8, 1.0, 'solid', 3.0);
springSegment();
step(4.2, 1.2, 'speed', 3.0);
step(9.6, 0.4, 'solid', 3.0);
springSegment();

/* ---------------- Section 4 · Make it satisfying ---------------- */
section = 3;
checkpoint(4.2, 1.2);
for (let i = 0; i < 3; i++) step(5.2, 1.6, 'light', 2.1);        // warm-up
for (let i = 0; i < 5; i++) step(6.6, 0.9, 'light', 2.0);        // sprint jumps
step(5.7, 0.6, 'light', 2.0);
step(5.7, 0.6, 'light', 2.0);
for (let i = 0; i < 10; i++) step(5.0, 1.1, 'vanish', 2.0);
step(5.0, 1.4, 'goal', 5.0);

export { PLATFORMS, COINS };
export const START = { x: 0, y: 0.3, z: TOWER.ring + 0.6, facing: Math.PI };
