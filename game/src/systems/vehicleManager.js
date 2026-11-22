// Owns every car on the island: adds and removes their meshes, steps their physics, resolves
// car-to-car crashes with impulses (and reports who hit whom), and cleans up old wrecks.
import { emit } from '../core/eventBus.js';
import { Vehicle } from '../entities/vehicle.js';

export class VehicleManager {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.list = [];
  }

  spawn(typeId, color, x, z, heading, role = null) {
    const v = new Vehicle(typeId, color, x, z, heading);
    v.role = role;
    this.list.push(v);
    this.scene.add(v.mesh);
    return v;
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(v.mesh);
    v.removed = true;
  }

  update(dt) {
    for (const v of this.list) v.update(dt, this.collision);
    this.resolveCrashes();
    // remove wrecks that have burned out and nobody cares about
    for (const v of [...this.list]) {
      if (v.destroyed && v.wreckTimer > 40 && v.driver !== 'player' && !v.tags.has('mission')) this.remove(v);
    }
  }

  resolveCrashes() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        const dx0 = b.pos.x - a.pos.x;
        const dz0 = b.pos.z - a.pos.z;
        if (dx0 * dx0 + dz0 * dz0 > 49) continue;
        const ca = a.circles();
        const cb = b.circles();
        const r = a.radius + b.radius;
        for (const p of ca) {
          for (const q of cb) {
            const dx = q.x - p.x;
            const dz = q.z - p.z;
            const d2 = dx * dx + dz * dz;
            if (d2 >= r * r || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const nz = dz / d;
            const overlap = r - d;
            const ma = a.type.mass;
            const mb = b.type.mass;
            const wa = mb / (ma + mb);
            const wb = ma / (ma + mb);
            a.pos.x -= nx * overlap * wa;
            a.pos.z -= nz * overlap * wa;
            b.pos.x += nx * overlap * wb;
            b.pos.z += nz * overlap * wb;
            const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (rel < 0) {
              const jImp = (-1.35 * rel) / (1 / ma + 1 / mb);
              a.vx -= (jImp / ma) * nx;
              a.vz -= (jImp / ma) * nz;
              b.vx += (jImp / mb) * nx;
              b.vz += (jImp / mb) * nz;
              const strength = -rel;
              if (strength > 2.5) {
                a.damage(strength * strength * 0.7 * wa * 2, b.driver);
                b.damage(strength * strength * 0.7 * wb * 2, a.driver);
                emit('vehicleImpact', { x: (p.x + q.x) / 2, y: 0.8, z: (p.z + q.z) / 2, strength, vehicle: a, other: b });
                emit('vehicleCrash', { a, b, strength });
              }
            }
          }
        }
      }
    }
  }

  nearestTo(x, z, maxDist, filter = () => true) {
    let best = null;
    let bestD = maxDist;
    for (const v of this.list) {
      if (!filter(v)) continue;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < bestD) { best = v; bestD = d; }
    }
    return best;
  }
}
