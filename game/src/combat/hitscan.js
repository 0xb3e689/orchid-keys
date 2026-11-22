// Bullets as instant rays: find the first person, car or wall a shot meets, apply damage and
// knock-back, and announce the shot so effects, sound, the wanted level and AI can react.
import * as THREE from 'three';
import { emit } from '../core/eventBus.js';
import { WEAPONS } from './weapons.js';

const tmpO = new THREE.Vector3();
const tmpD = new THREE.Vector3();

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx;
  const oy = o.y - cy;
  const oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}

/** Ray against a person standing (two spheres) or lying down (one low sphere). */
function rayCharacter(o, d, ch) {
  if (ch.isDown) return raySphere(o, d, ch.pos.x, ch.pos.y + 0.25, ch.pos.z, 0.6);
  return Math.min(
    raySphere(o, d, ch.pos.x, ch.pos.y + 1.35, ch.pos.z, 0.42),
    raySphere(o, d, ch.pos.x, ch.pos.y + 0.6, ch.pos.z, 0.36),
  );
}

/** Ray against a car's oriented box. */
function rayVehicle(o, d, v) {
  const c = Math.cos(-v.heading);
  const s = Math.sin(-v.heading);
  const px = o.x - v.pos.x;
  const pz = o.z - v.pos.z;
  const lo = { x: px * c + pz * s, y: o.y, z: -px * s + pz * c };
  const ld = { x: d.x * c + d.z * s, y: d.y, z: -d.x * s + d.z * c };
  const hw = v.type.W / 2;
  const hl = v.type.L / 2;
  let tmin = 0;
  let tmax = Infinity;
  for (const [p, dir, lo2, hi] of [[lo.x, ld.x, -hw, hw], [lo.y, ld.y, 0.2, 1.7], [lo.z, ld.z, -hl, hl]]) {
    if (Math.abs(dir) < 1e-9) {
      if (p < lo2 || p > hi) return Infinity;
      continue;
    }
    let t1 = (lo2 - p) / dir;
    let t2 = (hi - p) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

/**
 * Fire one trigger pull. shooter: { pos, faction, character?, vehicle? }.
 * world: { characters(): iterable, vehicles: [], collision }.
 * Returns the list of hits for this pull.
 */
export function fireWeapon(world, shooter, weaponId, origin, dir, rnd = Math.random) {
  const w = WEAPONS[weaponId];
  const pellets = w.pellets ?? 1;
  const hits = [];
  emit('shotFired', { x: origin.x, y: origin.y, z: origin.z, dir, weapon: weaponId, shooter });
  for (let p = 0; p < pellets; p++) {
    tmpD.copy(dir);
    if (w.spread) {
      tmpD.x += (rnd() - 0.5) * 2 * w.spread;
      tmpD.y += (rnd() - 0.5) * 2 * w.spread;
      tmpD.z += (rnd() - 0.5) * 2 * w.spread;
      tmpD.normalize();
    }
    tmpO.copy(origin);
    let best = w.range;
    let target = null;
    let kind = 'none';
    for (const ch of world.characters()) {
      if (!ch.alive || ch === shooter.character || ch.inVehicle) continue;
      const t = rayCharacter(tmpO, tmpD, ch);
      if (t < best) { best = t; target = ch; kind = 'character'; }
    }
    for (const v of world.vehicles) {
      if (v === shooter.vehicle) continue;
      const t = rayVehicle(tmpO, tmpD, v);
      if (t < best) { best = t; target = v; kind = 'vehicle'; }
    }
    const wall = world.collision.raycast(tmpO, tmpD, best);
    if (wall < best) { best = wall; target = null; kind = 'wall'; }
    if (tmpD.y < 0) {
      const ground = -tmpO.y / tmpD.y;
      if (ground < best) { best = ground; target = null; kind = 'ground'; }
    }
    const hx = tmpO.x + tmpD.x * best;
    const hy = tmpO.y + tmpD.y * best;
    const hz = tmpO.z + tmpD.z * best;
    if (kind === 'character') {
      const killed = target.hurt(w.damage, origin.x, origin.z, weaponId === 'shotgun' ? 2.5 : 0.6);
      emit('characterShot', { target, shooter, killed, x: hx, y: hy, z: hz, weapon: weaponId });
    } else if (kind === 'vehicle') {
      target.damage(w.damage * 1.6, shooter.faction);
      emit('vehicleShot', { target, shooter, x: hx, y: hy, z: hz });
    } else if (kind === 'wall' || kind === 'ground') {
      emit('bulletImpact', { x: hx, y: hy, z: hz });
    }
    hits.push({ kind, target, x: hx, y: hy, z: hz });
    emit('tracer', { x0: origin.x, y0: origin.y, z0: origin.z, x1: hx, y1: hy, z1: hz });
  }
  return hits;
}

/** A punch: hits the nearest standing person in front within reach. */
export function punch(world, attacker, facing) {
  const w = WEAPONS.fists;
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  let best = null;
  let bestD = w.range;
  for (const ch of world.characters()) {
    if (ch === attacker.character || !ch.alive || ch.inVehicle) continue;
    const dx = ch.pos.x - attacker.pos.x;
    const dz = ch.pos.z - attacker.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.4) { best = ch; bestD = d; }
  }
  emit('punchThrown', { x: attacker.pos.x, z: attacker.pos.z, hit: !!best });
  if (best) {
    const killed = best.hurt(w.damage, attacker.pos.x, attacker.pos.z, 4);
    emit('characterShot', { target: best, shooter: attacker, killed, x: best.pos.x, y: 1.3, z: best.pos.z, weapon: 'fists' });
  }
  return best;
}
