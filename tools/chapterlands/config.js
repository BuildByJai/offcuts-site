// Chapterlands — all tunable data lives here.
// (Formerly "Book Town". Books themselves live in catalogue/books.json + content/.)
// Units: 1 unit ≈ 1 metre. The town square spans x/z −30…30; y is up.

// One palette for the whole town: 8 main colours + accents. Buildings below
// pick from it by name, so retinting the town means editing this block.
const PALETTE = {
  // main
  cream: 0xefe3c8, stone: 0xd8d0bf, brick: 0xc0583f, sage: 0x9fbf94,
  slate: 0x5b6e7c, navy: 0x23303d, butter: 0xf2d47a, wood: 0x7a4e30,
  // accents
  berry: 0x9c2f3a, grape: 0x5a4a9c, peach: 0xf2c9a0, powder: 0xb9d4e6, lilac: 0xd7b8d8,
  moss: 0x5f7a52, plum: 0x5c4a6e, darkWood: 0x5a3a24, ink: 0x2a2420, white: 0xfbf7ee,
  gold: 0xf2b705, coral: 0xe94f6a, teal: 0x2f9e9a, violet: 0x6a5acd, mint: 0x7fd6b0,
  leaf: 0x5aa24f, deepLeaf: 0x3f7f3e, sky: 0x8fc6ec
};
const P = PALETTE;

