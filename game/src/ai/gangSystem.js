// Hostile crews that missions put on the street (the Brine Kings, Shore's security, Brick
// Delacroix) and getaway drivers who flee across the island. They fight the player with the
// shared combat brain and are cleaned up when their mission ends.
import { rng } from '../core/rng.js';
import { Character } from '../entities/character.js';
import { LOOKS } from '../entities/humanModel.js';
import { armCharacter, updateCombatant } from './combatantAI.js';
import { DrivingAgent } from './drivingAgent.js';

const GANG_LOOKS = {
  goon: LOOKS.goon,
  brine: { skin: 0x8d5524, shirt: 0x2a9d8f, pants: 0x264653, hair: 0x1b1b1b, hat: 0x2a9d8f },
  brick: { skin: 0x6b4226, shirt: 0xf4f4f4, pants: 0x111111, hair: 0x111111, hat: null, accent: 0x111111 },
};

export class GangSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.drivers = new Map(); // vehicle -> agent
  }

  spawn(x, z, { tag, weapon = 'pistol', look = 'goon', health = 100, accuracy = 0.45, name = null }) {
    const ch = new Character(GANG_LOOKS[look] ?? LOOKS.goon, x, z, rng.range(0, 6.28));
    ch.faction = 'enemy';
    ch.tag = tag;
    ch.health = health;
    ch.name = name;
    armCharacter(ch, weapon, { accuracy, speed: 4.2 });
    ch.awake = false;
    this.list.push(ch);
    this.game.scene.add(ch.mesh);
    return ch;
  }

  members(tag) { return this.list.filter((c) => c.tag === tag); }
  alive(tag) { return this.list.filter((c) => c.tag === tag && c.alive).length; }

  /** A getaway driver: routes to (x, z) and keeps running from the player. */
  addFleeingDriver(vehicle, dest) {
    const agent = new DrivingAgent(vehicle, rng.next);
    agent.routeTo(dest.x, dest.z);
    agent.dest = dest;
    this.drivers.set(vehicle, agent);
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const target = player.targetInfo();
    for (const ch of [...this.list]) {
      const d = Math.hypot(ch.pos.x - player.pos.x, ch.pos.z - player.pos.z);
      if (!ch.alive) {
        ch.removeTimer += dt;
        if (ch.removeTimer > 30 && d > 60) this.remove(ch);
      } else if (!player.dead) {
        // wake up when the player gets close or starts a fight
        if (!ch.awake && (d < 38 || ch.health < 100)) ch.awake = true;
        if (ch.awake) updateCombatant(ch, dt, target, game.hitWorld, game.collision);
        else { ch.moveX = ch.moveZ = 0; ch.pose = 'normal'; }
      } else {
        ch.moveX = ch.moveZ = 0;
      }
      ch.step(dt, game.collision);
      ch.syncMesh();
    }
    for (const [v, agent] of this.drivers) {
      if (v.removed || v.destroyed || v.driver !== 'enemy') { this.drivers.delete(v); continue; }
      if (agent.updateRoute(dt, game.vehicles.list, 27, true, 12)) {
        // reached the destination: pick somewhere far from the player and keep going
        const far = { x: -player.pos.x * 0.8 + rng.range(-80, 80), z: -player.pos.z * 0.8 + rng.range(-80, 80) };
        agent.routeTo(far.x, far.z);
      }
    }
  }

  remove(ch) {
    const i = this.list.indexOf(ch);
    if (i >= 0) this.list.splice(i, 1);
    this.game.scene.remove(ch.mesh);
  }

  clearTag(tag) {
    for (const ch of this.members(tag)) this.remove(ch);
  }

  clearAll() {
    for (const ch of [...this.list]) this.remove(ch);
    this.drivers.clear();
  }

  characters() { return this.list; }
}
