/**
 * The skin being made: a base colour under image layers, each placed on the texture by its centre, size and turn. Positions are
 * fractions of the (square) texture, so the same document exports at any size.
 */

export interface SkinLayer {
  id: string;
  name: string;
  image: CanvasImageSource;
  /** Pixel size of the image. */
  width: number;
  height: number;
  /** Centre on the texture, 0..1 from the top-left. */
  x: number;
  y: number;
  /** Width of the image as a fraction of the texture width (the height follows the image's aspect). */
  scale: number;
  /** Turn in degrees, clockwise. */
  rotation: number;
  opacity: number;
  flipX: boolean;
  visible: boolean;
  /** Soft elliptical edge: 0 keeps the whole rectangle, 1 fades from the centre out. */
  feather: number;
}

export interface SkinDocument {
  baseColor: string;
  baseEnabled: boolean;
  layers: SkinLayer[];
}

export const LAYER_LIMITS = {
  scale: { min: 0.02, max: 2 },
  rotation: { min: -180, max: 180 },
  opacity: { min: 0, max: 1 },
  feather: { min: 0, max: 1 },
};

const DEFAULT_SCALE = 0.4;
/** The faded copy of a layer is drawn at most this wide: enough for the preview, cheap to redo when the feather changes. */
const FEATHER_MAX_SIZE = 1024;

let nextId = 1;

/** A new layer in the middle of the texture. */
export function newLayer(name: string, image: CanvasImageSource, width: number, height: number): SkinLayer {
  return {
    id: `layer-${nextId++}`, name, image, width, height,
    x: 0.5, y: 0.5, scale: DEFAULT_SCALE, rotation: 0, opacity: 1, flipX: false, visible: true, feather: 0,
  };
}

const aspect = (layer: SkinLayer) => layer.height / layer.width;

const feathered = new WeakMap<CanvasImageSource, { feather: number; canvas: HTMLCanvasElement }>();

/** The layer's image with its edge faded out on an ellipse (cached per image and feather amount). */
function featheredImage(layer: SkinLayer): CanvasImageSource {
  if (layer.feather <= 0) return layer.image;
  const cached = feathered.get(layer.image);
  if (cached && cached.feather === layer.feather) return cached.canvas;
  const k = Math.min(1, FEATHER_MAX_SIZE / Math.max(layer.width, layer.height));
  const w = Math.max(1, Math.round(layer.width * k));
  const h = Math.max(1, Math.round(layer.height * k));
  const canvas = cached?.canvas ?? document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(layer.image, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(Math.max(0, 1 - layer.feather), 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  feathered.set(layer.image, { feather: layer.feather, canvas });
  return canvas;
}

/** Paints the whole skin onto a `size` x `size` canvas. */
export function drawSkin(ctx: CanvasRenderingContext2D, size: number, doc: SkinDocument) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (doc.baseEnabled) {
    ctx.fillStyle = doc.baseColor;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.imageSmoothingQuality = 'high';
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const w = layer.scale * size;
    const h = w * aspect(layer);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(layer.x * size, layer.y * size);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    if (layer.flipX) ctx.scale(-1, 1);
    ctx.drawImage(featheredImage(layer), -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.restore();
}

/** The four corners of a layer on the texture (fractions), clockwise from the top-left. */
export function layerCorners(layer: SkinLayer): [number, number][] {
  const hw = layer.scale / 2;
  const hh = (layer.scale * aspect(layer)) / 2;
  const a = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as const).map(([dx, dy]) => [layer.x + dx * cos - dy * sin, layer.y + dx * sin + dy * cos]);
}

/** The topmost visible layer under a point of the texture (fractions), or null. */
export function hitLayer(layers: SkinLayer[], u: number, v: number): SkinLayer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    const a = (-layer.rotation * Math.PI) / 180;
    const dx = u - layer.x;
    const dy = v - layer.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= layer.scale / 2 && Math.abs(ly) <= (layer.scale * aspect(layer)) / 2) return layer;
  }
  return null;
}

const clamp = (value: number, range: { min: number; max: number }) => Math.min(range.max, Math.max(range.min, value));

/** Keeps edited values within their ranges (sliders, the wheel and typed numbers all go through here). */
export function clampLayer(layer: SkinLayer): SkinLayer {
  return {
    ...layer,
    scale: clamp(layer.scale, LAYER_LIMITS.scale),
    rotation: ((((layer.rotation + 180) % 360) + 360) % 360) - 180,
    opacity: clamp(layer.opacity, LAYER_LIMITS.opacity),
    feather: clamp(layer.feather, LAYER_LIMITS.feather),
    x: clamp(layer.x, { min: -0.5, max: 1.5 }),
    y: clamp(layer.y, { min: -0.5, max: 1.5 }),
  };
}
