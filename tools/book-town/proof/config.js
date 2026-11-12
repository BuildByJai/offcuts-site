// Book Town graphics proof — tunables. Units: metres, seconds.
// The square layout (building footprints, spawns, ad slots) comes from the
// current town's config so the proof is the same place, re-dressed.
import { CONFIG as TOWN } from '../config.js';

export const PROOF = {
  town: TOWN,

  render: {
    exposure: 1.12,
    toneMapping: 'aces',           // 'agx' | 'aces'
    envIntensity: 1.0,
    envClamp: 11,                  // lighting copy of the HDRI is clamped here (sun comes from the DirectionalLight)
    fogColor: 0xd9e7f2,           // overridden per preset
    fogNear: 80, fogFar: 260,
    // Post-processing (High tier). Medium drops AO; Low drops everything.
    ao: { strength: 0.6, radius: 0.3, scale: 1.0, thickness: 1.0, distanceExponent: 1.0, distanceFallOff: 1.0 },
    bloom: { strength: 0.14, radius: 0.55, threshold: 1.05 },
    grade: { warmth: 0.035, lift: 0.01, saturation: 1.14, contrast: 1.06, vignette: 0.2 },
    dof: { enabled: true, aperture: 0.00006, maxBlur: 0.012, minDistance: 11 }   // only when the camera is zoomed out
  },

  // Time-of-day presets. The HDRI lights everything (image-based lighting);
  // the sun direction is read off the brightest pixel of each HDRI at load.
  presets: {
    morning: { label: 'Morning',     hdri: 'assets/hdri/autumn_field_puresky_1k.hdr',               exposure: 1.25, sun: { color: 0xfff0d2, intensity: 2.6 }, env: 1.3, fog: 0xdfe9ef, fogNear: 70, fogFar: 230, sky: 1.0 },
    midday:  { label: 'Midday',      hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr', exposure: 1.0, sun: { color: 0xfff6e6, intensity: 3.0 }, env: 1.25,  fog: 0xcfe2f4, fogNear: 85, fogFar: 270, sky: 1.0 },
    golden:  { label: 'Golden hour', hdri: 'assets/hdri/kloppenheim_06_puresky_1k.hdr',               exposure: 1.3, sun: { color: 0xffc98a, intensity: 2.8 }, env: 1.25,  fog: 0xf0d9bd, fogNear: 60, fogFar: 200, sky: 1.0 }
  },
  defaultPreset: 'midday',

  tiers: {
    low:    { pixelRatio: 1,   shadows: false, cascades: 0, shadowMap: 0,    ao: false, bloom: false, dof: false, aa: 'fxaa', grass: 0.18, props: 0.5, npcs: 2, anisotropy: 2 },
    medium: { pixelRatio: 1.5, shadows: true,  cascades: 2, shadowMap: 1024, ao: false, bloom: true,  dof: false, aa: 'fxaa', grass: 0.5,  props: 1,   npcs: 3, anisotropy: 4 },
    high:   { pixelRatio: 2,   shadows: true,  cascades: 3, shadowMap: 2048, ao: true,  bloom: true,  dof: true,  aa: 'smaa', grass: 1,    props: 1,   npcs: 5, anisotropy: 8 }
  },
  // Sun shadows. 'single' = one soft 2048 map that follows the player (64 m square, texel-snapped).
  // 'csm' = three.js CSMShadowNode; in r170 it drops casters that sit between cascades, so it's off by default (?shadow=csm to compare).
  shadow: { mode: 'single', intensity: 0.8, maxFar: 70, lightMargin: 40, bias: -0.00025, normalBias: 0.02, singleRange: 34 },
  autoDrop: { belowFps: 28, forSec: 5 },

  camera: {
    fov: 50, distance: 6.5, minDistance: 2.2, maxDistance: 34,
    pitch: 0.3, minPitch: -0.2, maxPitch: 1.3,
    pivotHeight: 1.45, mouseSensitivity: 0.0045, touchSensitivity: 0.007,
    posDamping: 9, rotDamping: 10, lookAhead: 0.9, sprintFov: 7,
    overviewFrom: 14,            // past this distance the camera tilts up towards a dollhouse view
    overviewPitch: 0.95
  },

  movement: {
    walkSpeed: 2.2, jogSpeed: 4.2, sprintSpeed: 6.2,
    accelTime: 0.32, stopTime: 0.22, airControl: 0.5,
    jumpHeight: 1.25, shortHopFactor: 2.2, gravity: 22, terminalVelocity: 30,
    coyoteTime: 0.12, jumpBuffer: 0.12, turnSpeed: 9,
    radius: 0.3, height: 1.72, stepHeight: 0.35, snapDistance: 0.3, maxSlopeDeg: 50,
    joystickSprintAt: 0.85, fixedHz: 60
  },

  // Buildings: footprints from the town config; look per style here.
  // wall/roof name a texture set (assets/textures/<set>_col|nrm|arm.webp);
  // tint is multiplied into the albedo (soft pastel + natural materials).
  styles: {
    library: { wall: 'white_plaster_02',  tint: 0xfdf9f0, roof: 'roof_slates_02',     roofTint: 0xb8bcc4, trim: 0xfaf6ee, accent: 0x5a4636, pitched: false },
    shop:    { wall: 'Bricks075A',        tint: 0xd9a58e, roof: 'clay_roof_tiles_02', roofTint: 0xd2a07c, trim: 0xfaf4e6, accent: 0x3f6b4a, pitched: true },
    hall:    { wall: 'painted_plaster_wall', tint: 0xe6dfd0, roof: 'grey_roof_tiles_02', roofTint: 0xaaa9a4, trim: 0xf7f2e8, accent: 0x6b6459, pitched: true },
    house:   { wall: 'PaintedPlaster017', tint: 0xffffff,  roof: 'clay_roof_tiles_02', roofTint: 0xc9856a, trim: 0xfbf8f1, accent: 0x4d5f6e, pitched: true },
    cafe:    { wall: 'PaintedPlaster012', tint: 0xf6dcc0,  roof: 'roof_slates_02',     roofTint: 0x9aa0a8, trim: 0xfff9f0, accent: 0x7a4a2e, pitched: true },
    cinema:  { wall: 'red_brick',         tint: 0xd6b6ae,  roof: 'grey_roof_tiles_02', roofTint: 0x8f8f93, trim: 0xf6e8c8, accent: 0x8a2d36, pitched: false },
    tower:   { wall: 'beige_wall_001',    tint: 0xe3ded2,  roof: 'roof_slates_02',     roofTint: 0x8c929c, trim: 0xf5f2ea, accent: 0x2f3b4a, pitched: false }
  },
  // pastel tints for the plain-plaster houses (by building id)
  houseTints: { 'nw-house': 0xcfe0c6, 'se-house': 0xf7e6b8, 'sw-house': 0xe6d6ec, 's-house-1': 0xcfe1ef, 's-house-2': 0xf7dcc8 },

  grass: { bladeHeight: 0.22, bladeWidth: 0.032, density: 95, windAmp: 0.07, windSpeed: 1.4 },
  water: { color: 0x86c3dc, deep: 0x3f8aa8 },

  // Ambient life
  life: { birds: 7, butterflies: 8, npcs: 5 },

  debugDefault: { physics: false }
};

export default PROOF;
