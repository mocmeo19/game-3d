import * as THREE from 'three';

/** The ground agents stand on, bullets and sight lines hit, and water fills. */
export interface Terrain {
  /** Height of the water surface; water lies wherever the ground is below it. */
  readonly waterLevel: number;
  heightAt(x: number, z: number): number;
  /** Distance along a unit ray to where it goes into the ground, or null if it stays above the ground within `far`. */
  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, far: number): number | null;
  /** How deep the water over the ground is at x/z (0 on dry land). */
  waterDepthAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: THREE.Vector3): THREE.Vector3;
  /** A wall of the ground itself at x/z for feet at `feetY` (a city's height map: a building side); absent on smooth terrain. */
  blocksStep?(x: number, z: number, feetY: number): boolean;
}

/** A level floor at y = 0 without water (the cargo ship and anywhere no terrain is shaped). */
export const FLAT_TERRAIN: Terrain = {
  waterLevel: -Infinity,
  heightAt: () => 0,
  rayHit: (_ox, oy, _oz, _dx, dy, _dz, far) => {
    if (dy >= -1e-4 || oy <= 0) return null;
    const t = -oy / dy;
    return t < far ? t : null;
  },
  waterDepthAt: () => 0,
  normalAt: (_x, _z, out) => out.set(0, 1, 0),
};

/** Wading starts at knee-deep water; swimming once the water would reach the chest. */
const WADING_DEPTH = 0.25;
/** A swimmer's feet hang this far under the surface, keeping the head above it. */
export const SWIM_DEPTH = 1.3;

export type WaterState = 'dry' | 'wading' | 'swimming';

export function waterStateAt(terrain: Terrain, x: number, z: number): WaterState {
  const depth = terrain.waterDepthAt(x, z);
  if (depth > SWIM_DEPTH) return 'swimming';
  return depth > WADING_DEPTH ? 'wading' : 'dry';
}

/** Lowest the feet can be at x/z: the ground, or the floating height of a swimmer in deep water. */
export function terrainFloor(terrain: Terrain, x: number, z: number): number {
  const ground = terrain.heightAt(x, z);
  return terrain.waterLevel - ground > SWIM_DEPTH ? terrain.waterLevel - SWIM_DEPTH : ground;
}
