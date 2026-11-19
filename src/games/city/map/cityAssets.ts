import type { P2 } from '../../core/agents/nav';
import { DALLAS_PLACES, type PlaceId } from './cityPlaces';
import type { CityScenery } from './cityScenery';
import { HeightGrid, parseHeightGridMeta } from './heightGrid';
import { buildStreetMasks, type StreetMasks } from './walkMask';

const DALLAS_DIR = '/maps/city/';
const DALLAS_TILES_DIR = `${DALLAS_DIR}tiles/`;
/** The generated city's seed: change it for a different city with the same districts. */
const GENERATED_CITY_SEED = 20261116;

/** The city maps the open world can be played on. */
export type CityMapKind = 'generated' | 'dallas';

/** The city's ground: heights and the street masks worked out from them. */
export interface CityGround {
  grid: HeightGrid;
  masks: StreetMasks;
}

/** Everything a city map gives the game; the engine and the HUD work the same on any of them. */
export interface CitySource {
  ground: CityGround;
  /** Where the named places are (before being moved onto the street). */
  places: Record<PlaceId, P2>;
  /** Top-down picture for the minimap and the big map. */
  mapImageUrl: string;
  /** The drawn buildings and streets for one game (freed with the engine). */
  createScenery(): CityScenery;
}

async function fetchOk(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

/** The photo city: a baked height map and texture tiles streamed from the server (scripts/city/). */
async function loadDallas(): Promise<CitySource> {
  const [{ CityStreamer }, { parseTileManifest }] = await Promise.all([import('./cityStreamer'), import('./cityTiles')]);
  const [metaResponse, cellsResponse, tilesResponse] = await Promise.all([
    fetchOk(`${DALLAS_DIR}city-height.json`),
    fetchOk(`${DALLAS_DIR}city-height.bin`),
    fetchOk(`${DALLAS_TILES_DIR}tiles.json`),
  ]);
  const meta = parseHeightGridMeta(await metaResponse.json());
  const bytes = await cellsResponse.arrayBuffer();
  if (bytes.byteLength % 2) throw new Error('city-height.bin has an odd byte count');
  const grid = new HeightGrid(meta, new Int16Array(bytes));
  const manifest = parseTileManifest(await tilesResponse.json());
  return {
    ground: { grid, masks: buildStreetMasks(grid) },
    places: DALLAS_PLACES,
    mapImageUrl: `${DALLAS_DIR}city-map.jpg`,
    createScenery: () => new CityStreamer(manifest),
  };
}

/** The generated city: built from its seed in the browser, nothing to download. */
async function loadGenerated(): Promise<CitySource> {
  const [{ generateCityLayout }, { layoutGround }, { drawLayoutMinimap }, { ProceduralScenery }] = await Promise.all([
    import('./procedural/cityLayout'),
    import('./procedural/layoutGround'),
    import('./procedural/layoutMinimap'),
    import('./procedural/ProceduralScenery'),
  ]);
  const layout = generateCityLayout(GENERATED_CITY_SEED);
  return {
    ground: layoutGround(layout),
    places: layout.places,
    mapImageUrl: await drawLayoutMinimap(layout),
    createScenery: () => new ProceduralScenery(layout),
  };
}

const requests = new Map<CityMapKind, Promise<CitySource>>();

/**
 * A city map, worked out once per page (it never changes and takes a moment to label); a failed load is forgotten so the
 * next attempt tries again.
 */
export function loadCitySource(kind: CityMapKind): Promise<CitySource> {
  let request = requests.get(kind);
  if (!request) {
    request = (kind === 'generated' ? loadGenerated() : loadDallas()).catch((error: unknown) => {
      requests.delete(kind);
      throw error;
    });
    requests.set(kind, request);
  }
  return request;
}
