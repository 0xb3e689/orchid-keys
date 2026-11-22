// Wild orchids: 24 glowing flowers hidden around the island (street corners in every district,
// the beaches, the harbour piers). Each one found pays cash, every sixth pays a bonus, and
// finding all of them makes Dez a Keys Legend. Which ones were found is saved with the game.
import * as THREE from 'three';
import { CITY } from '../config.js';
import { LOT_HALF, blockCenter } from '../world/cityPlan.js';
import { groundHeight } from '../entities/character.js';
import { makeGlow } from '../world/signage.js';

const H = CITY.half;
const E = LOT_HALF + CITY.sidewalk * 0.5;
const corner = (bx, bz, sx, sz) => ({ x: blockCenter(bx) + sx * E, z: blockCenter(bz) + sz * E });

/** Every hiding place, in the order the save file records them. */
export const ORCHID_SPOTS = [
  corner(0, 1, -1, -1), corner(1, 7, 1, 1), corner(2, 3, 1, -1), { x: blockCenter(3) + 16, z: blockCenter(8) - E },
  corner(4, 4, 1, 1), corner(5, 0, -1, -1), corner(5, 6, 1, -1), corner(6, 2, 1, 1),
  corner(7, 9, -1, 1), corner(8, 1, 1, -1), corner(8, 6, -1, -1), corner(9, 4, 1, 1),
  corner(9, 9, 1, 1), corner(2, 9, -1, 1), corner(3, 5, 1, 1), corner(6, 8, 1, 1),
  { x: blockCenter(1), z: H + 45 }, { x: blockCenter(4) + 10, z: H + 52 }, { x: blockCenter(8), z: H + 38 },
  { x: H + 40, z: blockCenter(2) }, { x: H + 50, z: blockCenter(6) }, { x: blockCenter(3), z: -H - 40 },
  { x: blockCenter(7), z: -H - 35 }, { x: -H - 40, z: blockCenter(2) },
];
export const ORCHID_COUNT = ORCHID_SPOTS.length;
const PAY = 150;
const MILESTONES = { 6: 1000, 12: 2500, 18: 4000, 24: 10000 };

function orchidMesh() {
  const group = new THREE.Group();
  const petal = new THREE.MeshStandardMaterial({ color: 0xff6ad5, emissive: 0xc0168f, emissiveIntensity: 0.9, roughness: 0.5 });
  const lip = new THREE.MeshStandardMaterial({ color: 0xfff0fb, emissive: 0xffc4ef, emissiveIntensity: 0.6 });
  const flower = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), petal);
    const a = (i / 5) * Math.PI * 2;
    p.scale.set(1, 0.25, 0.55);
    p.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
    p.rotation.y = -a;
    flower.add(p);
  }
  const centre = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lip);
  centre.position.y = 0.05;
  flower.add(centre);
  flower.rotation.x = -0.9;
  flower.position.y = 1.1;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0x3f8f3a }));
  stem.position.y = 0.55;
  const glow = makeGlow(0xff5fd2, 3.6);
  glow.position.y = 1.1;
  // a soft pink shaft so a hidden orchid catches the eye from down the street
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.45, 6, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  shaft.position.y = 3;
  group.add(stem, flower, glow, shaft);
  group.scale.setScalar(1.35);
  group.userData.flower = flower;
  return group;
}

export class OrchidHunt {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.meshes = ORCHID_SPOTS.map((s) => {
      const m = orchidMesh();
      m.position.set(s.x, groundHeight(s.x, s.z), s.z);
      game.scene.add(m);
      return m;
    });
    this.sync();
  }

  get found() { return this.game.progress.orchids.length; }

  /** Show only the orchids not yet found (after a new game or a load). */
  sync() {
    this.got = new Set(this.game.progress.orchids);
    this.meshes.forEach((m, i) => { m.visible = !this.got.has(i); });
  }

  update(dt) {
    this.time += dt;
    const g = this.game;
    const p = g.player;
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i];
      if (this.got.has(i)) continue;
      const d = Math.hypot(p.pos.x - m.position.x, p.pos.z - m.position.z);
      m.visible = d < 240;              // far ones cost draw calls and are too small to see
      if (!m.visible) continue;
      m.userData.flower.rotation.y = this.time * 1.5 + i;
      m.userData.flower.position.y = 1.1 + Math.sin(this.time * 2.4 + i) * 0.08;
      if (!p.dead && d < (p.vehicle ? 3 : 1.6)) this.collect(i);
    }
  }

  collect(i) {
    const g = this.game;
    const pr = g.progress;
    if (pr.orchids.includes(i)) return;
    pr.orchids.push(i);
    this.got.add(i);
    this.meshes[i].visible = false;
    const n = pr.orchids.length;
    pr.addMoney(PAY, `Wild orchid ${n}/${ORCHID_COUNT}`);
    g.fx.sparks(this.meshes[i].position.x, 1.1, this.meshes[i].position.z, 18, 1);
    g.sound.cash();
    if (MILESTONES[n]) {
      pr.addMoney(MILESTONES[n], 'Orchid bonus');
      if (n === ORCHID_COUNT) {
        pr.addRespect(10);
        g.hud.banner('ORCHID HUNTER', 'Every wild orchid on the island found', '#ff6ad5', 4);
      }
    }
  }
}
