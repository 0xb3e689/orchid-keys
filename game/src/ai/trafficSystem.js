// Ambient traffic: keeps a ring of civilian cars driving the lanes around the player, spawning
// them out of sight and retiring them when far away, and fills kerbside parking with cars
// waiting to be stolen.
import { TRAFFIC } from '../config.js';
import { rng } from '../core/rng.js';
import { DrivingAgent } from './drivingAgent.js';
import { CAR_COLORS, CIVILIAN_TYPES } from '../entities/vehicleModels.js';
import { randomLanePoint } from '../world/roadGraph.js';
import { planParkingSpots } from '../world/cityPlan.js';

export class TrafficSystem {
  constructor(vehicles) {
    this.vehicles = vehicles;
    this.agents = new Map();
    this.parkingSpots = planParkingSpots();
    this.parked = new Set();
    this.density = 1;
  }

  /** Spawn one driving car on a lane between min and max metres from (px, pz). */
  spawnNear(px, pz, min, max) {
    for (let tries = 0; tries < 12; tries++) {
      const p = randomLanePoint(rng.next);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < min || d > max) continue;
      if (this.vehicles.nearestTo(p.x, p.z, 9)) continue;
      const v = this.vehicles.spawn(rng.pick(CIVILIAN_TYPES), rng.pick(CAR_COLORS), p.x, p.z, p.heading, 'traffic');
      v.driver = 'npc';
      const agent = new DrivingAgent(v, rng.next);
      agent.startLane(p.a, p.b);
      agent.waypoints.shift();
      agent.cruise = TRAFFIC.cruise * rng.range(0.8, 1.15);
      v.speedInit = agent.cruise * 0.7;
      v.vx = Math.sin(p.heading) * v.speedInit;
      v.vz = Math.cos(p.heading) * v.speedInit;
      this.agents.set(v, agent);
      return v;
    }
    return null;
  }

  update(dt, focus, obstacles) {
    let driving = 0;
    for (const [v, agent] of this.agents) {
      if (v.removed || v.driver !== 'npc' || v.destroyed) {
        this.agents.delete(v);
        continue;
      }
      driving++;
      const d = Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z);
      if (d > TRAFFIC.despawn) {
        this.vehicles.remove(v);
        this.agents.delete(v);
        continue;
      }
      if (v.panic > 0) {
        v.panic -= dt;
        agent.cruise = Math.max(agent.cruise, 20);
      }
      agent.updateWander(dt, obstacles);
    }
    const want = Math.round(TRAFFIC.count * this.density);
    for (let i = driving; i < want && i < driving + 2; i++) this.spawnNear(focus.x, focus.z, TRAFFIC.spawnMin, TRAFFIC.spawnMax);
    this.updateParked(focus);
    // retire abandoned cars far from the player
    for (const v of this.vehicles.list) {
      if (v.role === 'traffic' && v.driver === null && !v.owned && !v.tags.has('mission') && Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z) > TRAFFIC.despawn + 40) {
        this.vehicles.remove(v);
      }
    }
  }

  /** Parked cars appear in kerbside spots within ~150 m and vanish beyond ~220 m. */
  updateParked(focus) {
    for (const spot of this.parkingSpots) {
      const d = Math.hypot(spot.x - focus.x, spot.z - focus.z);
      if (!spot.car && d < 150 && d > 50) {
        const v = this.vehicles.spawn(rng.pick(CIVILIAN_TYPES), rng.pick(CAR_COLORS), spot.x, spot.z, spot.heading, 'parked');
        spot.car = v;
      } else if (spot.car && (spot.car.removed || (d > 220 && spot.car.driver === null && !spot.car.owned))) {
        if (!spot.car.removed) this.vehicles.remove(spot.car);
        spot.car = null;
      } else if (spot.car && spot.car.driver !== null) {
        // someone drove it away: the spot frees up once it is gone
        spot.car.role = 'traffic';
        spot.car = null;
      }
    }
  }

  /** Startle drivers near a gunshot or crash so they speed away. */
  panicNear(x, z, radius) {
    for (const v of this.agents.keys()) {
      if (Math.hypot(v.pos.x - x, v.pos.z - z) < radius) v.panic = 6;
    }
  }
}
