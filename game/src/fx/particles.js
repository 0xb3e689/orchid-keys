// A pooled GPU particle system (one Points draw call for additive glow, one for smoke) plus
// bullet tracers and flash lights: muzzle flashes, sparks, blood puffs, tyre smoke, engine
// smoke, fire and explosions all come from here.
import * as THREE from 'three';
import { canvasTexture } from '../world/geometryKit.js';

const MAX = 2400;

function makePool(blending, texture) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 4);
  const size = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, scale: { value: 600 } },
    vertexShader: `attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;
      void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vColor;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); }`,
    blending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, geo, pos, col, size, items: [] };
}

export class ParticleFx {
  constructor(scene) {
    const soft = canvasTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.glow = makePool(THREE.AdditiveBlending, soft);
    this.smoke = makePool(THREE.NormalBlending, soft);
    scene.add(this.glow.points, this.smoke.points);

    this.tracers = [];
    const tracerGeo = new THREE.BufferGeometry();
    this.tracerPos = new Float32Array(64 * 6);
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracerLines = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85, toneMapped: false }));
    this.tracerLines.frustumCulled = false;
    scene.add(this.tracerLines);

    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 18, 2);
      scene.add(l);
      this.lights.push({ light: l, life: 0, max: 1, power: 0 });
    }
    this.lightIndex = 0;
  }

  spawn(pool, x, y, z, vx, vy, vz, life, size0, size1, r, g, b, a, gravity = 0, drag = 0) {
    if (pool.items.length >= MAX) pool.items.shift();
    pool.items.push({ x, y, z, vx, vy, vz, life, max: life, size0, size1, r, g, b, a, gravity, drag });
  }

  flash(x, y, z, color, power, life) {
    const slot = this.lights[this.lightIndex++ % this.lights.length];
    slot.light.position.set(x, y, z);
    slot.light.color.setHex(color);
    slot.life = slot.max = life;
    slot.power = power;
  }

  muzzleFlash(x, y, z, dx, dz) {
    for (let i = 0; i < 4; i++) {
      const s = 0.5 + Math.random() * 0.5;
      this.spawn(this.glow, x + dx * 0.2 * i, y, z + dz * 0.2 * i, dx * 2, 0, dz * 2, 0.06, 0.6 * s, 0.2, 1, 0.8, 0.4, 1);
    }
    this.flash(x, y, z, 0xffc070, 8, 0.06);
  }

  sparks(x, y, z, count = 10, strength = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (2 + Math.random() * 6) * strength;
      this.spawn(this.glow, x, y, z, Math.cos(a) * s, 1 + Math.random() * 4 * strength, Math.sin(a) * s, 0.25 + Math.random() * 0.35, 0.18, 0.04, 1, 0.75, 0.3, 1, 14);
    }
  }

  dust(x, y, z) {
    for (let i = 0; i < 4; i++) {
      this.spawn(this.smoke, x, y, z, (Math.random() - 0.5) * 1.5, Math.random(), (Math.random() - 0.5) * 1.5, 0.6, 0.3, 0.9, 0.75, 0.7, 0.62, 0.5);
    }
  }

  blood(x, y, z) {
    for (let i = 0; i < 8; i++) {
      this.spawn(this.smoke, x, y, z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.45, 0.25, 0.1, 0.55, 0.05, 0.05, 0.9, 9);
    }
  }

  tyreSmoke(x, z) {
    this.spawn(this.smoke, x, 0.3, z, (Math.random() - 0.5), 0.6 + Math.random() * 0.6, (Math.random() - 0.5), 1.4, 0.6, 2.6, 0.85, 0.85, 0.85, 0.35, -0.5, 0.6);
  }

  engineSmoke(x, y, z, fire) {
    if (fire) {
      this.spawn(this.glow, x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8, 0, 2 + Math.random() * 2, 0, 0.5, 1.1, 0.3, 1, 0.45, 0.1, 1, -2);
    }
    this.spawn(this.smoke, x, y + 0.3, z, (Math.random() - 0.5) * 0.6, 2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.6, 2.2, 0.6, 3.2, fire ? 0.15 : 0.45, fire ? 0.13 : 0.43, fire ? 0.12 : 0.42, 0.55, -0.6, 0.4);
  }

  explosion(x, y, z, radius = 8) {
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 1.2;
      const s = 4 + Math.random() * radius * 1.4;
      this.spawn(this.glow, x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, 0.5 + Math.random() * 0.5, 2.6, 0.6, 1, 0.55 + Math.random() * 0.3, 0.15, 1, -1, 2.5);
    }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 4;
      this.spawn(this.smoke, x, y + 1, z, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s, 2.5 + Math.random() * 2, 2, 7, 0.18, 0.16, 0.15, 0.75, -0.4, 1.2);
    }
    this.sparks(x, y, z, 40, 2);
    this.flash(x, y + 2, z, 0xff8a3a, 60, 0.6);
  }

  tracer(x0, y0, z0, x1, y1, z1) {
    if (this.tracers.length >= 64) this.tracers.shift();
    // draw only the far part of the path so it reads as a streak
    this.tracers.push({ x0, y0, z0, x1, y1, z1, life: 0.06 });
  }

  update(dt) {
    for (const pool of [this.glow, this.smoke]) {
      const items = pool.items;
      let w = 0;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vy -= p.gravity * dt;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= d; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05 && p.gravity > 0) { p.y = 0.05; p.vy *= -0.3; }
        items[w++] = p;
      }
      items.length = w;
      for (let i = 0; i < w; i++) {
        const p = items[i];
        const t = 1 - p.life / p.max;
        pool.pos[i * 3] = p.x; pool.pos[i * 3 + 1] = p.y; pool.pos[i * 3 + 2] = p.z;
        pool.col[i * 4] = p.r; pool.col[i * 4 + 1] = p.g; pool.col[i * 4 + 2] = p.b;
        pool.col[i * 4 + 3] = p.a * (1 - t);
        pool.size[i] = p.size0 + (p.size1 - p.size0) * t;
      }
      pool.geo.setDrawRange(0, w);
      pool.geo.attributes.position.needsUpdate = true;
      pool.geo.attributes.color.needsUpdate = true;
      pool.geo.attributes.size.needsUpdate = true;
    }
    let n = 0;
    this.tracers = this.tracers.filter((t) => (t.life -= dt) > 0);
    for (const t of this.tracers) {
      const a = 0.35;
      this.tracerPos.set([t.x0 + (t.x1 - t.x0) * a, t.y0 + (t.y1 - t.y0) * a, t.z0 + (t.z1 - t.z0) * a, t.x1, t.y1, t.z1], n * 6);
      n++;
    }
    this.tracerLines.geometry.setDrawRange(0, n * 2);
    this.tracerLines.geometry.attributes.position.needsUpdate = true;
    for (const s of this.lights) {
      if (s.life > 0) s.life -= dt;
      s.light.intensity = s.life > 0 ? s.power * (s.life / s.max) : 0;
    }
  }
}
