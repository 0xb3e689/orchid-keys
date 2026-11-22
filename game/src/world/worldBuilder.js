// Assembles the whole island in order: sky and light, terrain and sea, streets and buildings,
// palms, lamps, signs and neon, and the waterfront set pieces. Returns the collision world
// and the bits that animate.
import { CollisionWorld } from './collisionWorld.js';
import { setupSkyAndLight } from './skyAndLight.js';
import { buildTerrainAndSea } from './terrainAndSea.js';
import { buildCity } from './cityBuilder.js';
import { buildPalms } from './vegetation.js';
import { buildStreetLamps } from './streetLamps.js';
import { buildSignage } from './signage.js';
import { buildCoastProps } from './coastProps.js';

export function buildWorld(scene, renderer) {
  const collision = new CollisionWorld();
  const sky = setupSkyAndLight(scene, renderer);
  const terrain = buildTerrainAndSea(scene);
  const city = buildCity(scene, collision);
  buildPalms(scene, collision);
  buildStreetLamps(scene, collision);
  buildSignage(scene, city.buildings);
  buildCoastProps(scene, collision);
  return { collision, sky, terrain, buildings: city.buildings };
}
