// Signs and neon: canvas-lettered signs for every landmark, glowing club signs and neon tubes
// along the Lumen Strip, and hotel names on the Coral Beach art-deco fronts.
import * as THREE from 'three';
import { createRng } from '../core/rng.js';
import { canvasTexture } from './geometryKit.js';
import { blockAt, blockCenter } from './cityPlan.js';
import { SIDEWALK_HEIGHT } from './cityBuilder.js';

const CLUB_NAMES = ['PINK PELICAN', 'NITE HERON', 'CLUB MANGO', 'TACOS 24H', 'LUCKY CONCH', 'COCO LOUNGE', 'KARAOKE', 'DISCO DRIFT', 'LIQUOR', 'PALM ARCADE', 'BAR', 'HOT SAUCE'];
const HOTEL_NAMES = ['SEAFOAM', 'MARISOL', 'BELLAIRE', 'SUNRAY', 'AZURE', 'THE CORAL', 'TIDEWATER', 'LA BRISA', 'DUNES', 'PELICAN'];
const NEON = ['#ff3fa4', '#33f0ff', '#b04bff', '#ffe066', '#7cff6b', '#ff7a33'];

let glowTexture = null;
function getGlowTexture() {
  if (!glowTexture) {
    glowTexture = canvasTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  return glowTexture;
}

/** A lettered sign as a flat mesh. neon=true draws glowing tube letters on a dark board. */
export function makeSign(text, { width = 8, height = 1.6, fg = '#ffffff', bg = '#202028', neon = false, font = 'bold' } = {}) {
  const px = 64;
  const tw = Math.max(128, Math.round((width / height) * px));
  const tex = canvasTexture(tw, px, (ctx, w, h) => {
    if (!neon) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.font = `${font} ${Math.round(h * 0.62)}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = Math.round(h * 0.62);
    while (ctx.measureText(text).width > w * 0.92 && size > 10) {
      size -= 2;
      ctx.font = `${font} ${size}px "Trebuchet MS", Verdana, sans-serif`;
    }
    if (neon) {
      ctx.shadowColor = fg;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.strokeStyle = fg;
      ctx.strokeText(text, w / 2, h / 2 + 2);
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, w / 2, h / 2 + 2);
    } else {
      ctx.fillStyle = fg;
      ctx.fillText(text, w / 2, h / 2 + 2);
    }
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: neon, toneMapped: !neon, side: THREE.DoubleSide, depthWrite: !neon });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  return mesh;
}

export function makeGlow(color, size) {
  const mat = new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size * 0.6, 1);
  return sprite;
}

/** Which side of its block a building fronts on: unit vector (fx, fz) away from the block centre. */
function frontOfBuilding(s) {
  const b = blockAt(s.x, s.z);
  if (!b) return { fx: 0, fz: 1 };
  const dx = s.x - blockCenter(b.bx);
  const dz = s.z - blockCenter(b.bz);
  if (Math.abs(dz) >= Math.abs(dx)) return { fx: 0, fz: dz >= 0 ? 1 : -1 };
  return { fx: dx >= 0 ? 1 : -1, fz: 0 };
}

function placeOnFacade(mesh, s, front, y, out = 0.12) {
  const half = front.fz ? s.d / 2 : s.w / 2;
  mesh.position.set(s.x + front.fx * (half + out), SIDEWALK_HEIGHT + y, s.z + front.fz * (half + out));
  mesh.rotation.y = Math.atan2(front.fx, front.fz);
}

const LANDMARK_SIGNS = {
  safehouse: { text: 'SUDS & SPIN', fg: '#2b2b2b', bg: '#9fe3c9' },
  garage: { text: "TIKO'S BODY SHOP", fg: '#1b1b1b', bg: '#ffd23f' },
  gunShop: { text: 'GULFSIDE ARMS', fg: '#ffffff', bg: '#b3261e' },
  police: { text: 'OKPD  CENTRAL', fg: '#ffffff', bg: '#1d4e89' },
  hospital: { text: 'MERCY PALMS', fg: '#d62828', bg: '#ffffff' },
  club: { text: 'THE VELVET LAGOON', fg: '#ff3fa4', neon: true },
  gazette: { text: 'ORCHID GAZETTE', fg: '#111111', bg: '#f1ede4' },
  couriers: { text: 'COCONUT COURIERS', fg: '#4a2c10', bg: '#ffa94d' },
};

export function buildSignage(scene, buildings) {
  const rng = createRng(1357);
  const group = new THREE.Group();
  for (const s of buildings) {
    if (s.landmark && LANDMARK_SIGNS[s.landmark]) {
      const def = LANDMARK_SIGNS[s.landmark];
      const front = s.landmark === 'garage' ? { fx: 1, fz: 0 } : s.landmark === 'club' ? { fx: -1, fz: 0 } : frontOfBuilding(s);
      const width = Math.min(18, (front.fz ? s.w : s.d) * 0.8);
      const sign = makeSign(def.text, { width, height: width / 7, fg: def.fg, bg: def.bg, neon: def.neon });
      placeOnFacade(sign, s, front, Math.min(s.h - 1.5, 6.2));
      group.add(sign);
      if (def.neon) {
        const glow = makeGlow(0xff3fa4, width * 1.4);
        glow.position.copy(sign.position);
        group.add(glow);
      }
      continue;
    }
    if (s.style === 'club' && rng.chance(0.85)) {
      const front = frontOfBuilding(s);
      const color = rng.pick(NEON);
      const width = Math.min(12, (front.fz ? s.w : s.d) * 0.7);
      const sign = makeSign(rng.pick(CLUB_NAMES), { width, height: width / 4.5, fg: color, neon: true });
      placeOnFacade(sign, s, front, rng.range(4.5, Math.max(5, s.h - 3)));
      const glow = makeGlow(color, width * 1.5);
      glow.position.copy(sign.position);
      group.add(sign, glow);
      // vertical neon tubes framing the facade
      const tubeMat = new THREE.MeshBasicMaterial({ color: rng.pick(NEON), toneMapped: false });
      for (const side of [-1, 1]) {
        const tube = new THREE.Mesh(new THREE.BoxGeometry(0.18, s.h * 0.8, 0.18), tubeMat);
        const half = front.fz ? s.w / 2 : s.d / 2;
        placeOnFacade(tube, s, front, s.h * 0.45, 0.15);
        tube.position.x += front.fz ? side * (half - 0.4) : 0;
        tube.position.z += front.fx ? side * (half - 0.4) : 0;
        group.add(tube);
      }
    } else if (s.style === 'deco' && s.h > 14 && rng.chance(0.8)) {
      const front = frontOfBuilding(s);
      const sign = makeSign(rng.pick(HOTEL_NAMES), { width: 9, height: 2, fg: rng.pick(['#ff5fa2', '#1f9e9a', '#f08a5d', '#6b4fd8']), bg: '#fff8ec' });
      placeOnFacade(sign, s, front, s.h - 2);
      group.add(sign);
    }
  }
  scene.add(group);
  return group;
}
