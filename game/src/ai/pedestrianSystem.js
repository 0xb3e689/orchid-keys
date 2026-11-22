// Island locals on foot: they stroll around the sidewalk ring of their block, cross at the
// corners, flee from gunfire, explosions and reckless drivers, and are spawned and retired
// around the player so the streets always feel busy.
import { CITY, PEDS } from '../config.js';
import { rng } from '../core/rng.js';
import { on } from '../core/eventBus.js';
import { Character } from '../entities/character.js';
import { randomLook } from '../entities/humanModel.js';
import { LOT_HALF, blockCenter } from '../world/cityPlan.js';

const RING = LOT_HALF + CITY.sidewalk * 0.5;
const CORNERS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

export class PedestrianSystem {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.list = [];
    this.density = 1;
    on('shotFired', (e) => this.scare(e.x, e.z, 45));
    on('explosion', (e) => this.scare(e.x, e.z, 60));
  }

  add(ch) {
    this.list.push(ch);
    this.scene.add(ch.mesh);
    return ch;
  }

  remove(ch) {
    const i = this.list.indexOf(ch);
    if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(ch.mesh);
  }

  /** Spawn a walker on a random block corner within the spawn ring around (px, pz). */
  spawnNear(px, pz) {
    for (let t = 0; t < 10; t++) {
      const bx = Math.floor((px + CITY.half) / CITY.pitch) + rng.int(-2, 2);
      const bz = Math.floor((pz + CITY.half) / CITY.pitch) + rng.int(-2, 2);
      if (bx < 0 || bz < 0 || bx >= CITY.blocks || bz >= CITY.blocks) continue;
      const corner = rng.int(0, 3);
      const along = rng.next();
      const [ax, az] = CORNERS[corner];
      const [bxx, bzz] = CORNERS[(corner + 1) % 4];
      const x = blockCenter(bx) + (ax + (bxx - ax) * along) * RING;
      const z = blockCenter(bz) + (az + (bzz - az) * along) * RING;
      const d = Math.hypot(x - px, z - pz);
      if (d < PEDS.spawnMin || d > PEDS.spawnMax) continue;
      const ch = new Character(randomLook(rng), x, z);
      ch.faction = 'civilian';
      ch.ai = { bx, bz, corner: (corner + 1) % 4, dir: 1, mode: 'walk', timer: 0, speed: PEDS.walk * rng.range(0.8, 1.2), threat: null };
      return this.add(ch);
    }
    return null;
  }

  /** Make a specific person walk from (x, z), e.g. a driver dragged out of a car. */
  spawnAt(x, z, look = randomLook(rng), faction = 'civilian') {
    const ch = new Character(look, x, z);
    ch.faction = faction;
    const bx = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((x + CITY.half) / CITY.pitch)));
    const bz = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((z + CITY.half) / CITY.pitch)));
    ch.ai = { bx, bz, corner: 0, dir: 1, mode: 'walk', timer: 0, speed: PEDS.walk, threat: null };
    return this.add(ch);
  }

  scare(x, z, radius) {
    for (const p of this.list) {
      if (!p.alive || !p.ai) continue;
      if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius) {
        p.ai.mode = 'flee';
        p.ai.timer = rng.range(5, 9);
        p.ai.threat = { x, z };
      }
    }
  }

  target(ai) {
    const [cx, cz] = CORNERS[ai.corner];
    return { x: blockCenter(ai.bx) + cx * RING, z: blockCenter(ai.bz) + cz * RING };
  }

  update(dt, focus) {
    let alive = 0;
    for (const p of [...this.list]) {
      const d = Math.hypot(p.pos.x - focus.x, p.pos.z - focus.z);
      if (!p.alive) {
        p.removeTimer += dt;
        if (p.removeTimer > 25 || d > PEDS.despawn) this.remove(p);
        p.step(dt, this.collision);
        p.syncMesh();
        continue;
      }
      if (d > PEDS.despawn) { this.remove(p); continue; }
      alive++;
      this.think(p, dt);
      p.step(dt, this.collision);
      p.syncMesh();
    }
    const want = Math.round(PEDS.count * this.density);
    for (let i = alive; i < want && i < alive + 3; i++) this.spawnNear(focus.x, focus.z);
  }

  think(p, dt) {
    const ai = p.ai;
    if (p.isDown) { p.moveX = p.moveZ = 0; return; }
    if (ai.mode === 'flee' && ai.threat) {
      ai.timer -= dt;
      const dx = p.pos.x - ai.threat.x;
      const dz = p.pos.z - ai.threat.z;
      const len = Math.hypot(dx, dz) || 1;
      p.moveX = (dx / len) * PEDS.run;
      p.moveZ = (dz / len) * PEDS.run;
      if (ai.timer <= 0) {
        ai.mode = 'walk';
        // re-adopt the block we fled into
        ai.bx = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((p.pos.x + CITY.half) / CITY.pitch)));
        ai.bz = Math.max(0, Math.min(CITY.blocks - 1, Math.floor((p.pos.z + CITY.half) / CITY.pitch)));
      }
      return;
    }
    if (ai.mode === 'idle') {
      ai.timer -= dt;
      p.moveX = p.moveZ = 0;
      if (ai.timer <= 0) ai.mode = 'walk';
      return;
    }
    const t = this.target(ai);
    const dx = t.x - p.pos.x;
    const dz = t.z - p.pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.8) {
      // at a corner: sometimes cross to the neighbouring block, sometimes pause
      if (rng.chance(0.3)) {
        const [cx, cz] = CORNERS[ai.corner];
        const horizontal = rng.chance(0.5);
        const nbx = ai.bx + (horizontal ? cx : 0);
        const nbz = ai.bz + (horizontal ? 0 : cz);
        if (nbx >= 0 && nbz >= 0 && nbx < CITY.blocks && nbz < CITY.blocks) {
          ai.bx = nbx;
          ai.bz = nbz;
          // the matching corner on the far side of the road
          const tx = horizontal ? -cx : cx;
          const tz = horizontal ? cz : -cz;
          ai.corner = CORNERS.findIndex(([a, b]) => a === tx && b === tz);
          return;
        }
      }
      if (rng.chance(0.15)) { ai.mode = 'idle'; ai.timer = rng.range(1.5, 4); }
      ai.corner = (ai.corner + (ai.dir > 0 ? 1 : 3)) % 4;
      return;
    }
    p.moveX = (dx / len) * ai.speed;
    p.moveZ = (dz / len) * ai.speed;
  }
}
