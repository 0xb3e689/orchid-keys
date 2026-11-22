// Static collision for the city: building footprints and props as axis-aligned boxes in a
// spatial hash, with circle push-out for bodies and cars and ray casts for bullets and the camera.
import { isWalkable } from './coastline.js';

const CELL = 24;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
  }

  key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  /** Register a box { minX, maxX, minZ, maxZ, height }. */
  addBox(minX, maxX, minZ, maxZ, height = 50, tag = 'building') {
    const b = { minX, maxX, minZ, maxZ, height, tag, id: this.boxes.length };
    this.boxes.push(b);
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = this.key(cx, cz);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(b);
      }
    }
    return b;
  }

  addCircle(x, z, r, height = 6, tag = 'prop') {
    return this.addBox(x - r, x + r, z - r, z + r, height, tag);
  }

  nearby(x, z, r) {
    const out = new Set();
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const list = this.grid.get(this.key(cx, cz));
        if (list) for (const b of list) out.add(b);
      }
    }
    return out;
  }

  /**
   * Push a circle at pos {x, z} with radius r out of every box and out of the sea.
   * Returns the collision normal {x, z, depth} of the deepest contact, or null.
   */
  resolveCircle(pos, r, prev = null) {
    let hit = null;
    for (const b of this.nearby(pos.x, pos.z, r)) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      let d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let depth;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        dx /= d; dz /= d;
        depth = r - d;
      } else {
        // centre inside the box: leave by the nearest face
        const faces = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z];
        const m = faces.indexOf(Math.min(...faces));
        dx = m === 0 ? -1 : m === 1 ? 1 : 0;
        dz = m === 2 ? -1 : m === 3 ? 1 : 0;
        depth = faces[m] + r;
      }
      pos.x += dx * depth;
      pos.z += dz * depth;
      if (!hit || depth > hit.depth) hit = { x: dx, z: dz, depth, box: b };
    }
    if (!isWalkable(pos.x, pos.z, r)) {
      // the shoreline is a wall: go back to where we were (or toward the island centre)
      let nx = -pos.x;
      let nz = -pos.z;
      if (prev && isWalkable(prev.x, prev.z, r)) {
        nx = prev.x - pos.x;
        nz = prev.z - pos.z;
        pos.x = prev.x;
        pos.z = prev.z;
      } else {
        const len = Math.hypot(nx, nz) || 1;
        pos.x += (nx / len) * 0.5;
        pos.z += (nz / len) * 0.5;
      }
      const len = Math.hypot(nx, nz) || 1;
      hit = hit ?? { x: nx / len, z: nz / len, depth: 0.5, box: null, shore: true };
    }
    return hit;
  }

  /** True when a box covers (x, z) at height y. */
  pointBlocked(x, z, y = 1) {
    for (const b of this.nearby(x, z, 0.1)) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y <= b.height) return true;
    }
    return false;
  }

  /**
   * First hit distance of a 3D ray against the boxes (slab test), or Infinity.
   * Origin {x,y,z}, normalised dir {x,y,z}.
   */
  raycast(o, d, maxDist, ignoreThin = false) {
    let best = Infinity;
    const steps = Math.ceil(maxDist / CELL) + 1;
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxDist, s * CELL);
      const px = o.x + d.x * t;
      const pz = o.z + d.z * t;
      for (const b of this.nearby(px, pz, CELL)) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        // palm trunks and lamp posts never push the camera in
        if (ignoreThin && (b.tag === 'palm' || b.tag === 'lamp')) continue;
        const hit = rayBox(o, d, b);
        if (hit < best) best = hit;
      }
      if (best < t) break;
    }
    return best <= maxDist ? best : Infinity;
  }
}

function rayBox(o, d, b) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [
    [o.x, d.x, b.minX, b.maxX],
    [o.y, d.y, 0, b.height],
    [o.z, d.z, b.minZ, b.maxZ],
  ];
  for (const [p, v, lo, hi] of axes) {
    if (Math.abs(v) < 1e-9) {
      if (p < lo || p > hi) return Infinity;
    } else {
      let t1 = (lo - p) / v;
      let t2 = (hi - p) / v;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}
