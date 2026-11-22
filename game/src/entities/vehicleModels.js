// The island's own cars, built from coloured boxes merged into one body mesh each, with
// separate wheels (they spin and steer), head/tail lights and, for OKPD cruisers, a light bar.
import * as THREE from 'three';
import { box, cylinder, merge, paint } from '../world/geometryKit.js';

/** Handling and look for every vehicle model on the island. Speeds in m/s. */
export const VEHICLE_TYPES = {
  marlin: { name: 'Marlin Sedan', L: 4.6, W: 1.9, maxSpeed: 40, accel: 10, brake: 22, grip: 8, steer: 0.55, health: 900, mass: 1.2, price: 2500, shape: 'sedan' },
  kestrel: { name: 'Kestrel GT', L: 4.4, W: 2.0, maxSpeed: 56, accel: 16, brake: 26, grip: 9.5, steer: 0.5, health: 750, mass: 1.0, price: 12000, shape: 'sports' },
  cab: { name: 'Coconut Cab', L: 4.7, W: 1.9, maxSpeed: 38, accel: 9.5, brake: 22, grip: 8, steer: 0.55, health: 950, mass: 1.2, price: 3000, shape: 'taxi' },
  bayline: { name: 'Bayline Van', L: 5.1, W: 2.05, maxSpeed: 31, accel: 7, brake: 18, grip: 6.5, steer: 0.5, health: 1300, mass: 1.8, price: 4000, shape: 'van' },
  sandpiper: { name: 'Sandpiper Pickup', L: 5.0, W: 2.0, maxSpeed: 37, accel: 9, brake: 20, grip: 7, steer: 0.52, health: 1200, mass: 1.6, price: 5000, shape: 'pickup' },
  manta: { name: 'Manta Convertible', L: 4.5, W: 1.95, maxSpeed: 47, accel: 12.5, brake: 24, grip: 8.5, steer: 0.55, health: 800, mass: 1.1, price: 8000, shape: 'convertible' },
  cruiser: { name: 'OKPD Cruiser', L: 4.8, W: 1.95, maxSpeed: 50, accel: 14, brake: 26, grip: 9, steer: 0.55, health: 1400, mass: 1.5, price: 0, shape: 'police' },
};

export const CIVILIAN_TYPES = ['marlin', 'marlin', 'cab', 'bayline', 'sandpiper', 'manta', 'kestrel', 'marlin'];
export const CAR_COLORS = [0xe63946, 0xf1faee, 0x1d3557, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0xff70a6, 0x70d6ff, 0x9b5de5, 0x222222, 0xc0c0c0, 0x06d6a0];

const GLASS = 0x1c2733;
const TRIM = 0x18181c;
const geometryCache = new Map();

/** A box whose top face is pulled in (narrower and shorter): sloped windscreens and roofs. */
function cabin(w, h, d, x, y, z, color, topW = 0.86, topD = 0.7, lean = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * topW);
      p.setZ(i, p.getZ(i) * topD + lean);
    }
  }
  g.computeVertexNormals();
  g.translate(x, y, z);
  return paint(g, color);
}

