// Set dressing along the water: the Salt Orchid beach bar, Councilman Shore's yacht, harbour
// cranes and stacked containers in Port Halcyon, lifeguard huts and beach umbrellas.
import * as THREE from 'three';
import { CITY } from '../config.js';
import { createRng } from '../core/rng.js';
import { box, cylinder, merge, paint } from './geometryKit.js';
import { LANDMARKS, roadLine } from './cityPlan.js';
import { PIERS } from './coastline.js';
import { makeSign, makeGlow } from './signage.js';

const H = CITY.half;
const BAR_OFFSET = 9;
const vc =() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });

function beachBar() {
  const lm = LANDMARKS.saltOrchid;
  const parts = [
    box(14, 0.4, 9, 0, 0.2, 0, 0xb08a5a),
    box(10, 1.2, 1.2, 0, 0.8, 2.2, 0x6b4a2a),
    box(10.4, 0.12, 1.6, 0, 1.45, 2.2, 0xd9b38c),
  ];
  for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) parts.push(cylinder(0.15, 0.15, 3.4, x, 1.9, z, 0x7a5a3a, 6));
  const roof = new THREE.ConeGeometry(9.5, 2.6, 4);
  roof.rotateY(Math.PI / 4);
  roof.scale(1.15, 1, 0.8);
  roof.translate(0, 4.6, 0);
  parts.push(paint(roof, 0xc9a25e));
  for (let i = 0; i < 4; i++) parts.push(box(0.6, 0.6, 0.6, -3 + i * 2, 1.9, 2.2, [0xff6b6b, 0xffd23f, 0x7cf29a, 0x5aa9ff][i]));
  const mesh = new THREE.Mesh(merge(parts), vc());
  // the bar stands a few metres seaward of its marker
  mesh.position.set(lm.x, 0, lm.z + BAR_OFFSET);
  mesh.castShadow = true;
  const sign = makeSign('THE SALT ORCHID', { width: 7, height: 1.1, fg: '#ffb36b', neon: true });
  sign.position.set(lm.x, 3.6, lm.z + BAR_OFFSET - 4.7);
  sign.rotation.y = Math.PI;
  const glow = makeGlow(0xffb36b, 9);
  glow.position.copy(sign.position);
  return [mesh, sign, glow];
}

export function yachtGeometry() {
  const hull = new THREE.CylinderGeometry(1, 1, 30, 12, 1, false, 0, Math.PI);
  hull.rotateZ(Math.PI / 2);
  hull.rotateX(Math.PI);
  hull.scale(1, 2.6, 3.6);
  // taper the bow
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    if (x > 6) {
      const t = (x - 6) / 9;
      p.setZ(i, p.getZ(i) * (1 - t * 0.85));
    }
  }
  hull.translate(0, 1.2, 0);
  hull.computeVertexNormals();
  const parts = [paint(hull, 0xf4f4f4)];
  parts.push(box(26, 0.3, 6.6, -0.5, 1.25, 0, 0xb08a5a));
  parts.push(box(14, 2.4, 5.2, -3, 2.6, 0, 0xffffff));
  parts.push(box(12, 0.5, 5.4, -3, 2.4, 0, 0x1d2d44));
  parts.push(box(8, 2.0, 4.2, -4, 4.8, 0, 0xffffff));
  parts.push(box(7.6, 0.8, 4.3, -3.6, 4.6, 0, 0x1d2d44));
  parts.push(box(3, 0.3, 3, -5, 6.0, 0, 0xc9a25e));
  parts.push(cylinder(0.1, 0.1, 4, -5, 7.8, 0, 0xcccccc));
  return merge(parts);
}

function yacht() {
  const lm = LANDMARKS.yacht;
  const mesh = new THREE.Mesh(yachtGeometry(), vc());
  // moored alongside the yacht pier, clear of its deck
  mesh.position.set(lm.x - 14, -0.6, lm.z + 11.5);
  mesh.castShadow = true;
  const name = makeSign('GILDED HERON', { width: 5, height: 0.8, fg: '#c9a25e', bg: '#f4f4f4' });
  name.position.set(lm.x - 14 - 8, 1.2, lm.z + 11.5 - 3.65);
  name.rotation.y = Math.PI;
  return [mesh, name];
}

