import type { UvLayout } from './uvLayout';

function trianglePath(layout: UvLayout, size: number) {
  const { uv, triangles } = layout;
  const path = new Path2D();
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t] * 2;
    const b = triangles[t + 1] * 2;
    const c = triangles[t + 2] * 2;
    path.moveTo(uv[a] * size, uv[a + 1] * size);
    path.lineTo(uv[b] * size, uv[b + 1] * size);
    path.lineTo(uv[c] * size, uv[c + 1] * size);
    path.closePath();
  }
  return path;
}

/**
 * The UV layout drawn once as lines on a transparent canvas, islands lightly filled so their outline reads at a glance. The
 * editor scales this picture with the view instead of redrawing tens of thousands of triangles every frame.
 */
export function renderWireframe(layout: UvLayout, size: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const path = trianglePath(layout, size);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.08;
  ctx.fill(path);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  // about one screen pixel when the whole texture fits the editor (roughly a third of its size)
  ctx.lineWidth = Math.max(1, (size / 2048) * 2.2);
  ctx.stroke(path);
  return canvas;
}

/**
 * Where the UV islands lie, as an alpha mask (opaque inside them). The editor dims what falls outside, showing which parts of a
 * picture will actually appear on the body.
 */
export function renderIslandMask(layout: UvLayout, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const path = trianglePath(layout, size);
  ctx.fillStyle = '#fff';
  ctx.fill(path);
  // widen the edges a little so neighbouring triangles leave no hairline gaps
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke(path);
  return canvas;
}
