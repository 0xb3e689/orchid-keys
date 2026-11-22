// How computer drivers drive: steer toward a waypoint, hold a target speed, brake for whatever
// is in front, back out when stuck, and follow lanes through the road graph, either wandering
// (traffic) or routing to a destination (police, racers, mission cars).
import { angleDiff, clamp, headingTo } from '../core/mathUtils.js';
import { findPath, laneWaypoints, nearestNode, randomNextNode } from '../world/roadGraph.js';

/** Set v.controls to drive toward (tx, tz) at about `speed` m/s. */
export function steerToward(v, tx, tz, speed, aggressive = false) {
  const desired = headingTo(v.pos.x, v.pos.z, tx, tz);
  const diff = angleDiff(v.heading, desired);
  const vf = v.speed;
  v.controls.steer = clamp(-diff * (aggressive ? 2.6 : 2.0), -1, 1);
  // slow down for sharp turns
  const turnLimit = speed * (1 - clamp(Math.abs(diff) / 1.6, 0, 0.75));
  if (vf < turnLimit - 0.5) v.controls.throttle = aggressive ? 1 : clamp((turnLimit - vf) / 4, 0.25, 1);
  else if (vf > turnLimit + 2) v.controls.throttle = -clamp((vf - turnLimit) / 6, 0.2, 1);
  else v.controls.throttle = 0.1;
  v.controls.handbrake = aggressive && Math.abs(diff) > 1.1 && vf > 14;
}

/** Distance to the nearest obstacle in this car's path, scanning `range` metres ahead. */
export function obstacleAhead(v, others, range = 16, width = 2.3) {
  const fx = v.forwardX;
  const fz = v.forwardZ;
  let nearest = Infinity;
  for (const o of others) {
    if (o === v) continue;
    const dx = o.pos.x - v.pos.x;
    const dz = o.pos.z - v.pos.z;
    if (Math.abs(dx) > range || Math.abs(dz) > range) continue;
    const ahead = dx * fx + dz * fz;
    if (ahead <= 0.5 || ahead > range) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < width) nearest = Math.min(nearest, ahead);
  }
  return nearest;
}

export class DrivingAgent {
  constructor(vehicle, rnd) {
    this.v = vehicle;
    this.rnd = rnd;
    this.from = null;
    this.to = null;
    this.waypoints = [];
    this.route = null;        // list of node ids when routing to a destination
    this.cruise = 12;
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.honked = 0;
  }

  /** Begin wandering along lane a→b. */
  startLane(a, b) {
    this.from = a;
    this.to = b;
    this.waypoints = laneWaypoints(a, b);
    this.route = null;
  }

  /** Route through the graph to a world point. */
  routeTo(x, z) {
    const v = this.v;
    // plan from the junction in front of the car, so it never has to U-turn to start
    const start = nearestNode(v.pos.x + v.forwardX * 45, v.pos.z + v.forwardZ * 45);
    const goal = nearestNode(x, z);
    this.route = findPath(start, goal);
    this.goal = { x, z };
    this.waypoints = [];
    for (let i = 0; i + 1 < this.route.length; i++) this.waypoints.push(...laneWaypoints(this.route[i], this.route[i + 1]));
    this.waypoints.push({ x, z });
    // drop nearby waypoints that are already behind
    while (this.waypoints.length > 1) {
      const w = this.waypoints[0];
      const dx = w.x - v.pos.x;
      const dz = w.z - v.pos.z;
      if (dx * v.forwardX + dz * v.forwardZ < 2 && Math.hypot(dx, dz) < 45) this.waypoints.shift();
      else break;
    }
  }

  nextLane() {
    const c = randomNextNode(this.from, this.to, this.rnd);
    this.from = this.to;
    this.to = c;
    this.waypoints = laneWaypoints(this.from, this.to);
  }

  /** Recover from being stuck against something: reverse with opposite lock. */
  handleStuck(dt) {
    const v = this.v;
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      v.controls.throttle = -1;
      v.controls.steer = -v.controls.steer || 0.6;
      v.controls.handbrake = false;
      return true;
    }
    if (v.controls.throttle > 0.3 && Math.abs(v.speed) < 0.8) this.stuckTime += dt;
    else this.stuckTime = Math.max(0, this.stuckTime - dt);
    if (this.stuckTime > 1.8) {
      this.stuckTime = 0;
      this.reverseTime = 1.3;
    }
    return false;
  }

  /** Lane-following for ambient traffic. obstacles: things to brake for. */
  updateWander(dt, obstacles) {
    if (this.handleStuck(dt)) return;
    const v = this.v;
    if (!this.waypoints.length) this.nextLane();
    const wp = this.waypoints[0];
    if (Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z) < 4.5) {
      this.waypoints.shift();
      if (!this.waypoints.length) this.nextLane();
    }
    const target = this.waypoints[0];
    let speed = this.cruise;
    const block = obstacleAhead(v, obstacles, 15);
    if (block < 15) speed = Math.min(speed, Math.max(0, (block - 5) * 1.2));
    steerToward(v, target.x, target.z, speed);
    if (block < 5.5) v.controls.throttle = v.speed > 0.3 ? -1 : 0;
  }

  /** Follow the planned route; returns true when the destination is reached. */
  updateRoute(dt, obstacles, speed, aggressive = false, arriveRadius = 6) {
    if (this.handleStuck(dt)) return false;
    const v = this.v;
    while (this.waypoints.length > 1 && Math.hypot(this.waypoints[0].x - v.pos.x, this.waypoints[0].z - v.pos.z) < 6) this.waypoints.shift();
    const target = this.waypoints[0];
    if (!target) return true;
    const d = Math.hypot(target.x - v.pos.x, target.z - v.pos.z);
    let s = speed;
    if (this.waypoints.length === 1) s = Math.min(speed, d * 0.8);
    if (obstacles) {
      const block = obstacleAhead(v, obstacles, 14);
      if (block < 14) s = Math.min(s, Math.max(0, (block - 5) * 1.5));
    }
    steerToward(v, target.x, target.z, s, aggressive);
    return this.waypoints.length === 1 && d < arriveRadius;
  }
}