function harbour(collision) {
  const rng = createRng(77);
  const out = [];
  const colors = [0xc0392b, 0x2e86c1, 0xf39c12, 0x16a085, 0x8e44ad, 0xd35400, 0x7f8c8d];
  const parts = [];
  // container stacks on the apron
  for (let i = 0; i < 14; i++) {
    const z = -H + 30 + i * 46 + rng.range(-6, 6);
    if (PIERS.some((p) => Math.abs(z - (p.minZ + p.maxZ) / 2) < 16)) continue;
    const x = -H - 16 + rng.range(-4, 4);
    const levels = rng.int(1, 3);
    for (let l = 0; l < levels; l++) parts.push(box(2.6, 2.6, 12, x, 1.3 + l * 2.6, z, rng.pick(colors)));
    collision.addBox(x - 1.3, x + 1.3, z - 6, z + 6, levels * 2.6, 'container');
  }
  const containers = new THREE.Mesh(merge(parts), vc());
  containers.castShadow = true;
  containers.receiveShadow = true;
  out.push(containers);
  // gantry cranes over the cargo pier
  const pier = PIERS[2];
  for (const dz of [-5, 5]) {
    const cp = [];
    const z = (pier.minZ + pier.maxZ) / 2 + dz;
    const x = pier.minX + 12;
    for (const lx of [-4, 4]) cp.push(box(0.8, 22, 0.8, x + lx, 11, z, 0xe8a33d));
    cp.push(box(34, 1.6, 1.6, x - 6, 22, z, 0xe8a33d));
    cp.push(box(3, 2.4, 2.4, x - 2, 20.6, z, 0x444444));
    const crane = new THREE.Mesh(merge(cp), vc());
    crane.castShadow = true;
    out.push(crane);
  }
  return out;
}

function beachDressing(collision) {
  const rng = createRng(31);
  const parts = [];
  for (let x = -H + 40; x < H + 30; x += rng.range(16, 26)) {
    const z = H + rng.range(30, 52);
    const col = rng.pick([0xff5f7e, 0x2ec4b6, 0xffbf69, 0xffffff, 0x7b61ff]);
    parts.push(cylinder(0.05, 0.05, 2.6, x, 1.3, z, 0xdddddd, 5));
    const canopy = new THREE.ConeGeometry(1.8, 0.7, 8);
    canopy.translate(x, 2.7, z);
    parts.push(paint(canopy, col));
    parts.push(box(0.8, 0.15, 1.9, x + 1.4, 0.3, z + 0.4, col));
  }
  // lifeguard huts on stilts
  for (const x of [-H + 120, roadLine(6) + 20, H - 40]) {
    const z = H + 48;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(0.2, 2.4, 0.2, x + dx, 1.2, z + dz, 0xdddddd));
    parts.push(box(3, 2, 3, x, 3.4, z, 0xff8fab));
    parts.push(box(3.4, 0.25, 3.4, x, 4.5, z, 0x2ec4b6));
    collision.addBox(x - 1.2, x + 1.2, z - 1.2, z + 1.2, 4.5, 'hut');
  }
  const mesh = new THREE.Mesh(merge(parts), vc());
  mesh.castShadow = true;
  return [mesh];
}

export function buildCoastProps(scene, collision) {
  const group = new THREE.Group();
  group.add(...beachBar(), ...yacht(), ...harbour(collision), ...beachDressing(collision));
  const lm = LANDMARKS.saltOrchid;
  collision.addBox(lm.x - 7, lm.x + 7, lm.z + BAR_OFFSET - 4.5, lm.z + BAR_OFFSET + 1.6, 5, 'bar');
  scene.add(group);
  return group;
}
