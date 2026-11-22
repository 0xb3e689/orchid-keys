// Cartography for the HUD minimap and the pause-menu map: the island is painted once into an
// offscreen canvas (sea, beaches, district lots, building footprints, roads, piers), then the
// minimap draws it rotated around the player with blips for police, the mission target,
// story givers, shops and activities.
import { CITY } from '../config.js';
import { DISTRICTS, LANDMARKS, LOT_HALF, blockCenter, districtOfBlock, landmarkOnBlock, planBuildings, roadLine } from '../world/cityPlan.js';
import { ISLAND, PIERS } from '../world/coastline.js';

const SIZE = 1000;           // canvas pixels, 1 px = 1 m
const ORIGIN = SIZE / 2;     // world (0, 0) at the centre

export const BLIPS = {
  home: { letter: 'R', color: '#7cf29a', label: "Mama Ro's (save)" },
  garage: { letter: 'T', color: '#ffd23f', label: "Tiko's Body Shop" },
  gun: { letter: 'G', color: '#ff6b6b', label: 'Gulfside Arms' },
  police: { letter: 'P', color: '#5aa9ff', label: 'OKPD Central' },
  hospital: { letter: '+', color: '#ffffff', label: 'Mercy Palms Hospital' },
  club: { letter: 'V', color: '#ff3fa4', label: 'Velvet Lagoon' },
  paper: { letter: 'N', color: '#f1ede4', label: 'Orchid Gazette' },
  courier: { letter: 'C', color: '#ffa94d', label: 'Coconut Couriers' },
  bar: { letter: 'B', color: '#ffb36b', label: 'The Salt Orchid' },
  boat: { letter: 'Y', color: '#c084fc', label: "Shore's yacht" },
  race: { letter: '⚑', color: '#ffe066', label: 'Sunset Sprint race' },
};

function paintBase() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const W = (x) => x + ORIGIN;
  g.fillStyle = '#1f8fa8';
  g.fillRect(0, 0, SIZE, SIZE);
  // shallows then sand
  g.fillStyle = '#3fc3c0';
  g.beginPath();
  g.roundRect(W(ISLAND.minX) - 18, W(ISLAND.minZ) - 18, ISLAND.maxX - ISLAND.minX + 36, ISLAND.maxZ - ISLAND.minZ + 36, ISLAND.radius + 18);
  g.fill();
  g.fillStyle = '#e8cf9f';
  g.beginPath();
  g.roundRect(W(ISLAND.minX), W(ISLAND.minZ), ISLAND.maxX - ISLAND.minX, ISLAND.maxZ - ISLAND.minZ, ISLAND.radius);
  g.fill();
  g.fillStyle = '#9a958c';
  g.fillRect(W(ISLAND.minX), W(-CITY.half - 10), 40, CITY.half * 2 + 20);
  g.fillStyle = '#8b6d4e';
  for (const p of PIERS) g.fillRect(W(p.minX), W(p.minZ), p.maxX - p.minX, p.maxZ - p.minZ);
  // blocks by district
  const bs = CITY.pitch - CITY.roadWidth;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const lm = landmarkOnBlock(bx, bz);
      const park = lm && LANDMARKS[lm].park;
      g.fillStyle = '#b9ada0';
      g.fillRect(W(blockCenter(bx) - bs / 2), W(blockCenter(bz) - bs / 2), bs, bs);
      g.fillStyle = park ? '#5f9a4a' : DISTRICTS[districtOfBlock(bx, bz)].map;
      g.fillRect(W(blockCenter(bx) - LOT_HALF), W(blockCenter(bz) - LOT_HALF), LOT_HALF * 2, LOT_HALF * 2);
    }
  }
  g.fillStyle = 'rgba(20,16,30,0.45)';
  for (const b of planBuildings()) g.fillRect(W(b.x - b.w / 2), W(b.z - b.d / 2), b.w, b.d);
  // roads
  g.fillStyle = '#e9e6ef';
  for (let i = 0; i <= CITY.blocks; i++) {
    g.fillRect(W(roadLine(i) - CITY.roadWidth / 2), W(-CITY.half - CITY.roadWidth / 2), CITY.roadWidth, CITY.half * 2 + CITY.roadWidth);
    g.fillRect(W(-CITY.half - CITY.roadWidth / 2), W(roadLine(i) - CITY.roadWidth / 2), CITY.half * 2 + CITY.roadWidth, CITY.roadWidth);
  }
  return c;
}

export class MapRenderer {
  constructor() {
    this.base = paintBase();
  }

