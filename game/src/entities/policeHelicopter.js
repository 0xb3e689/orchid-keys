// OKPD Air Unit "Kingfisher": a low-poly helicopter with a spinning rotor and a searchlight
// cone that hovers over the suspect at four stars and up.
import * as THREE from 'three';
import { box, cylinder, merge, sphere } from '../world/geometryKit.js';
import { damp, dampAngle, headingTo } from '../core/mathUtils.js';

export class PoliceHelicopter {
  constructor(scene) {
    this.group = new THREE.Group();
    const body = new THREE.Mesh(merge([
      sphere(1.4, 0, 0, 0.6, 0x14213d, 10, 8),
      box(1.6, 1.2, 2.6, 0, -0.1, -0.6, 0x14213d),
      box(1.7, 0.4, 2.0, 0, -0.35, 0.3, 0xf4f6f8),
      box(0.35, 0.35, 5.5, 0, 0.2, -4.2, 0x14213d),
      box(0.12, 1.4, 0.8, 0, 0.8, -6.8, 0xf4f6f8),
      box(1.2, 0.9, 0.9, 0, 0.3, 1.5, 0x1c2733),
      box(0.12, 0.12, 3.4, -0.8, -1.4, 0, 0x222222),
      box(0.12, 0.12, 3.4, 0.8, -1.4, 0, 0x222222),
      cylinder(0.12, 0.12, 0.6, 0, 1.0, 0, 0x222222),
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4 }));
    body.castShadow = true;
    this.rotor = new THREE.Mesh(merge([box(11, 0.06, 0.35, 0, 0, 0, 0x111111), box(0.35, 0.06, 11, 0, 0, 0, 0x111111)]), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.75 }));
    this.rotor.position.y = 1.35;
    this.tailRotor = new THREE.Mesh(box(0.05, 1.6, 0.2, 0, 0, 0, 0x111111), new THREE.MeshStandardMaterial({ vertexColors: true }));
    this.tailRotor.position.set(0.2, 0.8, -6.8);
    const coneGeo = new THREE.ConeGeometry(3.2, 34, 20, 1, true);
    coneGeo.translate(0, -17, 0);
    this.beam = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.group.add(body, this.rotor, this.tailRotor, this.beam);
    this.group.visible = false;
    scene.add(this.group);
    this.active = false;
    this.pos = new THREE.Vector3(0, 40, 0);
    this.heading = 0;
    this.fireCooldown = 2;
    this.character = null;
    this.health = 400;
  }

  activate(x, z) {
    if (this.active) return;
    this.active = true;
    this.group.visible = true;
    this.pos.set(x + 150, 45, z + 150);
  }

  deactivate() {
    this.active = false;
    this.group.visible = false;
  }

  update(dt, target) {
    if (!this.active) return;
    // orbit slowly above and behind the suspect
    const t = performance.now() / 1000;
    const gx = target.x + Math.cos(t * 0.25) * 22;
    const gz = target.z + Math.sin(t * 0.25) * 22;
    this.pos.x = damp(this.pos.x, gx, 0.6, dt);
    this.pos.z = damp(this.pos.z, gz, 0.6, dt);
    this.pos.y = damp(this.pos.y, 32, 0.5, dt);
    this.heading = dampAngle(this.heading, headingTo(this.pos.x, this.pos.z, target.x, target.z), 1.5, dt);
    this.group.position.copy(this.pos);
    this.group.rotation.set(0.12, this.heading, 0);
    this.rotor.rotation.y += dt * 28;
    this.tailRotor.rotation.x += dt * 40;
    // aim the searchlight at the suspect
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dy = this.pos.y;
    this.beam.lookAt(target.x, 0, target.z);
    this.beam.rotateX(-Math.PI / 2);
    this.beam.scale.set(1, Math.hypot(dx, dy, dz) / 34, 1);
  }
}
