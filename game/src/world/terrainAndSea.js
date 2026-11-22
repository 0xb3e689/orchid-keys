// The island ground (sand sloping into the water, concrete along the harbour), the piers, and
// an animated sea shaded with shallow turquoise near the shore, sky reflection and sun glitter.
import * as THREE from 'three';
import { CITY, PALETTE } from '../config.js';
import { ISLAND, PIERS, islandSdf } from './coastline.js';
import { SUN_DIRECTION } from './skyAndLight.js';

const SEA_LEVEL = -0.45;

function buildGround() {
  const size = 1300;
  const seg = 160;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(20, 0, 0);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(PALETTE.sand);
  const wet = new THREE.Color(0xb59a6c);
  const concrete = new THREE.Color(0x9a958c);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = islandSdf(x, z);
    const y = d < -4 ? 0 : -Math.min(6, (d + 4) * 0.09);
    pos.setY(i, y);
    if (x < ISLAND.minX + 40 && d < 0) c.copy(concrete);
    else c.copy(sand).lerp(wet, THREE.MathUtils.smoothstep(d, -14, 2));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildSea() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(0x3fd3c6) },
      uDeep: { value: new THREE.Color(PALETTE.seaDeep) },
      uSky: { value: new THREE.Color(PALETTE.horizon) },
      uSun: { value: SUN_DIRECTION.clone() },
      uIsland: { value: new THREE.Vector4((ISLAND.minX + ISLAND.maxX) / 2, (ISLAND.minZ + ISLAND.maxZ) / 2, (ISLAND.maxX - ISLAND.minX) / 2 - ISLAND.radius, (ISLAND.maxZ - ISLAND.minZ) / 2 - ISLAND.radius) },
      uRadius: { value: ISLAND.radius },
    },
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSun;
      uniform vec4 uIsland; uniform float uRadius;
      varying vec3 vWorld;
      float sdIsland(vec2 p) {
        vec2 q = abs(p - uIsland.xy) - uIsland.zw;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
      }
      vec2 waveGrad(vec2 p, float t) {
        vec2 g = vec2(0.0);
        g += vec2(0.8, 0.3) * cos(dot(p, vec2(0.08, 0.03)) + t * 1.1) * 0.6;
        g += vec2(-0.2, 0.9) * cos(dot(p, vec2(-0.02, 0.11)) + t * 1.5) * 0.4;
        g += vec2(0.6, -0.7) * cos(dot(p, vec2(0.21, -0.17)) + t * 2.3) * 0.25;
        g += vec2(-0.9, -0.4) * cos(dot(p, vec2(-0.43, -0.29)) + t * 3.1) * 0.12;
        return g;
      }
      void main() {
        vec2 p = vWorld.xz;
        float d = sdIsland(p);
        vec2 g = waveGrad(p, uTime);
        vec3 n = normalize(vec3(-g.x * 0.18, 1.0, -g.y * 0.18));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
        vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 140.0, d));
        vec3 col = mix(water, uSky, 0.15 + fres * 0.55);
        vec3 h = normalize(uSun + viewDir);
        float spec = pow(max(dot(n, h), 0.0), 220.0);
        col += vec3(1.0, 0.8, 0.55) * spec * 2.2;
        // foam on the shoreline
        float foam = smoothstep(6.0, 0.0, d) * (0.55 + 0.45 * sin(d * 1.3 - uTime * 2.0));
        col = mix(col, vec3(1.0, 0.97, 0.9), clamp(foam, 0.0, 1.0) * 0.8);
        gl_FragColor = vec4(col, mix(0.82, 0.96, smoothstep(0.0, 30.0, d)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(4000, 4000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = SEA_LEVEL;
  mesh.renderOrder = 1;
  return mesh;
}

function buildPiers() {
  const group = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x8b6d4e, roughness: 0.9 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.9 });
  for (const p of PIERS) {
    const w = p.maxX - p.minX;
    const d = p.maxZ - p.minZ;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), deckMat);
    deck.position.set((p.minX + p.maxX) / 2, 0.0, (p.minZ + p.maxZ) / 2);
    deck.receiveShadow = true;
    deck.castShadow = true;
    group.add(deck);
    for (let x = p.minX + 2; x < p.maxX; x += 6) {
      for (const z of [p.minZ + 0.5, p.maxZ - 0.5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 6), postMat);
        post.position.set(x, -1.6, z);
        group.add(post);
      }
    }
  }
  return group;
}

export function buildTerrainAndSea(scene) {
  scene.add(buildGround());
  const sea = buildSea();
  scene.add(sea);
  scene.add(buildPiers());
  return {
    update(time) { sea.material.uniforms.uTime.value = time; },
    halfExtent: CITY.half,
  };
}
