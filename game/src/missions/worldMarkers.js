// What the player drives or walks into: glowing ground rings with a light pillar for mission
// givers and destinations, floating arrows over targets, race checkpoints and pickups.
import * as THREE from 'three';
import { makeSign } from '../world/signage.js';

function ringMesh(color, radius) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1.4, 32, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  );
  ring.position.y = 0.7;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.25;
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.25, radius * 0.6, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  pillar.position.y = 20;
  group.add(ring, disc, pillar);
  return group;
}

function arrowMesh(color) {
  const g = new THREE.ConeGeometry(0.6, 1.2, 4);
  g.rotateX(Math.PI);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
}

function pickupMesh(kind) {
  const color = kind === 'cash' ? 0x5ce65c : kind === 'ledger' ? 0xc9a25e : kind === 'armor' ? 0x4ea8ff : 0xffa94d;
  const group = new THREE.Group();
  const item = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
  item.position.y = 1;
  group.add(item, ringMesh(color, 1.1));
  return group;
}

export class WorldMarkers {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.time = 0;
  }

  /** kind: 'ring' (go here), 'arrow' (follow a moving thing), 'pickup', 'checkpoint'. */
  add(id, { x, z, color = 0xffd23f, radius = 2.5, kind = 'ring', label = null, follow = null, pickup = 'package' }) {
    this.remove(id);
    let mesh;
    if (kind === 'arrow') mesh = arrowMesh(color);
    else if (kind === 'pickup') mesh = pickupMesh(pickup);
    else mesh = ringMesh(color, radius);
    if (label) {
      const sign = makeSign(label, { width: 4, height: 0.7, fg: '#ffffff', bg: 'rgba(0,0,0,0.55)' });
      sign.position.y = kind === 'arrow' ? 1.4 : 3.2;
      sign.userData.billboard = true;
      mesh.add(sign);
    }
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const marker = { id, mesh, x, z, radius, kind, follow, color };
    this.items.set(id, marker);
    return marker;
  }

  remove(id) {
    const m = this.items.get(id);
    if (!m) return;
    this.scene.remove(m.mesh);
    this.items.delete(id);
  }

  clear(prefix = '') {
    for (const id of [...this.items.keys()]) if (id.startsWith(prefix)) this.remove(id);
  }

  get(id) { return this.items.get(id); }

  update(dt, camera) {
    this.time += dt;
    for (const m of this.items.values()) {
      if (m.follow) {
        m.x = m.follow.pos.x;
        m.z = m.follow.pos.z;
        m.mesh.position.set(m.x, (m.follow.type ? 3.4 : 2.6) + Math.sin(this.time * 4) * 0.25, m.z);
        m.mesh.rotation.y += dt * 2;
      } else if (m.kind === 'pickup') {
        m.mesh.children[0].rotation.y += dt * 2;
        m.mesh.children[0].position.y = 1 + Math.sin(this.time * 3) * 0.15;
      } else {
        const s = 1 + Math.sin(this.time * 3) * 0.04;
        m.mesh.scale.set(s, 1, s);
      }
      m.mesh.traverse((o) => {
        if (o.userData.billboard) o.quaternion.copy(m.mesh.quaternion).invert().multiply(camera.quaternion);
      });
    }
  }

  /** Is (x, z) inside marker `id`? */
  inside(id, x, z, extra = 0) {
    const m = this.items.get(id);
    return !!m && Math.hypot(m.x - x, m.z - z) < m.radius + extra;
  }
}
