// Tuning constants for Orchid Keys: city grid, physics step, crowd sizes and colours.
// Every system reads its numbers from here so balancing happens in one place.

export const GAME_TITLE = 'Orchid Keys';

/** The island city is a square grid of blocks with roads on every grid line. */
export const CITY = {
  blocks: 10,          // blocks per side
  pitch: 72,           // distance between road centre lines (m)
  roadWidth: 12,       // full asphalt width
  sidewalk: 3.5,       // sidewalk ring around each block
  beach: 70,           // sand ring between the outer boulevard and the sea
  get half() { return (this.blocks * this.pitch) / 2; },
  get islandHalf() { return this.half + this.beach; },
};

export const STEP = 1 / 60;
export const MAX_FRAME_STEPS = 5;

export const TRAFFIC = { count: 24, spawnMin: 70, spawnMax: 165, despawn: 230, cruise: 13 };
export const PEDS = { count: 44, spawnMin: 25, spawnMax: 120, despawn: 150, walk: 1.5, run: 5.5 };
export const POLICE = {
  carsPerStar: [0, 1, 2, 4, 5, 6],
  footCopsPerStar: [0, 1, 2, 3, 4, 4],
  spawnMin: 90, spawnMax: 150,
  sightRange: 95,
  evadeSeconds: [0, 8, 11, 15, 19, 24],
  roadblockFromStars: 3,
  heliFromStars: 4,
};

export const PLAYER = { walk: 2.6, sprint: 6.2, turn: 10, radius: 0.45, maxHealth: 100, maxArmor: 100 };

/** Golden-hour palette shared by sky, fog, lighting and UI accents. */
export const PALETTE = {
  skyTop: 0x1f2a6b,
  skyMid: 0xe0705a,
  horizon: 0xffb070,
  sun: 0xffb36b,
  fog: 0xf0946c,
  hemiSky: 0xffd1a8,
  hemiGround: 0x5a4a6a,
  sea: 0x1b8fa3,
  seaDeep: 0x0d4d6e,
  sand: 0xe8cf9f,
  grass: 0x6f9a4a,
  asphalt: 0x3b3d45,
  sidewalk: 0xb9ada0,
  neonPink: 0xff3fa4,
  neonCyan: 0x33f0ff,
  neonPurple: 0xb04bff,
};

export const SAVE_KEY = 'orchid-keys-save-v1';
