// Turns the city plan into meshes: textured road segments and junctions, raised sidewalks,
// district-coloured lots, and every building as instanced boxes (one draw call per facade
// style) with rooftop clutter. Building footprints are registered as colliders.
import * as THREE from 'three';
import { CITY, PALETTE } from '../config.js';
import { canvasTexture } from './geometryKit.js';
import { createFacadeMaterial } from './facadeMaterial.js';
import { DISTRICTS, LANDMARKS, LOT_HALF, blockCenter, districtOfBlock, landmarkOnBlock, planBuildings, roadLine } from './cityPlan.js';

export const SIDEWALK_HEIGHT = 0.16;

function roadSegmentTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a4549';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const g = 50 + Math.random() * 30;
      ctx.fillStyle = `rgba(${g},${g},${g + 6},0.35)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // tyre-worn lanes
    ctx.fillStyle = 'rgba(20,20,24,0.18)';
    for (const x of [0.17, 0.33, 0.67, 0.83]) ctx.fillRect(w * x - 6, 0, 12, h);
    // edge lines and double yellow centre
    ctx.fillStyle = '#e9e4d8';
    ctx.fillRect(6, 0, 3, h);
    ctx.fillRect(w - 9, 0, 3, h);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(w / 2 - 5, 0, 3, h);
    ctx.fillRect(w / 2 + 2, 0, 3, h);
    // zebra crossings at both ends
    ctx.fillStyle = '#ecebe6';
    for (let x = 10; x < w - 10; x += 14) {
      ctx.fillRect(x, 4, 8, 34);
      ctx.fillRect(x, h - 38, 8, 34);
    }
  });
}

function junctionTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4a4549';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      const g = 50 + Math.random() * 30;
      ctx.fillStyle = `rgba(${g},${g},${g + 6},0.35)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

function lotTexture(kind) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    if (kind === 'grass') {
      ctx.fillStyle = '#6f9a4a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${60 + Math.random() * 60},${110 + Math.random() * 60},${40 + Math.random() * 30},0.5)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3);
      }
    } else {
      ctx.fillStyle = '#c9c1b6';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90,80,70,0.25)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }
  }, true);
}

function buildRoads(group) {
  const N = CITY.blocks;
  const segLen = CITY.pitch - CITY.roadWidth;
  const segTex = roadSegmentTexture();
  const segGeo = new THREE.PlaneGeometry(CITY.roadWidth, segLen);
  segGeo.rotateX(-Math.PI / 2);
  // a little sheen so the asphalt picks up the sunset instead of reading as a black hole
  const segMat = new THREE.MeshStandardMaterial({ map: segTex, roughness: 0.8, envMapIntensity: 0.7 });
  const count = 2 * (N + 1) * N;
  const segs = new THREE.InstancedMesh(segGeo, segMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let line = 0; line <= N; line++) {
    for (let b = 0; b < N; b++) {
      // along Z on x = roadLine(line)
      m.compose(new THREE.Vector3(roadLine(line), 0.02, blockCenter(b)), q.identity(), new THREE.Vector3(1, 1, 1));
      segs.setMatrixAt(k++, m);
      // along X on z = roadLine(line)
      m.compose(new THREE.Vector3(blockCenter(b), 0.02, roadLine(line)), q.setFromAxisAngle(up, Math.PI / 2), new THREE.Vector3(1, 1, 1));
      segs.setMatrixAt(k++, m);
    }
  }
  segs.receiveShadow = true;
  group.add(segs);

  const jGeo = new THREE.PlaneGeometry(CITY.roadWidth, CITY.roadWidth);
  jGeo.rotateX(-Math.PI / 2);
  const junctions = new THREE.InstancedMesh(jGeo, new THREE.MeshStandardMaterial({ map: junctionTexture(), roughness: 0.8, envMapIntensity: 0.7 }), (N + 1) * (N + 1));
  k = 0;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      m.makeTranslation(roadLine(i), 0.021, roadLine(j));
      junctions.setMatrixAt(k++, m);
    }
  }
  junctions.receiveShadow = true;
  group.add(junctions);
}

