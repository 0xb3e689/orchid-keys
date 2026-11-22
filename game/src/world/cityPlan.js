// The layout of Orchid Keys as plain data: the road grid, the five districts, the named
// landmarks the story uses, and the building footprints each block gets. Nothing here
// touches three.js, so AI, minimap and missions can all read the same plan.
import { CITY } from '../config.js';
import { createRng } from '../core/rng.js';

const H = CITY.half;
const P = CITY.pitch;
/** Half-size of the buildable lot inside a block's sidewalk ring. */
export const LOT_HALF = P / 2 - CITY.roadWidth / 2 - CITY.sidewalk;

export const DISTRICTS = {
  port: { name: 'Port Halcyon', map: '#6f6a66', ground: 0x8c8780 },
  heights: { name: 'Palmetto Heights', map: '#5f8a52', ground: 0x6f9a4a },
  meridian: { name: 'Meridian', map: '#6d7388', ground: 0xa9a39b },
  lumen: { name: 'Lumen Strip', map: '#7a4f86', ground: 0x6e6274 },
  coral: { name: 'Coral Beach', map: '#c9a77a', ground: 0xd9c7a2 },
};

export const roadLine = (i) => -H + i * P;
export const blockCenter = (b) => -H + (b + 0.5) * P;

export function districtOfBlock(bx, bz) {
  if (bx <= 1) return 'port';
  if (bz <= 2) return 'heights';
  if (bx >= 7 && bz <= 7) return 'lumen';
  if (bz >= 7) return 'coral';
  return 'meridian';
}

export function blockAt(x, z) {
  const bx = Math.floor((x + H) / P);
  const bz = Math.floor((z + H) / P);
  if (bx < 0 || bz < 0 || bx >= CITY.blocks || bz >= CITY.blocks) return null;
  return { bx, bz };
}

/** District id for any world point (the beach ring and docks count as their nearest district). */
export function districtAt(x, z) {
  const bx = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((x + H) / P)));
  const bz = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((z + H) / P)));
  if (x < -H) return 'port';
  if (z > H || x > H) return 'coral';
  return districtOfBlock(bx, bz);
}

/** True when (x, z) is on asphalt (any road line, including the coastal boulevard). */
export function isOnRoad(x, z) {
  const hw = CITY.roadWidth / 2;
  if (Math.abs(x) > H + hw || Math.abs(z) > H + hw) return false;
  const rx = ((x + H) % P + P) % P;
  const rz = ((z + H) % P + P) % P;
  return rx < hw || rx > P - hw || rz < hw || rz > P - hw;
}

/** Edge point of a block on its south sidewalk, where markers and doors sit. */
const frontOf = (bx, bz, side = 'south') => {
  const cx = blockCenter(bx);
  const cz = blockCenter(bz);
  const e = LOT_HALF + CITY.sidewalk * 0.6;
  if (side === 'south') return { x: cx, z: cz + e, facing: 0 };
  if (side === 'north') return { x: cx, z: cz - e, facing: Math.PI };
  if (side === 'east') return { x: cx + e, z: cz, facing: Math.PI / 2 };
  return { x: cx - e, z: cz, facing: -Math.PI / 2 };
};

/** Named places of the island. `block` lots are kept free of random buildings. */
export const LANDMARKS = {
  safehouse: { name: "Mama Ro's Suds & Spin", block: [4, 1], ...frontOf(4, 1), blip: 'home', color: '#7cf29a' },
  garage: { name: "Tiko's Body Shop", block: [1, 4], ...frontOf(1, 4, 'east'), blip: 'garage', color: '#ffd23f' },
  gunShop: { name: 'Gulfside Arms', block: [2, 5], ...frontOf(2, 5), blip: 'gun', color: '#ff6b6b' },
  police: { name: 'OKPD Central Station', block: [5, 4], ...frontOf(5, 4), blip: 'police', color: '#5aa9ff' },
  hospital: { name: 'Mercy Palms Hospital', block: [3, 2], ...frontOf(3, 2), blip: 'hospital', color: '#ffffff' },
  club: { name: 'The Velvet Lagoon', block: [8, 4], ...frontOf(8, 4, 'west'), blip: 'club', color: '#ff3fa4' },
  gazette: { name: 'Orchid Gazette', block: [6, 6], ...frontOf(6, 6, 'north'), blip: 'paper', color: '#f5f5f5' },
  couriers: { name: 'Coconut Couriers', block: [8, 8], ...frontOf(8, 8, 'north'), blip: 'courier', color: '#ffa94d' },
  plaza: { name: 'Meridian Plaza', block: [4, 4], ...frontOf(4, 4), blip: null, color: '#ffffff', park: true },
  park: { name: 'Orchid Park', block: [6, 1], ...frontOf(6, 1), blip: null, color: '#ffffff', park: true },
  saltOrchid: { name: 'The Salt Orchid', block: null, x: blockCenter(5), z: H + 24, facing: 0, blip: 'bar', color: '#ffb36b' },
  yacht: { name: "Shore's yacht, the Gilded Heron", block: null, x: -H - 58, z: blockCenter(6), facing: -Math.PI / 2, blip: 'boat', color: '#c084fc' },
  marina: { name: 'Halcyon Marina', block: null, x: -H - 40, z: blockCenter(8), facing: -Math.PI / 2, blip: null, color: '#ffffff' },
  raceStart: { name: 'Sunset Sprint', block: null, x: roadLine(2) + 20, z: H, facing: Math.PI / 2, blip: 'race', color: '#ffe066' },
};

