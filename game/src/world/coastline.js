// Where land ends: the island's rounded outline (beaches south, east and north, a concrete
// harbour apron west), the piers of Port Halcyon, and the walkable/drivable test built on them.
import { CITY } from '../config.js';
import { blockCenter } from './cityPlan.js';

const H = CITY.half;
export const ISLAND = { minX: -H - 30, maxX: H + CITY.beach, minZ: -H - CITY.beach, maxZ: H + CITY.beach, radius: 60 };

/** Piers reaching west from the harbour apron: axis-aligned rectangles at deck height. */
export const PIERS = [
  { minX: -H - 66, maxX: -H - 25, minZ: blockCenter(6) - 7, maxZ: blockCenter(6) + 7, name: 'yacht pier' },
  { minX: -H - 52, maxX: -H - 25, minZ: blockCenter(8) - 5, maxZ: blockCenter(8) + 5, name: 'marina' },
  { minX: -H - 48, maxX: -H - 25, minZ: blockCenter(2) - 6, maxZ: blockCenter(2) + 6, name: 'cargo pier' },
];

/** Signed distance (m) to the island shoreline: negative on land, positive at sea. */
export function islandSdf(x, z) {
  const cx = (ISLAND.minX + ISLAND.maxX) / 2;
  const cz = (ISLAND.minZ + ISLAND.maxZ) / 2;
  const bx = (ISLAND.maxX - ISLAND.minX) / 2 - ISLAND.radius;
  const bz = (ISLAND.maxZ - ISLAND.minZ) / 2 - ISLAND.radius;
  const qx = Math.abs(x - cx) - bx;
  const qz = Math.abs(z - cz) - bz;
  const ox = Math.max(qx, 0);
  const oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(qx, qz), 0) - ISLAND.radius;
}

export function onPier(x, z) {
  for (const p of PIERS) if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) return true;
  return false;
}

/** Feet and wheels may go where there is land (a little short of the waterline) or a pier deck. */
export function isWalkable(x, z, margin = 2) {
  return islandSdf(x, z) < -margin || onPier(x, z);
}

/** True for the open harbour west of the docks (no beach there). */
export const isHarbourSide = (x) => x < -H - 5;
