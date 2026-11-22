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
  game.hud.shownMoney = money;
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
  jumpToStep(game, 3, 'The alarm went off!');
  game.missions.active.vehicles.push(car);
  game.wanted.setAtLeast(4);
  game.dialog.queue([line('radio', 'All units: pink Kestrel GT westbound on Seabreeze Boulevard. Box it in!', 30)]);
  // two cruisers right on the bumper, one closing in the oncoming lane
  const offsets = [3.2, 11];
  const chasers = [[offsets[0], H + 2.9, -0.1], [offsets[1], H + 2.4, 0.05]].map(([dx, z, yaw]) => {
    const v = game.police.spawnCruiser(x0 + dx, z, 0, 1e9);
    v.pos.set(x0 + dx, 0, z);
    v.heading = -Math.PI / 2 + yaw;
    return v;
  });
  // a roadblock thrown across the boulevard ahead
  const jx = x0 - 78;
  for (const [dz, h] of [[-3.2, 0.35], [3.2, Math.PI - 0.35]]) {
    const v = game.vehicles.spawn('cruiser', 0xffffff, jx, H + dz, h, 'police');
    v.siren = true;
    v.tags.add('roadblock');
    game.police.cars.set(v, { agent: null, mode: 'roadblock', crew: 0, retarget: 0, life: 99 });
  }
  game.police.spawnOfficer(jx - 4, H - 6.5, Math.PI / 2);
  game.police.spawnOfficer(jx - 3, H + 7, Math.PI / 2);
  // and one more cruiser charging head-on in the oncoming lane
  const head = game.police.spawnCruiser(x0 - 40, H + 3, 0, 1e9);
  head.pos.set(x0 - 40, 0, H + 3);
  head.heading = Math.PI / 2 - 0.12;
  game.police.heli.activate(x0, lane);
  trafficCar(game, 'cab', 0, roadLine(4) - 30, H + 3, Math.PI / 2, 9, nodeId(3, 10), nodeId(4, 10));
  trafficCar(game, 'bayline', 0xffffff, roadLine(3) + 10, H - 3, -Math.PI / 2, 8, nodeId(4, 10), nodeId(3, 10));
  const hold = () => {
    car.vx = -34; car.vz = 0; car.heading = -Math.PI / 2; car.pos.z = lane;
    car.controls.throttle = 1; car.controls.steer = 0;
    chasers.forEach((v, i) => { v.vx = -34; v.vz = 0; v.pos.x = car.pos.x + offsets[i]; });
    head.vx = 18; head.vz = 0; head.pos.z = H + 3; head.heading = Math.PI / 2 - 0.12;
  };
  settle(game, 45, hold);
  game.police.heli.pos.set(car.pos.x - 46, 24, lane + 6);
  game.police.heli.update(0.016, car.pos);
  // a cruiser scraping the Kestrel's flank, tyres smoking (staging bumps leave no damage)
  for (const v of game.vehicles.list) v.health = v.maxHealth;
  game.fx.smoke.items.length = 0;
  for (let i = 0; i < 5; i++) game.fx.tyreSmoke(car.pos.x + 2.2 + i * 0.9, car.pos.z + (i % 2 ? 0.8 : -0.8));
  game.fx.sparks(car.pos.x + 1.2, 0.7, car.pos.z + 1.3, 26, 1.4);
  game.fx.update(0.12);
  const yaw = -Math.PI / 2 + 0.2;
  game.followCam.override = { distance: 12.5, pitch: 0.17 };
  game.followCam.idleMouse = 0;
  for (let i = 0; i < 40; i++) { game.followCam.yaw = yaw; game.frame(STEP / 10); }
  game.hud.showRadio('Radio Coral 98.1');
}

