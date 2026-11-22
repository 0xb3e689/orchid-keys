// Turns gameplay events into what you see and hear: muzzle flashes and gunshots, tracers,
// bullet sparks and dust, blood puffs, crash sparks with crunches, burning engines, and
// explosions that shake the camera and hurt everything nearby.
import { on } from '../core/eventBus.js';

export function wireEffects(game) {
  const fx = game.fx;
  const sound = game.sound;
  const near = (x, z) => Math.hypot(x - game.camera.position.x, z - game.camera.position.z);

  on('shotFired', (e) => {
    const d = e.dir;
    const len = Math.hypot(d.x, d.z) || 1;
    if (e.weapon !== 'fists') fx.muzzleFlash(e.x + (d.x / len) * 0.3, e.y, e.z + (d.z / len) * 0.3, d.x / len, d.z / len);
    sound.gunshot(e.weapon, near(e.x, e.z));
    game.traffic.panicNear(e.x, e.z, 50);
  });
  on('tracer', (e) => fx.tracer(e.x0, e.y0, e.z0, e.x1, e.y1, e.z1));
  on('bulletImpact', (e) => { fx.sparks(e.x, e.y, e.z, 5, 0.6); fx.dust(e.x, e.y, e.z); });
  on('characterShot', (e) => { fx.blood(e.x, e.y, e.z); if (e.weapon === 'fists') sound.punch(); });
  on('vehicleShot', (e) => fx.sparks(e.x, e.y, e.z, 6, 0.7));
  on('punchThrown', (e) => { if (!e.hit) sound.tone({ type: 'sine', freq: 300, to: 200, duration: 0.05, gain: 0.05 }); });
  on('vehicleImpact', (e) => {
    fx.sparks(e.x, e.y, e.z, Math.min(30, 6 + e.strength * 1.5), Math.min(2, e.strength / 8));
    sound.impact(e.strength, near(e.x, e.z));
    if (e.vehicle === game.player.vehicle || e.other === game.player.vehicle) game.followCam.shake = Math.min(1, game.followCam.shake + e.strength / 25);
  });
  on('vehicleSmoke', (e) => fx.engineSmoke(e.x, e.y, e.z, e.fire));
  on('explosion', (e) => {
    fx.explosion(e.x, e.y, e.z, e.radius);
    const d = near(e.x, e.z);
    sound.explosion(d);
    game.followCam.shake = Math.min(1.6, game.followCam.shake + Math.max(0, 1.4 - d / 40));
    // blast damage to everything around
    for (const v of game.vehicles.list) {
      if (v === e.vehicle) continue;
      const vd = Math.hypot(v.pos.x - e.x, v.pos.z - e.z);
      if (vd < e.radius) {
        v.damage((1 - vd / e.radius) * 500, e.source);
        const push = (1 - vd / e.radius) * 9;
        v.vx += ((v.pos.x - e.x) / (vd || 1)) * push;
        v.vz += ((v.pos.z - e.z) / (vd || 1)) * push;
      }
    }
    for (const ch of game.characters()) {
      if (ch.inVehicle) continue;
      const cd = Math.hypot(ch.pos.x - e.x, ch.pos.z - e.z);
      if (cd < e.radius * 1.2) ch.hurt((1 - cd / (e.radius * 1.2)) * 120, e.x, e.z, 9);
    }
    game.peds.scare(e.x, e.z, 60);
  });
  on('horn', () => sound.horn());
  on('wantedUp', () => sound.starUp());
}
