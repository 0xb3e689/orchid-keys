// The game session: builds the island, owns every system, runs the fixed-step simulation in
// a sensible order, and handles the big moments (new game, load, wasted, busted, shops,
// radio, the ending). Systems talk to each other through the event bus and this object.
import * as THREE from 'three';
import { on } from './core/eventBus.js';
import { rng } from './core/rng.js';
import { formatMoney } from './core/mathUtils.js';
import { buildWorld } from './world/worldBuilder.js';
import { LANDMARKS, blockCenter, roadLine } from './world/cityPlan.js';
import { VehicleManager } from './systems/vehicleManager.js';
import { TrafficSystem } from './ai/trafficSystem.js';
import { PedestrianSystem } from './ai/pedestrianSystem.js';
import { PoliceSystem } from './ai/policeSystem.js';
import { GangSystem } from './ai/gangSystem.js';
import { WantedSystem } from './systems/wantedSystem.js';
import { Progression } from './systems/progression.js';
import { resolveVehicleHits } from './systems/vehicleContact.js';
import { wireCrimes } from './systems/crimeReporter.js';
import { SHOPS, shopSpot } from './systems/shops.js';
import { StreetPickups } from './systems/streetPickups.js';
import { applySave, readSave, writeSave } from './systems/saveGame.js';
import { Player } from './entities/playerController.js';
import { CAR_COLORS } from './entities/vehicleModels.js';
import { fireWeapon, punch } from './combat/hitscan.js';
import { FollowCamera } from './camera/followCamera.js';
import { ParticleFx } from './fx/particles.js';
import { wireEffects } from './fx/fxDirector.js';
import { sound } from './audio/soundEngine.js';
import { music, STATIONS } from './audio/musicGenerator.js';
import { WorldMarkers } from './missions/worldMarkers.js';
import { MissionRunner } from './missions/missionRunner.js';
import { createStreetRace } from './missions/streetRace.js';
import { createCourierRun } from './missions/courierJobs.js';
import { Hud } from './ui/hud.js';
import { DialogBox } from './ui/dialogBox.js';
import { MapRenderer, BLIPS } from './ui/mapRenderer.js';
import { Menus } from './ui/menus.js';

export class Game {
  constructor(renderer, input) {
    this.renderer = renderer;
    this.input = input;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.3, 2200);
    this.time = 0;
    this.state = 'title';
    this.sound = sound;

    const world = buildWorld(this.scene, renderer);
    this.world = world;
    this.collision = world.collision;

    this.progress = new Progression();
    this.wanted = new WantedSystem();
    this.vehicles = new VehicleManager(this.scene, this.collision);
    this.traffic = new TrafficSystem(this.vehicles);
    this.peds = new PedestrianSystem(this.scene, this.collision);
    this.player = new Player(this, LANDMARKS.safehouse.x, LANDMARKS.safehouse.z + 5, Math.PI);
    this.police = new PoliceSystem(this);
    this.gangs = new GangSystem(this);
    this.fx = new ParticleFx(this.scene);
    this.followCam = new FollowCamera(this.camera);
    this.markers = new WorldMarkers(this.scene);
    this.hud = new Hud();
    this.dialog = new DialogBox();
    this.map = new MapRenderer();
    this.missions = new MissionRunner(this);
    this.missions.registerActivity({ id: 'race', landmark: 'raceStart', label: 'SUNSET SPRINT', color: 0xffe066, needsVehicle: true, create: createStreetRace });
    this.missions.registerActivity({ id: 'courier', landmark: 'couriers', label: 'COCONUT COURIERS', color: 0xffa94d, needsVehicle: true, create: createCourierRun });
    this.menus = new Menus(this);
    this.pickups = new StreetPickups(this);
    this.objectiveTarget = null;
    this.radioIndex = 0;
    this.shopInside = new Set();
    this.fadeTimer = 0;

    /** What bullets can hit. */
    this.hitWorld = { characters: () => this.characters(), vehicles: this.vehicles.list, collision: this.collision };

