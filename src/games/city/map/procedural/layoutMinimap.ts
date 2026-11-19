import type { CityLayout, Surface } from './cityLayout';

const MAP_PX = 1024;
const MAP_COLOR: Record<Surface, string> = {
  road: '#2c2f33',
  sidewalk: '#7d7a73',
  grass: '#4f7a3c',
  paving: '#8f897e',
  parking: '#4c4f52',
  sand: '#c9b98a',
};
const SEA = '#24546d';
const SHORE_STEP_M = 8;

/**
 * The top-down picture of the generated city for the minimap and the big map, drawn from the layout: ground, the sea and
 * buildings (taller is lighter). Resolves to an object URL the caller frees with URL.revokeObjectURL.
 */
export async function drawLayoutMinimap(layout: CityLayout): Promise<string> {
  const { bounds } = layout;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = MAP_PX;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  const scale = MAP_PX / (bounds.x1 - bounds.x0);
  const px = (x: number) => (x - bounds.x0) * scale;
  const pz = (z: number) => (z - bounds.z0) * scale;
  for (const p of layout.patches) {
    g.fillStyle = MAP_COLOR[p.surface];
    g.fillRect(px(p.x0), pz(p.z0), (p.x1 - p.x0) * scale, (p.z1 - p.z0) * scale);
  }
  g.fillStyle = SEA;
  g.beginPath();
  g.moveTo(px(bounds.x0), pz(bounds.z1));
  for (let x = bounds.x0; x <= bounds.x1; x += SHORE_STEP_M) g.lineTo(px(x), pz(layout.shoreZ(x)));
  g.lineTo(px(bounds.x1), pz(bounds.z1));
  g.closePath();
  g.fill();
  for (const b of layout.buildings) {
    const light = Math.min(78, 32 + b.height * 0.22);
    g.fillStyle = `hsl(215 8% ${light}%)`;
    g.fillRect(px(b.x0), pz(b.z0), (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The map picture could not be made'))), 'image/png'));
  return URL.createObjectURL(blob);
}
