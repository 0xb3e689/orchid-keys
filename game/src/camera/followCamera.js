// The third-person camera: mouse-orbit over the shoulder on foot (closer when aiming), a
// chase cam in cars that swings back behind the bonnet, pulls out and widens with speed,
// and never sits inside a building.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/mathUtils.js';

const tmp = new THREE.Vector3();
const dir = new THREE.Vector3();

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.18;
    this.distance = 5;
    this.idleMouse = 0;
    this.target = new THREE.Vector3();
    this.shake = 0;
    this.sensitivity = 0.0024;
  }

  snapBehind(heading) {
    this.yaw = heading;
    this.pitch = 0.18;
  }

  update(dt, player, input, collision) {
    const m = input.takeMouse();
    this.yaw -= m.x * this.sensitivity;
    this.pitch = clamp(this.pitch + m.y * this.sensitivity, -0.5, 1.1);
    const moved = Math.abs(m.x) + Math.abs(m.y) > 0.5;
    this.idleMouse = moved ? 0 : this.idleMouse + dt;

    const v = player.vehicle;
    let wantDist;
    let height;
    let side = 0;
    let fov = 68;
    if (v) {
      const speed = Math.abs(v.speed);
      // swing back behind the car when the mouse is left alone
      if (this.idleMouse > 1.2 && speed > 2) {
        const behind = v.speed >= -1 ? v.heading : v.heading + Math.PI;
        this.yaw = dampAngle(this.yaw, behind, 3.2, dt);
        this.pitch = damp(this.pitch, 0.2, 2, dt);
      }
      wantDist = 6.5 + v.type.L * 0.4 + speed * 0.07;
      height = 1.6;
      fov = 68 + clamp(speed * 0.45, 0, 20);
      this.target.set(v.pos.x, 1.3, v.pos.z);
    } else {
      const aiming = player.aiming;
      wantDist = aiming ? 2.4 : 4.4;
      height = 1.55;
      side = aiming ? 0.75 : 0.35;
      fov = aiming ? 55 : 66;
      this.target.set(player.body.pos.x, player.body.pos.y + height, player.body.pos.z);
    }
    if (this.override) {
      wantDist = this.override.distance;
      this.pitch = this.override.pitch;
    }
    this.distance = damp(this.distance, wantDist, 5, dt);
    this.camera.fov = damp(this.camera.fov, fov, 4, dt);
    this.camera.updateProjectionMatrix();

    const cp = Math.cos(this.pitch);
    const fx = Math.sin(this.yaw) * cp;
    const fz = Math.cos(this.yaw) * cp;
    const fy = -Math.sin(this.pitch);
    // over-the-shoulder offset to the right of the view
    const rx = -Math.cos(this.yaw) * side;
    const rz = Math.sin(this.yaw) * side;
    const pivot = tmp.set(this.target.x + rx, this.target.y + (v ? 0.9 : 0.15), this.target.z + rz);
    dir.set(-fx, -fy, -fz).normalize();
    let dist = this.distance;
    const hit = collision.raycast(pivot, dir, dist);
    if (hit < dist) dist = Math.max(0.8, hit - 0.4);
    const cam = this.camera.position;
    cam.set(pivot.x + dir.x * dist, Math.max(0.4, pivot.y + dir.y * dist), pivot.z + dir.z * dist);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.25;
      cam.x += (Math.random() - 0.5) * s;
      cam.y += (Math.random() - 0.5) * s;
      cam.z += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(pivot.x + fx * 6, pivot.y + fy * 6 + (v ? -0.3 : 0), pivot.z + fz * 6);
  }

  /** Where the crosshair points: the first wall along the view ray, or 120 m out. */
  aimPoint(collision) {
    const c = this.camera;
    c.getWorldDirection(dir);
    const d = collision.raycast(c.position, dir, 120);
    const t = Math.min(d, 120);
    return new THREE.Vector3(c.position.x + dir.x * t, c.position.y + dir.y * t, c.position.z + dir.z * t);
  }
}
