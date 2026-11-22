// Coconut Couriers: a chain of timed parcel drops to random addresses around the island.
// Each drop pays more than the last; miss a deadline and the shift ends.
import { CITY } from '../config.js';
import { rng } from '../core/rng.js';
import { LOT_HALF, blockCenter, districtOfBlock, DISTRICTS } from '../world/cityPlan.js';
import { action, goTo } from './missionSteps.js';

const DROPS = 4;

function randomAddress(from) {
  for (let t = 0; t < 40; t++) {
    const bx = rng.int(1, CITY.blocks - 1);
    const bz = rng.int(0, CITY.blocks - 1);
    const side = rng.int(0, 3);
    const e = LOT_HALF + CITY.sidewalk + 2.5;
    const cx = blockCenter(bx);
    const cz = blockCenter(bz);
    const p = [[cx, cz + e], [cx, cz - e], [cx + e, cz], [cx - e, cz]][side];
    const d = Math.hypot(p[0] - from.x, p[1] - from.z);
    if (d > 180 && d < 520) return { x: p[0], z: p[1], district: DISTRICTS[districtOfBlock(bx, bz)].name };
  }
  return { x: 0, z: 0, district: 'Meridian' };
}

export function createCourierRun(game) {
  const steps = [];
  let from = { x: game.player.pos.x, z: game.player.pos.z };
  for (let i = 0; i < DROPS; i++) {
    const addr = randomAddress(from);
    const dist = Math.abs(addr.x - from.x) + Math.abs(addr.z - from.z);
    const time = Math.round(dist / 15 + 20);
    const pay = 150 + i * 75;
    steps.push(goTo(addr, `Drop ${i + 1}/${DROPS}: deliver the parcel in ${addr.district}.`, { vehicle: 'any', radius: 5, timeLimit: time, label: 'DROP-OFF' }));
    steps.push(action((ctx) => {
      ctx.game.progress.addMoney(pay, 'Delivery');
      ctx.game.hud.toast(`Parcel delivered · $${pay}`);
      ctx.game.sound.cash();
    }));
    from = addr;
  }
  return {
    id: 'courier',
    title: 'Coconut Couriers',
    subtitle: 'Delivery run · beat every deadline',
    reward: { money: 300, respect: 3 },
    steps,
    onPass(g) { g.progress.deliveriesDone++; },
  };
}