function buildBlocksGround(group) {
  const N = CITY.blocks;
  const blockSize = CITY.pitch - CITY.roadWidth;
  const sideGeo = new THREE.BoxGeometry(blockSize, SIDEWALK_HEIGHT, blockSize);
  sideGeo.translate(0, SIDEWALK_HEIGHT / 2, 0);
  const sidewalks = new THREE.InstancedMesh(sideGeo, new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.9 }), N * N);
  const lotGeo = new THREE.BoxGeometry(LOT_HALF * 2, 0.05, LOT_HALF * 2);
  lotGeo.translate(0, SIDEWALK_HEIGHT + 0.025, 0);
  const paved = [];
  const grass = [];
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  let k = 0;
  for (let bx = 0; bx < N; bx++) {
    for (let bz = 0; bz < N; bz++) {
      m.makeTranslation(blockCenter(bx), 0, blockCenter(bz));
      sidewalks.setMatrixAt(k++, m);
      const d = districtOfBlock(bx, bz);
      const lm = landmarkOnBlock(bx, bz);
      const isPark = lm && LANDMARKS[lm].park;
      (d === 'heights' || isPark ? grass : paved).push({ bx, bz, d });
    }
  }
  sidewalks.receiveShadow = true;
  group.add(sidewalks);
  for (const [list, kind] of [[paved, 'paved'], [grass, 'grass']]) {
    const tex = lotTexture(kind);
    tex.repeat.set(4, 4);
    const lots = new THREE.InstancedMesh(lotGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), list.length);
    list.forEach((l, i) => {
      m.makeTranslation(blockCenter(l.bx), 0, blockCenter(l.bz));
      lots.setMatrixAt(i, m);
      lots.setColorAt(i, c.set(kind === 'grass' ? 0xffffff : DISTRICTS[l.d].ground).lerp(new THREE.Color(0xffffff), 0.45));
    });
    lots.receiveShadow = true;
    group.add(lots);
  }
}

function buildBuildings(group, collision) {
  const specs = planBuildings();
  const byStyle = new Map();
  for (const s of specs) {
    if (!byStyle.has(s.style)) byStyle.set(s.style, []);
    byStyle.get(s.style).push(s);
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  unit.translate(0, 0.5, 0);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const q = new THREE.Quaternion();
  for (const [style, list] of byStyle) {
    const mesh = new THREE.InstancedMesh(unit, createFacadeMaterial(style), list.length);
    list.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, SIDEWALK_HEIGHT, s.z), q, new THREE.Vector3(s.w, s.h, s.d));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(s.color));
      collision.addBox(s.x - s.w / 2, s.x + s.w / 2, s.z - s.d / 2, s.z + s.d / 2, s.h);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // rooftop clutter: AC units on towers and hotels, parapet caps on houses
  const roofItems = [];
  for (const s of specs) {
    if (s.style === 'tower' || s.style === 'deco' || s.style === 'club') {
      roofItems.push({ x: s.x + s.w * 0.15, z: s.z - s.d * 0.1, w: s.w * 0.35, d: s.d * 0.3, y: s.h, h: 2.4 });
      if (s.style === 'tower' && s.h > 60) roofItems.push({ x: s.x, z: s.z, w: s.w * 0.6, d: s.d * 0.6, y: s.h, h: 6 });
    } else if (s.style === 'house') {
      roofItems.push({ x: s.x, z: s.z, w: s.w + 0.6, d: s.d + 0.6, y: s.h, h: 0.5 });
    }
  }
  const roof = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), roofItems.length);
  roofItems.forEach((r, i) => {
    m.compose(new THREE.Vector3(r.x, SIDEWALK_HEIGHT + r.y, r.z), q, new THREE.Vector3(r.w, r.h, r.d));
    roof.setMatrixAt(i, m);
    roof.setColorAt(i, c.set(r.h < 1 ? 0xb5523b : 0xd8d4cc));
  });
  roof.castShadow = true;
  group.add(roof);
  return specs;
}

/** Build the whole city into `scene`; returns the building specs for other builders. */
export function buildCity(scene, collision) {
  const group = new THREE.Group();
  group.name = 'city';
  buildRoads(group);
  buildBlocksGround(group);
  const buildings = buildBuildings(group, collision);
  scene.add(group);
  return { group, buildings };
}