export const CONFIG = {
  // The one place the game's display name lives. Titles, start screen and toasts read it.
  gameName: 'Chapterlands',
  gameNameParts: ['Chapter', 'lands'],   // the logo shows the second part in gold

  // Save v2 (Chapterlands). Migrated once from the Book Town keys, which are
  // left in place (never deleted) in case we need to roll back.
  saveKey: 'chapterlands.save.v2',
  legacySaveKeys: ['bookTown.save.v2', 'bookTown.save.v1'],

  // Generated library-card names: adjective + book-ish noun. No free text, ever.
  names: {
    adjectives: ['Brave', 'Swift', 'Quiet', 'Bright', 'Clever', 'Gentle', 'Lucky', 'Bold', 'Merry', 'Nimble', 'Sunny', 'Daring',
      'Curious', 'Jolly', 'Kind', 'Steady', 'Plucky', 'Cosy', 'Golden', 'Silver', 'Busy', 'Calm', 'Happy', 'Wise'],
    nouns: ['Lantern', 'Inkwell', 'Bookmark', 'Quill', 'Chapter', 'Page', 'Atlas', 'Compass', 'Library', 'Story', 'Fable',
      'Scroll', 'Candle', 'Owl', 'Spine', 'Index', 'Shelf', 'Riddle', 'Margin', 'Ribbon', 'Pencil', 'Reader', 'Map', 'Notebook']
  },

  // Coins buy help, never answers. (Hints only explain *where* to look again.)
  costs: {
    hint: 5,          // one hint per reading-check question
    extraLife: 10,    // skill games with lives
    speedBoost: 8     // a short speed boost in a skill game
  },
  // Rewards for the District Kit (side quests carry their own reward).
  rewards: { streetGame: 10, skyRun: 25, vault: 50 },

  // Grown-up check: guards every link that leaves the game.
  grownUps: {
    numbers: [[74, 'seventy-four'], [38, 'thirty-eight'], [91, 'ninety-one'], [56, 'fifty-six'], [27, 'twenty-seven'], [63, 'sixty-three'], [45, 'forty-five'], [82, 'eighty-two']],
    // find-a-library links shown for books that aren't readable in-game
    libraryLinks: [
      { label: 'Find your local library (GOV.UK)', href: 'https://www.gov.uk/local-library-services' },
      { label: 'BorrowBox', href: 'https://www.borrowbox.com/' },
      { label: 'Libby', href: 'https://libbyapp.com/' }
    ]
  },

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

  /* ---------------- palette ----------------
     One set of colours for the whole town (see PALETTE above) so buildings,
     props and characters read as one family. */
  palette: PALETTE,

  /* ---------------- graphics ---------------- */
  graphics: {
    exposure: 1.05,
    toonSteps: [0.42, 0.68, 0.88, 1.0],  // brightness of each toon band (dark → lit)
    outlineColor: 0x241c16,
    outlineWidth: 0.028,                 // metres, inverted-hull thickness
    fog: { near: 60, far: 175 },
    dayLengthSec: 600,                   // a full day/night cycle (≈10 minutes)
    startHour: 9.5,                      // time of day when the town loads
    lockHour: null,                      // set e.g. 12 / 18.6 / 22 to freeze the clock (or use ?time=18.6)
    // quality tiers — auto-picked on first load, changeable in the pause menu
    tiers: {
      low:    { pixelRatio: 1,   shadows: 0,    post: false, props: 0.45, npcs: 2, grass: 0.35, shadowRange: 0 },
      medium: { pixelRatio: 1.5, shadows: 1024, post: false, props: 0.8,  npcs: 4, grass: 0.7,  shadowRange: 26 },
      high:   { pixelRatio: 2,   shadows: 2048, post: true,  props: 1,    npcs: 6, grass: 1,    shadowRange: 34 }
    },
    autoDrop: { belowFps: 40, forSec: 5 },
    bloom: { strength: 0.42, radius: 0.5, threshold: 0.82 },
    vignette: 0.32
  },

  /* ---------------- moves (Part B) ----------------
     Everything here is in metres / seconds. Prices in `shop`. */
  moves: {
    doubleJumpFactor: 0.8,     // height of the second jump relative to a normal jump
    tripleJumpFactor: 0.75,
    superJumpChargeTime: 1.0,  // seconds to fully charge
    superJumpMin: 1.25,        // × jump height at a tap
    superJumpMax: 2.5,         // × jump height fully charged
    slideTime: 0.65,
    slideSpeed: 12.5,          // starting speed (keeps more if you were already faster)
    slideFriction: 9,          // m/s² of slow-down while sliding
    slideHeight: 0.9,          // collider height while sliding (fits under ~1m gaps)
    longJumpHeight: 1.5,
    longJumpSpeed: 14,
    ledgeReach: 2.3,           // a ledge this far above your feet can be grabbed (mantle covers ≤ mantleReach)
    ledgeHang: 0.16,           // seconds hanging before the auto pull-up
    ledgePull: 0.3,
    dashSpeed: 22,
    dashTime: 0.17,
    wallSlideSpeed: 3.2,
    wallJumpPush: 8.5,         // horizontal kick away from the wall
    wallJumpHeight: 2.0,
    glideFallSpeed: 2.2,
    glideSpeed: 9,
    glideTurn: 2.6,
    poundHover: 0.16,
    poundSpeed: 30,
    poundBounceFactor: 1.8,    // bounce pads launch this much higher after a ground pound
    rideMinSpeed: 7,           // rails / ziplines never go slower than this
    zipSpeed: 15,
    railSpeed: 11,
    ladderSpeed: 4.2
  },

  stamina: {
    max: 1,
    regenTime: 2.0,            // seconds to refill from empty while on the ground
    regenDelay: 0.25,
    superJump: 0.45,           // cost at full charge (scales down for a partial charge)
    dash: 0.3,
    glidePerSec: 0.22
  },

  /* ---------------- shop + economy ---------------- */
  shop: {
    unlocks: [
      { id: 'dash',        name: 'Dash',         price: 50,  icon: '💨', desc: 'Quick burst forward, on the ground or once per jump in the air.',
        tip: 'Press <b>Q</b> or double-tap a direction (touch: the 💨 button). Try dashing across the café alley.' },
      { id: 'wallJump',    name: 'Wall Jump',    price: 100, icon: '🧱', desc: 'Kick off walls. Bounce between two close walls to climb.',
        tip: 'Jump into a wall, then jump again. Try the narrow gap between the clock tower and the house next door.' },
      { id: 'glide',       name: 'Glide',        price: 150, icon: '☂️', desc: 'Open your umbrella for a slow fall with forward travel.',
        tip: 'Double jump, then <b>keep holding Jump</b> while falling. Vents push you up. Try gliding from the clock tower to Book Island.' },
      { id: 'groundPound', name: 'Ground Pound', price: 100, icon: '⬇️', desc: 'Slam down. Breaks cracked crates and bounces extra high off mushrooms.',
        tip: 'Press <b>C</b> in mid-air (touch: the ⚡ button). Look for cracked crates on the rooftops.' },
      { id: 'tripleJump',  name: 'Triple Jump',  price: 300, icon: '🌀', desc: 'A third jump in mid-air.',
        tip: 'Tap Jump a third time in mid-air.' }
    ],
    boosts: [
      { id: 'rocket', name: 'Rocket Boots', price: 10, icon: '🚀', secs: 30, desc: '30 seconds of double-height jumps.' },
      { id: 'speed',  name: 'Speed Shoes',  price: 10, icon: '👟', secs: 30, desc: '30 seconds of faster sprinting.' },
      { id: 'magnet', name: 'Coin Magnet',  price: 15, icon: '🧲', secs: 60, desc: '60 seconds of pulling in nearby coins.' }
    ],
    rocketJumpMult: 2,         // jump height multiplier
    speedSprintMult: 1.4,
    magnetRadius: 7
  },
  economy: {
    coin: 1,                   // wallet value of a regular coin (collected once)
    golden: 25,                // wallet value of a golden coin
    crate: 5,                  // coins inside a cracked crate (crates rebuild after crateRespawn)
    crateRespawn: 180,
    orbRespawn: 120,           // seconds before a boost orb returns
    trialFinish: 5,            // every finished time trial
    medal: { bronze: 10, silver: 20, gold: 40 },   // first time you earn each medal on a course
    comboMin: 3,               // tricks needed in one air-chain before it pays
    comboCap: 15
  },

  // Rideable scooter in the square — later phase, off for now.
  scooter: { enabled: false },

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
    easeOut: 4,            // how quickly the camera eases back out after a wall pushes it in
    rotDamping: 14,        // how quickly the view catches up with a drag (higher = snappier)
    lookAhead: 0.12,       // seconds of travel the view leads by…
    lookAheadMax: 1.4,     // …capped at this many metres
    // overview (town only — see FollowCamera opts): zoom past overviewFrom and the
    // camera tilts up to overviewPitch, out to overviewDistance, pivot raised by overviewLift
    overview: false, overviewFrom: 13, overviewDistance: 42, overviewPitch: 1.0, overviewLift: 2,
    sprintFovKick: 7,      // degrees added while sprinting / dashing
    speedPullBack: 2.2,    // extra distance at high speed and during super jumps
    shake: 1               // global multiplier for camera shake
  },

  /* ---------------- spawns ---------------- */
  spawns: {
    default: { x: 0, y: 0, z: 34, facing: Math.PI },   // south entrance, facing the square
    study:   { plot: 'life-atomic' },                    // outside the Atomic Habits district (Life Skills road)
    reading: { x: -18, y: 0, z: -26.5, facing: 0 },     // outside the Reading Room door, facing the square
    tower:   { x: -26.6, y: 0, z: -16, facing: Math.PI / 2 } // outside the Habit Tower door, facing the square
  },

  /* ---------------- Habit Tower (obby) ---------------- */
  tower: {
    targetMs: 120000,      // finish under this for the Speed Habit badge
    ghostHz: 20,           // ghost replay sample rate
    // The new moves work in the tower, but a full super jump + double jump
    // could skip half a lap of the spiral, so the super jump is capped here.
    moveOverrides: { superJumpMax: 1.55 }
  },

  /* ---------------- movement playground (Part B) ----------------
     Positions are world metres. Each kind is handled by js/gadgets.js. */
  gadgets: {
    // mushrooms: launch = height in metres (ground pound onto one for poundBounceFactor × more)
    bouncePads: [
      { x: 13, z: 13, launch: 8.5 },
      { x: -18, z: 3, launch: 8 }
    ],
    // jump rings refresh your air jumps and fling you toward the next ring;
    // `exit` is where the last ring of a chain sends you.
    ringChains: [
      { rings: [[13, 7.5, 12.4], [15, 10, 2], [17, 11, -6], [18.5, 11.5, -14], [19, 11.5, -20.5], [18, 11.5, -27]],
        exit: [20, 9.3, -35], speed: 11 }
    ],
    // ziplines: a (top) → b (bottom). Jump up into the cable to grab it.
    ziplines: [
      { a: [25, 16.6, -22.3], b: [20, 3.8, 19] },
      { a: [13, 11.7, -36], b: [-11, 10.7, -36] }
    ],
    // grind rails: land on them from above; you ride in the direction you were moving
    rails: [
      { a: [-28.4, 1.0, 18], b: [-28.4, 1.0, -22], posts: true },
      { a: [-10.5, 1.45, 40], b: [10.5, 1.45, 40], posts: false },
      { a: [-30.5, 7.6, 9], b: [-12, 1.2, 9], posts: true, cable: true }
    ],
    cannons: [
      { x: -13, z: 21, yaw: Math.PI * 0.82, pitch: 0.72, speed: 31 }
    ],
    // ladders / ivy on a building face; normal points away from the wall
    ladders: [
      { x: 11.2, z: -29.95, nx: 0, nz: 1, top: 6.3, style: 'ladder' },
      { x: -29.95, z: 6, nx: 1, nz: 0, top: 7.3, style: 'ladder' },
      { x: 29.95, z: 24, nx: -1, nz: 0, top: 5.3, style: 'ivy' }
    ],
    // updraft vents only lift you while gliding
    vents: [
      { x: 8, z: -18, top: 17 },
      { x: -2, z: -20, top: 14 }
    ],
    speedPads: [
      { x: 0, z: 22, dx: 0, dz: -1 },
      { x: 18, z: 4, dx: 0, dz: -1 }
    ],
    // cracked crates: break with a ground pound. `golden` releases that golden coin the first time.
    crates: [
      { id: 'k1', x: -12, y: 8.3, z: -40, golden: 'g8' },
      { id: 'k2', x: 36, y: 9.3, z: -40 },
      { id: 'k3', x: 3.6, y: 11.5, z: -11.4 },
      { id: 'k4', x: -39.5, y: 0, z: -0.6 },
      { id: 'k5', x: 40, y: 4.3, z: 12 }
    ],
    // floating platforms [x, top, z, w, d]
    islands: [
      { x: 2, top: 11.5, z: -10, w: 5, d: 5, name: 'Book Island' }
    ],
    // glowing boost orbs in the world (same boosts as the shop, free, respawn)
    orbs: [
      { boost: 'rocket', x: -8, y: 1.2, z: 22 },
      { boost: 'speed',  x: 6,  y: 1.2, z: 22 },
      { boost: 'magnet', x: -8, y: 1.2, z: -4 }
    ],
    shop: { x: -19.4, z: 22.2, r: 2.6 }
  },

  /* ---------------- time trials ----------------
     Gates are passed in order; the last one is the finish. Medal times in ms. */
  trials: [
    { id: 'square', name: 'Square Sprint', board: 'trial-square', color: 0x2f9e9a,
      start: { x: 6, z: 25, facing: Math.PI },
      gates: [[6, 1.5, 13], [17, 1.5, 2], [7, 1.5, -13], [-7, 1.5, -13], [-17, 1.5, 2], [-6, 1.5, 13], [1, 1.5, 21]],
      radius: 2.4, medals: { gold: 13500, silver: 17000, bronze: 23000 } },
    { id: 'roofs', name: 'Rooftop Run', board: 'trial-roofs', color: 0xe9a23b,
      start: { x: 23, z: 2, facing: 0.4 },
      gates: [[29, 3.9, 9], [37, 5.4, 6], [37, 6.9, -10], [25, 15.6, -25], [20, 1.8, 17]],
      radius: 2.6, medals: { gold: 30000, silver: 42000, bronze: 60000 } },
    { id: 'sky', name: 'Sky Route', board: 'trial-sky', color: 0x6a5acd,
      start: { x: 11, z: 18, facing: Math.PI },
      gates: [[13, 7.5, 12.4], [18.5, 11.5, -14], [20, 10.4, -36], [-14, 9.6, -37], [-7, 1.6, -27]],
      radius: 2.6, medals: { gold: 26000, silver: 34000, bronze: 48000 } }
  ],

  /* ---------------- buildings ----------------
     Footprint is [x0, x1] × [z0, z1], height h. `door` faces the square.
     status: 'live' (enterable), 'locked' (coming soon), or 'filler' (no door). */
  buildings: [
    // The old columned library is now the Reading Room (A1 §2 / Build Day). Narrowed
    // on its west side so the Family road can squeeze out past it.
    { id: 'reading',  name: 'Reading Room', sign: 'Reading Room', status: 'live', open: 'reading', icon: '📖',
      x0: -26, x1: -8,  z0: -44, z1: -30, h: 8,   wall: P.cream, trim: P.wood, roof: P.slate, style: 'library',
      door: { face: 'south', at: -18 } },
    // The Secret Room: The Study, the original escape room — unchanged, behind this door.
    { id: 'secret',   name: 'The Secret Room', sign: 'Secret Room', status: 'live', href: '../the-study/', icon: '🗝️',
      x0: -2,  x1: 12,  z0: -44, z1: -30, h: 6,   wall: P.brick, trim: P.cream, roof: P.darkWood, style: 'shop',
      door: { face: 'south', at: 5 } },
    { id: 'townhall', name: 'Town Hall',  status: 'filler',
      x0: 12,  x1: 44,  z0: -44, z1: -30, h: 9,   wall: P.stone, trim: P.slate, roof: P.moss, style: 'hall' },
    { id: 'nw-house', name: 'House',      status: 'filler',
      x0: -44, x1: -33.5, z0: -44, z1: -30, h: 5, wall: P.sage, trim: P.white, roof: P.brick, style: 'house' },

    { id: 'e-house',  name: 'House',      status: 'filler',
      x0: 30,  x1: 44,  z0: -30, z1: -3,   h: 5.5, wall: P.grape, trim: P.gold, roof: P.navy, style: 'house' },
    // The café is open: it's where the White Rabbit quest starts.
    { id: 'cafe',     name: 'Café',       sign: 'Café', status: 'open',
      x0: 30,  x1: 44,  z0: 3,   z1: 16,  h: 4,   wall: P.peach, trim: P.darkWood, roof: P.wood, style: 'cafe',
      door: { face: 'west', at: 11 } },
    { id: 'se-house', name: 'House',      status: 'filler',
      x0: 30,  x1: 44,  z0: 22,  z1: 44,  h: 5,   wall: P.butter, trim: P.white, roof: P.slate, style: 'house' },

    { id: 'tower',    name: 'Habit Tower', sign: 'Habit Tower', status: 'live', href: 'tower/', icon: '🗼',
      x0: -44, x1: -30, z0: -30, z1: -1.5, h: 6,  wall: P.powder, trim: P.navy, roof: P.slate, style: 'tower',
      door: { face: 'east', at: -16 } },
    { id: 'w-house',  name: 'House',      status: 'filler',
      x0: -44, x1: -30, z0: 4, z1: 28,    h: 7,   wall: P.berry, trim: P.butter, roof: P.ink, style: 'house' },
    { id: 'sw-house', name: 'House',      status: 'filler',
      x0: -44, x1: -33.5, z0: 30, z1: 44, h: 4.5, wall: P.lilac, trim: P.white, roof: P.plum, style: 'house' },

    { id: 's-house-1', name: 'House',     status: 'filler',
      x0: -26, x1: -11, z0: 30,  z1: 44,  h: 5,   wall: P.powder, trim: P.white, roof: P.brick, style: 'house' },
    { id: 's-house-2', name: 'House',     status: 'filler',
      x0: 11,  x1: 28,  z0: 30,  z1: 44,  h: 5.5, wall: P.peach, trim: P.white, roof: P.moss, style: 'house' }
  ],

  /* ---------------- library roads (A1 §2) ----------------
     Seven roads, one per quarter, leave Library Square through gaps in the ring
     of buildings. `gate` is where the arch stands, `out` is where the road
     leaves the town, then it runs on at `angle` (degrees; 0 = +x/east,
     90 = +z/south). Plots are placed along it from catalogue order — nothing
     about books is hard-coded here. */
  roads: [
    { quarter: 'fantasy',   gate: [-5, -29.4],   out: [-5, -47],    angle: 270, width: 5.5 },
    { quarter: 'family',    gate: [-28, -29.4],  out: [-29.5, -47], angle: 225, width: 3.8 },
    { quarter: 'life',      gate: [-29.4, 1.25], out: [-47, 1.25],  angle: 180, width: 5 },
    { quarter: 'animals',   gate: [-29, 29.4],   out: [-29.5, 47],  angle: 135, width: 4.5 },
    { quarter: 'adventure', gate: [0, 29.4],     out: [0, 47],      angle: 90,  width: 5.5 },
    { quarter: 'scifi',     gate: [29.4, 19],    out: [47, 19],     angle: 45,  width: 5.5 },
    { quarter: 'mystery',   gate: [29.4, 0],     out: [47, 0],      angle: 0,   width: 5.5 }
  ],
  plots: {
    maxPerRoad: 6,      // the rest of the road fades into "more coming"
    first: 22,          // metres past `out` to the first plot
    spacing: 23,        // metres between plots (they alternate sides of the road)
    offset: 11,         // sideways distance from the road centre to the plot centre
    size: [12, 9],      // building footprint (along the road, away from it)
    yard: 26            // side quest items are scattered within this square around a plot
  },

  /* ---------------- Lookout Towers (A1 §3) ----------------
     A reusable prefab: everything about a tower is here. `at` is metres along
     its road past `out`, `side` is which side of the road (±1). Presets live in
     js/lookout.js. `requiresKey` (a book id) puts a gate round the base. */
  lookoutTowers: [
    { id: 'fantasy', quarter: 'fantasy', at: 4, side: -1, height: 24, preset: 'spiral', requiresKey: null }
  ],
  // Only built with ?debug=1: tests the requiresKey gate message.
  debugTowers: [
    { id: 'debug-mystery', quarter: 'mystery', at: 4, side: 1, height: 16, preset: 'zigzag', requiresKey: 'mys-holmes-3' }
  ],

  /* ---------------- side quests (A1 §5) ----------------
     Run by js/sidequests.js. Step types: talk (interact with an NPC),
     collect (pick up items by id), deliver (bring items to targets),
     reach (go to points; an `actor` can hop ahead of you).
     Positions are world metres. `plot:<bookId>` means "at that book's plot".
     District side quests live in each book.json and use the same format. */
  npcs: [
    { id: 'librarian', name: 'the Librarian', kind: 'person', at: [-13.5, 0, -27.2], facing: 0,
      look: { skin: 0xc68a5a, hair: 0x2a1a12, shirt: 0x1f3b2c, pants: 0x3a3a46, shoes: 0x2a2420 } },
    { id: 'rabbit', name: 'the White Rabbit', kind: 'rabbit', at: [20, 0, 9], facing: -Math.PI / 2 }
  ],
  sideQuests: [
    { id: 'lost-books', title: 'Lost Books', giver: 'librarian',
      steps: [
        { type: 'talk', params: { npc: 'librarian' },
          text: 'Talk to the Librarian on the Reading Room steps.',
          say: 'Oh, what a muddle! Seven books have wandered off. Every road out of the square is one part of the library — Fantasy, Adventure, Mystery and the rest — and each road has a little shelf under its arch. Could you find the books and put each one back on its own shelf? Match the colour and the picture on the cover.' },
        { type: 'collect', params: { items: [
            { id: 'lb-fantasy',   quarter: 'fantasy',   at: [-16, 0.7, 10] },
            { id: 'lb-adventure', quarter: 'adventure', at: [18, 0.7, -7] },
            { id: 'lb-animals',   quarter: 'animals',   at: [-21, 0.7, -3] },
            { id: 'lb-family',    quarter: 'family',    at: [-5, 0.7, 20] },
            { id: 'lb-mystery',   quarter: 'mystery',   at: [-5, 0.7, -62] },
            { id: 'lb-scifi',     quarter: 'scifi',     at: [2, 0.7, 60] },
            { id: 'lb-life',      quarter: 'life',      at: [60, 0.7, 3] }
          ] },
          text: 'Find the seven lost books around the square and just outside town.' },
        { type: 'deliver', params: { pairs: [
            { item: 'lb-fantasy', target: 'shelf:fantasy' }, { item: 'lb-adventure', target: 'shelf:adventure' },
            { item: 'lb-animals', target: 'shelf:animals' }, { item: 'lb-family', target: 'shelf:family' },
            { item: 'lb-mystery', target: 'shelf:mystery' }, { item: 'lb-scifi', target: 'shelf:scifi' },
            { item: 'lb-life', target: 'shelf:life' } ] },
          text: 'Put each book on the shelf under its own road\'s arch.' },
        { type: 'talk', params: { npc: 'librarian' },
          text: 'Tell the Librarian the shelves are tidy.',
          say: 'Every book back where it belongs! Now you know how the library works: pick a road for the kind of story you like, and the easier books are nearest the square.' }
      ],
      reward: { coins: 40, badge: 'shelver' } },
    { id: 'white-rabbit', title: 'The White Rabbit', giver: 'rabbit',
      steps: [
        { type: 'reach', params: { actor: 'rabbit', radius: 2.2, points: [[20, 9], [12, 17], [-3, 15], [-13, 5], [-9, -11], [-5, -20]] },
          text: 'A white rabbit with a pocket watch is hurrying through the square. Catch him!',
          say: 'Oh dear! Oh dear! I shall be too late!' },
        { type: 'talk', params: { npc: 'rabbit' },
          text: 'Talk to the White Rabbit.',
          say: 'Oh my ears and whiskers, how late it\'s getting! I\'ve lost my way home — it\'s somewhere up the Fantasy road, past all that fog. Will you walk with me?' },
        { type: 'reach', params: { actor: 'rabbit', lead: true, radius: 4, points: [[-5, -29], [-5, -50], 'plot:fan-alice-1'] },
          text: 'Follow the White Rabbit up the Fantasy road.' },
        { type: 'talk', params: { npc: 'rabbit' },
          text: 'Talk to the White Rabbit at the edge of Wonderland.',
          say: 'Here we are — Wonderland! But the way is still shut. Come back when the way opens! And thank you — you\'re much quicker than I am.' }
      ],
      reward: { coins: 30, badge: 'rabbit-chaser' } }
  ],

  /* ---------------- library noticeboards (A1 §6) ----------------
     These were third-party ad placeholders. They now show our own posters
     (district "coming soon" / "open now", drawn by js/posters.js from the
     catalogue). The structure is kept so sponsor placements can come back
     later, clearly labelled — but there are no external links in this phase:
     `link` must stay null. Position is the centre of the panel; rotationY
     turns it to face the square; size is [width, height]. `poster` picks
     what to draw: 'coming-soon' (rotates through planned books), 'open-now'
     (live districts), 'quarters' (the seven roads), 'reading-room'. */
  adSlots: [
    { id: 'board-north',  poster: 'open-now',     link: null, label: 'Library noticeboard',
      position: [5, 8.4, -30.75], rotationY: 0, size: [9, 3.6] },
    { id: 'board-west',   poster: 'quarters',     link: null, label: 'Library noticeboard',
      position: [-25.55, 4.5, 23], rotationY: Math.PI / 2, size: [5.6, 2.24] },
    { id: 'board-east',   poster: 'coming-soon',  link: null, label: 'Library noticeboard',
      position: [29.94, 4.25, -16], rotationY: -Math.PI / 2, size: [8, 1.6] },
    { id: 'tower-banner', poster: 'reading-room', link: null, label: 'Library noticeboard',
      position: [-31.94, 17, -16], rotationY: Math.PI / 2, size: [3, 7.5] },
    // scene: 'tower' slots render inside the Habit Tower, not in the town square
    { id: 'tower-interior', poster: 'coming-soon', link: null, label: 'Library noticeboard', scene: 'tower',
      position: [0, 6, -9.9], rotationY: 0, size: [7, 2.8] },
    { id: 'bus-stop',     poster: 'coming-soon',  link: null, label: 'Library noticeboard',
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
    // path to the Reading Room
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
    { id: 'c49', x: -12, y: 1, z: 14 }, { id: 'c50', x: 12, y: 1, z: -4 },
    // ---- Phase 3: coins that sit on the new movement routes ----
    // jump-ring sky route
    { id: 'c51', x: 15, y: 10, z: 2 }, { id: 'c52', x: 18.5, y: 11.5, z: -14 },
    // under the ziplines (you pass through them while riding)
    { id: 'c53', x: 23.5, y: 11.66, z: -10.75 }, { id: 'c54', x: 22, y: 7.82, z: 2 }, { id: 'c55', x: 1, y: 10.1, z: -36 },
    // cinema cable rail
    { id: 'c56', x: -24, y: 6.25, z: 9 }, { id: 'c57', x: -18.5, y: 4.35, z: 9 },
    // (moved in Chapterlands A1) the start of the Fantasy road
    { id: 'c58', x: -5, y: 1, z: -35 }, { id: 'c59', x: -5, y: 1, z: -39 }, { id: 'c60', x: -5, y: 1, z: -43 },
    // Book Island + the updraft that leads to it
    { id: 'c61', x: 0.5, y: 12.4, z: -11.5 }, { id: 'c62', x: 3.5, y: 12.4, z: -8.5 }, { id: 'c63', x: -2, y: 9, z: -20 }
  ],

  goldenCoins: [
    { id: 'g1', x: 40,  y: 6.6,  z: -20,  hint: 'arcade roof' },
    { id: 'g2', x: 25,  y: 15.6, z: -25,  hint: 'clock tower top' },
    { id: 'g3', x: -26, y: 7.0,  z: 23,   hint: 'billboard top' },
    { id: 'g4', x: -42, y: 1.1,  z: 0,    hint: 'back alley' },
    { id: 'g5', x: 0,   y: 1.1,  z: -5.6, hint: 'behind the fountain' },
    { id: 'g6', x: 30,  y: 10.4, z: -38,  hint: 'town hall roof (end of the sky rings)' },
    { id: 'g7', x: 2,   y: 12.6, z: -10,  hint: 'Book Island (glide there)' },
    { id: 'g8', x: -12, y: 9.1,  z: -40,  hint: 'cracked crate on the Reading Room roof', crate: 'k1' }
  ],

  badges: [
    { id: 'first-coin',     name: 'First Coin',      desc: 'Pick up your first coin.',            icon: '🪙' },
    { id: 'rooftop-runner', name: 'Rooftop Runner',  desc: 'Reach the top of the clock tower.',   icon: '🕰️' },
    { id: 'golden-hunter',  name: 'Golden Hunter',   desc: 'Find every golden coin.',             icon: '⭐' },
    { id: 'collector',      name: 'Collector',       desc: 'Collect every coin in town.',         icon: '💰' },
    { id: 'habit-breaker',  name: 'Habit Breaker',   desc: 'Escape the Atomic Habits study.',    icon: '📘' },
    { id: 'tower-climber',  name: 'Tower Climber',   desc: 'Reach the top of the Habit Tower.',   icon: '🗼' },
    { id: 'speed-habit',    name: 'Speed Habit',     desc: 'Climb the Habit Tower in under 2:00.', icon: '⚡' },
    { id: 'new-moves',      name: 'New Moves',       desc: 'Buy your first move at the shop stall.', icon: '🛒' },
    { id: 'combo-king',     name: 'Combo King',      desc: 'Chain 8 tricks without touching the ground.', icon: '🔥' },
    { id: 'trial-gold',     name: 'Gold Rush',       desc: 'Win a gold medal in a time trial.',   icon: '🥇' },
    { id: 'all-trials',     name: 'Course Record',   desc: 'Finish all three time trials.',       icon: '🏁' },
    // Chapterlands A1
    { id: 'shelver',        name: 'Shelver',         desc: 'Return all seven lost books to their shelves.', icon: '📚' },
    { id: 'rabbit-chaser',  name: 'Rabbit Chaser',   desc: 'Catch the White Rabbit and help him home.',    icon: '🐇' },
    { id: 'lookout',        name: 'Lookout',         desc: 'Climb a Lookout Tower and lift the fog.',      icon: '🔭' },
    { id: 'first-check',    name: 'Good Reader',     desc: 'Pass your first reading check.',               icon: '✅' },
    { id: 'sky-runner',     name: 'Sky Runner',      desc: 'Finish a Sky Run.',                            icon: '☁️' },
    { id: 'vault-cracker',  name: 'Vault Cracker',   desc: 'Crack a district Vault.',                      icon: '🗝️' }
    // District badges (First Book, Through the Glass, …) are declared in each
    // book's content/<quarter>/<id>/book.json under unlock.badges.
  ],

  // clock tower footprint + top height (used for the Rooftop Runner badge)
  clockTower: { x0: 22, x1: 28, z0: -28, z1: -22, h: 14.5 }
};

export default CONFIG;