    wireEffects(this);
    wireCrimes(this);
    this.placeShopMarkers();
    on('wasted', () => this.onWastedOrBusted('wasted'));
    on('busted', () => this.onWastedOrBusted('busted'));
    on('enteredVehicle', () => this.startRadio());
    on('exitedVehicle', () => music.stop());
    on('storyComplete', () => this.showEnding());
    input.onUnlock = () => { if (this.state === 'playing' && !this.menus.open) this.pause(); };
    this.followCam.snapBehind(Math.PI);
  }

  *characters() {
    yield this.player.body;
    yield* this.peds.list;
    yield* this.police.officers;
    yield* this.gangs.list;
  }

  fireFrom(shooter, weapon, origin, dir) { return fireWeapon(this.hitWorld, shooter, weapon, origin, dir); }
  punch(body) { return punch(this.hitWorld, { pos: body.pos, character: body, faction: 'player' }, body.heading); }

  // ---- session flow -------------------------------------------------------

  newGame() {
    this.resetWorld();
    this.progress.reset();
    const p = this.player;
    p.ammo = { fists: Infinity };
    p.weapon = 'fists';
    p.armor = 0;
    p.respawn(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z + 5, Math.PI);
    this.followCam.snapBehind(Math.PI);
    this.state = 'playing';
    this.hud.show(true);
    this.hud.banner('ORCHID KEYS', 'Palmetto Heights · 6:42 PM', '#ff5fa2', 3.5);
    this.hud.hint('<kbd>WASD</kbd> move · <kbd>Mouse</kbd> look · <kbd>F</kbd> steal a car · <kbd>M</kbd> map · <kbd>Esc</kbd> pause', 9);
    this.missions.startStory();
  }

  loadGame() {
    const data = readSave();
    if (!data) { this.newGame(); return; }
    this.resetWorld();
    this.progress.reset();
    this.player.respawn(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z + 5);
    applySave(this, data);
    this.followCam.snapBehind(this.player.heading);
    this.state = 'playing';
    this.hud.show(true);
    this.hud.banner('WELCOME BACK', `${formatMoney(this.progress.money)} · ${this.progress.rank.title}`, '#7cf29a', 3);
    for (const c of this.progress.ownedCars.slice(-1)) this.deliverOwnedCar(c.type);
    if (this.progress.story === 0) this.missions.startStory();
  }

  resetWorld() {
    if (this.missions.active) this.missions.cleanup();
    this.police.reset();
    this.gangs.clearAll();
    this.wanted.clear();
    for (const v of [...this.vehicles.list]) this.vehicles.remove(v);
    for (const s of this.traffic.parkingSpots) s.car = null;
    for (const p of [...this.peds.list]) this.peds.remove(p);
    this.markers.clear('step-');
    this.dialog.clear();
    this.missions.giversShown = false;
    music.stop();
  }

  quitToTitle() {
    this.state = 'title';
    this.hud.show(false);
    this.menus.showStart();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.menus.openPause();
  }

  saveNow() {
    const ok = writeSave(this);
    this.hud.toast(ok ? 'Game saved.' : 'Could not save (storage blocked).');
  }

  autosave() { writeSave(this); }

  onWastedOrBusted(kind) {
    if (this.state !== 'playing' || this.fadeTimer > 0) return;
    const p = this.progress;
    const fee = Math.min(p.money, kind === 'wasted' ? 400 + Math.floor(p.money * 0.05) : 600 + Math.floor(p.money * 0.08));
    p.addMoney(-fee);
    this.menus.fade(kind, kind === 'wasted' ? 'WASTED' : 'BUSTED', kind === 'wasted' ? `Mercy Palms bill: ${formatMoney(fee)}` : `Bail and lost weapons: ${formatMoney(fee)}`);
    if (kind === 'busted') this.player.ammo = { fists: Infinity };
    this.fadeTimer = 3.2;
    this.fadeKind = kind;
  }

  finishFade() {
    const kind = this.fadeKind;
    this.fadeTimer = 0;
    this.menus.hide();
    this.police.reset();
    this.wanted.clear();
    const spot = kind === 'wasted' ? LANDMARKS.hospital : LANDMARKS.police;
    this.player.respawn(spot.x, spot.z + 2, 0);
    this.player.weapon = this.player.ammo[this.player.weapon] > 0 ? this.player.weapon : 'fists';
    this.followCam.snapBehind(0);
    if (kind === 'ending') this.quitToTitle();
  }

  showEnding() {
    this.menus.fade('ending', 'THE SALT ORCHID IS OPEN', 'Thanks for playing Orchid Keys. The island is yours: keep racing, delivering and causing trouble.');
    this.fadeTimer = 7;
    this.fadeKind = 'ending-free';
  }

  // ---- helpers used by missions and shops ---------------------------------

  spawnMissionVehicle(type, color, x, z, heading, tag, mustSurvive = true) {
    const v = this.vehicles.spawn(type, color, x, z, heading, 'mission');
    v.tags.add('mission');
    v.tags.add(tag);
    v.mustSurvive = mustSurvive;
    if (this.missions.active) this.missions.active.vehicles.push(v);
    return v;
  }

  taggedVehicle(tag) { return this.vehicles.list.find((v) => v.tags.has(tag)) ?? null; }

  /** The aide's van for "Paper Trail": leaves Meridian and runs for the port. */
  spawnCourierVan() {
    const v = this.spawnMissionVehicle('bayline', 0x1d2d44, roadLine(6) + 3, blockCenter(5), Math.PI, 'courier', false);
    v.driver = 'enemy';
    v.health = v.maxHealth = 1100;
    this.gangs.addFleeingDriver(v, { x: roadLine(0), z: blockCenter(8) });
    return v;
  }

  resprayVehicle(v) {
    const color = rng.pick(CAR_COLORS);
    const fresh = this.vehicles.spawn(v.typeId, color, v.pos.x, v.pos.z, v.heading, v.role);
    fresh.tags = v.tags;
    fresh.owned = v.owned;
    fresh.health = fresh.maxHealth;
    this.player.vehicle = null;
    this.vehicles.remove(v);
    this.player.enterVehicle(fresh);
  }

  deliverOwnedCar(type) {
    const lm = LANDMARKS.garage;
    const x = roadLine(2) + 3;
    const z = lm.z + 14;
    const existing = this.vehicles.list.find((v) => v.owned && v.typeId === type);
    if (existing) this.vehicles.remove(existing);
    const v = this.vehicles.spawn(type, 0xff70a6, x, z, 0, 'owned');
    v.owned = true;
    this.hud.toast(`Your ${v.type.name} is parked outside Tiko's.`);
    return v;
  }

  setObjectiveTarget(p) { this.objectiveTarget = p ? { x: p.x, z: p.z, ref: p } : null; }

  freeRoamObjective() {
    const next = this.missions.storyGiverSpot();
    if (this.wanted.stars > 0) return 'You are <b>wanted</b>. Break line of sight with OKPD until the stars fade.';
    if (next) return `Next story mission: <b>${this.missions.nextStory.title}</b> · see ${next.who} (yellow blip)`;
    return 'Free roam: race at the <b>⚑</b>, run parcels for <b>Coconut Couriers</b>, or spend your money.';
  }

  placeShopMarkers() {
    for (const [id, s] of Object.entries(SHOPS)) {
      const p = shopSpot(id);
      this.markers.add('shop-' + id, { x: p.x, z: p.z, color: s.color, radius: s.onFoot ? 1.6 : 4, label: s.label });
    }
  }

  checkShops() {
    const pl = this.player;
    for (const [id, s] of Object.entries(SHOPS)) {
      const inside = this.markers.inside('shop-' + id, pl.pos.x, pl.pos.z) && (s.onFoot ? !pl.vehicle : !!pl.vehicle);
      if (inside && !this.shopInside.has(id)) {
        this.shopInside.add(id);
        if (pl.vehicle) { pl.vehicle.vx = pl.vehicle.vz = 0; }
        this.menus.openShop(id);
      } else if (!inside) this.shopInside.delete(id);
    }
  }

  startRadio() {
    if (!sound.enabled) return;
    music.play(STATIONS[this.radioIndex]);
    this.hud.showRadio(STATIONS[this.radioIndex].name);
  }

  cycleRadio() {
    this.radioIndex = (this.radioIndex + 1) % (STATIONS.length + 1);
    if (this.radioIndex === STATIONS.length) { music.stop(); this.hud.showRadio('Radio off'); return; }
    this.startRadio();
  }

  // ---- minimap and map ----------------------------------------------------

  mapGivers() {
    const out = [];
    const story = this.missions.storyGiverSpot();
    for (const lm of Object.values(LANDMARKS)) {
      if (!lm.blip || (story && story.x === lm.x && story.z === lm.z)) continue;
      out.push({ x: lm.x, z: lm.z, blip: BLIPS[lm.blip], important: false });
    }
    if (story) out.push({ x: story.x, z: story.z, blip: { letter: '!', color: '#ffd23f' }, important: true });
    return out;
  }

  minimapInfo() {
    const p = this.player;
    const police = [];
    for (const v of this.police.cars.keys()) if (!v.destroyed && v.siren) police.push(v.pos);
    for (const o of this.police.officers) if (o.alive && this.wanted.stars > 0) police.push(o.pos);
    if (this.police.heli.active) police.push(this.police.heli.pos);
    const enemies = this.gangs.list.filter((g) => g.alive).map((g) => g.pos);
    const target = this.objectiveTarget ?? this.missions.storyGiverSpot();
    return {
      x: p.pos.x, z: p.pos.z, yaw: this.followCam.yaw, heading: p.heading,
      zoom: p.vehicle ? 0.62 + Math.max(0, 0.3 - Math.abs(p.vehicle.speed) * 0.01) : 0.95,
      police, enemies, target, givers: this.mapGivers(), time: this.time,
      route: this.objectiveTarget,
    };
  }

  drawFullMap(canvas) {
    const p = this.player;
    this.map.drawFullMap(canvas, { x: p.pos.x, z: p.pos.z, heading: p.heading, givers: this.mapGivers(), target: this.objectiveTarget ?? this.missions.storyGiverSpot() });
  }

  // ---- the frame ----------------------------------------------------------

  /** One fixed simulation step. */
  step(dt) {
    this.time += dt;
    const input = this.input;
    const player = this.player;
    if (this.fadeTimer > 0) {
      this.fadeTimer -= dt;
      if (this.fadeTimer <= 0) {
        if (this.fadeKind === 'ending-free') { this.menus.hide(); this.fadeTimer = 0; }
        else this.finishFade();
      }
    }
    const focus = player.pos;
    player.update(dt, input, this.followCam);
    this.traffic.update(dt, focus, [...this.vehicles.list, player.body, ...this.peds.list.filter((p) => p.alive && !p.isDown && p.ai?.mode !== 'flee').slice(0, 30)]);
    this.police.update(dt);
    this.gangs.update(dt);
    this.peds.update(dt, focus);
    this.vehicles.update(dt);
    resolveVehicleHits(this.vehicles.list, this.characters());
    if (player.dead) player.body.syncMesh();
    this.missions.update(dt);
    this.pickups.update(dt);
    this.dialog.update(dt);
    if (!player.dead) this.checkShops();
    if (player.vehicle && Math.abs(player.vehicle.lateralSlip ?? 0) > 4.5 && player.vehicle.absSpeed > 6) {
      const v = player.vehicle;
      this.fx.tyreSmoke(v.pos.x - v.forwardX * 1.6, v.pos.z - v.forwardZ * 1.6);
    }
    if (player.vehicle) this.progress.stats.distanceDriven += player.vehicle.absSpeed * dt;
  }

  /** Per-frame work outside the fixed step: camera, effects, audio, HUD. */
  frame(dt) {
    const input = this.input;
    if (this.state === 'playing' && !this.menus.blocking) {
      if (input.wasPressed('KeyM')) this.menus.openMap(null);
      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) this.pause();
      if (input.wasPressed('KeyR') && this.player.vehicle) this.cycleRadio();
      if (input.wasPressed('Enter')) this.dialog.skip();
    } else {
      this.menus.handleKeys(input);
    }
    if (this.state === 'title') this.titleFlyover(dt);
    else this.followCam.update(dt, this.player, input, this.collision);
    this.world.sky.follow(this.camera, this.state === 'title' ? this.camera.position : this.player.pos);
    this.world.terrain.update(this.time);
    this.fx.update(dt);
    this.markers.update(dt, this.camera);
    if (this.state === 'playing') {
      this.hud.update(dt, this);
      this.map.drawMinimap(document.getElementById('hud-minimap'), this.minimapInfo());
      const v = this.player.vehicle;
      sound.setEngine(!!v && !this.menus.blocking, v ? Math.min(1, Math.abs(v.speed) / v.type.maxSpeed) : 0, v ? Math.abs(v.controls.throttle) : 0);
      sound.setSiren(this.police.nearestSirenDistance(this.player.pos.x, this.player.pos.z));
    }
  }

  /** Behind the title screen: a slow helicopter orbit over Meridian toward the sunset. */
  titleFlyover(dt) {
    this.time += dt;
    const a = this.time * 0.035 + 2.2;
    this.camera.position.set(Math.cos(a) * 260, 95, Math.sin(a) * 260 + 60);
    this.camera.lookAt(0, 25, 120);
    // keep the streets under the camera alive
    const focus = { x: Math.cos(a) * 150, z: Math.sin(a) * 150 + 80 };
    this.traffic.update(dt, focus, this.vehicles.list);
    this.vehicles.update(dt);
    this.peds.update(dt, focus);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
