/** The city cut into square tiles for streaming (scripts/city/bake_city_tiles.py). Pure: no three.js. */

export interface CityTile {
  id: string;
  glb: string;
  /** Texture at source quality, and a quarter-size copy for tiles further away. */
  tex: string;
  texLo: string;
  size: number;
  loSize: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TileManifest {
  tileM: number;
  tiles: CityTile[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A file name next to the manifest: no folders, nothing that could point elsewhere. */
const isFileName = (v: unknown): v is string => typeof v === 'string' && /^[\w.-]+$/.test(v);

function parseTile(raw: unknown): CityTile {
  if (!isRecord(raw)) throw new Error('tiles.json: a tile is not an object');
  const { id, glb, tex, texLo, size, loSize, minX, maxX, minZ, maxZ } = raw;
  if (typeof id !== 'string' || !isFileName(glb) || !isFileName(tex) || !isFileName(texLo)) throw new Error('tiles.json: bad tile files');
  if (!isNumber(size) || !isNumber(loSize) || !isNumber(minX) || !isNumber(maxX) || !isNumber(minZ) || !isNumber(maxZ)) throw new Error(`tiles.json: bad numbers in tile ${id}`);
  return { id, glb, tex, texLo, size, loSize, minX, maxX, minZ, maxZ };
}

/** Checks the tile list fetched with the city, which is outside data. */
export function parseTileManifest(raw: unknown): TileManifest {
  if (!isRecord(raw) || !isNumber(raw.tileM) || !Array.isArray(raw.tiles)) throw new Error('tiles.json is not a tile list');
  return { tileM: raw.tileM, tiles: raw.tiles.map(parseTile) };
}

/** Distance (m) on the ground from x/z to the nearest point of a tile (0 inside it). */
export function distanceToTile(tile: CityTile, x: number, z: number): number {
  const dx = Math.max(tile.minX - x, 0, x - tile.maxX);
  const dz = Math.max(tile.minZ - z, 0, z - tile.maxZ);
  return Math.hypot(dx, dz);
}

/** The loading cover waits for the tiles this close to the player to show something. */
export const DRAWN_AROUND_M = 60;

/** How much of a tile should be in memory. */
export type TileDetail = 'none' | 'lo' | 'hi';

export interface StreamRadii {
  /** Tiles nearer than this are loaded… */
  loadM: number;
  /** …and stay until they are this far (no loading and unloading at the edge every step). */
  unloadM: number;
  /** Tiles nearer than this get the full texture… */
  hiM: number;
  /** …and keep it until this far. */
  hiKeepM: number;
}

/**
 * How far a city's scenery is kept. The fog (cityWorld.ts) is fully thick before `loadM`, so the edge of what is loaded is
 * never seen. In the photo city only the tiles right around the camera hold their full texture.
 */
export const STREAM_RADII: StreamRadii = { loadM: 520, unloadM: 600, hiM: 100, hiKeepM: 150 };

/** The detail a tile at `distance` should have, given what it has now (with a margin either way). */
export function wantedDetail(current: TileDetail, distance: number, radii: StreamRadii): TileDetail {
  const hi = current === 'hi' ? distance < radii.hiKeepM : distance < radii.hiM;
  if (hi) return 'hi';
  const loaded = current === 'none' ? distance < radii.loadM : distance < radii.unloadM;
  return loaded ? 'lo' : 'none';
}
