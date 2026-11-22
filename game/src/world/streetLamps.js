// Street lamps on the corners of every block: an instanced curved post plus a warm bulb that
// reads as "evening is coming" against the sunset.
import * as THREE from 'three';
import { CITY } from '../config.js';
import { box, cylinder, merge } from './geometryKit.js';
import { LOT_HALF, blockCenter } from './cityPlan.js';

export function buildStreetLamps(scene, collision) {
  const post = merge([
    cylinder(0.09, 0.13, 6.5, 0, 3.25, 0, 0x2d3138, 6),
    box(0.1, 0.1, 1.8, 0, 6.45, 0.85, 0x2d3138),
    box(0.5, 0.18, 0.7, 0, 6.35, 1.7, 0x2d3138),
  ]);
  const bulbGeo = new THREE.BoxGeometry(0.4, 0.08, 0.55);
  bulbGeo.translate(0, 6.24, 1.7);
  const spots = [];
  const e = LOT_HALF + CITY.sidewalk - 0.6;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      // lamps face the road: rotation chosen so the arm (+Z local) points outward
      spots.push({ x: cx + e, z: cz - e * 0.5, r: Math.PI / 2 });
      spots.push({ x: cx - e, z: cz + e * 0.5, r: -Math.PI / 2 });
      spots.push({ x: cx + e * 0.5, z: cz + e, r: 0 });
      spots.push({ x: cx - e * 0.5, z: cz - e, r: Math.PI });
    }
  }
  const posts = new THREE.InstancedMesh(post, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), spots.length);
  const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, 0, s.z), q.setFromAxisAngle(up, s.r), one);
    posts.setMatrixAt(i, m);
    bulbs.setMatrixAt(i, m);
    collision.addCircle(s.x, s.z, 0.2, 6, 'lamp');
  });
  posts.castShadow = true;
  scene.add(posts, bulbs);
}
