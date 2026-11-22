// Anyone on foot: position, facing, health, being knocked flying by a car, dying, and keeping
// the animated model in step. Pedestrians, police officers, gang members and the player all
// build on this body.
import * as THREE from 'three';
import { clamp, dampAngle } from '../core/mathUtils.js';
import { animateHuman, buildHuman } from './humanModel.js';
import { isOnRoad } from '../world/cityPlan.js';
import { SIDEWALK_HEIGHT } from '../world/cityBuilder.js';

let nextId = 1;

export function groundHeight(x, z) {
  return isOnRoad(x, z) ? 0 : SIDEWALK_HEIGHT;
}

export class Character {
  constructor(look, x, z, heading = 0) {
    this.id = nextId++;
    this.look = look;
    this.model = buildHuman(look);
    this.mesh = this.model.root;
    this.pos = new THREE.Vector3(x, groundHeight(x, z), z);
    this.heading = heading;
    this.moveX = 0;           // desired velocity this frame (m/s)
    this.moveZ = 0;
    this.knockX = 0;          // velocity from being hit
    this.knockZ = 0;
    this.vy = 0;
    this.health = 100;
    this.alive = true;
    this.down = 0;            // seconds left lying down (Infinity when dead)
    this.phase = Math.random() * 6;
    this.stride = 0;
    this.pose = 'normal';
    this.radius = 0.4;
    this.inVehicle = null;
    this.removeTimer = 0;
  }

  get isDown() { return this.down > 0; }

  /** Take damage; returns true if this hit killed them. */
  hurt(amount, fromX = null, fromZ = null, force = 0) {
    if (!this.alive) return false;
    this.health -= amount;
    if (fromX !== null && force > 0) {
      const dx = this.pos.x - fromX;
      const dz = this.pos.z - fromZ;
      const len = Math.hypot(dx, dz) || 1;
      this.knockX = (dx / len) * force;
      this.knockZ = (dz / len) * force;
      this.vy = Math.min(7, force * 0.35);
      this.down = Math.max(this.down, 2.5);
    }
    if (this.health <= 0) {
      this.alive = false;
      this.down = Infinity;
      return true;
    }
    return false;
  }

  /** Integrate movement against the city; call after AI/controls set moveX/moveZ. */
  step(dt, collision) {
    const prev = { x: this.pos.x, z: this.pos.z };
    if (this.isDown) {
      this.down -= dt;
      this.pos.x += this.knockX * dt;
      this.pos.z += this.knockZ * dt;
      this.knockX *= Math.exp(-2.5 * dt);
      this.knockZ *= Math.exp(-2.5 * dt);
    } else {
      this.pos.x += (this.moveX + this.knockX) * dt;
      this.pos.z += (this.moveZ + this.knockZ) * dt;
      this.knockX *= Math.exp(-6 * dt);
      this.knockZ *= Math.exp(-6 * dt);
      const sp = Math.hypot(this.moveX, this.moveZ);
      if (sp > 0.2) this.heading = dampAngle(this.heading, Math.atan2(this.moveX, this.moveZ), 12, dt);
      this.stride = sp / 3.2;
      this.phase += sp * dt * 2.6;
    }
    collision.resolveCircle(this.pos, this.radius, prev);
    const floor = groundHeight(this.pos.x, this.pos.z);
    this.vy -= 22 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= floor) { this.pos.y = floor; this.vy = 0; }
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    animateHuman(this.model, this.phase, clamp(this.stride, 0, 1.8), this.isDown ? 'down' : this.pose);
  }
}
