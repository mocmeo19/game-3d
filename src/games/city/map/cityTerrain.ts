import type * as THREE from 'three';
import type { Terrain } from '../../core/world/terrain';
import { VOID_HEIGHT_M, type HeightGrid } from './heightGrid';
import { STREET_STEP_M } from './walkMask';

/** Ray march step (m): under half a cell, so a thin wall is never stepped over. */
const RAY_STEP_M = 1;
const RAY_REFINE_STEPS = 5;
/** How far up a walker steps in one go (a kerb, a stair); anything higher is a wall. */
const STEP_UP_M = 0.75;
const NORMAL_SPAN_M = 1.5;

/**
 * The city's ground from the baked height map. Buildings are part of it: their sides are walls for walkers (`blocksStep`),
 * and bullets and sight lines stop on them (`rayHit`). The city has no water to swim in.
 */
export class CityTerrain implements Terrain {
  readonly waterLevel = -Infinity;

  constructor(private readonly grid: HeightGrid) {}

  heightAt(x: number, z: number) {
    return this.grid.smoothHeightAt(x, z, STREET_STEP_M);
  }

  blocksStep(x: number, z: number, feetY: number) {
    const ground = this.grid.heightAt(x, z);
    return ground === VOID_HEIGHT_M || ground - feetY > STEP_UP_M;
  }

  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, far: number) {
    const below = (t: number) => oy + dy * t < this.grid.heightAt(ox + dx * t, oz + dz * t);
    if (below(0)) return 0;
    let prev = 0;
    for (let t = RAY_STEP_M; t < far + RAY_STEP_M; t += RAY_STEP_M) {
      const at = Math.min(t, far);
      if (below(at)) {
        let lo = prev;
        let hi = at;
        for (let i = 0; i < RAY_REFINE_STEPS; i++) {
          const mid = (lo + hi) / 2;
          if (below(mid)) hi = mid;
          else lo = mid;
        }
        return hi;
      }
      prev = at;
      if (at === far) break;
    }
    return null;
  }

  waterDepthAt() {
    return 0;
  }

  normalAt(x: number, z: number, out: THREE.Vector3) {
    const hx = this.heightAt(x + NORMAL_SPAN_M, z) - this.heightAt(x - NORMAL_SPAN_M, z);
    const hz = this.heightAt(x, z + NORMAL_SPAN_M) - this.heightAt(x, z - NORMAL_SPAN_M);
    return out.set(-hx, NORMAL_SPAN_M * 2, -hz).normalize();
  }
}
