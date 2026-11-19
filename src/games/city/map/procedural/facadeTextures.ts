import * as THREE from 'three';
import type { Patch, Rect, Surface } from './cityLayout';

/** One window bay of a facade spans this many metres; one floor is this tall. */
export const BAY_M = 3.2;
export const FLOOR_M = 3.6;
const FACADE_PX = 128;

interface FacadeStyle {
  wall: string;
  glass: string;
  /** Window share of the bay's width and of the floor's height. */
  windowW: number;
  windowH: number;
}

/** Building looks by style id (cityLayout.ts picks them per district). */
const FACADES: readonly FacadeStyle[] = [
  { wall: '#2c3a46', glass: '#5d89a6', windowW: 0.92, windowH: 0.86 },
  { wall: '#53585e', glass: '#8fa3b3', windowW: 0.88, windowH: 0.8 },
  { wall: '#b9b3a7', glass: '#3f5566', windowW: 0.78, windowH: 0.42 },
  { wall: '#8a4b38', glass: '#2f3c45', windowW: 0.46, windowH: 0.55 },
  { wall: '#d1c3a4', glass: '#34444f', windowW: 0.5, windowH: 0.5 },
  { wall: '#d9b99b', glass: '#3a4852', windowW: 0.36, windowH: 0.42 },
  { wall: '#e7e3da', glass: '#3c4a54', windowW: 0.34, windowH: 0.42 },
  { wall: '#8c9297', glass: '#44515a', windowW: 0.22, windowH: 0.18 },
];

export const FACADE_COUNT = FACADES.length;

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  return { c, g };
}

function facadeTexture(style: FacadeStyle): THREE.Texture {
  const { c, g } = canvas(FACADE_PX);
  const s = FACADE_PX;
  g.fillStyle = style.wall;
  g.fillRect(0, 0, s, s);
  const ww = s * style.windowW;
  const wh = s * style.windowH;
  const x = (s - ww) / 2;
  const y = (s - wh) * 0.45;
  const glass = g.createLinearGradient(0, y, 0, y + wh);
  glass.addColorStop(0, style.glass);
  glass.addColorStop(1, '#1b2329');
  g.fillStyle = glass;
  g.fillRect(x, y, ww, wh);
  // a sill under the window and a thin frame
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(x - 2, y + wh, ww + 4, 3);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.strokeRect(x + 0.5, y + 0.5, ww - 1, wh - 1);
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** The materials every generated tile shares: one facade per style, roofs, tree parts and the sea. Owned by the scenery. */
export class CityMaterials {
  readonly facades: THREE.MeshLambertMaterial[] = FACADES.map((style) => new THREE.MeshLambertMaterial({ map: facadeTexture(style) }));
  readonly roof = new THREE.MeshLambertMaterial({ color: 0x6d6a66 });
  readonly trunk = new THREE.MeshLambertMaterial({ color: 0x5a4330 });
  readonly crown = new THREE.MeshLambertMaterial({ color: 0x4f7d3a });
  readonly water = new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.88 });

  dispose() {
    for (const m of this.facades) {
      m.map?.dispose();
      m.dispose();
    }
    this.roof.dispose();
    this.trunk.dispose();
    this.crown.dispose();
    this.water.dispose();
  }
}

const SURFACE_COLOR: Record<Surface, string> = {
  road: '#3a3c3f',
  sidewalk: '#aaa69d',
  grass: '#5d8a45',
  paving: '#b8b0a3',
  parking: '#5f6163',
  sand: '#d8c99a',
};
const LANE_DASH_M = 3;
const LANE_GAP_M = 4;
/** A road at least this wide gets a dashed middle line. */
const LANE_ROAD_M = 6;

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

/** The painted ground of one tile: surfaces and lane lines, `pxPerM` pixels a metre. */
export function groundTexture(tile: Rect, patches: readonly Patch[], pxPerM: number): THREE.Texture {
  const size = Math.round((tile.x1 - tile.x0) * pxPerM);
  const { c, g } = canvas(size);
  const px = (x: number) => (x - tile.x0) * pxPerM;
  const pz = (z: number) => (z - tile.z0) * pxPerM;
  for (const p of patches) {
    if (!overlaps(p, tile)) continue;
    g.fillStyle = SURFACE_COLOR[p.surface];
    g.fillRect(px(p.x0), pz(p.z0), (p.x1 - p.x0) * pxPerM, (p.z1 - p.z0) * pxPerM);
    if (p.surface === 'road') paintLane(g, p, px, pz, pxPerM);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function paintLane(g: CanvasRenderingContext2D, road: Patch, px: (x: number) => number, pz: (z: number) => number, pxPerM: number) {
  const w = road.x1 - road.x0;
  const d = road.z1 - road.z0;
  if (Math.min(w, d) < LANE_ROAD_M) return;
  g.fillStyle = '#e8dfa8';
  const line = Math.max(1, 0.18 * pxPerM);
  if (w > d) {
    const z = (road.z0 + road.z1) / 2;
    for (let x = road.x0; x < road.x1; x += LANE_DASH_M + LANE_GAP_M) g.fillRect(px(x), pz(z) - line / 2, LANE_DASH_M * pxPerM, line);
  } else {
    const x = (road.x0 + road.x1) / 2;
    for (let z = road.z0; z < road.z1; z += LANE_DASH_M + LANE_GAP_M) g.fillRect(px(x) - line / 2, pz(z), line, LANE_DASH_M * pxPerM);
  }
}
