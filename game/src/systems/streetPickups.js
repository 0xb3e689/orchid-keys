// Things lying around the island for whoever explores: first-aid kits by the hospital and
// parks, armour vests near OKPD, cash stashes in Port Halcyon alleys and on the beach. Each
// respawns a minute after it is taken.
import { CITY } from '../config.js';
import { LANDMARKS, blockCenter, roadLine } from '../world/cityPlan.js';

const H = CITY.half;
const SPOTS = [
  { kind: 'health', x: LANDMARKS.hospital.x + 8, z: LANDMARKS.hospital.z },
  { kind: 'health', x: LANDMARKS.park.x, z: LANDMARKS.park.z - 20 },
  { kind: 'health', x: LANDMARKS.plaza.x - 10, z: LANDMARKS.plaza.z - 18 },
  { kind: 'armor', x: LANDMARKS.police.x - 12, z: LANDMARKS.police.z },
  { kind: 'armor', x: roadLine(9) + 8, z: blockCenter(2) },
  { kind: 'cash', x: roadLine(1) - 9, z: blockCenter(3) + 22, amount: 250 },
  { kind: 'cash', x: -H - 20, z: blockCenter(4), amount: 400 },
  { kind: 'cash', x: blockCenter(8), z: H + 48, amount: 300 },
  { kind: 'cash', x: H + 30, z: blockCenter(1), amount: 500 },
  { kind: 'cash', x: blockCenter(2), z: -H - 30, amount: 350 },
];

export class StreetPickups {
  constructor(game) {
    this.game = game;
    this.items = SPOTS.map((s, i) => ({ ...s, id: 'pickup-' + i, timer: 0, active: false }));
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    for (const it of this.items) {
      if (!it.active) {
        it.timer -= dt;
        if (it.timer <= 0) {
          it.active = true;
          g.markers.add(it.id, { x: it.x, z: it.z, kind: 'pickup', pickup: it.kind === 'health' ? 'package' : it.kind, radius: 1.4 });
        }
        continue;
      }
      if (p.vehicle || p.dead || Math.hypot(p.pos.x - it.x, p.pos.z - it.z) > 1.6) continue;
      if (it.kind === 'health' && p.health >= 100) continue;
      if (it.kind === 'armor' && p.armor >= 100) continue;
      it.active = false;
      it.timer = 60;
      g.markers.remove(it.id);
      if (it.kind === 'health') { p.heal(50); g.hud.toast('First-aid kit +50 health'); }
      else if (it.kind === 'armor') { p.armor = 100; g.hud.toast('Body armour'); }
      else { g.progress.addMoney(it.amount, 'Cash stash'); }
      g.sound.cash();
    }
  }
}
