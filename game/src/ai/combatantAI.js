// Armed people on foot (OKPD officers, Shore's crew, rival gangs): close in on a target, stop
// at firing range, aim and shoot with an accuracy that depends on who they are, or punch when
// unarmed. Officers chasing a low-wanted suspect run in to arrest instead of shooting.
import * as THREE from 'three';
import { WEAPONS } from '../combat/weapons.js';
import { fireWeapon, punch } from '../combat/hitscan.js';
import { headingTo } from '../core/mathUtils.js';

const origin = new THREE.Vector3();
const dir = new THREE.Vector3();

/** Give a character a combat brain. */
export function armCharacter(ch, weapon, { accuracy = 0.5, range = null, speed = 4.6, aggression = 1 } = {}) {
  ch.combat = {
    weapon,
    accuracy,
    range: range ?? Math.min(WEAPONS[weapon].range * 0.55, 32),
    speed,
    aggression,
    cooldown: Math.random() * 1.2,
    burst: 0,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0,
    arrestOnly: false,
  };
  ch.model.gun.visible = weapon !== 'fists';
}

/**
 * One think-step. target: { pos, character?, vehicle? } (player or anyone). world: hitscan world.
 * Returns 'arrest' when an arrest-only officer is touching the target.
 */
export function updateCombatant(ch, dt, target, world, collision) {
  const c = ch.combat;
  if (!c || !ch.alive || ch.isDown || !target) { ch.moveX = ch.moveZ = 0; return null; }
  const tx = target.pos.x;
  const tz = target.pos.z;
  const dx = tx - ch.pos.x;
  const dz = tz - ch.pos.z;
  const d = Math.hypot(dx, dz) || 0.001;
  const melee = c.weapon === 'fists' || c.arrestOnly;
  const want = melee ? 1.2 : c.range;
  c.cooldown -= dt;

  if (d > want) {
    // run in, with a little weave so a group spreads out
    const sx = -dz / d;
    const sz = dx / d;
    const weave = melee ? 0 : Math.sin(performance.now() / 600 + ch.id) * 0.35;
    ch.moveX = (dx / d + sx * weave) * c.speed;
    ch.moveZ = (dz / d + sz * weave) * c.speed;
    ch.pose = 'normal';
  } else {
    c.strafeTimer -= dt;
    if (c.strafeTimer <= 0) { c.strafe = -c.strafe; c.strafeTimer = 1.2 + Math.random() * 1.6; }
    const sideways = melee ? 0 : 1.6;
    ch.moveX = (-dz / d) * c.strafe * sideways;
    ch.moveZ = (dx / d) * c.strafe * sideways;
    ch.pose = melee ? 'normal' : 'aim';
  }
  if (!melee || d < 3) {
    // always face the target while in range
    ch.heading = headingTo(ch.pos.x, ch.pos.z, tx, tz);
  }

  if (c.arrestOnly) return d < 1.6 ? 'arrest' : null;
  if (melee) {
    if (d < 1.8 && c.cooldown <= 0) {
      c.cooldown = WEAPONS.fists.cooldown * 2;
      punch(world, { pos: ch.pos, character: ch, faction: ch.faction }, ch.heading);
    }
    return null;
  }
  if (d > WEAPONS[c.weapon].range * 0.9 || c.cooldown > 0) return null;
  // line of sight from the gun to the target's chest
  origin.set(ch.pos.x + Math.sin(ch.heading) * 0.5, ch.pos.y + 1.45, ch.pos.z + Math.cos(ch.heading) * 0.5);
  const ty = (target.vehicle ? 0.9 : target.pos.y + 1.2);
  dir.set(tx - origin.x, ty - origin.y, tz - origin.z);
  const len = dir.length();
  dir.normalize();
  if (collision.raycast(origin, dir, len) < len - 1) { c.cooldown = 0.4; return null; }
  // inaccuracy grows with distance and with the target's speed
  const miss = (1 - c.accuracy) * (0.05 + d * 0.004) + (target.speed ?? 0) * 0.004;
  dir.x += (Math.random() - 0.5) * miss * 2;
  dir.y += (Math.random() - 0.5) * miss;
  dir.z += (Math.random() - 0.5) * miss * 2;
  dir.normalize();
  fireWeapon(world, { pos: ch.pos, character: ch, faction: ch.faction }, c.weapon, origin, dir);
  const w = WEAPONS[c.weapon];
  if (w.auto) {
    c.burst++;
    c.cooldown = c.burst % 4 === 0 ? 1.1 / c.aggression : w.cooldown * 1.4;
  } else {
    c.cooldown = (w.cooldown * 3 + Math.random() * 0.8) / c.aggression;
  }
  return null;
}
