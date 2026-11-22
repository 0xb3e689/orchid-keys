// ?shot=<name> stages a scene of the real game deterministically for the screenshots: the
// same seed, the same placements and a fixed number of simulation steps, then the world is
// frozen so the capture sees exactly this frame.
//   chase   - Hot Pink: fleeing OKPD on Seabreeze Boulevard at sunset (the cover)
//   city    - on foot on the Lumen Strip with traffic and pedestrians
//   mission - Neon Debt: a gunfight with the Brine Kings in Port Halcyon
//   title   - the title screen over a flyover of the island
import { STEP } from '../config.js';
import { rng } from '../core/rng.js';
import { CITY } from '../config.js';
import { DrivingAgent } from '../ai/drivingAgent.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { line } from '../missions/cast.js';
import { blockCenter, roadLine } from '../world/cityPlan.js';
import { nodeId } from '../world/roadGraph.js';

const H = CITY.half;

function beginSession(game, { money, respect, story }) {
  rng.reseed(1234);
  game.menus.show(null);
  game.resetWorld();
  game.progress.reset();
  game.progress.money = money;
  game.progress.respect = respect;
  game.progress.story = story;
  game.state = 'playing';
  game.hud.show(true);
  game.invulnerable = true;
}

/** Jump the story mission `index` straight to the step whose objective starts with `text`. */
function jumpToStep(game, index, text) {
  const def = STORY_MISSIONS[index];
  game.missions.start({ ...def, story: true });
  const a = game.missions.active;
  const k = def.steps.findIndex((s) => s.text && s.text.startsWith(text));
  a.step = null;
  a.index = k - 1;
  game.missions.advance();
  game.dialog.clear();
  game.hud.bannerTimer = 0.01;
}

function trafficCar(game, type, color, x, z, heading, speed, from, to) {
  const v = game.vehicles.spawn(type, color, x, z, heading, 'traffic');
  v.driver = 'npc';
  v.vx = Math.sin(heading) * speed;
  v.vz = Math.cos(heading) * speed;
  const agent = new DrivingAgent(v, rng.next);
  agent.startLane(from, to);
  agent.cruise = speed;
  game.traffic.agents.set(v, agent);
  return v;
}

function settle(game, steps, keep = () => {}) {
  for (let i = 0; i < steps; i++) {
    keep(i);
    game.step(STEP);
  }
  for (let i = 0; i < 30; i++) game.frame(STEP);
}

function stageChase(game) {
  beginSession(game, { money: 18450, respect: 32, story: 3 });
  const lane = H - 3;                    // westbound lane of Seabreeze Boulevard
  const x0 = blockCenter(6) + 10;
  const car = game.vehicles.spawn('kestrel', 0xff70a6, x0, lane, -Math.PI / 2, 'mission');
  car.tags.add('kestrel');
  game.player.respawn(x0, lane);
  game.player.enterVehicle(car);
  game.player.giveWeapon('smg', 180);
  game.player.weapon = 'smg';
  jumpToStep(game, 3, 'The alarm went off');
  game.missions.active.vehicles.push(car);
  game.wanted.setAtLeast(4);
  game.dialog.queue([line('radio', 'All units: pink Kestrel GT westbound on Seabreeze Boulevard. Box it in!', 30)]);
  // two cruisers right on the bumper, one closing in the oncoming lane
  const chasers = [[5.5, H + 2.6, 0.12], [7.5, H - 4.6, -0.06], [17, H - 1, 0.05]].map(([dx, z, yaw]) => {
    const v = game.police.spawnCruiser(x0 + dx, z, 0, 1e9);
    v.pos.set(x0 + dx, 0, z);
    v.heading = -Math.PI / 2 + yaw;
    return v;
  });
  // a roadblock waiting at the next junction
  const jx = roadLine(4);
  for (const [dz, h] of [[-3.2, 0.35], [3.2, Math.PI - 0.35]]) {
    const v = game.vehicles.spawn('cruiser', 0xffffff, jx + 16, H + dz, h, 'police');
    v.siren = true;
    v.tags.add('roadblock');
    game.police.cars.set(v, { agent: null, mode: 'roadblock', crew: 0, retarget: 0, life: 99 });
  }
  game.police.spawnOfficer(jx + 11, H - 6, Math.PI / 2);
  game.police.spawnOfficer(jx + 12, H + 6.5, Math.PI / 2);
  game.police.heli.activate(x0, lane);
  trafficCar(game, 'cab', 0, roadLine(4) - 30, H + 3, Math.PI / 2, 9, nodeId(3, 10), nodeId(4, 10));
  trafficCar(game, 'bayline', 0xffffff, roadLine(3) + 10, H - 3, -Math.PI / 2, 8, nodeId(4, 10), nodeId(3, 10));
  const hold = () => {
    car.vx = -34; car.vz = 0; car.heading = -Math.PI / 2; car.pos.z = lane;
    car.controls.throttle = 1; car.controls.steer = 0;
    chasers.forEach((v, i) => { v.vx = -34; v.vz = 0; v.pos.x = car.pos.x + [5.5, 7.5, 17][i]; });
  };
  settle(game, 45, hold);
  game.police.heli.pos.set(car.pos.x - 48, 26, lane - 14);
  game.police.heli.update(0.016, car.pos);
  game.followCam.override = { distance: 15, pitch: 0.2 };
  game.followCam.yaw = -Math.PI / 2 - 0.1;
  game.followCam.idleMouse = 0;
  for (let i = 0; i < 40; i++) { game.followCam.yaw = -Math.PI / 2 - 0.1; game.frame(STEP); }
  game.hud.showRadio('Radio Coral 98.1');
}

