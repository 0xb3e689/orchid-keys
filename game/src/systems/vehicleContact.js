// Cars versus people: anyone standing in the path of a moving car is knocked flying, hurt in
// proportion to the speed, and the hit is reported (a crime when the player was driving).
import { emit } from '../core/eventBus.js';

export function resolveVehicleHits(vehicles, characters) {
  for (const v of vehicles) {
    const speed = v.absSpeed;
    if (speed < 2.5 || v.destroyed) continue;
    const circles = v.circles();
    const r = v.radius + 0.35;
    for (const ch of characters) {
      if (!ch.alive || ch.inVehicle || ch.pos.y > 1.5) continue;
      if (Math.abs(ch.pos.x - v.pos.x) > 4 || Math.abs(ch.pos.z - v.pos.z) > 4) continue;
      for (const c of circles) {
        const dx = ch.pos.x - c.x;
        const dz = ch.pos.z - c.z;
        if (dx * dx + dz * dz > r * r) continue;
        if (ch.hitCooldown && ch.hitCooldown > performance.now()) break;
        ch.hitCooldown = performance.now() + 600;
        const killed = ch.hurt(speed * speed * 0.35 + 8, v.pos.x - v.vx, v.pos.z - v.vz, speed * 0.8);
        ch.knockX += v.vx * 0.7;
        ch.knockZ += v.vz * 0.7;
        ch.vy = Math.min(9, 2 + speed * 0.3);
        v.vx *= 0.93;
        v.vz *= 0.93;
        emit('characterRunOver', { target: ch, vehicle: v, killed, x: ch.pos.x, z: ch.pos.z, speed });
        break;
      }
    }
  }
}
