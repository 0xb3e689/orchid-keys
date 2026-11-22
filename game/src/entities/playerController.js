// Dez Navarro, the player: walking and sprinting relative to the camera, jumping, punching and
// shooting where the crosshair points, switching weapons, entering parked cars, dragging
// drivers out (carjacking), driving with handbrake drifts, drive-by shooting and bailing out.
import * as THREE from 'three';
import { PLAYER } from '../config.js';
import { emit } from '../core/eventBus.js';
import { Character } from './character.js';
import { LOOKS } from './humanModel.js';
import { WEAPONS, WEAPON_ORDER } from '../combat/weapons.js';

const aimOrigin = new THREE.Vector3();
const aimDir = new THREE.Vector3();

export class Player {
  constructor(game, x, z, heading = 0) {
    this.game = game;
    this.body = new Character(LOOKS.player, x, z, heading);
    this.body.faction = 'player';
    this.body.health = PLAYER.maxHealth;
    this.body.isPlayer = true;
    this.armor = 0;
    this.vehicle = null;
    this.ammo = { fists: Infinity };
    this.weapon = 'fists';
    this.fireCooldown = 0;
    this.aimTimer = 0;
    this.dead = false;
    this.aiming = false;
    this.enterLock = 0;
    const baseHurt = this.body.hurt.bind(this.body);
    this.body.hurt = (amount, fx, fz, force) => {
      if (this.game.invulnerable) return false;
      const absorbed = Math.min(this.armor, amount * 0.7);
      this.armor -= absorbed;
      emit('playerHurt', { amount });
      return baseHurt(amount - absorbed, fx, fz, force);
    };
    game.scene.add(this.body.mesh);
  }

  get pos() { return this.vehicle ? this.vehicle.pos : this.body.pos; }
  get health() { return this.body.health; }
  set health(v) { this.body.health = v; }
  get heading() { return this.vehicle ? this.vehicle.heading : this.body.heading; }

  /** What enemies aim at and chase. */
  targetInfo() {
    return { pos: this.pos, character: this.body, vehicle: this.vehicle, speed: this.vehicle ? this.vehicle.absSpeed : 0 };
  }

  giveWeapon(id, ammo) {
    this.ammo[id] = (this.ammo[id] ?? 0) + ammo;
    if (this.weapon === 'fists') this.weapon = id;
    emit('weaponGiven', { id });
  }

  cycleWeapon(step) {
    const owned = WEAPON_ORDER.filter((w) => this.ammo[w] > 0);
    const i = owned.indexOf(this.weapon);
    this.weapon = owned[(i + step + owned.length) % owned.length];
    emit('weaponSwitched', { id: this.weapon });
  }

  placeAt(x, z, heading = 0) {
    if (this.vehicle) this.exitVehicle(true);
    this.body.pos.set(x, 0.2, z);
    this.body.heading = heading;
    this.body.knockX = this.body.knockZ = 0;
    this.body.down = 0;
  }

  update(dt, input, cam) {
    if (this.dead) return;
    this.fireCooldown -= dt;
    this.enterLock -= dt;
    if (input.wasPressed('KeyQ') || input.wheel < 0) this.cycleWeapon(-1);
    if (input.wasPressed('KeyE') || input.wheel > 0) this.cycleWeapon(1);
    WEAPON_ORDER.forEach((w, i) => { if (input.wasPressed('Digit' + (i + 1)) && this.ammo[w] > 0) this.weapon = w; });

    if (this.vehicle) this.updateDriving(dt, input, cam);
    else this.updateOnFoot(dt, input, cam);

    if (this.body.health <= 0 && !this.dead) {
      this.dead = true;
      emit('wasted', {});
    }
  }

  updateOnFoot(dt, input, cam) {
    const b = this.body;
    const fwd = input.axis('KeyS', 'KeyW') || input.axis('ArrowDown', 'ArrowUp');
    const strafe = input.axis('KeyA', 'KeyD') || input.axis('ArrowLeft', 'ArrowRight');
    const yaw = cam.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    let mx = fx * fwd + -fz * strafe;
    let mz = fz * fwd + fx * strafe;
    const len = Math.hypot(mx, mz);
    this.aiming = input.mouseHeld(2) && this.weapon !== 'fists';
    const sprint = input.isDown('ShiftLeft') && !this.aiming;
    const speed = this.aiming ? PLAYER.walk * 0.8 : sprint ? PLAYER.sprint : PLAYER.walk * 1.4;
    if (len > 0.01) { mx = (mx / len) * speed; mz = (mz / len) * speed; }
    b.moveX = mx;
    b.moveZ = mz;
    if (input.wasPressed('Space') && b.pos.y < 0.25 && !b.isDown) b.vy = 6.2;
    this.aimTimer -= dt;
    if (this.aiming || this.aimTimer > 0) {
      b.pose = this.weapon === 'fists' ? 'normal' : 'aim';
    } else {
      b.pose = 'normal';
    }
    b.model.gun.visible = this.weapon !== 'fists';
    b.step(dt, this.game.collision);
    // face the crosshair while aiming
    if (this.aiming || this.aimTimer > 0) b.heading = yaw;
    b.syncMesh();

    const firing = WEAPONS[this.weapon].auto ? input.mouseHeld(0) : input.mouseClicked(0);
    if (firing && this.fireCooldown <= 0 && !b.isDown) this.fire(cam, b.pos.x, b.pos.y + 1.45, b.pos.z);

    if (input.wasPressed('KeyF') && this.enterLock <= 0) this.tryEnterVehicle();
  }

