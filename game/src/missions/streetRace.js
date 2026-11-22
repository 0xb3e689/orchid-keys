// Sunset Sprint: a one-lap checkpoint street race along Coral Beach and the Lumen Strip against
// three rival drivers who route through the streets, with a countdown, live race position
// and prize money by finishing place.
import { DrivingAgent } from '../ai/drivingAgent.js';
import { rng } from '../core/rng.js';
import { roadLine } from '../world/cityPlan.js';
import { line } from './cast.js';
import { say } from './missionSteps.js';

const NODES = [[5, 10], [9, 10], [10, 8], [10, 5], [8, 5], [7, 7], [5, 7], [4, 9], [2, 10]];
export const RACE_CHECKPOINTS = NODES.map(([i, j]) => ({ x: roadLine(i), z: roadLine(j) }));
const RIVALS = [
  { type: 'kestrel', color: 0x33f0ff, name: 'Nico "Static" Reyes', skill: 0.92 },
  { type: 'manta', color: 0xffe066, name: 'Lulu Vance', skill: 0.86 },
  { type: 'marlin', color: 0xb04bff, name: 'Old Man Fitch', skill: 0.8 },
];
const PRIZES = [1500, 600, 250, 0];

function raceStep() {
  return {
    text: 'Race! Hit every checkpoint before your rivals.',
    kind: 'race',
    enter(ctx) {
      const g = ctx.game;
      const pv = g.player.vehicle;
      const s = ctx.state;
      s.countdown = 3.5;
      s.cp = 0;
      s.racers = [];
      s.finished = [];
      const start = { x: roadLine(2) + 10, z: roadLine(10) };
      if (pv) {
        pv.pos.set(start.x, 0, start.z + 3);
        pv.heading = Math.PI / 2;
        pv.vx = pv.vz = 0;
      }
      const grid = [[0, -3], [-9, 3], [-9, -3]];
      RIVALS.forEach((r, i) => {
        const v = g.spawnMissionVehicle(r.type, r.color, start.x + grid[i][0], start.z + grid[i][1], Math.PI / 2, 'racer' + i, false);
        v.driver = 'racer';
        const agent = new DrivingAgent(v, rng.next);
        agent.routeTo(RACE_CHECKPOINTS[0].x, RACE_CHECKPOINTS[0].z);
        s.racers.push({ ...r, v, agent, cp: 0, done: false });
      });
      this.showCheckpoint(ctx);
    },
    showCheckpoint(ctx) {
      const s = ctx.state;
      ctx.game.markers.clear('race-');
      const c = RACE_CHECKPOINTS[s.cp];
      if (!c) return;
      const last = s.cp === RACE_CHECKPOINTS.length - 1;
      ctx.game.markers.add('race-cp', { x: c.x, z: c.z, radius: 9, color: last ? 0xffffff : 0xffe066, label: last ? 'FINISH' : `CHECKPOINT ${s.cp + 1}/${RACE_CHECKPOINTS.length}` });
      ctx.game.setObjectiveTarget(c);
    },
    update(ctx, dt) {
      const g = ctx.game;
      const s = ctx.state;
      const pv = g.player.vehicle;
      if (s.countdown > 0) {
        s.countdown -= dt;
        const n = Math.ceil(s.countdown);
        if (n !== s.lastCount) { s.lastCount = n; g.hud.banner(n > 0 ? String(n) : 'GO!', '', '#ffe066', 0.9); g.sound.blip(n <= 0); }
        for (const r of s.racers) { r.v.controls.throttle = 0; r.v.controls.handbrake = true; }
        if (pv) { pv.controls.handbrake = true; pv.vx *= 0.5; pv.vz *= 0.5; }
        return null;
      }
      if (!pv) {
        s.outOfCar = (s.outOfCar ?? 0) + dt;
        if (s.outOfCar > 12) return 'You left your car.';
      } else s.outOfCar = 0;
      // rivals: rubber-band slightly around the player so the race stays close
      for (const r of s.racers) {
        if (r.done || r.v.destroyed || r.v.driver !== 'racer') continue;
        const lead = r.cp - s.cp;
        const top = 34 * r.skill * (lead > 0 ? 0.88 : lead < 0 ? 1.12 : 1);
        // rivals brake for civilians, never for the player: they will trade paint instead
        const traffic = g.vehicles.list.filter((v) => v !== r.v && v.role === 'traffic' && v.driver !== 'player');
        if (r.agent.updateRoute(dt, traffic, top, true, 10)) {
          r.cp++;
          if (r.cp >= RACE_CHECKPOINTS.length) { r.done = true; s.finished.push(r.name); r.v.controls.throttle = 0; r.v.controls.handbrake = true; }
          else r.agent.routeTo(RACE_CHECKPOINTS[r.cp].x, RACE_CHECKPOINTS[r.cp].z);
        }
      }
      const c = RACE_CHECKPOINTS[s.cp];
      if (pv && g.markers.inside('race-cp', pv.pos.x, pv.pos.z, 1)) {
        g.sound.blip(true);
        s.cp++;
        if (s.cp >= RACE_CHECKPOINTS.length) {
          s.place = s.finished.length + 1;
          return 'done';
        }
        this.showCheckpoint(ctx);
      }
      // live position: checkpoints passed, then distance to the next one
      const myScore = s.cp * 10000 - (c ? Math.hypot(c.x - g.player.pos.x, c.z - g.player.pos.z) : 0);
      let place = 1;
      for (const r of s.racers) {
        const rc = RACE_CHECKPOINTS[r.cp];
        const score = r.done ? 1e9 : r.cp * 10000 - (rc ? Math.hypot(rc.x - r.v.pos.x, rc.z - r.v.pos.z) : 0);
        if (score > myScore) place++;
      }
      ctx.mission.text = `Race! Position ${place}/4 · checkpoint ${s.cp + 1}/${RACE_CHECKPOINTS.length}`;
      return null;
    },
    exit(ctx) {
      ctx.game.markers.clear('race-');
      for (const r of ctx.state.racers ?? []) r.v.driver = null;
    },
  };
}

export function createStreetRace(game) {
  const def = {
    id: 'race',
    title: 'Sunset Sprint',
    subtitle: 'Street race · Coral Beach loop',
    reward: {},
    steps: [
      say(line('dez', 'Three rivals, one lap, the whole beach watching. Easy money.')),
      raceStep(),
    ],
    onPass(g) {
      const place = g.missions.active.state.place ?? 4;
      const prize = PRIZES[place - 1] ?? 0;
      if (prize) g.progress.addMoney(prize, 'Race prize');
      g.progress.addRespect(place === 1 ? 5 : place === 2 ? 2 : 1);
      if (place === 1) g.progress.stats.racesWon++;
      g.hud.toast(place === 1 ? 'You won the Sunset Sprint!' : `You finished ${['1st', '2nd', '3rd', '4th'][place - 1]}.`);
    },
  };
  return def;
}
