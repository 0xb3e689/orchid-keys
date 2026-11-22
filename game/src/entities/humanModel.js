// Low-poly people: a merged torso/head mesh with pivoting arms and legs, coloured per outfit,
// plus the walk/run cycle, aiming pose and knocked-down pose shared by everyone on foot.
import * as THREE from 'three';
import { box, merge, sphere } from '../world/geometryKit.js';
import { createRng } from '../core/rng.js';

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const cache = new Map();

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4226];
const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xf7fff7, 0x1a535c, 0xff9f1c, 0xcbf3f0, 0xe36397, 0x5e60ce, 0x80ed99, 0xffffff];
const PANTS = [0x2b2d42, 0x8d99ae, 0xedf2f4, 0x3d405b, 0xa68a64, 0x1d3557, 0xe9c46a];
const HAIR = [0x1b1b1b, 0x3b2314, 0x7a4b25, 0xd9b26f, 0x9a9a9a];

const outfitRng = createRng(55);

/** A random civilian outfit. */
export function randomLook(rnd = outfitRng) {
  return { skin: rnd.pick(SKINS), shirt: rnd.pick(SHIRTS), pants: rnd.pick(PANTS), hair: rnd.pick(HAIR), hat: rnd.chance(0.2) ? rnd.pick([0xffffff, 0xd9b26f, 0x222222]) : null };
}

export const LOOKS = {
  player: { skin: 0x8d5524, shirt: 0xf7f3e8, pants: 0x3d405b, hair: 0x1b1b1b, hat: null, accent: 0xff5fa2 },
  cop: { skin: 0xe0ac69, shirt: 0x1d3557, pants: 0x14213d, hair: 0x1b1b1b, hat: 0x14213d },
  goon: { skin: 0xc68642, shirt: 0x2b2d42, pants: 0x111111, hair: 0x1b1b1b, hat: null, accent: 0xd4af37 },
  courier: { skin: 0xf1c27d, shirt: 0xffa94d, pants: 0x2b2d42, hair: 0x3b2314, hat: 0xffa94d },
};

function key(look) { return [look.skin, look.shirt, look.pants, look.hair, look.hat, look.accent].join('-'); }

function parts(look) {
  if (cache.has(key(look))) return cache.get(key(look));
  const torso = [
    box(0.5, 0.62, 0.3, 0, 1.3, 0, look.shirt),
    box(0.46, 0.14, 0.28, 0, 0.98, 0, look.pants),
    box(0.14, 0.12, 0.14, 0, 1.66, 0, look.skin),
    sphere(0.15, 0, 1.82, 0, look.skin, 8, 6),
    sphere(0.158, 0, 1.86, -0.025, look.hair, 8, 6),
  ];
  if (look.accent) torso.push(box(0.08, 0.5, 0.31, 0.12, 1.32, 0.005, look.accent));
  if (look.hat) {
    torso.push(box(0.34, 0.1, 0.34, 0, 2.0, 0, look.hat));
    torso.push(box(0.3, 0.04, 0.2, 0, 1.95, 0.2, look.hat));
  }
  const leg = merge([box(0.2, 0.86, 0.22, 0, -0.43, 0, look.pants), box(0.22, 0.1, 0.32, 0, -0.88, 0.05, 0x222222)]);
  const arm = merge([box(0.14, 0.58, 0.16, 0, -0.29, 0, look.shirt), box(0.12, 0.12, 0.12, 0, -0.62, 0, look.skin)]);
  const result = { torso: merge(torso), leg, arm };
  cache.set(key(look), result);
  return result;
}

const gunGeometry = merge([box(0.08, 0.12, 0.34, 0, -0.62, 0.14, 0x1a1a1a)]);

export function buildHuman(look) {
  const g = parts(look);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(g.torso, material);
  torso.castShadow = true;
  body.add(torso);
  const limb = (geo, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    // limbs are too thin to matter in the shadow map; only the torso casts
    const m = new THREE.Mesh(geo, material);
    pivot.add(m);
    body.add(pivot);
    return pivot;
  };
  const legL = limb(g.leg, -0.12, 0.94);
  const legR = limb(g.leg, 0.12, 0.94);
  const armL = limb(g.arm, -0.33, 1.58);
  const armR = limb(g.arm, 0.33, 1.58);
  const gun = new THREE.Mesh(gunGeometry, material);
  gun.visible = false;
  armR.add(gun);
  return { root, body, legL, legR, armL, armR, gun };
}

/**
 * Pose a human. phase advances with distance walked; stride 0..1 (walk) to ~1.6 (sprint).
 * pose: 'normal' | 'aim' | 'down' | 'hands-up'
 */
export function animateHuman(h, phase, stride, pose = 'normal') {
  if (pose === 'down') {
    h.body.rotation.set(-Math.PI / 2, 0, 0);
    h.body.position.set(0, 0.18, 0.95);
    h.legL.rotation.x = 0.1;
    h.legR.rotation.x = -0.2;
    h.armL.rotation.x = -2.6;
    h.armR.rotation.x = -0.4;
    return;
  }
  h.body.rotation.set(0, 0, 0);
  const s = Math.sin(phase);
  const swing = 0.55 * Math.min(stride, 1.6);
  h.body.position.set(0, Math.abs(Math.cos(phase)) * 0.06 * Math.min(stride, 1.5), 0);
  h.body.rotation.x = stride > 1.1 ? 0.12 : 0;
  h.legL.rotation.x = s * swing;
  h.legR.rotation.x = -s * swing;
  h.armL.rotation.x = -s * swing * 0.8;
  h.armR.rotation.x = s * swing * 0.8;
  h.armL.rotation.z = 0;
  h.armR.rotation.z = 0;
  if (pose === 'aim') {
    h.armR.rotation.x = -Math.PI / 2;
    h.armL.rotation.x = -1.3;
    h.armL.rotation.z = -0.5;
  } else if (pose === 'hands-up') {
    h.armL.rotation.x = Math.PI;
    h.armR.rotation.x = Math.PI;
  }
}