  fire(cam, ox, oy, oz, vehicle = null) {
    const w = WEAPONS[this.weapon];
    this.fireCooldown = w.cooldown;
    this.aimTimer = 0.6;
    if (w.melee) {
      this.body.heading = cam.yaw;
      this.game.punch(this.body);
      return;
    }
    if (this.ammo[this.weapon] <= 0) { this.cycleWeapon(-1); return; }
    this.ammo[this.weapon]--;
    aimOrigin.set(ox + Math.sin(cam.yaw) * 0.6, oy, oz + Math.cos(cam.yaw) * 0.6);
    const target = cam.aimPoint(this.game.collision);
    aimDir.copy(target).sub(aimOrigin).normalize();
    this.game.fireFrom({ pos: this.body.pos, character: this.body, faction: 'player', vehicle }, this.weapon, aimOrigin, aimDir);
    if (this.ammo[this.weapon] <= 0) this.cycleWeapon(-1);
  }

  tryEnterVehicle() {
    const b = this.body;
    const v = this.game.vehicles.nearestTo(b.pos.x, b.pos.z, 4.2, (c) => !c.destroyed && !c.tags.has('noEnter'));
    if (!v) return;
    const previous = v.driver;
    if (previous && previous !== 'player') {
      emit('carjack', { vehicle: v, previousDriver: previous });
    }
    this.enterVehicle(v);
  }

  enterVehicle(v) {
    this.vehicle = v;
    v.driver = 'player';
    v.siren = false;
    v.controls.throttle = 0;
    this.body.inVehicle = v;
    this.body.mesh.visible = false;
    this.enterLock = 0.4;
    emit('enteredVehicle', { vehicle: v });
  }

  exitVehicle(force = false) {
    const v = this.vehicle;
    if (!v) return;
    const speed = v.absSpeed;
    const side = { x: Math.cos(v.heading), z: -Math.sin(v.heading) };
    const off = v.type.W / 2 + 0.7;
    let x = v.pos.x + side.x * off;
    let z = v.pos.z + side.z * off;
    if (this.game.collision.pointBlocked(x, z)) {
      x = v.pos.x - side.x * off;
      z = v.pos.z - side.z * off;
    }
    this.body.pos.set(x, 0.2, z);
    this.body.heading = v.heading;
    this.body.inVehicle = null;
    this.body.mesh.visible = true;
    v.driver = null;
    v.controls.throttle = 0;
    v.controls.steer = 0;
    v.controls.handbrake = !force && speed < 3;
    this.vehicle = null;
    this.enterLock = 0.4;
    if (speed > 8 && !force) {
      // bailing out at speed
      this.body.knockX = v.vx * 0.6;
      this.body.knockZ = v.vz * 0.6;
      this.body.down = 1.6;
      this.body.hurt(Math.min(30, speed * 0.8));
    }
    emit('exitedVehicle', { vehicle: v });
  }

  updateDriving(dt, input, cam) {
    const v = this.vehicle;
    if (v.destroyed) {
      this.exitVehicle(true);
      this.body.hurt(60);
      return;
    }
    const thr = input.axis('KeyS', 'KeyW') || input.axis('ArrowDown', 'ArrowUp');
    const steer = input.axis('KeyA', 'KeyD') || input.axis('ArrowLeft', 'ArrowRight');
    v.controls.throttle = thr;
    v.controls.steer = steer;
    v.controls.handbrake = input.isDown('Space');
    if (input.wasPressed('KeyH')) emit('horn', { vehicle: v });
    if (input.wasPressed('KeyG') && v.isPolice) v.siren = !v.siren;
    // the body rides along so systems that track it stay correct
    this.body.pos.set(v.pos.x, 0, v.pos.z);
    this.body.heading = v.heading;
    this.aiming = input.mouseHeld(2) && this.weapon !== 'fists';
    if (this.aiming && input.mouseHeld(0) && this.fireCooldown <= 0 && this.weapon !== 'fists') {
      this.fire(cam, v.pos.x, 1.4, v.pos.z, v);
    }
    if (input.wasPressed('KeyF') && this.enterLock <= 0) this.exitVehicle();
  }

  heal(amount) { this.body.health = Math.min(PLAYER.maxHealth, this.body.health + amount); }

  respawn(x, z, heading = 0) {
    if (this.vehicle) this.exitVehicle(true);
    this.dead = false;
    this.body.alive = true;
    this.body.down = 0;
    this.body.health = PLAYER.maxHealth;
    this.placeAt(x, z, heading);
  }
}
