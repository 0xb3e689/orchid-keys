// Palm trees: one curved-trunk, drooping-frond model merged into a single geometry and
// instanced along sidewalks, through the parks and down the beaches.
import * as THREE from 'three';
import { CITY } from '../config.js';
import { createRng } from '../core/rng.js';
import { merge, paint } from './geometryKit.js';
import { LANDMARKS, LOT_HALF, blockCenter, districtOfBlock, landmarkOnBlock } from './cityPlan.js';
import { islandSdf } from './coastline.js';

function palmGeometry() {
  const parts = [];
  const height = 8;
  const trunk = new THREE.CylinderGeometry(0.17, 0.3, height, 7, 8);
  trunk.translate(0, height / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + 0.022 * y * y);
    // ring bands
    const s = 1 + 0.08 * Math.max(0, Math.sin(y * 5));
    tp.setX(i, tp.getX(i) * s);
    tp.setZ(i, tp.getZ(i) * s);
  }
  trunk.computeVertexNormals();
  parts.push(paint(trunk, 0x8a6a4a));
  const topX = 0.022 * height * height;
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const len = 3.8 + (f % 3) * 0.5;
    const g = new THREE.PlaneGeometry(1.1, len, 1, 6);
    g.translate(0, len / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / len;
      const x = p.getX(i) * (1 - t * 0.85);
      // a frond reaching outward along +Z: arching up first, then drooping at the tip
      p.setXYZ(i, x, len * (0.45 * t - 0.85 * t * t) + 0.2 - Math.abs(x) * 0.25, t * len);
    }
    g.rotateY((f / fronds) * Math.PI * 2 + (f % 2) * 0.2);
    g.translate(topX, height - 0.1, 0);
    g.computeVertexNormals();
    parts.push(paint(g, f % 2 ? 0x3f7d3a : 0x4f9444));
  }
  const nuts = new THREE.SphereGeometry(0.45, 6, 4);
  nuts.translate(topX, height - 0.3, 0);
  parts.push(paint(nuts, 0x6b4a2a));
  return merge(parts);
}

/** Every palm position as { x, z, s (scale), r (yaw) }. */
function planPalms() {
  const rng = createRng(4242);
  const spots = [];
  const N = CITY.blocks;
  const edge = LOT_HALF + 1.2;
  for (let bx = 0; bx < N; bx++) {
    for (let bz = 0; bz < N; bz++) {
      const d = districtOfBlock(bx, bz);
      const lm = landmarkOnBlock(bx, bz);
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      if (lm && LANDMARKS[lm].park) {
        for (let i = 0; i < 14; i++) spots.push({ x: cx + rng.range(-22, 22), z: cz + rng.range(-22, 22) });
        continue;
      }
      if (d === 'port' || d === 'meridian') {
        if (d === 'meridian') for (const t of [-0.6, 0, 0.6]) spots.push({ x: cx + t * LOT_HALF, z: cz + edge });
        continue;
      }
      const spacing = d === 'coral' ? 11 : 14;
      for (let t = -LOT_HALF + 4; t <= LOT_HALF - 4; t += spacing) {
        spots.push({ x: cx + t, z: cz + edge });
        spots.push({ x: cx + t, z: cz - edge });
        if (d !== 'lumen') {
          spots.push({ x: cx + edge, z: cz + t });
          spots.push({ x: cx - edge, z: cz + t });
        }
      }
    }
  }
  // beach rows south and east, clusters north
  const H = CITY.half;
  for (let x = -H + 10; x < H + 40; x += rng.range(9, 16)) {
    spots.push({ x, z: H + rng.range(14, 22), beach: true });
    if (rng.chance(0.4)) spots.push({ x: x + 4, z: H + rng.range(40, 55), beach: true });
  }
  for (let z = -H; z < H; z += rng.range(10, 18)) spots.push({ x: H + rng.range(14, 24), z, beach: true });
  for (let x = -H + 80; x < H; x += rng.range(14, 24)) spots.push({ x, z: -H - rng.range(14, 30), beach: true });
  return spots
    .filter((s) => islandSdf(s.x, s.z) < -6)
    .map((s) => ({ ...s, s: rng.range(0.8, 1.25), r: rng.range(0, Math.PI * 2) }));
}

export function buildPalms(scene, collision) {
  const spots = planPalms();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(palmGeometry(), mat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach((p, i) => {
    m.compose(new THREE.Vector3(p.x, 0.1, p.z), q.setFromAxisAngle(up, p.r), new THREE.Vector3(p.s, p.s, p.s));
    mesh.setMatrixAt(i, m);
    collision.addCircle(p.x, p.z, 0.35, 8, 'palm');
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return spots;
}