const landmarkBlocks = new Map();
for (const [id, lm] of Object.entries(LANDMARKS)) {
  if (lm.block) landmarkBlocks.set(lm.block[0] + ',' + lm.block[1], id);
}
export const landmarkOnBlock = (bx, bz) => landmarkBlocks.get(bx + ',' + bz) ?? null;

const PASTELS = [0x9fe3c9, 0xf7b2c1, 0xffcf9e, 0xc9b6f2, 0xfff0a8, 0xa8d8ff, 0xffffff, 0xf4d6c6];
const GLASS = [0x8fa6c4, 0xd9dde3, 0x6f8fb3, 0xc8bfae, 0xa3b8c9, 0x9aa5b8];
const NEON_FACADES = [0x3b2a52, 0x4a2142, 0x24324f, 0x5a3a6e, 0x2f2f3f];
const INDUSTRIAL = [0x8a7b6b, 0x9c5a3c, 0x6b7a80, 0xa39a8a, 0x5e6b5a];

/**
 * Every building footprint in the city: { x, z, w, d, h, color, style, district }.
 * The style picks the facade shader settings (windows, storefronts, signage space).
 */
export function planBuildings() {
  const rng = createRng(7741);
  const out = [];
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const district = districtOfBlock(bx, bz);
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const lm = landmarkOnBlock(bx, bz);
      if (lm) {
        out.push(...landmarkBuildings(lm, cx, cz, district));
        continue;
      }
      const add = (x, z, w, d, h, color, style) => out.push({ x: cx + x, z: cz + z, w, d, h, color, style, district });
      const L = LOT_HALF;
      if (district === 'meridian') {
        const q = L / 2;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if (rng.chance(0.15)) continue;
          const w = rng.range(17, 23);
          const d = rng.range(17, 23);
          const h = rng.range(32, 105) * (bx === 4 || bx === 5 ? 1.15 : 1);
          add(sx * q, sz * q, w, d, h, rng.pick(GLASS), 'tower');
        }
      } else if (district === 'lumen') {
        const cols = 3;
        const span = (2 * L) / cols;
        for (let i = 0; i < cols; i++) {
          for (const sz of [-1, 1]) {
            const x = -L + span * (i + 0.5);
            add(x, sz * L * 0.5, span - 2, L - 3, rng.range(10, 30), rng.pick(NEON_FACADES), 'club');
          }
        }
      } else if (district === 'coral') {
        add(0, -L * 0.45, L * 1.7, L * 0.8, rng.range(16, 34), rng.pick(PASTELS), 'deco');
        if (rng.chance(0.7)) add(-L * 0.5, L * 0.5, L * 0.8, L * 0.75, rng.range(9, 18), rng.pick(PASTELS), 'deco');
        if (rng.chance(0.5)) add(L * 0.55, L * 0.55, L * 0.7, L * 0.7, rng.range(8, 14), rng.pick(PASTELS), 'deco');
      } else if (district === 'heights') {
        for (const gx of [-1, 0, 1]) {
          for (const gz of [-1, 0, 1]) {
            if (rng.chance(0.25) || (gx === 0 && gz === 0)) continue;
            const w = rng.range(8, 12);
            const d = rng.range(8, 12);
            add(gx * L * 0.66, gz * L * 0.66, w, d, rng.range(4.5, 8.5), rng.pick(PASTELS), 'house');
          }
        }
      } else {
        add(0, -L * 0.45, L * 1.8, L * 0.85, rng.range(9, 14), rng.pick(INDUSTRIAL), 'warehouse');
        if (rng.chance(0.6)) add(-L * 0.4, L * 0.55, L * 0.9, L * 0.6, rng.range(7, 11), rng.pick(INDUSTRIAL), 'warehouse');
      }
    }
  }
  return out;
}

function landmarkBuildings(id, cx, cz, district) {
  const L = LOT_HALF;
  const b = (x, z, w, d, h, color, style) => ({ x: cx + x, z: cz + z, w, d, h, color, style, district, landmark: id });
  switch (id) {
    case 'safehouse': return [b(0, -6, 26, 22, 7, 0xf7b2c1, 'house'), b(-L * 0.65, L * 0.6, 10, 10, 6, 0x9fe3c9, 'house')];
    case 'garage': return [b(-4, 0, 30, 40, 9, 0xd9a441, 'warehouse')];
    case 'gunShop': return [b(0, -4, 34, 30, 12, 0x5b5f6b, 'club'), b(0, -L * 0.75, 40, 10, 40, 0x8fa6c4, 'tower')];
    case 'police': return [b(0, -8, 44, 30, 22, 0xdfe6ee, 'tower')];
    case 'hospital': return [b(0, -6, 44, 32, 30, 0xf4f4f4, 'tower')];
    case 'club': return [b(6, 0, 30, 46, 16, 0x2a1838, 'club')];
    case 'gazette': return [b(0, 6, 36, 30, 48, 0xc8bfae, 'tower')];
    case 'couriers': return [b(0, 6, 38, 30, 10, 0xffcf9e, 'warehouse')];
    default: return [];
  }
}

/** Parking spots by the kerb, used to place parked cars that can be stolen. */
export function planParkingSpots() {
  const rng = createRng(991);
  const spots = [];
  for (let i = 0; i < CITY.blocks; i++) {
    for (let j = 0; j <= CITY.blocks; j++) {
      if (!rng.chance(0.35)) continue;
      const along = blockCenter(i) + rng.range(-18, 18);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = CITY.roadWidth / 2 - 1.3;
      if (rng.chance(0.5)) spots.push({ x: along, z: roadLine(j) + side * off, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
      else spots.push({ x: roadLine(j) + side * off, z: along, heading: side > 0 ? Math.PI : 0 });
    }
  }
  return spots;
}
