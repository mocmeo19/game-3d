import type { CityGround } from '../cityAssets';
import { HeightGrid } from '../heightGrid';
import { buildStreetMasks } from '../walkMask';
import type { CityLayout } from './cityLayout';

/** Same cell as the baked photo city: fine enough for a 3 m alley, small enough to label 2 km in a moment. */
const CELL_M = 2.5;
const NO_GROUND = -32768;
const STORED_PER_M = 10;

/**
 * The generated city as a height map: the ground with buildings standing on it as raised cells (so their sides are walls
 * for walkers, cars and bullets) and no ground where the sea is. The street masks then come out of it like for any city.
 */
export function layoutGround(layout: CityLayout): CityGround {
  const { bounds } = layout;
  const cols = Math.floor((bounds.x1 - bounds.x0) / CELL_M);
  const rows = Math.floor((bounds.z1 - bounds.z0) / CELL_M);
  const cells = new Int16Array(cols * rows);
  const store = (m: number) => Math.max(-32767, Math.min(32767, Math.round(m * STORED_PER_M)));
  for (let r = 0; r < rows; r++) {
    const z = bounds.z0 + (r + 0.5) * CELL_M;
    for (let c = 0; c < cols; c++) {
      const x = bounds.x0 + (c + 0.5) * CELL_M;
      cells[r * cols + c] = z > layout.shoreZ(x) ? NO_GROUND : store(layout.groundAt(x, z));
    }
  }
  for (const b of layout.buildings) {
    const top = store(b.base + b.height);
    const c0 = Math.max(0, Math.floor((b.x0 - bounds.x0) / CELL_M));
    const c1 = Math.min(cols - 1, Math.floor((b.x1 - bounds.x0) / CELL_M));
    const r0 = Math.max(0, Math.floor((b.z0 - bounds.z0) / CELL_M));
    const r1 = Math.min(rows - 1, Math.floor((b.z1 - bounds.z0) / CELL_M));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r * cols + c] = Math.max(cells[r * cols + c], top);
  }
  const grid = new HeightGrid({ originX: bounds.x0, originZ: bounds.z0, cellM: CELL_M, cols, rows, noGround: NO_GROUND }, cells);
  return { grid, masks: buildStreetMasks(grid) };
}
