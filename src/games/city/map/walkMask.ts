import type { HeightGrid } from './heightGrid';

/** Highest step (m) between neighbouring cells that still counts as the same ground: kerbs and ramps yes, building sides no. */
export const STREET_STEP_M = 0.7;
/** Cells of open ground a car needs on every side of its line (2 × 2.5 m: a street, a car park, a highway lane). */
const DRIVE_CLEARANCE_CELLS = 2;
/** Clearance is only told apart up to this many cells (beyond, every cell is equally open). */
const CLEARANCE_CAP = 40;

/** The parts of the city the player and the bots can reach on foot and by car. */
export interface StreetMasks {
  /** 1 where a cell is on the one connected street level of the city (roofs and closed courtyards are 0). */
  walk: Uint8Array;
  /** Cells to the nearest closed cell, capped at CLEARANCE_CAP. */
  clearance: Uint8Array;
  /** 1 where a car fits (walkable and clear enough). */
  drive: Uint8Array;
}

/**
 * Labels the ground reachable without climbing more than STREET_STEP_M per cell and keeps the largest such area: the street
 * network with its plazas, car parks and the ramps up to the highways. Building tops and walled-in yards fall outside it.
 */
export function largestStreetArea(grid: HeightGrid, stepM = STREET_STEP_M): Uint8Array {
  const n = grid.count;
  const cols = grid.cols;
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let bestLabel = -1;
  let bestSize = 0;
  let next = 0;
  for (let seed = 0; seed < n; seed++) {
    if (label[seed] >= 0 || !grid.hasGround(seed)) continue;
    const id = next++;
    label[seed] = id;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    while (head < tail) {
      const k = queue[head++];
      const c = k % cols;
      const h = grid.cellHeight(k);
      const visit = (nk: number) => {
        if (label[nk] >= 0 || !grid.hasGround(nk) || Math.abs(grid.cellHeight(nk) - h) > stepM) return;
        label[nk] = id;
        queue[tail++] = nk;
      };
      if (c > 0) visit(k - 1);
      if (c < cols - 1) visit(k + 1);
      if (k >= cols) visit(k - cols);
      if (k < n - cols) visit(k + cols);
    }
    if (tail > bestSize) {
      bestSize = tail;
      bestLabel = id;
    }
  }
  const walk = new Uint8Array(n);
  for (let k = 0; k < n; k++) walk[k] = label[k] === bestLabel ? 1 : 0;
  return walk;
}

/** Two-pass chamfer distance (in cells, 8 neighbours) from every open cell to the nearest closed one. */
export function clearanceOf(walk: Uint8Array, cols: number, rows: number): Uint8Array {
  const dist = new Uint8Array(walk.length);
  for (let k = 0; k < walk.length; k++) dist[k] = walk[k] ? CLEARANCE_CAP : 0;
  const relax = (k: number, nk: number) => {
    const d = dist[nk] + 1;
    if (d < dist[k]) dist[k] = d;
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      if (!dist[k]) continue;
      if (c === 0 || r === 0 || c === cols - 1 || r === rows - 1) {
        dist[k] = 1;
        continue;
      }
      relax(k, k - 1);
      relax(k, k - cols);
      relax(k, k - cols - 1);
      relax(k, k - cols + 1);
    }
  for (let r = rows - 1; r >= 0; r--)
    for (let c = cols - 1; c >= 0; c--) {
      const k = r * cols + c;
      if (!dist[k] || c === 0 || r === 0 || c === cols - 1 || r === rows - 1) continue;
      relax(k, k + 1);
      relax(k, k + cols);
      relax(k, k + cols + 1);
      relax(k, k + cols - 1);
    }
  return dist;
}

export function buildStreetMasks(grid: HeightGrid): StreetMasks {
  const walk = largestStreetArea(grid);
  const clearance = clearanceOf(walk, grid.cols, grid.rows);
  const drive = new Uint8Array(walk.length);
  for (let k = 0; k < walk.length; k++) drive[k] = clearance[k] > DRIVE_CLEARANCE_CELLS ? 1 : 0;
  return { walk, clearance, drive };
}
