/** The baked city height map (scripts/city/bake_city.py): one ground height per square cell, read without three.js. */

export interface HeightGridMeta {
  originX: number;
  originZ: number;
  cellM: number;
  cols: number;
  rows: number;
  /** Stored value of a cell where the model has no surface. */
  noGround: number;
}

/** Decimetres per metre in the stored heights. */
const STORED_PER_M = 10;
/** Height reported where there is no ground: far below anything, so it reads as a drop off the world. */
export const VOID_HEIGHT_M = -1000;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Checks the grid description fetched with the city, which is outside data. */
export function parseHeightGridMeta(raw: unknown): HeightGridMeta {
  if (typeof raw !== 'object' || raw === null) throw new Error('city-height.json is not an object');
  const r = raw as Record<string, unknown>;
  const { originX, originZ, cellM, cols, rows, noGround } = r;
  if (!isFiniteNumber(originX) || !isFiniteNumber(originZ) || !isFiniteNumber(cellM) || cellM <= 0) throw new Error('city-height.json: bad origin or cell size');
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || (cols as number) < 2 || (rows as number) < 2) throw new Error('city-height.json: bad grid size');
  if (!Number.isInteger(noGround)) throw new Error('city-height.json: bad noGround');
  return { originX, originZ, cellM, cols: cols as number, rows: rows as number, noGround: noGround as number };
}

export class HeightGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellM: number;
  readonly originX: number;
  readonly originZ: number;
  private readonly noGround: number;

  constructor(meta: HeightGridMeta, private readonly cells: Int16Array) {
    if (cells.length !== meta.cols * meta.rows) throw new Error(`city-height.bin has ${cells.length} cells, expected ${meta.cols * meta.rows}`);
    this.cols = meta.cols;
    this.rows = meta.rows;
    this.cellM = meta.cellM;
    this.originX = meta.originX;
    this.originZ = meta.originZ;
    this.noGround = meta.noGround;
  }

  get count() {
    return this.cells.length;
  }
  get maxX() {
    return this.originX + this.cols * this.cellM;
  }
  get maxZ() {
    return this.originZ + this.rows * this.cellM;
  }

  /** Column of x (may be outside the grid). */
  col(x: number) {
    return Math.floor((x - this.originX) / this.cellM);
  }
  row(z: number) {
    return Math.floor((z - this.originZ) / this.cellM);
  }
  inside(col: number, row: number) {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }
  /** Cell index of x/z, or -1 outside the grid. */
  index(x: number, z: number) {
    const c = this.col(x);
    const r = this.row(z);
    return this.inside(c, r) ? r * this.cols + c : -1;
  }
  centreX(col: number) {
    return this.originX + (col + 0.5) * this.cellM;
  }
  centreZ(row: number) {
    return this.originZ + (row + 0.5) * this.cellM;
  }

  hasGround(index: number) {
    return index >= 0 && this.cells[index] !== this.noGround;
  }

  /** Height (m) of a cell, or VOID_HEIGHT_M where there is none. */
  cellHeight(index: number) {
    if (!this.hasGround(index)) return VOID_HEIGHT_M;
    return this.cells[index] / STORED_PER_M;
  }

  /** Height at the cell under x/z (no smoothing: a building edge stays a sharp wall). */
  heightAt(x: number, z: number) {
    return this.cellHeight(this.index(x, z));
  }

  /**
   * Height blended between the four cell centres around x/z, for walking and driving on gentle ground. A neighbour much higher
   * or lower (a wall, a ledge) is left out of the blend so the ground never ramps up a building side.
   */
  smoothHeightAt(x: number, z: number, maxBlendStepM: number) {
    const fx = (x - this.originX) / this.cellM - 0.5;
    const fz = (z - this.originZ) / this.cellM - 0.5;
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fz);
    const centre = this.heightAt(x, z);
    if (centre === VOID_HEIGHT_M) return centre;
    const tx = fx - c0;
    const tz = fz - r0;
    let sum = 0;
    let weight = 0;
    for (let dr = 0; dr <= 1; dr++)
      for (let dc = 0; dc <= 1; dc++) {
        const c = c0 + dc;
        const r = r0 + dr;
        if (!this.inside(c, r)) continue;
        const h = this.cellHeight(r * this.cols + c);
        if (h === VOID_HEIGHT_M || Math.abs(h - centre) > maxBlendStepM) continue;
        const w = (dc ? tx : 1 - tx) * (dr ? tz : 1 - tz);
        sum += h * w;
        weight += w;
      }
    return weight > 1e-6 ? sum / weight : centre;
  }
}
