// Entry point: create the WebGL renderer (ACES tone mapping, soft shadows), the input and the
// game, then run a fixed-step simulation loop with rendering every frame. ?shot=<name> stages
// a deterministic scene for the screenshots instead of showing the title screen.
import * as THREE from 'three';
import { MAX_FRAME_STEPS, STEP } from './config.js';
import { Input } from './core/input.js';
import { Game } from './game.js';
import { stageShot } from './shots/shotDirector.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const input = new Input(canvas);
const game = new Game(renderer, input);
window.orchidKeys = game;

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  game.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(game, shot);
} else {
  game.menus.showStart();
}

let last = performance.now();
let acc = 0;
function loop(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  input.enabled = game.state === 'playing' && !game.menus.blocking && !game.frozen;
  if (game.state === 'playing' && !game.menus.blocking && !game.frozen) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_FRAME_STEPS) {
      game.step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === MAX_FRAME_STEPS) acc = 0;
  }
  if (!game.frozen) game.frame(dt);
  game.render();
  input.endFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
