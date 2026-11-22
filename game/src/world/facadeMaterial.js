// Building facades without textures: a standard PBR material whose shader is patched to draw
// window grids, storefront glass and warm lit rooms from each fragment's world position.
import * as THREE from 'three';

/** Per-style window layout: spacing (m), window fill, glass tint, lit-room chance, storefront. */
export const FACADE_STYLES = {
  tower: { cell: [3.0, 3.6], fill: [0.88, 0.66], glass: 0x2f4f72, lit: 0.12, store: 1, reflect: 0.7 },
  deco: { cell: [3.6, 3.4], fill: [0.4, 0.5], glass: 0x2f6276, lit: 0.18, store: 1, reflect: 0.4 },
  club: { cell: [4.0, 3.8], fill: [0.46, 0.38], glass: 0x3a2448, lit: 0.22, store: 1, reflect: 0.3 },
  house: { cell: [3.4, 3.0], fill: [0.36, 0.42], glass: 0x3d5368, lit: 0.25, store: 0, reflect: 0.25 },
  warehouse: { cell: [7.0, 6.0], fill: [0.55, 0.2], glass: 0x4a5257, lit: 0.06, store: 0, reflect: 0.15 },
};

export function createFacadeMaterial(styleName) {
  const s = FACADE_STYLES[styleName];
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.05, envMapIntensity: 0.6 });
  const glass = new THREE.Color(s.glass);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCell = { value: new THREE.Vector2(s.cell[0], s.cell[1]) };
    shader.uniforms.uFill = { value: new THREE.Vector2(s.fill[0], s.fill[1]) };
    shader.uniforms.uGlass = { value: glass };
    shader.uniforms.uLit = { value: s.lit };
    shader.uniforms.uStore = { value: s.store };
    shader.uniforms.uReflect = { value: s.reflect };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFacadePos;\nvarying vec3 vFacadeNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 facadeWorld = vec4(transformed, 1.0);
        vec3 facadeN = objectNormal;
        #ifdef USE_INSTANCING
          facadeWorld = instanceMatrix * facadeWorld;
          facadeN = mat3(instanceMatrix) * facadeN;
        #endif
        vFacadePos = (modelMatrix * facadeWorld).xyz;
        vFacadeNormal = normalize(mat3(modelMatrix) * facadeN);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFacadePos;
        varying vec3 vFacadeNormal;
        uniform vec2 uCell; uniform vec2 uFill; uniform vec3 uGlass;
        uniform float uLit; uniform float uStore; uniform float uReflect;
        float facadeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float facadeWindow = 0.0;
        float facadeLit = 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 fn = abs(vFacadeNormal);
        if (fn.y < 0.5) {
          float u = fn.x > fn.z ? vFacadePos.z : vFacadePos.x;
          float v = vFacadePos.y;
          vec2 cell = vec2(u / uCell.x, (v - 0.6) / uCell.y);
          vec2 f = fract(cell);
          vec2 m = (1.0 - uFill) * 0.5;
          float w = step(m.x, f.x) * step(f.x, 1.0 - m.x) * step(m.y, f.y) * step(f.y, 1.0 - m.y);
          float storefront = uStore * (1.0 - step(3.6, v)) * step(0.5, v) * step(0.06, fract(u / 6.0)) ;
          w = max(w * step(4.2 * uStore, v), storefront);
          // a darker band where floors meet, and a kerb-height base
          float band = 1.0 - 0.18 * (1.0 - step(0.08, fract((v - 0.6) / uCell.y)));
          diffuseColor.rgb *= band * mix(0.78, 1.0, step(0.6, v));
          float h = facadeHash(floor(cell) + floor(vFacadePos.xz * 0.05) * 7.0);
          facadeLit = w * step(1.0 - uLit, h);
          facadeWindow = w;
          vec3 glassCol = uGlass * mix(0.35, 0.8, facadeHash(floor(cell) * 1.7));
          diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, w);
        } else {
          // flat roofs: gravel with a lighter parapet line
          diffuseColor.rgb *= 0.72;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, facadeWindow * uReflect);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.6, facadeWindow * uReflect);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += facadeLit * vec3(1.0, 0.7, 0.4) * 0.55;`,
      );
  };
  mat.customProgramCacheKey = () => 'facade-' + styleName;
  return mat;
}
