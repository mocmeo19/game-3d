import * as THREE from 'three';
import { fbm } from '../scenery';

/** Procedural textures for the cargo ship (drawn once on a canvas; nothing to download). */

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function repeatTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Grimy speckles over a painted surface: darker spots and a few rust streaks. */
function grime(ctx: CanvasRenderingContext2D, size: number, spots: number, rust: number) {
  for (let i = 0; i < spots; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < rust; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const grad = ctx.createLinearGradient(x, y, x, y + 30 + Math.random() * 50);
    grad.addColorStop(0, 'rgba(120,60,30,0.35)');
    grad.addColorStop(1, 'rgba(120,60,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, 2 + Math.random() * 3, 80);
  }
}

/**
 * Corrugated container wall, white so a material colour paints it: vertical ridges with a top and bottom rail. One repeat covers a
 * container's height (the boxes are tiled at that size), so the rails meet the container's edges.
 */
export function corrugatedTexture() {
  const size = 256;
  const [c, ctx] = canvas(size);
  const ridges = 10;
  for (let x = 0; x < size; x++) {
    const shade = 0.78 + 0.22 * Math.sin((x / size) * ridges * Math.PI * 2);
    const v = Math.round(255 * shade);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, size);
  }
  ctx.fillStyle = 'rgba(40,40,40,0.55)';
  ctx.fillRect(0, 0, size, 10);
  ctx.fillRect(0, size - 12, size, 12);
  grime(ctx, size, 220, 6);
  return repeatTexture(c);
}

/** Painted steel deck: welded plates with seams, worn paint and rust spots (green-grey; tinted by the material). */
export function deckTexture() {
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#7d8a78';
  ctx.fillRect(0, 0, size, size);
  const image = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.02, y * 0.02, 5) - 0.5;
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) image.data[i + k] = Math.max(0, Math.min(255, image.data[i + k] + n * 40));
    }
  ctx.putImageData(image, 0, 0);
  ctx.strokeStyle = 'rgba(30,34,30,0.6)';
  ctx.lineWidth = 2;
  for (const p of [0, size / 2]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  grime(ctx, size, 500, 10);
  return repeatTexture(c);
}

/** Small rolling waves as a normal map, from the slope of a tiling height field. */
export function waveNormalTexture() {
  const size = 256;
  const [c, ctx] = canvas(size);
  const image = ctx.createImageData(size, size);
  const turn = (Math.PI * 2) / size;
  // whole numbers of waves across the canvas so the texture tiles without seams
  const height = (x: number, y: number) =>
    Math.sin(x * turn * 3 + Math.sin(y * turn * 2) * 1.2) * 0.5 + Math.sin(y * turn * 5 + x * turn * 2) * 0.3 + Math.sin((x + y) * turn * 7) * 0.15;
  const normal = new THREE.Vector3();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      normal.set(-dx * 6, -dy * 6, 1).normalize();
      const i = (y * size + x) * 4;
      image.data[i] = (normal.x * 0.5 + 0.5) * 255;
      image.data[i + 1] = (normal.y * 0.5 + 0.5) * 255;
      image.data[i + 2] = (normal.z * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  return repeatTexture(c, false);
}
