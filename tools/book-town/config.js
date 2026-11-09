// Book Town — all tunable data lives here.
// Units: 1 unit ≈ 1 metre. The town square spans x/z −30…30; y is up.

export const CONFIG = {
  saveKey: 'bookTown.save.v1',

  // Affiliate links. Placeholder until the real URL is ready — while it isn't
  // an http(s) URL the end-screen button shows "link coming soon" instead.
  affiliate: {
    atomicHabits: 'AFFILIATE_URL_ATOMIC_HABITS'
  },

  /* ---------------- movement feel ---------------- */
  movement: {
    walkSpeed: 6,
    sprintSpeed: 10,
    accelTime: 0.15,       // seconds to reach top speed from rest
    stopTime: 0.09,        // seconds to stop from top speed
    airControl: 0.7,       // fraction of ground acceleration available in the air
    jumpHeight: 2.2,       // full height when jump is held
    shortHopFactor: 2.6,   // extra gravity multiplier while rising with jump released
    gravity: 32,
    terminalVelocity: 40,
    coyoteTime: 0.12,
    jumpBuffer: 0.12,
    turnSpeed: 14,         // radians/sec-ish smoothing for facing
    stepHeight: 0.5,       // ledges lower than this are walked up automatically
    mantleReach: 1.2,      // airborne: ledges up to this far above your feet are climbed onto
    radius: 0.35,
    height: 1.8,
    joystickSprintAt: 0.85 // touch stick pushed past this fraction auto-sprints
  },

  camera: {
    fov: 60,
    distance: 7,
    minDistance: 2.5,
    maxDistance: 14,
    pitch: 0.38,           // radians above horizontal
    minPitch: -0.25,
    maxPitch: 1.25,
    pivotHeight: 1.5,
    mouseSensitivity: 0.005,
    touchSensitivity: 0.008,
    easeOut: 4             // how quickly the camera eases back out after a wall pushes it in
  },

  /* ---------------- spawns ---------------- */
  spawns: {
    default: { x: 0, y: 0, z: 34, facing: Math.PI },   // south entrance, facing the square
    study:   { x: -18, y: 0, z: -26.5, facing: 0 }      // outside The Study door, facing the square
  },

  /* ---------------- buildings ----------------
     Footprint is [x0, x1] × [z0, z1], height h. `door` faces the square.
     status: 'live' (enterable), 'locked' (coming soon), or 'filler' (no door). */
  buildings: [
    { id: 'study',    name: 'The Study',  sign: 'The Study · Atomic Habits', status: 'live',   href: 'study/',
      x0: -28, x1: -8,  z0: -44, z1: -30, h: 8,   wall: 0xe9dcc0, trim: 0x7a5236, roof: 0x5b6e7c, style: 'library',
      door: { face: 'south', at: -18 } },
    { id: 'bookshop', name: 'Bookshop',   sign: 'Bookshop', status: 'locked',
      x0: -6,  x1: 12,  z0: -44, z1: -30, h: 6,   wall: 0xc0583f, trim: 0xf3e6c8, roof: 0x4a3a33, style: 'shop',
      door: { face: 'south', at: 3 } },
    { id: 'townhall', name: 'Town Hall',  status: 'filler',
      x0: 12,  x1: 44,  z0: -44, z1: -30, h: 9,   wall: 0xd8d2c4, trim: 0x8a8273, roof: 0x6a7d5a, style: 'hall' },
    { id: 'nw-house', name: 'House',      status: 'filler',
      x0: -44, x1: -30, z0: -44, z1: -30, h: 5,   wall: 0xa7c4a0, trim: 0xffffff, roof: 0x8d4b3a, style: 'house' },

    { id: 'arcade',   name: 'Arcade',     sign: 'Arcade', status: 'locked',
      x0: 30,  x1: 44,  z0: -30, z1: -3,   h: 5.5, wall: 0x5a4a9c, trim: 0xffd23f, roof: 0x34305a, style: 'shop',
      door: { face: 'west', at: -10 } },
    { id: 'cafe',     name: 'Café',       sign: 'Café', status: 'locked',
      x0: 30,  x1: 44,  z0: 3,   z1: 16,  h: 4,   wall: 0xf2c9a0, trim: 0x6b4226, roof: 0x7a4a2e, style: 'cafe',
      door: { face: 'west', at: 11 } },
    { id: 'se-house', name: 'House',      status: 'filler',
      x0: 30,  x1: 44,  z0: 18,  z1: 44,  h: 5,   wall: 0xf0e2a8, trim: 0xffffff, roof: 0x5b6e7c, style: 'house' },

    { id: 'gym',      name: 'Gym',        sign: 'Gym', status: 'locked',
      x0: -44, x1: -30, z0: -30, z1: -1.5, h: 6,  wall: 0x8fa3b8, trim: 0x23303d, roof: 0x3d4a57, style: 'shop',
      door: { face: 'east', at: -16 } },
    { id: 'cinema',   name: 'Cinema',     sign: 'Cinema', status: 'locked',
      x0: -44, x1: -30, z0: 1.5, z1: 28,  h: 7,   wall: 0x9c2f3a, trim: 0xf6d77a, roof: 0x4a1d23, style: 'cinema',
      door: { face: 'east', at: 14 } },
    { id: 'sw-house', name: 'House',      status: 'filler',
      x0: -44, x1: -30, z0: 30,  z1: 44,  h: 4.5, wall: 0xd7b8d8, trim: 0xffffff, roof: 0x5c4a6e, style: 'house' },

    { id: 's-house-1', name: 'House',     status: 'filler',
      x0: -28, x1: -11, z0: 30,  z1: 44,  h: 5,   wall: 0xb9d4e6, trim: 0xffffff, roof: 0x8d4b3a, style: 'house' },
    { id: 's-house-2', name: 'House',     status: 'filler',
      x0: 11,  x1: 28,  z0: 30,  z1: 44,  h: 5.5, wall: 0xf3d3b3, trim: 0xffffff, roof: 0x4f6a4a, style: 'house' }
  ],

  /* ---------------- ad slots (placeholders) ----------------
     Swap `image` to change the ad. If `link` is set, interacting opens it in a
     new tab with rel="sponsored noopener". Position is the centre of the panel;
     rotationY turns it to face the square; size is [width, height]. */
  adSlots: [
    { id: 'billboard-north', image: 'assets/ads/placeholder-1.png', link: null, label: 'Advertise here',
      position: [3, 8.4, -30.75], rotationY: 0, size: [9, 3.6] },
    { id: 'billboard-west',  image: 'assets/ads/placeholder-2.png', link: null, label: 'Advertise here',
      position: [-25.55, 4.5, 23], rotationY: Math.PI / 2, size: [5.6, 2.24] },
    { id: 'shopfront-arcade', image: 'assets/ads/placeholder-3.png', link: null, label: 'Advertise here',
      position: [29.94, 4.25, -21], rotationY: -Math.PI / 2, size: [8, 1.6] },
    { id: 'bus-stop',        image: 'assets/ads/placeholder-4.png', link: null, label: 'Advertise here',
      position: [-7, 1.3, 32.7], rotationY: Math.PI, size: [1.4, 2.1] }
  ],

  /* ---------------- coins ----------------
     Stable IDs: never renumber, or saved progress will point at the wrong coin.
     y is the coin's centre height. */
  coins: [
    // ring around the fountain
    { id: 'c01', x: 6.5,  y: 1, z: 0 },    { id: 'c02', x: 4.6,  y: 1, z: 4.6 },
    { id: 'c03', x: 0,    y: 1, z: 6.5 },  { id: 'c04', x: -4.6, y: 1, z: 4.6 },
    { id: 'c05', x: -6.5, y: 1, z: 0 },    { id: 'c06', x: -4.6, y: 1, z: -4.6 },
    { id: 'c07', x: 0,    y: 1, z: -7 },   { id: 'c08', x: 4.6,  y: 1, z: -4.6 },
    // path from the entrance
    { id: 'c09', x: 0, y: 1, z: 27 }, { id: 'c10', x: 0, y: 1, z: 23 }, { id: 'c11', x: 0, y: 1, z: 19 },
    { id: 'c12', x: 0, y: 1, z: 15 }, { id: 'c13', x: 0, y: 1, z: 11 },
    // path to The Study
    { id: 'c14', x: -6, y: 1, z: -10 }, { id: 'c15', x: -9, y: 1, z: -14 }, { id: 'c16', x: -12, y: 1, z: -18 },
    { id: 'c17', x: -15, y: 1, z: -22 }, { id: 'c18', x: -18, y: 1.3, z: -24.5 },
    // rooftop route: crates → awning → café roof → arcade roof → clock tower
    { id: 'c19', x: 27.3, y: 1.9, z: 4.9 }, { id: 'c20', x: 27.3, y: 2.9, z: 6.6 },
    { id: 'c21', x: 29, y: 3.7, z: 5 }, { id: 'c22', x: 29, y: 3.7, z: 9 }, { id: 'c23', x: 29, y: 3.7, z: 13 },
    { id: 'c24', x: 33, y: 4.9, z: 13 }, { id: 'c25', x: 37, y: 4.9, z: 13 }, { id: 'c26', x: 37, y: 4.9, z: 8 },
    { id: 'c27', x: 37, y: 4.9, z: 3.2 },
    { id: 'c28', x: 37, y: 6.4, z: -4 }, { id: 'c29', x: 34, y: 6.4, z: -12 }, { id: 'c30', x: 31.5, y: 6.4, z: -22 },
    { id: 'c31', x: 28.7, y: 8.2, z: -25 }, { id: 'c32', x: 27, y: 10, z: -21.3 },
    { id: 'c33', x: 23.5, y: 11.8, z: -21.3 }, { id: 'c34', x: 21.3, y: 13.6, z: -24 },
    // west side + back alley
    { id: 'c35', x: -24, y: 1, z: -20 }, { id: 'c36', x: -24, y: 1, z: -10 }, { id: 'c37', x: -24, y: 1, z: 6 },
    { id: 'c38', x: -31.5, y: 1, z: 0 }, { id: 'c39', x: -36, y: 1, z: 0 },
    // market stall → billboard
    { id: 'c40', x: -20.1, y: 1.9, z: 23 }, { id: 'c41', x: -22.5, y: 3.3, z: 23 }, { id: 'c42', x: -25.2, y: 4.3, z: 23 },
    // east side of the square
    { id: 'c43', x: 20, y: 1, z: 10 }, { id: 'c44', x: 20, y: 1, z: 20 }, { id: 'c45', x: 14, y: 1, z: -14 },
    // bus-stop roof
    { id: 'c46', x: -7, y: 3.5, z: 32 },
    // alley between the arcade and café
    { id: 'c47', x: 33, y: 1, z: 0 }, { id: 'c48', x: 41, y: 1, z: 0 },
    // odds and ends
    { id: 'c49', x: -12, y: 1, z: 14 }, { id: 'c50', x: 12, y: 1, z: -4 }
  ],

  goldenCoins: [
    { id: 'g1', x: 40,  y: 6.6,  z: -20,  hint: 'arcade roof' },
    { id: 'g2', x: 25,  y: 15.6, z: -25,  hint: 'clock tower top' },
    { id: 'g3', x: -26, y: 7.0,  z: 23,   hint: 'billboard top' },
    { id: 'g4', x: -42, y: 1.1,  z: 0,    hint: 'back alley' },
    { id: 'g5', x: 0,   y: 1.1,  z: -5.6, hint: 'behind the fountain' }
  ],

  badges: [
    { id: 'first-coin',     name: 'First Coin',      desc: 'Pick up your first coin.',            icon: '🪙' },
    { id: 'rooftop-runner', name: 'Rooftop Runner',  desc: 'Reach the top of the clock tower.',   icon: '🕰️' },
    { id: 'golden-hunter',  name: 'Golden Hunter',   desc: 'Find all 5 golden coins.',            icon: '⭐' },
    { id: 'collector',      name: 'Collector',       desc: 'Collect all 50 coins.',               icon: '💰' },
    { id: 'habit-breaker',  name: 'Habit Breaker',   desc: 'Escape The Study.',                   icon: '📘' }
  ],

  // clock tower footprint + top height (used for the Rooftop Runner badge)
  clockTower: { x0: 22, x1: 28, z0: -28, z1: -22, h: 14.5 }
};

export default CONFIG;
