// The road network as a graph of intersections. Traffic picks random turns on it, police
// and racers find shortest routes through it, and lanes are offset to the right-hand side.
import { CITY } from '../config.js';
import { roadLine } from './cityPlan.js';

const N = CITY.blocks; // nodes per side = N + 1
const LANE_OFFSET = 3;

export const nodeId = (i, j) => j * (N + 1) + i;
export const nodeI = (id) => id % (N + 1);
export const nodeJ = (id) => Math.floor(id / (N + 1));
export const nodePos = (id) => ({ x: roadLine(nodeI(id)), z: roadLine(nodeJ(id)) });
export const NODE_COUNT = (N + 1) * (N + 1);

export function neighbours(id) {
  const i = nodeI(id);
  const j = nodeJ(id);
  const out = [];
  if (i > 0) out.push(nodeId(i - 1, j));
  if (i < N) out.push(nodeId(i + 1, j));
  if (j > 0) out.push(nodeId(i, j - 1));
  if (j < N) out.push(nodeId(i, j + 1));
  return out;
}

export function nearestNode(x, z) {
  const i = Math.max(0, Math.min(N, Math.round((x + CITY.half) / CITY.pitch)));
  const j = Math.max(0, Math.min(N, Math.round((z + CITY.half) / CITY.pitch)));
  return nodeId(i, j);
}

/** Pick the next intersection after arriving at `cur` from `prev`, avoiding U-turns. */
export function randomNextNode(prev, cur, rnd) {
  const options = neighbours(cur).filter((n) => n !== prev);
  const list = options.length ? options : neighbours(cur);
  return list[Math.floor(rnd() * list.length)];
}

/** Breadth-first shortest path (in hops) between two intersections, inclusive. */
export function findPath(from, to) {
  if (from === to) return [from];
  const prev = new Int32Array(NODE_COUNT).fill(-1);
  prev[from] = from;
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    for (const n of neighbours(cur)) {
      if (prev[n] !== -1) continue;
      prev[n] = cur;
      if (n === to) {
        const path = [to];
        let p = to;
        while (p !== from) { p = prev[p]; path.push(p); }
        return path.reverse();
      }
      queue.push(n);
    }
  }
  return [from];
}

/**
 * Lane waypoints for travelling a→b: a point just past a's junction and one just before b's,
 * both shifted to the right-hand lane.
 */
export function laneWaypoints(a, b) {
  const pa = nodePos(a);
  const pb = nodePos(b);
  const dx = Math.sign(pb.x - pa.x);
  const dz = Math.sign(pb.z - pa.z);
  // with heading 0 facing +Z, the right-hand side of travel direction (dx, dz) is (-dz, dx)
  const ox = -dz * LANE_OFFSET;
  const oz = dx * LANE_OFFSET;
  const inset = CITY.roadWidth * 0.75;
  return [
    { x: pa.x + dx * inset + ox, z: pa.z + dz * inset + oz },
    { x: pb.x - dx * inset + ox, z: pb.z - dz * inset + oz },
  ];
}

/** Heading of the lane a→b (0 faces +Z). */
export function laneHeading(a, b) {
  const pa = nodePos(a);
  const pb = nodePos(b);
  return Math.atan2(pb.x - pa.x, pb.z - pa.z);
}

/** A random spot on a random lane: { a, b, t, x, z, heading } for spawning traffic. */
export function randomLanePoint(rnd) {
  const a = Math.floor(rnd() * NODE_COUNT);
  const ns = neighbours(a);
  const b = ns[Math.floor(rnd() * ns.length)];
  const [w0, w1] = laneWaypoints(a, b);
  const t = 0.1 + rnd() * 0.8;
  return { a, b, x: w0.x + (w1.x - w0.x) * t, z: w0.z + (w1.z - w0.z) * t, heading: laneHeading(a, b) };
}