function stageCity(game) {
  beginSession(game, { money: 6720, respect: 18, story: 4 });
  // Coral Beach's hotel row, looking east toward the Lumen Strip with the sun at our backs
  const road = roadLine(8);
  const z = road + 5.2;                  // at the kerb of the south sidewalk
  const x = blockCenter(3) + 4;
  game.player.respawn(x, z, Math.PI / 2 + 0.3);
  game.player.giveWeapon('pistol', 48);
  game.player.weapon = 'pistol';
  const lane = (i) => nodeId(i, 8);
  trafficCar(game, 'cab', 0, x + 16, road + 3, Math.PI / 2, 9, lane(3), lane(4));
  trafficCar(game, 'manta', 0x70d6ff, x + 30, road - 3, -Math.PI / 2, 10, lane(5), lane(4));
  trafficCar(game, 'marlin', 0xe63946, x + 58, road + 3, Math.PI / 2, 11, lane(3), lane(4));
  trafficCar(game, 'sandpiper', 0xe9c46a, x + 92, road - 3, -Math.PI / 2, 11, lane(5), lane(4));
  trafficCar(game, 'bayline', 0xffffff, x + 128, road + 3, Math.PI / 2, 10, lane(4), lane(5));
  trafficCar(game, 'kestrel', 0x9b5de5, x + 170, road - 3, -Math.PI / 2, 12, lane(6), lane(5));
  const parked = game.vehicles.spawn('marlin', 0x2a9d8f, x + 24, road + 4.7, Math.PI / 2, 'parked');
  parked.driver = null;
  for (let i = 0; i < 16; i++) {
    const north = i % 3 === 0;
    const px = x + 5 + i * 5.5 + rng.range(-1.5, 1.5);
    const pz = north ? road - 7.6 + rng.range(-0.8, 0.8) : road + 8 + rng.range(-0.8, 1.0);
    const ped = game.peds.spawnAt(px, pz);
    ped.heading = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    ped.ai.mode = 'idle';
    ped.ai.timer = 99;
    ped.phase = rng.range(0, 6);
  }
  settle(game, 40, () => {
    for (const p of game.peds.list) { p.moveX = Math.sin(p.heading) * 1.4; p.moveZ = Math.cos(p.heading) * 1.4; }
  });
  game.followCam.override = { distance: 6.2, pitch: 0.12 };
  for (let i = 0; i < 25; i++) { game.followCam.yaw = Math.PI / 2 + 0.18; game.frame(STEP / 10); }
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
  const spots = [[-5, -9], [3, -12], [-11, -6], [7, -8], [-1, -17], [11, -15]];
  spots.forEach(([dx, dz], i) => {
    const e = g.spawn(wx + dx, wz + dz, { tag: 'brine', weapon: i === 3 ? 'fists' : 'pistol', look: 'brine' });
    e.awake = true;
    if (i === 4) e.hurt(200, wx, wz + 6, 3);
  });
  // their getaway pickup, already burning after a stray round hit the tank
  const getaway = game.vehicles.spawn('sandpiper', 0x264653, wx - 9, wz - 14, 0.6, 'mission');
  getaway.driver = null;
  game.player.aiming = true;
  settle(game, 24, () => {
    game.player.body.moveX = game.player.body.moveZ = 0;
    for (const e of g.list) { e.moveX = e.moveZ = 0; }
  });
  getaway.lastHitBy = 'enemy';
  getaway.explode();
  for (let i = 0; i < 18; i++) { game.fx.update(1 / 60); getaway.update(1 / 60, game.collision); }
  const yaw = Math.PI + 0.08;
  game.followCam.override = { distance: 4.6, pitch: 0.1, fov: 62 };
  game.player.body.heading = yaw;
  for (let i = 0; i < 25; i++) { game.player.aiming = true; game.followCam.yaw = yaw; game.frame(STEP / 10); }
  game.player.body.heading = yaw;
  game.player.body.pose = 'aim';
  game.player.body.syncMesh();
  for (const e of g.list) {
    if (!e.alive) continue;
    e.heading = Math.atan2(game.player.pos.x - e.pos.x, game.player.pos.z - e.pos.z);
    e.pose = e.combat.weapon === 'fists' ? 'normal' : 'aim';
    e.syncMesh();
  }
  // pull the triggers on the last frame so flashes and tracers are in the shot
  game.player.fire(game.followCam, game.player.body.pos.x, game.player.body.pos.y + 1.45, game.player.body.pos.z);
  const enemy = g.list[1];
  game.fireFrom({ pos: enemy.pos, character: enemy, faction: 'enemy' }, 'pistol', { x: enemy.pos.x, y: 1.45, z: enemy.pos.z + 0.5 }, { x: 0.12, y: -0.02, z: 0.99 });
  game.fx.update(0.01);
  game.hud.update(0.016, game);
}

function stageTitle(game) {
  rng.reseed(77);
  game.state = 'title';
  game.time = 5.2;
  game.menus.showStart();
  for (let i = 0; i < 240; i++) game.titleFlyover(STEP / 4);
  game.frame(STEP);
}

export function stageShot(game, name) {
  const stages = { chase: stageChase, city: stageCity, mission: stageMission, title: stageTitle };
  (stages[name] ?? stageChase)(game);
  game.frozen = name !== 'title';
}
