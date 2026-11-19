import type { P2 } from '../../../core/agents/nav';
import { PLACE_IDS, type PlaceId } from '../cityPlaces';
import { seededRandom, valueNoise } from './seededRandom';

/**
 * A generated city: a grid of avenues and side streets on gentle hills, districts from towers downtown to warehouses, parks,
 * a promenade along the sea to the south and steep hills round the other edges. Pure: no three.js, the same seed always
 * gives the same city.
 */

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export type District = 'downtown' | 'midtown' | 'residential' | 'industrial' | 'park' | 'plaza';

/** What the ground is painted with. */
export type Surface = 'road' | 'sidewalk' | 'grass' | 'paving' | 'parking' | 'sand';

export interface Patch extends Rect {
  surface: Surface;
}

export interface Building extends Rect {
  /** Ground height the walls start from (m). */
  base: number;
  height: number;
  /** Facade look (see facadeTextures.ts). */
  style: number;
}

export interface Block extends Rect {
  district: District;
}

export interface Tree {
  x: number;
  z: number;
  scale: number;
}

export interface CityLayout {
  bounds: Rect;
  blocks: Block[];
  /** Painted ground, later patches over earlier ones. */
  patches: Patch[];
  buildings: Building[];
  trees: Tree[];
  /** Where the sea starts at x (z of the shore). */
  shoreZ(x: number): number;
  /** Ground height without buildings (hills, the sea bed below the water). */
  groundAt(x: number, z: number): number;
  /** Height of the sea surface. */
  seaLevel: number;
  places: Record<PlaceId, P2>;
}

export const CITY_HALF_M = 1024;
/** Band of steep hills round the land edges (m). */
const HILLS_M = 70;
const HILL_HEIGHT_M = 34;
const SHORE_Z = 760;
const SHORE_WAVE_M = 40;
/** Promenade between the last street and the shore. */
const PROMENADE_M = 46;
const SEA_LEVEL = -1.5;
const SEA_BED = -5;
const ROLLING_HILLS_M = 7;
const ROLLING_SCALE_M = 560;

const AVENUE = { width: 26, sidewalk: 5 };
const SIDE_STREET = { width: 15, sidewalk: 3.5 };
const AVENUE_GAP: [number, number] = [190, 250];
/** Chance an avenue gap gets a side street through its middle. */
const SIDE_STREET_CHANCE = 0.8;

const DOWNTOWN_CENTRE: P2 = { x: 40, z: -180 };
const DOWNTOWN_R = 360;
const MIDTOWN_R = 720;

interface DistrictRules {
  lotMax: number;
  gap: number;
  emptyChance: number;
  height: (random: () => number) => number;
  styles: readonly number[];
  surface: Surface;
}

const DISTRICTS: Record<Exclude<District, 'park' | 'plaza'>, DistrictRules> = {
  downtown: { lotMax: 62, gap: 4, emptyChance: 0.08, height: (r) => 45 + r() ** 2 * 180, styles: [0, 1, 2], surface: 'paving' },
  midtown: { lotMax: 46, gap: 3, emptyChance: 0.12, height: (r) => 14 + r() * 42, styles: [2, 3, 4], surface: 'paving' },
  residential: { lotMax: 26, gap: 3.5, emptyChance: 0.18, height: (r) => 6 + r() * 8, styles: [5, 6], surface: 'grass' },
  industrial: { lotMax: 80, gap: 6, emptyChance: 0.22, height: (r) => 8 + r() * 9, styles: [7], surface: 'parking' },
};

/** Districts each place belongs in, and a point it leans toward (the fitting block nearest the point wins). */
const PLACE_PLAN: Record<PlaceId, { district: District; near?: P2 }> = {
  hideout: { district: 'residential', near: { x: -620, z: 520 } },
  downtown: { district: 'downtown', near: DOWNTOWN_CENTRE },
  plaza: { district: 'plaza' },
  dome: { district: 'downtown', near: { x: -180, z: -380 } },
  expo: { district: 'industrial', near: { x: 700, z: -300 } },
  interchange: { district: 'midtown', near: { x: 300, z: 420 } },
  riverside: { district: 'midtown', near: { x: 650, z: 700 } },
  westPark: { district: 'park', near: { x: -600, z: -200 } },
  northwest: { district: 'residential', near: { x: -800, z: -800 } },
  arena: { district: 'midtown', near: { x: -520, z: -620 } },
  pawnShop: { district: 'residential', near: { x: -760, z: -220 } },
  vyLoft: { district: 'midtown', near: { x: 380, z: -640 } },
  hospital: { district: 'midtown', near: { x: -320, z: 140 } },
  policeHq: { district: 'downtown', near: { x: 300, z: -40 } },
  gunShopWest: { district: 'residential', near: { x: -500, z: 250 } },
  gunShopNorth: { district: 'midtown', near: { x: 120, z: -720 } },
  paintShop: { district: 'industrial', near: { x: 640, z: 420 } },
  storeA: { district: 'residential', near: { x: -820, z: 80 } },
  storeB: { district: 'downtown', near: { x: -60, z: -500 } },
  storeC: { district: 'industrial', near: { x: 820, z: -40 } },
  storeD: { district: 'residential', near: { x: -380, z: -760 } },
  storeE: { district: 'midtown', near: { x: -200, z: 620 } },
  jobGarage: { district: 'industrial', near: { x: 520, z: 200 } },
};