  static drawBlip(g, x, y, blip, size = 9) {
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.beginPath();
    g.arc(x, y, size + 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = blip.color;
    g.beginPath();
    g.arc(x, y, size, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.font = `bold ${Math.round(size * 1.3)}px Verdana, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(blip.letter, x, y + 1);
  }

  static drawArrow(g, x, y, angle, size, color) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = color;
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -size);
    g.lineTo(size * 0.7, size * 0.8);
    g.lineTo(0, size * 0.4);
    g.lineTo(-size * 0.7, size * 0.8);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  /**
   * Draw the rotating minimap. info: { x, z, yaw, heading, zoom, police:[{x,z}], target:{x,z}|null,
   * givers:[{x,z,blip}], enemies:[{x,z}], time }.
   */
  drawMinimap(canvas, info) {
    const g = canvas.getContext('2d');
    const w = canvas.width;
    const r = w / 2;
    const zoom = info.zoom;
    const rot = info.yaw + Math.PI;
    g.save();
    g.clearRect(0, 0, w, w);
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#1f8fa8';
    g.fillRect(0, 0, w, w);
    g.translate(r, r);
    g.rotate(rot);
    g.scale(zoom, zoom);
    g.drawImage(this.base, -info.x - ORIGIN, -info.z - ORIGIN);
    if (info.search) {
      // the OKPD search area while the stars blink
      const blue = Math.floor(info.time * 2) % 2 === 0;
      g.fillStyle = blue ? 'rgba(42,107,255,0.22)' : 'rgba(255,42,42,0.22)';
      g.strokeStyle = blue ? 'rgba(42,107,255,0.8)' : 'rgba(255,42,42,0.8)';
      g.lineWidth = 3 / zoom;
      g.beginPath();
      g.arc(info.search.x - info.x, info.search.z - info.z, info.search.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    if (info.route) {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 4 / zoom;
      g.setLineDash([8 / zoom, 6 / zoom]);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(info.route.x - info.x, info.route.z - info.z);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();

    const toScreen = (x, z, clampToEdge) => {
      let dx = (x - info.x) * zoom;
      let dz = (z - info.z) * zoom;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      let sx = dx * c - dz * s;
      let sy = dx * s + dz * c;
      const len = Math.hypot(sx, sy);
      if (len > r - 12) {
        if (!clampToEdge) return null;
        sx *= (r - 12) / len;
        sy *= (r - 12) / len;
      }
      return { x: r + sx, y: r + sy, edge: len > r - 12 };
    };
    for (const gv of info.givers) {
      const p = toScreen(gv.x, gv.z, gv.important);
      if (p) MapRenderer.drawBlip(g, p.x, p.y, gv.blip, gv.important ? 9 : 7);
    }
    for (const e of info.enemies) {
      const p = toScreen(e.x, e.z, false);
      if (!p) continue;
      g.fillStyle = '#ff3b3b';
      g.beginPath();
      g.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    const flash = Math.floor(info.time * 4) % 2 === 0;
    for (const c of info.police) {
      const p = toScreen(c.x, c.z, true);
      if (!p) continue;
      g.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    if (info.target) {
      const p = toScreen(info.target.x, info.target.z, true);
      g.fillStyle = '#ffd23f';
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, 8, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // player arrow, pointing along their heading relative to the view
    MapRenderer.drawArrow(g, r, r, info.yaw - info.heading, 11, '#ffffff');
    // north marker
    const n = toScreen(info.x, info.z - 10000, true);
    g.fillStyle = '#fff';
    g.font = 'bold 15px Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', n.x, n.y);
  }

  /** The full island map for the pause menu. */
  drawFullMap(canvas, info) {
    const g = canvas.getContext('2d');
    const w = canvas.width;
    const scale = w / 900;
    g.save();
    g.fillStyle = '#1f8fa8';
    g.fillRect(0, 0, w, w);
    g.scale(scale, scale);
    g.translate(450, 450);
    g.drawImage(this.base, -ORIGIN, -ORIGIN);
    g.font = 'bold 15px Verdana, sans-serif';
    g.textAlign = 'center';
    for (const [id, d] of Object.entries(DISTRICTS)) {
      const spot = { port: [-330, -150], heights: [40, -300], meridian: [-60, 20], lumen: [290, -30], coral: [0, 300] }[id];
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 3;
      g.strokeText(d.name.toUpperCase(), spot[0], spot[1]);
      g.fillText(d.name.toUpperCase(), spot[0], spot[1]);
    }
    for (const gv of info.givers) MapRenderer.drawBlip(g, gv.x, gv.z, gv.blip, 11);
    if (info.target) {
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.arc(info.target.x, info.target.z, 10, 0, Math.PI * 2);
      g.fill();
    }
    MapRenderer.drawArrow(g, info.x, info.z, Math.PI - info.heading, 13, '#ffffff');
    g.restore();
  }
}
