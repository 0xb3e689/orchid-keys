// Decides when the player has committed a crime and whether anyone saw it: gunfire in
// public, assault and murder, running people down, carjacking, ramming or shooting OKPD
// cruisers, blowing things up. Witnessed crimes go to the wanted system; stats are kept.
import { emit, on } from '../core/eventBus.js';
import { rng } from '../core/rng.js';
import { LOOKS } from '../entities/humanModel.js';

export function wireCrimes(game) {
  const isPlayer = (s) => s && (s.faction === 'player' || s === 'player' || s.character === game.player.body);

  /** Did a civilian or officer see something at (x, z)? */
  const witnessed = (x, z) => {
    for (const p of game.peds.list) if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 32) return true;
    for (const o of game.police.officers) if (o.alive && Math.hypot(o.pos.x - x, o.pos.z - z) < 60) return true;
    for (const v of game.police.cars.keys()) if (Math.hypot(v.pos.x - x, v.pos.z - z) < 70) return true;
    return false;
  };
  const crime = (type, x, z, force = false) => emit('crime', { type, witnessed: force || witnessed(x, z) });

  on('shotFired', (e) => {
    if (isPlayer(e.shooter) && e.weapon !== 'fists' && !game.missions.active?.def.allowGunfire) crime('gunfire', e.x, e.z);
  });

  on('characterShot', (e) => {
    if (!isPlayer(e.shooter)) return;
    const t = e.target;
    if (e.killed) game.progress.stats.kills++;
    if (t.faction === 'police') crime(e.killed ? 'copKilled' : 'assaultCop', t.pos.x, t.pos.z, true);
    else if (t.faction === 'civilian') crime(e.killed ? 'murder' : 'assault', t.pos.x, t.pos.z);
    if (t.ai) { t.ai.mode = 'flee'; t.ai.timer = 8; t.ai.threat = { x: game.player.pos.x, z: game.player.pos.z }; }
  });

  on('characterRunOver', (e) => {
    if (e.vehicle.driver !== 'player') return;
    const t = e.target;
    if (t.faction === 'police') crime(e.killed ? 'copKilled' : 'assaultCop', t.pos.x, t.pos.z, true);
    else if (t.faction === 'civilian') crime(e.killed ? 'murder' : 'hitPedestrian', t.pos.x, t.pos.z);
  });

  on('vehicleCrash', (e) => {
    const pv = game.player.vehicle;
    if (!pv || (e.a !== pv && e.b !== pv)) return;
    const other = e.a === pv ? e.b : e.a;
    if (other.isPolice && e.strength > 5) crime('policeCarDamaged', other.pos.x, other.pos.z, true);
    if (e.strength > 9) game.player.body.health -= Math.min(12, e.strength * 0.4);
  });

  on('vehicleShot', (e) => {
    if (e.target.driver === 'player' && !isPlayer(e.shooter)) game.player.body.hurt(4);
    if (isPlayer(e.shooter) && e.target.isPolice) crime('policeCarDamaged', e.x, e.z, true);
  });

  on('explosion', (e) => { if (e.source === 'player') crime('explosion', e.x, e.z); });

  on('carjack', (e) => {
    const v = e.vehicle;
    game.progress.stats.carsStolen++;
    const side = { x: Math.cos(v.heading) * 2, z: -Math.sin(v.heading) * 2 };
    if (e.previousDriver === 'npc') {
      const ped = game.peds.spawnAt(v.pos.x + side.x, v.pos.z + side.z);
      ped.hurt(5, game.player.body.pos.x, game.player.body.pos.z, 4);
      ped.ai.mode = 'flee';
      ped.ai.timer = 8;
      ped.ai.threat = { x: v.pos.x, z: v.pos.z };
      crime('carjack', v.pos.x, v.pos.z, rng.chance(0.55));
    } else if (e.previousDriver === 'police') {
      const cop = game.police.spawnOfficer(v.pos.x + side.x, v.pos.z + side.z, v.heading);
      cop.look = LOOKS.cop;
      crime('assaultCop', v.pos.x, v.pos.z, true);
    }
  });

  on('enteredVehicle', (e) => {
    // taking a parked car is only a crime if police are right there
    if (e.vehicle.role === 'parked' && !e.vehicle.owned) {
      game.progress.stats.carsStolen++;
      for (const v of game.police.cars.keys()) if (Math.hypot(v.pos.x - e.vehicle.pos.x, v.pos.z - e.vehicle.pos.z) < 30) crime('carjack', v.pos.x, v.pos.z, true);
    }
  });

  on('wantedEvaded', () => { game.progress.stats.copsEvaded++; game.hud.toast('You lost the cops.'); });
}