/** Street lines across the whole city: their middle and width. */
interface StreetLine {
  at: number;
  width: number;
  sidewalk: number;
}

function streetLines(random: () => number, from: number, to: number): StreetLine[] {
  const lines: StreetLine[] = [{ at: from, ...AVENUE }];
  let at = from;
  for (;;) {
    const gap = AVENUE_GAP[0] + random() * (AVENUE_GAP[1] - AVENUE_GAP[0]);
    if (at + gap > to - AVENUE_GAP[0] * 0.5) break;
    if (random() < SIDE_STREET_CHANCE) lines.push({ at: at + gap * (0.42 + random() * 0.16), ...SIDE_STREET });
    at += gap;
    lines.push({ at, ...AVENUE });
  }
  lines.push({ at: to, ...AVENUE });
  return lines;
}

function districtOf(block: Rect): District {
  const x = (block.x0 + block.x1) / 2;
  const z = (block.z0 + block.z1) / 2;
  const r = Math.hypot(x - DOWNTOWN_CENTRE.x, z - DOWNTOWN_CENTRE.z);
  if (r < DOWNTOWN_R) return 'downtown';
  if (r < MIDTOWN_R) return 'midtown';
  return x < 0 ? 'residential' : 'industrial';
}

const centre = (r: Rect): P2 => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.z - b.z);
const nearestBlock = (blocks: readonly Block[], p: P2) => blocks.reduce((best, b) => (distance(centre(b), p) < distance(centre(best), p) ? b : best));

/** Splits a lot along its longer side until both sides fit `lotMax`. */
function splitLots(lot: Rect, lotMax: number, random: () => number, out: Rect[]) {
  const w = lot.x1 - lot.x0;
  const d = lot.z1 - lot.z0;
  if (w <= lotMax && d <= lotMax) {
    out.push(lot);
    return;
  }
  const t = 0.38 + random() * 0.24;
  if (w >= d) {
    const x = lot.x0 + w * t;
    splitLots({ ...lot, x1: x }, lotMax, random, out);
    splitLots({ ...lot, x0: x }, lotMax, random, out);
  } else {
    const z = lot.z0 + d * t;
    splitLots({ ...lot, z1: z }, lotMax, random, out);
    splitLots({ ...lot, z0: z }, lotMax, random, out);
  }
}