function bodyParts(shape, L, W, color) {
  const p = [];
  const hl = L / 2;
  switch (shape) {
    case 'sports':
      p.push(cabin(W, 0.5, L, 0, 0.6, 0, color, 0.97, 0.93));
      p.push(cabin(W - 0.3, 0.45, 1.95, 0, 1.07, -0.3, GLASS, 0.84, 0.6, -0.12));
      p.push(box((W - 0.3) * 0.84 + 0.02, 0.06, 1.17, 0, 1.32, -0.42, color));
      p.push(box(W, 0.08, 0.5, 0, 1.12, -hl + 0.25, color));
      p.push(box(0.1, 0.25, 0.1, -W / 2 + 0.3, 0.95, -hl + 0.3, TRIM));
      p.push(box(0.1, 0.25, 0.1, W / 2 - 0.3, 0.95, -hl + 0.3, TRIM));
      break;
    case 'van':
      p.push(box(W, 1.65, L - 0.8, 0, 1.25, -0.4, color));
      p.push(box(W, 0.9, 0.8, 0, 0.8, hl - 0.4, color));
      p.push(box(W - 0.1, 0.55, 0.3, 0, 1.6, hl - 0.95, GLASS));
      p.push(box(W + 0.02, 0.45, 1.2, 0, 1.6, hl - 1.7, GLASS));
      p.push(box(W + 0.03, 0.18, L - 1, 0, 0.9, -0.4, 0xffffff));
      break;
    case 'pickup':
      p.push(box(W, 0.7, L, 0, 0.75, 0, color));
      p.push(box(W - 0.1, 0.7, 1.6, 0, 1.45, 0.35, color));
      p.push(box(W - 0.05, 0.45, 1.5, 0, 1.45, 0.38, GLASS));
      p.push(box(0.12, 0.35, 2.0, -W / 2 + 0.06, 1.25, -1.3, color));
      p.push(box(0.12, 0.35, 2.0, W / 2 - 0.06, 1.25, -1.3, color));
      p.push(box(W, 0.35, 0.12, 0, 1.25, -hl + 0.06, color));
      break;
    case 'convertible':
      p.push(cabin(W, 0.6, L, 0, 0.65, 0, color, 0.97, 0.94));
      p.push(cabin(W - 0.2, 0.34, 0.14, 0, 1.11, 0.55, GLASS, 0.95, 1, -0.12));
      p.push(box(W - 0.4, 0.25, 1.4, 0, 0.98, -0.5, 0xd9c7a2));
      break;
    default: {
      // sedan, taxi and police share the saloon body
      p.push(cabin(W, 0.62, L, 0, 0.66, 0, color, 0.98, 0.95));
      p.push(cabin(W - 0.16, 0.58, 2.55, 0, 1.25, -0.2, GLASS, 0.9, 0.72, -0.06));
      p.push(box((W - 0.16) * 0.9 + 0.02, 0.07, 1.84, 0, 1.57, -0.26, color));
      if (shape === 'taxi') {
        p.push(box(0.9, 0.3, 0.4, 0, 1.72, -0.2, 0xfff3b0));
        p.push(box(W + 0.02, 0.16, L * 0.6, 0, 0.75, 0, 0x1b4332));
      }
      if (shape === 'police') {
        p.push(box(W + 0.02, 0.5, 2.0, 0, 0.72, 0.1, 0x14213d));
        p.push(box(1.3, 0.14, 0.35, 0, 1.64, -0.2, TRIM));
      }
    }
  }
  // bumpers and grille
  p.push(box(W + 0.04, 0.2, 0.18, 0, 0.42, hl - 0.05, TRIM));
  p.push(box(W + 0.04, 0.2, 0.18, 0, 0.42, -hl + 0.05, TRIM));
  return p;
}

function bodyGeometry(shape, L, W, color) {
  const key = `${shape}-${L}-${W}-${color}`;
  if (!geometryCache.has(key)) geometryCache.set(key, merge(bodyParts(shape, L, W, color)));
  return geometryCache.get(key);
}

const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.45 });
const burntMaterial = new THREE.MeshStandardMaterial({ color: 0x1d1b1a, roughness: 1 });
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const headMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false });
const wheelGeometry = merge([
  cylinder(0.36, 0.36, 0.26, 0, 0, 0, 0x151515, 12, Math.PI / 2),
  cylinder(0.2, 0.2, 0.28, 0, 0, 0, 0xbfbfbf, 8, Math.PI / 2),
]);
wheelMaterial.vertexColors = true;
wheelMaterial.color.set(0xffffff);

/**
 * Build a drivable car's visual. Returns { root, body, wheels[4], tail (material), lightbar }.
 * The root's origin is at ground level under the car's centre; the car faces +Z.
 */
export function buildVehicleModel(typeId, color) {
  const t = VEHICLE_TYPES[typeId];
  const root = new THREE.Group();
  const bodyColor = t.shape === 'police' ? 0xf4f6f8 : t.shape === 'taxi' ? 0x7be0b0 : color;
  const body = new THREE.Mesh(bodyGeometry(t.shape, t.L, t.W, bodyColor), bodyMaterial);
  body.castShadow = true;
  root.add(body);

  const hl = t.L / 2;
  const heads = new THREE.Mesh(merge([
    box(0.42, 0.16, 0.06, -t.W / 2 + 0.35, 0.72, hl + 0.01, 0xffffff),
    box(0.42, 0.16, 0.06, t.W / 2 - 0.35, 0.72, hl + 0.01, 0xffffff),
  ]), headMaterial);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x8a0d12, toneMapped: false });
  const tails = new THREE.Mesh(merge([
    box(0.4, 0.14, 0.06, -t.W / 2 + 0.33, 0.75, -hl - 0.01, 0xffffff),
    box(0.4, 0.14, 0.06, t.W / 2 - 0.33, 0.75, -hl - 0.01, 0xffffff),
  ]), tailMat);
  body.add(heads, tails);

  const wheels = [];
  const wx = t.W / 2 - 0.08;
  const wz = hl - 0.85;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Mesh(wheelGeometry, wheelMaterial);
    w.position.set(x, 0.36, z);
    w.castShadow = false;
    root.add(w);
    wheels.push(w);
  }

  let lightbar = null;
  if (t.shape === 'police') {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.32), new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.32), new THREE.MeshBasicMaterial({ color: 0x2a6bff, toneMapped: false }));
    red.position.set(-0.33, 1.78, -0.2);
    blue.position.set(0.33, 1.78, -0.2);
    body.add(red, blue);
    lightbar = { red, blue };
  }
  return { root, body, wheels, tailMaterial: tailMat, lightbar };
}

export function burnModel(model) {
  model.body.material = burntMaterial;
  for (const w of model.wheels) w.visible = false;
}
