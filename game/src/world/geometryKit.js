// Geometry helpers: coloured primitives placed in a local frame and merged into one buffer, so
// a car body, a palm crown or a lamp post costs one draw call instead of a dozen.
import * as THREE from 'three';

const tmpColor = new THREE.Color();

/** Give every vertex of `geo` the same colour (non-indexed copy). */
export function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  tmpColor.set(color);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** A coloured box centred at (x, y, z), optionally rotated about Y. */
export function box(w, h, d, x, y, z, color, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, color);
}

export function cylinder(rTop, rBottom, h, x, y, z, color, segments = 8, rotZ = 0, rotX = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  if (rotZ) g.rotateZ(rotZ);
  if (rotX) g.rotateX(rotX);
  g.translate(x, y, z);
  return paint(g, color);
}

export function sphere(r, x, y, z, color, w = 8, h = 6) {
  const g = new THREE.SphereGeometry(r, w, h);
  g.translate(x, y, z);
  return paint(g, color);
}

/** Concatenate non-indexed geometries that share position/normal/color (uv optional). */
export function merge(list) {
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const src of list) {
    const g = src.index ? src.toNonIndexed() : src;
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** A canvas-backed texture drawn by `draw(ctx, w, h)`. */
export function canvasTexture(w, h, draw, repeat = false) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
