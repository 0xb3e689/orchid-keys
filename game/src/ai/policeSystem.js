// OKPD dispatch: sends cruisers that route through the streets and ram the player's car,
// drops officers on foot who arrest or shoot, throws roadblocks across the road ahead at
// three stars, scrambles the helicopter at four, and decides when the player is seen,
// busted, or has slipped away.
import { POLICE } from '../config.js';
import { rng } from '../core/rng.js';
import { emit, on } from '../core/eventBus.js';
import { angleDiff, headingTo } from '../core/mathUtils.js';
import { DrivingAgent, steerToward } from './drivingAgent.js';
import { armCharacter, updateCombatant } from './combatantAI.js';
import { Character } from '../entities/character.js';
import { LOOKS } from '../entities/humanModel.js';
import { PoliceHelicopter } from '../entities/policeHelicopter.js';
import { laneHeading, laneWaypoints, neighbours, nearestNode, nodePos, randomLanePoint } from '../world/roadGraph.js';

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.cars = new Map();       // vehicle -> { agent, mode, crew, retarget }
    this.officers = [];
    this.roadblockTimer = 8;
    this.heli = new PoliceHelicopter(game.scene);
    this.bustTimer = 0;
    this.lastSeenAt = null;
    on('wantedCleared', () => this.standDown());
  }

  get wanted() { return this.game.wanted; }

  spawnCruiser(px, pz, min, max) {
    for (let t = 0; t < 14; t++) {
      const p = randomLanePoint(rng.next);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < min || d > max || this.game.vehicles.nearestTo(p.x, p.z, 8)) continue;
      const v = this.game.vehicles.spawn('cruiser', 0xffffff, p.x, p.z, p.heading, 'police');
      v.driver = 'police';
      v.siren = true;
      const agent = new DrivingAgent(v, rng.next);
      this.cars.set(v, { agent, mode: 'chase', crew: 2, retarget: 0, deployed: false });
      return v;
    }
    return null;
  }

  spawnOfficer(x, z, heading = 0) {
    const ch = new Character(LOOKS.cop, x, z, heading);
    ch.faction = 'police';
    ch.health = 120;
    const stars = this.wanted.stars;
    armCharacter(ch, stars >= 4 ? 'smg' : stars >= 3 && rng.chance(0.3) ? 'shotgun' : 'pistol', { accuracy: 0.45 + stars * 0.08, speed: 5.2 });
    this.officers.push(ch);
    this.game.scene.add(ch.mesh);
    return ch;
  }

  /** Put two cruisers nose-to-nose across a road segment ahead of the player, with officers. */
  placeRoadblock(player) {
    const pos = player.pos;
    const heading = player.vehicle ? player.vehicle.heading : player.body.heading;
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 80; i++) {
      const id = nearestNode(pos.x + Math.sin(heading) * (60 + i * 2), pos.z + Math.cos(heading) * (60 + i * 2));
      const np = nodePos(id);
      const d = Math.hypot(np.x - pos.x, np.z - pos.z);
      if (d < 55 || d > 150) continue;
      const ahead = Math.cos(angleDiff(heading, headingTo(pos.x, pos.z, np.x, np.z)));
      if (ahead > 0.8 && ahead * 100 - d * 0.1 > bestScore) { best = id; bestScore = ahead * 100 - d * 0.1; }
    }
    if (best === null) return false;
    // block the road leading from the junction back toward the player
    const prevId = neighbours(best).reduce((a, b) => {
      const pa = nodePos(a);
      const pb = nodePos(b);
      return Math.hypot(pa.x - pos.x, pa.z - pos.z) < Math.hypot(pb.x - pos.x, pb.z - pos.z) ? a : b;
    });
    const along = laneHeading(best, prevId);
    const np = nodePos(best);
    const cx = np.x + Math.sin(along) * 16;
    const cz = np.z + Math.cos(along) * 16;
    const across = along + Math.PI / 2;
    for (const side of [-1, 1]) {
      const x = cx + Math.sin(across) * side * 2.6;
      const z = cz + Math.cos(across) * side * 2.6;
      if (this.game.vehicles.nearestTo(x, z, 3)) continue;
      const v = this.game.vehicles.spawn('cruiser', 0xffffff, x, z, across + (side > 0 ? 0 : Math.PI), 'police');
      v.driver = null;
      v.siren = true;
      v.tags.add('roadblock');
      this.cars.set(v, { agent: null, mode: 'roadblock', crew: 0, retarget: 0, life: 45 });
      this.spawnOfficer(x + Math.sin(along) * 3, z + Math.cos(along) * 3, along + Math.PI);
    }
    emit('roadblock', { x: cx, z: cz });
    return true;
  }

  standDown() {
    for (const [v, s] of this.cars) {
      s.mode = 'leave';
      v.siren = false;
      if (s.agent) s.agent.startLane(nearestNode(v.pos.x, v.pos.z), neighbours(nearestNode(v.pos.x, v.pos.z))[0]);
    }
    for (const o of this.officers) if (o.combat) o.combat.calm = true;
    this.heli.deactivate();
  }

  /** Can any unit see the player right now? */
  computeSeen(player) {
    const p = player.pos;
    const range = POLICE.sightRange + this.wanted.stars * 8;
    const eye = { x: 0, y: 1.6, z: 0 };
    const check = (x, z) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > range) return false;
      if (d < 18) return true;
      eye.x = x; eye.z = z;
      const dir = { x: (p.x - x) / d, y: 0, z: (p.z - z) / d };
      return this.game.collision.raycast(eye, dir, d) >= d - 1;
    };
    if (this.heli.active && Math.hypot(this.heli.pos.x - p.x, this.heli.pos.z - p.z) < 70) return true;
    for (const v of this.cars.keys()) if (!v.destroyed && v.driver === 'police' && check(v.pos.x, v.pos.z)) return true;
    for (const o of this.officers) if (o.alive && !o.isDown && check(o.pos.x, o.pos.z)) return true;
    return false;
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const stars = this.wanted.stars;
    const target = player.targetInfo();

    // dispatch: keep enough cruisers in play for the star level
    let active = 0;
    for (const [v, s] of this.cars) if (s.mode === 'chase' && !v.destroyed && v.driver === 'police') active++;
    if (stars > 0 && active < POLICE.carsPerStar[stars] && rng.chance(dt * 1.5)) {
      this.spawnCruiser(player.pos.x, player.pos.z, POLICE.spawnMin - stars * 8, POLICE.spawnMax);
    }

    // roadblocks
    if (stars >= POLICE.roadblockFromStars && player.vehicle) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0 && player.vehicle.absSpeed > 8) {
        this.roadblockTimer = 26 - stars * 3;
        this.placeRoadblock(player);
      }
    }

    // helicopter
    if (stars >= POLICE.heliFromStars) this.heli.activate(player.pos.x, player.pos.z);
    this.heli.update(dt, player.pos);
    if (this.heli.active && stars >= 5) this.heliShoot(dt, target);

    const obstacles = game.vehicles.list;
    for (const [v, s] of [...this.cars]) {
      if (v.removed) { this.cars.delete(v); continue; }
      const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
      if (s.mode === 'roadblock') {
        s.life -= dt;
        if ((s.life < 0 && d > 120) || (stars === 0 && d > 90)) { game.vehicles.remove(v); this.cars.delete(v); }
        continue;
      }
      if (v.driver !== 'police' || v.destroyed) {
        // stolen or wrecked: no longer one of ours
        if (v.destroyed && d > 200) { game.vehicles.remove(v); this.cars.delete(v); }
        else if (v.driver === 'player') this.cars.delete(v);
        continue;
      }
      if (s.mode === 'leave' || stars === 0) {
        if (d > 160) { game.vehicles.remove(v); this.cars.delete(v); continue; }
        s.agent.updateWander(dt, obstacles);
        continue;
      }
      if (d > 320) { game.vehicles.remove(v); this.cars.delete(v); continue; }
      this.driveChase(v, s, dt, d, player, obstacles);
    }

    // officers on foot
    let arrest = false;
    for (const o of [...this.officers]) {
      const d = Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z);
      if ((!o.alive && (o.removeTimer += dt) > 20) || d > 200 || (stars === 0 && d > 60)) {
        this.officers.splice(this.officers.indexOf(o), 1);
        game.scene.remove(o.mesh);
        continue;
      }
      if (o.alive && stars > 0 && !player.dead) {
        o.combat.arrestOnly = stars <= 1 && !player.vehicle;
        if (updateCombatant(o, dt, target, game.hitWorld, game.collision) === 'arrest') arrest = true;
      } else {
        o.moveX = o.moveZ = 0;
        o.pose = 'normal';
      }
      o.step(dt, game.collision);
      o.syncMesh();
    }

    // busted: an officer has hands on a slow-moving suspect
    const slow = player.vehicle ? player.vehicle.absSpeed < 1.2 : player.body.stride < 0.6;
    const close = this.officers.some((o) => o.alive && !o.isDown && Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < (player.vehicle ? 3.2 : 1.7));
    if (stars > 0 && (arrest || close) && slow && !player.dead) {
      this.bustTimer += dt;
      if (this.bustTimer > (player.vehicle ? 2.2 : 1.2)) {
        this.bustTimer = 0;
        emit('busted', {});
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt);
    }

    const seen = stars > 0 && this.computeSeen(player);
    this.wanted.update(dt, seen);
  }

  driveChase(v, s, dt, d, player, obstacles) {
    const pv = player.vehicle;
    const px = player.pos.x;
    const pz = player.pos.z;
    if (!pv && d < 16 && v.absSpeed < 6 && !s.deployed) {
      // pull up and let the officers out
      s.deployed = true;
      for (let i = 0; i < s.crew; i++) {
        const side = i === 0 ? -1 : 1;
        const rx = -Math.cos(v.heading) * side * 2;
        const rz = Math.sin(v.heading) * side * 2;
        this.spawnOfficer(v.pos.x + rx, v.pos.z + rz, v.heading);
      }
      s.crew = 0;
    }
    if (!pv && d < 14) {
      v.controls.throttle = v.speed > 0.5 ? -1 : 0;
      v.controls.steer = 0;
      v.controls.handbrake = false;
      return;
    }
    if (d < 45) {
      // close: go straight for the suspect, leading a moving car so the cruiser rams it
      const lead = pv ? Math.min(1.2, d / 25) : 0;
      const tx = px + (pv ? pv.vx * lead : 0);
      const tz = pz + (pv ? pv.vz * lead : 0);
      if (s.agent.handleStuck(dt)) return;
      steerToward(v, tx, tz, pv ? Math.max(pv.absSpeed + 8, 22) : 12, true);
      return;
    }
    s.retarget -= dt;
    if (s.retarget <= 0 || !s.agent.waypoints.length) {
      s.retarget = 1.5;
      s.agent.routeTo(px, pz);
    }
    s.agent.updateRoute(dt, null, 30 + this.wanted.stars * 3, true);
  }

  heliShoot(dt, target) {
    this.heli.fireCooldown -= dt;
    if (this.heli.fireCooldown > 0) return;
    this.heli.fireCooldown = 0.12;
    if (Math.random() < 0.08) this.heli.fireCooldown = 2.5;
    const o = { x: this.heli.pos.x, y: this.heli.pos.y - 1.5, z: this.heli.pos.z };
    const tx = target.pos.x + (Math.random() - 0.5) * 5;
    const tz = target.pos.z + (Math.random() - 0.5) * 5;
    const len = Math.hypot(tx - o.x, 1 - o.y, tz - o.z);
    this.game.fireFrom({ pos: o, faction: 'police' }, 'smg', o, { x: (tx - o.x) / len, y: (1 - o.y) / len, z: (tz - o.z) / len });
  }

  /** Remove every unit (new game, respawn after busted/wasted). */
  reset() {
    for (const v of this.cars.keys()) if (!v.removed && v.driver !== 'player') this.game.vehicles.remove(v);
    this.cars.clear();
    for (const o of this.officers) this.game.scene.remove(o.mesh);
    this.officers = [];
    this.heli.deactivate();
  }

  nearestSirenDistance(x, z) {
    let best = Infinity;
    for (const v of this.cars.keys()) if (v.siren && !v.destroyed) best = Math.min(best, Math.hypot(v.pos.x - x, v.pos.z - z));
    return best;
  }

  characters() { return this.officers; }
  laneFor(a, b) { return laneWaypoints(a, b); }
}
