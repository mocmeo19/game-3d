import * as THREE from 'three';
import type { CityScenery } from '../cityScenery';
import { DRAWN_AROUND_M, STREAM_RADII } from '../cityTiles';
import type { CityLayout, Rect } from './cityLayout';
import { CityMaterials } from './facadeTextures';
import { buildTile, makeTreeParts, type BuiltTile } from './tileMeshes';

const TILE_M = 256;
/** Time (ms) a frame may spend building tiles; at least one is built when any is missing, so the start is never stuck. */
const BUILD_BUDGET_MS = 5;
/** The sea plane starts this far north of the city's south edge (under the land, which hides it) and reaches past the fog. */
const SEA_START_FROM_SOUTH_M = 400;
const SEA_REACH_M = 2400;

const distanceTo = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

/**
 * The generated city's scenery: tiles of ground, buildings and trees built from the layout when the camera comes near and
 * freed when it leaves, with the same radii as the photo city's tiles; the sea is one plane under everything.
 */
export class ProceduralScenery implements CityScenery {
  readonly group = new THREE.Group();
  private readonly tiles: Rect[] = [];
  private readonly built = new Map<number, BuiltTile>();
  private readonly materials = new CityMaterials();
  private readonly treeParts = makeTreeParts();
  private readonly sea: THREE.Mesh;

  constructor(private readonly layout: CityLayout) {
    this.group.name = 'generated-city';
    const { bounds } = layout;
    for (let z = bounds.z0; z < bounds.z1; z += TILE_M)
      for (let x = bounds.x0; x < bounds.x1; x += TILE_M) this.tiles.push({ x0: x, z0: z, x1: Math.min(bounds.x1, x + TILE_M), z1: Math.min(bounds.z1, z + TILE_M) });
    const seaGeometry = new THREE.PlaneGeometry(bounds.x1 - bounds.x0 + SEA_REACH_M * 2, SEA_REACH_M).rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(seaGeometry, this.materials.water);
    this.sea.position.set((bounds.x0 + bounds.x1) / 2, layout.seaLevel, bounds.z1 - SEA_START_FROM_SOUTH_M + SEA_REACH_M / 2);
    this.group.add(this.sea);
  }

  update(camera: THREE.Vector3) {
    const started = performance.now();
    const order = this.tiles
      .map((tile, index) => ({ tile, index, distance: distanceTo(tile, camera.x, camera.z) }))
      .sort((a, b) => a.distance - b.distance);
    let builtOne = false;
    for (const { tile, index, distance } of order) {
      const existing = this.built.get(index);
      if (existing && distance > STREAM_RADII.unloadM) {
        existing.dispose();
        this.built.delete(index);
        continue;
      }
      if (existing || distance > STREAM_RADII.loadM) continue;
      if (builtOne && performance.now() - started > BUILD_BUDGET_MS) continue;
      const fresh = buildTile(this.layout, tile, this.materials, this.treeParts);
      this.group.add(fresh.group);
      this.built.set(index, fresh);
      builtOne = true;
    }
  }

  isDrawnAround(x: number, z: number) {
    return this.tiles.every((tile, index) => distanceTo(tile, x, z) > DRAWN_AROUND_M || this.built.has(index));
  }

  dispose() {
    for (const tile of this.built.values()) tile.dispose();
    this.built.clear();
    this.sea.geometry.dispose();
    this.treeParts.trunk.dispose();
    this.treeParts.crown.dispose();
    this.materials.dispose();
    this.group.removeFromParent();
  }
}