export function generateCityLayout(seed: number): CityLayout {
  const random = seededRandom(seed);
  const bounds: Rect = { x0: -CITY_HALF_M, z0: -CITY_HALF_M, x1: CITY_HALF_M, z1: CITY_HALF_M };
  const shoreZ = (x: number) => SHORE_Z + Math.sin(x / 170 + 1) * SHORE_WAVE_M;
  const edgeHills = (x: number, z: number) => {
    const inside = Math.min(x - bounds.x0, bounds.x1 - x, z - bounds.z0);
    return inside >= HILLS_M ? 0 : HILL_HEIGHT_M * (1 - inside / HILLS_M) ** 0.6;
  };
  const groundAt = (x: number, z: number) => {
    if (z > shoreZ(x)) return SEA_BED;
    return valueNoise(x, z, ROLLING_SCALE_M, seed) * ROLLING_HILLS_M + edgeHills(x, z);
  };

  const inner = HILLS_M + AVENUE.width;
  const xs = streetLines(random, bounds.x0 + inner, bounds.x1 - inner);
  const lastZ = SHORE_Z - SHORE_WAVE_M - PROMENADE_M;
  const zs = streetLines(random, bounds.z0 + inner, lastZ);
  const west = xs[0].at - xs[0].width / 2;
  const east = xs[xs.length - 1].at + xs[0].width / 2;
  const streetTop = zs[0].at - zs[0].width / 2;
  const streetBottom = SHORE_Z + SHORE_WAVE_M;
  const patches: Patch[] = [{ ...bounds, surface: 'grass' }];
  // the promenade along the shore; the sea beyond it is drawn as water
  patches.push({ x0: west, z0: lastZ, x1: east, z1: streetBottom, surface: 'paving' });
  for (const line of xs) {
    patches.push({ x0: line.at - line.width / 2, z0: streetTop, x1: line.at + line.width / 2, z1: streetBottom, surface: 'sidewalk' });
    patches.push({ x0: line.at - line.width / 2 + line.sidewalk, z0: streetTop, x1: line.at + line.width / 2 - line.sidewalk, z1: streetBottom, surface: 'road' });
  }
  for (const line of zs) {
    patches.push({ x0: west, z0: line.at - line.width / 2, x1: east, z1: line.at + line.width / 2, surface: 'sidewalk' });
    patches.push({ x0: west, z0: line.at - line.width / 2 + line.sidewalk, x1: east, z1: line.at + line.width / 2 - line.sidewalk, surface: 'road' });
  }

  const blocks: Block[] = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const rect = { x0: xs[i].at + xs[i].width / 2, x1: xs[i + 1].at - xs[i + 1].width / 2, z0: zs[j].at + zs[j].width / 2, z1: zs[j + 1].at - zs[j + 1].width / 2 };
      blocks.push({ ...rect, district: districtOf(rect) });
    }
  nearestBlock(blocks, { x: DOWNTOWN_CENTRE.x - 40, z: DOWNTOWN_CENTRE.z + 230 }).district = 'plaza';
  for (const p of [{ x: -600, z: -200 }, { x: 520, z: 330 }, { x: -260, z: 460 }]) nearestBlock(blocks.filter((k) => k.district !== 'plaza'), p).district = 'park';

  const buildings: Building[] = [];
  const trees: Tree[] = [];
  for (const block of blocks) {
    if (block.district === 'park' || block.district === 'plaza') {
      patches.push({ ...block, surface: block.district === 'park' ? 'grass' : 'paving' });
      const count = block.district === 'park' ? Math.round(((block.x1 - block.x0) * (block.z1 - block.z0)) / 320) : 8;
      for (let k = 0; k < count; k++)
        trees.push({ x: block.x0 + 6 + random() * (block.x1 - block.x0 - 12), z: block.z0 + 6 + random() * (block.z1 - block.z0 - 12), scale: 0.8 + random() * 0.6 });
      continue;
    }
    const rules = DISTRICTS[block.district];
    patches.push({ ...block, surface: rules.surface });
    const lots: Rect[] = [];
    splitLots(block, rules.lotMax, random, lots);
    for (const lot of lots) {
      if (random() < rules.emptyChance) {
        patches.push({ ...lot, surface: block.district === 'residential' ? 'grass' : 'parking' });
        if (block.district === 'residential') trees.push({ ...centre(lot), scale: 1 + random() * 0.4 });
        continue;
      }
      const b = { x0: lot.x0 + rules.gap, z0: lot.z0 + rules.gap, x1: lot.x1 - rules.gap, z1: lot.z1 - rules.gap };
      if (b.x1 - b.x0 < 6 || b.z1 - b.z0 < 6) continue;
      const c = centre(b);
      const style = rules.styles[Math.floor(random() * rules.styles.length)] ?? rules.styles[0];
      buildings.push({ ...b, base: groundAt(c.x, c.z), height: rules.height(random), style });
    }
  }

  return { bounds, blocks, patches, buildings, trees, shoreZ, groundAt, seaLevel: SEA_LEVEL, places: placePlaces(blocks) };
}

/** Each place on the sidewalk in front of a block of its district, nearest its preferred point, one place per block. */
function placePlaces(blocks: readonly Block[]): Record<PlaceId, P2> {
  const out = {} as Record<PlaceId, P2>;
  const used = new Set<Block>();
  for (const id of PLACE_IDS) {
    const plan = PLACE_PLAN[id];
    const free = blocks.filter((b) => b.district === plan.district && !used.has(b));
    const pool = free.length ? free : blocks;
    const near = plan.near ?? centre(pool[0]);
    const block = nearestBlock(pool, near);
    used.add(block);
    const c = centre(block);
    // the middle of the block side facing the preferred point, two metres out on the sidewalk
    const sides: P2[] = [
      { x: c.x, z: block.z0 - 2 },
      { x: c.x, z: block.z1 + 2 },
      { x: block.x0 - 2, z: c.z },
      { x: block.x1 + 2, z: c.z },
    ];
    out[id] = sides.reduce((best, s) => (distance(s, near) < distance(best, near) ? s : best));
  }
  return out;
}
