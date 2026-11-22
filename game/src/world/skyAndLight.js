// Golden hour over the Keys: a gradient sky dome with a low sun, matching fog, warm sun and
// hemisphere light, a shadow camera that follows the player, and an environment map baked
// from the sky so glass and car paint reflect the sunset.
import * as THREE from 'three';
import { PALETTE } from '../config.js';

/** Toward the sun: low in the west-south-west, setting over the sea beyond Port Halcyon. */
export const SUN_DIRECTION = new THREE.Vector3(-0.78, 0.2, 0.58).normalize();

function createSkyDome() {
  const geo = new THREE.SphereGeometry(1400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      horizon: { value: new THREE.Color(PALETTE.horizon) },
      sunDir: { value: SUN_DIRECTION },
      sunColor: { value: new THREE.Color(0xffd27a) },
    },
    vertexShader: `varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `varying vec3 vDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        float sunAmt = max(dot(d, sunDir), 0.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, top, smoothstep(0.15, 0.75, h));
        // warm glow toward the sun, cooler violet away from it
        col += vec3(1.0, 0.45, 0.15) * pow(sunAmt, 8.0) * 0.5;
        col += vec3(1.0, 0.62, 0.3) * pow(sunAmt, 90.0) * 0.9;
        col = mix(col, col * vec3(0.85, 0.8, 1.05), (1.0 - sunAmt) * 0.35);
        // streaky cirrus clouds lit from below
        vec2 uv = d.xz / (d.y + 0.12) * 1.6;
        float c = noise(uv * vec2(1.0, 3.0)) * 0.6 + noise(uv * 3.1) * 0.4;
        c = smoothstep(0.6, 0.9, c) * smoothstep(0.03, 0.22, h) * (1.0 - smoothstep(0.45, 0.85, h));
        col = mix(col, vec3(1.0, 0.5, 0.52) * (0.75 + sunAmt * 0.45), c * 0.45);
        // sun disc
        col += sunColor * smoothstep(0.9988, 0.9996, sunAmt) * 1.4;
        // below the horizon: sea haze
        col = mix(col, horizon * 0.9, smoothstep(0.0, -0.05, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

export function setupSkyAndLight(scene, renderer) {
  scene.fog = new THREE.Fog(PALETTE.fog, 230, 1150);
  scene.background = new THREE.Color(PALETTE.horizon);

  const sky = createSkyDome();
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 600;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.4;
  scene.add(sun);
  scene.add(sun.target);

  // bake an environment map from the sky alone so reflections match the sunset
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(createSkyDome());
  const env = pmrem.fromScene(envScene, 0.02, 1, 2000).texture;
  scene.environment = env;
  pmrem.dispose();

  return {
    sky,
    sun,
    /** Keep the sky centred on the camera and the shadow box over the action. */
    follow(camera, focus) {
      sky.position.copy(camera.position);
      sun.position.set(focus.x + SUN_DIRECTION.x * 300, SUN_DIRECTION.y * 300, focus.z + SUN_DIRECTION.z * 300);
      sun.target.position.set(focus.x, 0, focus.z);
    },
  };
}
