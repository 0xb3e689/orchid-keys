// One car: arcade bicycle-model physics (throttle, brake, steering, handbrake drift), collision
// with the city as two circles along its length, damage, fire and explosion state, and the
// visual updates (wheel spin and steer, body roll, brake lights, police light bar).
import * as THREE from 'three';
import { clamp, approach } from '../core/mathUtils.js';
import { emit } from '../core/eventBus.js';
import { VEHICLE_TYPES, buildVehicleModel, burnModel } from './vehicleModels.js';

let nextId = 1;

export class Vehicle {
  constructor(typeId, color, x, z, heading) {
    this.id = nextId++;
    this.typeId = typeId;
    this.type = VEHICLE_TYPES[typeId];
    this.color = color;
    this.model = buildVehicleModel(typeId, color);
    this.mesh = this.model.root;
    for (const w of this.model.wheels) w.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.steerAngle = 0;
    this.wheelSpin = 0;
    this.health = this.type.health;
    this.maxHealth = this.type.health;
    this.driver = null;          // null | 'player' | 'npc' | 'police' | 'racer' | 'enemy'
    this.controls = { throttle: 0, steer: 0, handbrake: false };
    this.isPolice = this.type.shape === 'police';
    this.siren = false;
    this.destroyed = false;
    this.burning = 0;
    this.wreckTimer = 0;
    this.owned = false;
    this.tags = new Set();
    this.lastHitBy = null;
    this.syncMesh();
  }

  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }
  get speed() { return this.vx * this.forwardX + this.vz * this.forwardZ; }
  get absSpeed() { return Math.hypot(this.vx, this.vz); }

  /** Centres of the front and rear collision circles. */
  circles() {
    const o = this.type.L * 0.28;
    const fx = this.forwardX * o;
    const fz = this.forwardZ * o;
    return [{ x: this.pos.x + fx, z: this.pos.z + fz }, { x: this.pos.x - fx, z: this.pos.z - fz }];
  }

  get radius() { return this.type.W * 0.55; }

  damage(amount, source = null) {
    if (this.destroyed) return;
    this.health -= amount;
    if (source) this.lastHitBy = source;
    if (this.health <= 0) this.explode();
  }

  explode() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.health = 0;
    this.burning = 6;
    burnModel(this.model);
    if (this.model.lightbar) this.model.lightbar.red.visible = this.model.lightbar.blue.visible = false;
    emit('explosion', { x: this.pos.x, y: 1, z: this.pos.z, radius: 9, source: this.lastHitBy, vehicle: this });
  }

  update(dt, collision) {
    const t = this.type;
    const c = this.destroyed ? { throttle: 0, steer: 0, handbrake: true } : this.controls;
    const fx = this.forwardX;
    const fz = this.forwardZ;
    const rx = -fz;
    const rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * rx + this.vz * rz;

    // engine and brakes
    const thr = c.throttle;
    const healthFactor = 0.55 + 0.45 * clamp(this.health / this.maxHealth, 0, 1);
    if (thr > 0) {
      if (vf < -0.5) vf = approach(vf, 0, t.brake * thr * dt);
      else vf += t.accel * thr * healthFactor * Math.max(0.05, 1 - (vf / t.maxSpeed) ** 2) * dt;
    } else if (thr < 0) {
      if (vf > 0.5) vf = approach(vf, 0, t.brake * -thr * dt);
      else vf = Math.max(-t.maxSpeed * 0.32, vf + t.accel * 0.6 * thr * dt);
    } else {
      vf = approach(vf, 0, 2.2 * dt);
    }
    if (c.handbrake) vf = approach(vf, 0, 7 * dt);

    // steering (less lock at speed); positive steer input turns right
    const lock = t.steer * (1 - 0.6 * clamp(Math.abs(vf) / t.maxSpeed, 0, 1));
    this.steerAngle = approach(this.steerAngle, -c.steer * lock, 4.5 * dt);
    const wheelbase = t.L * 0.62;
    let yaw = (vf / wheelbase) * Math.tan(this.steerAngle);
    if (c.handbrake && Math.abs(vf) > 6) yaw *= 1.45;
    this.yawRate = yaw;
    this.heading += yaw * dt;

    // tyres bleed off sideways slip (much less with the handbrake: drift)
    const grip = c.handbrake ? 1.6 : t.grip;
    vl *= Math.exp(-grip * dt);

    const nfx = Math.sin(this.heading);
    const nfz = Math.cos(this.heading);
    this.vx = nfx * vf + -nfz * vl;
    this.vz = nfz * vf + nfx * vl;
    this.lateralSlip = vl;

    const prev = { x: this.pos.x, z: this.pos.z };
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this.collideWithCity(collision, prev);

    if (this.burning > 0) {
      this.burning -= dt;
      emit('vehicleSmoke', { x: this.pos.x, y: 1.4, z: this.pos.z, fire: true });
    } else if (!this.destroyed && this.health < this.maxHealth * 0.3 && Math.random() < 0.3) {
      emit('vehicleSmoke', { x: this.pos.x + nfx * this.type.L * 0.4, y: 1.1, z: this.pos.z + nfz * this.type.L * 0.4, fire: this.health < this.maxHealth * 0.12 });
      if (this.health < this.maxHealth * 0.12) this.damage(25 * dt);
    }
    if (this.destroyed) this.wreckTimer += dt;
    this.syncMesh(dt);
  }

  collideWithCity(collision, prev) {
    const prevCircles = (() => {
      const o = this.type.L * 0.28;
      return [{ x: prev.x + this.forwardX * o, z: prev.z + this.forwardZ * o }, { x: prev.x - this.forwardX * o, z: prev.z - this.forwardZ * o }];
    })();
    const cs = this.circles();
    const r = this.radius;
    for (let i = 0; i < 2; i++) {
      const c = cs[i];
      const before = { x: c.x, z: c.z };
      const hit = collision.resolveCircle(c, r, prevCircles[i]);
      if (!hit) continue;
      this.pos.x += c.x - before.x;
      this.pos.z += c.z - before.z;
      const vn = this.vx * hit.x + this.vz * hit.z;
      if (vn < 0) {
        const impact = -vn;
        this.vx -= hit.x * vn * 1.3;
        this.vz -= hit.z * vn * 1.3;
        this.vx *= 0.82;
        this.vz *= 0.82;
        if (impact > 3) {
          this.damage(impact * impact * 0.9);
          emit('vehicleImpact', { x: c.x - hit.x * r, y: 0.8, z: c.z - hit.z * r, strength: impact, vehicle: this });
        }
      }
    }
  }

  syncMesh(dt = 0) {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const vf = this.speed;
    this.wheelSpin += (vf * dt) / 0.36;
    const w = this.model.wheels;
    for (let i = 0; i < 4; i++) {
      w[i].rotation.x = this.wheelSpin;
      w[i].rotation.y = i < 2 ? this.steerAngle : 0;
    }
    // body roll into corners and squat under braking
    const roll = clamp(-this.yawRate * vf * 0.006, -0.08, 0.08);
    this.model.body.rotation.z = roll;
    const braking = this.controls.throttle < 0 && vf > 1;
    this.model.body.rotation.x = braking ? 0.025 : 0;
    this.model.tailMaterial.color.setHex(braking || this.controls.handbrake ? 0xff2a2a : 0x8a0d12);
    if (this.model.lightbar) {
      const on = this.siren && !this.destroyed;
      const phase = Math.floor(performance.now() / 140) % 2 === 0;
      this.model.lightbar.red.material.color.setHex(on && phase ? 0xff2a2a : 0x551111);
      this.model.lightbar.blue.material.color.setHex(on && !phase ? 0x2a6bff : 0x112255);
    }
  }
}