function stageCity(game) {
  beginSession(game, { money: 6720, respect: 18, story: 4 });
  const z = roadLine(5) + 8.2;           // south sidewalk of the Lumen Strip main road
  const x = roadLine(9) - 14;
  game.player.respawn(x, z, -Math.PI / 2);
  game.player.giveWeapon('pistol', 48);
  game.player.weapon = 'pistol';
  const lane = (i) => nodeId(i, 5);
  trafficCar(game, 'cab', 0, x - 18, roadLine(5) + 3, -Math.PI / 2, 10, lane(9), lane(8));
  trafficCar(game, 'manta', 0x70d6ff, x - 52, roadLine(5) - 3, Math.PI / 2, 11, lane(7), lane(8));
  trafficCar(game, 'marlin', 0xe63946, x - 85, roadLine(5) + 3, -Math.PI / 2, 12, lane(8), lane(7));
  trafficCar(game, 'sandpiper', 0xe9c46a, x - 125, roadLine(5) - 3, Math.PI / 2, 12, lane(6), lane(7));
  trafficCar(game, 'bayline', 0xffffff, x - 160, roadLine(5) + 3, -Math.PI / 2, 10, lane(7), lane(6));
  trafficCar(game, 'kestrel', 0x9b5de5, roadLine(8) - 3, roadLine(4) + 20, 0, 9, nodeId(8, 4), nodeId(8, 5));
  const parked = game.vehicles.spawn('marlin', 0x2a9d8f, x - 30, roadLine(5) + 4.7, Math.PI / 2, 'parked');
  parked.driver = null;
  for (let i = 0; i < 12; i++) {
    const px = x - 6 - i * 7.5 + rng.range(-2, 2);
    const pz = i % 3 === 0 ? roadLine(5) - 7.8 - rng.range(0, 1.5) : z + rng.range(-0.8, 1.2);
    const ped = game.peds.spawnAt(px, pz);
    ped.heading = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    ped.ai.mode = 'idle';
    ped.ai.timer = 99;
    ped.phase = rng.range(0, 6);
    ped.stride = 0.8;
  }
  settle(game, 40, () => {
    for (const p of game.peds.list) { p.moveX = Math.sin(p.heading) * 1.4; p.moveZ = Math.cos(p.heading) * 1.4; }
  });
  game.followCam.yaw = -Math.PI / 2 - 0.22;
  game.followCam.pitch = 0.08;
  for (let i = 0; i < 25; i++) game.frame(STEP);
}

function stageMission(game) {
  beginSession(game, { money: 2310, respect: 9, story: 2 });
  const wx = roadLine(1) - 8;
  const wz = blockCenter(6) + 30;
  game.player.respawn(wx + 5, wz + 6, Math.PI);
  game.player.giveWeapon('pistol', 54);
  game.player.weapon = 'pistol';
  game.player.body.health = 72;
  game.player.armor = 40;
  jumpToStep(game, 2, 'Take out the Brine Kings');
  const g = game.gangs;
  const spots = [[-4, -14], [3, -17], [-10, -9], [8, -12], [-1, -24]];
  spots.forEach(([dx, dz], i) => {
    const e = g.spawn(wx + dx, wz + dz, { tag: 'brine', weapon: i === 3 ? 'fists' : 'pistol', look: 'brine' });
    e.awake = true;
    if (i === 4) e.hurt(200, wx, wz + 6, 3);
  });
  const getaway = game.vehicles.spawn('sandpiper', 0x264653, wx - 12, wz - 4, 0.6, 'mission');
  getaway.driver = null;
  game.player.aiming = true;
  settle(game, 30, () => {
    game.player.body.moveX = game.player.body.moveZ = 0;
  });
  game.followCam.yaw = Math.PI + 0.12;
  game.followCam.pitch = 0.06;
  game.player.aiming = true;
  game.player.body.pose = 'aim';
  game.player.body.heading = Math.PI + 0.12;
  for (let i = 0; i < 25; i++) { game.player.aiming = true; game.frame(STEP); }
  game.player.body.heading = Math.PI + 0.12;
  game.player.body.pose = 'aim';
  game.player.body.syncMesh();
  // pull the trigger on the last frame so the flash and tracer are in the shot
  game.player.fire(game.followCam, game.player.body.pos.x, game.player.body.pos.y + 1.45, game.player.body.pos.z);
  const enemy = g.list[1];
  enemy.pose = 'aim';
  game.fireFrom({ pos: enemy.pos, character: enemy, faction: 'enemy' }, 'pistol', { x: enemy.pos.x, y: 1.45, z: enemy.pos.z + 0.5 }, { x: 0.15, y: 0, z: 0.99 });
  game.fx.update(0.01);
  game.hud.update(0.016, game);
}

function stageTitle(game) {
  rng.reseed(77);
  game.state = 'title';
  game.time = 5.2;
  game.menus.showStart();
  game.frame(STEP);
}

export function stageShot(game, name) {
  const stages = { chase: stageChase, city: stageCity, mission: stageMission, title: stageTitle };
  (stages[name] ?? stageChase)(game);
  game.frozen = name !== 'title';
}
