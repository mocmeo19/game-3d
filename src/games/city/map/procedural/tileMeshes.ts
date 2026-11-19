import * as THREE from 'three';
import type { Building, CityLayout, Rect } from './cityLayout';
import { BAY_M, FACADE_COUNT, FLOOR_M, groundTexture, type CityMaterials } from './facadeTextures';

/** Ground mesh resolution: one vertex every 8 m follows the rolling hills closely enough. */
const GROUND_SEGMENTS = 32;
const GROUND_PX_PER_M = 2;
/** Walls start this far below their base so a slope never shows a gap under a building. */
const FOOTING_M = 1.5;

/** Tree parts every tile shares (the scenery owns and frees them). */
export interface TreeParts {
  trunk: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
}

export const makeTreeParts = (): TreeParts => ({
  trunk: new THREE.CylinderGeometry(0.22, 0.3, 3, 6).translate(0, 1.5, 0),
  crown: new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.4, 0),
});

/** A built tile: its objects in the scene and how to free what only it owns. */
export interface BuiltTile {
  group: THREE.Group;
  dispose(): void;
}

class QuadBuffer {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];

  /** A quad from four corners (counter-clockwise seen from outside) with its UVs. */
  quad(corners: readonly number[][], normal: readonly number[], uv: readonly number[][]) {
    const start = this.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      this.positions.push(...corners[i]);
      this.normals.push(...normal);
      this.uvs.push(...uv[i]);
    }
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  get isEmpty() {
    return this.indices.length === 0;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}

/** Four walls with repeating window bays (whole floors from the base up) and a flat roof. */
function addBuilding(b: Building, walls: QuadBuffer, roofs: QuadBuffer) {
  const y0 = b.base - FOOTING_M;
  const y1 = b.base + b.height;
  const v0 = -FOOTING_M / FLOOR_M;
  const v1 = b.height / FLOOR_M;
  const wall = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
    const u1 = Math.hypot(bx - ax, bz - az) / BAY_M;
    walls.quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [nx, 0, nz], [[0, v0], [u1, v0], [u1, v1], [0, v1]]);
  };
  wall(b.x0, b.z1, b.x1, b.z1, 0, 1);
  wall(b.x1, b.z1, b.x1, b.z0, 1, 0);
  wall(b.x1, b.z0, b.x0, b.z0, 0, -1);
  wall(b.x0, b.z0, b.x0, b.z1, -1, 0);
  roofs.quad([[b.x0, y1, b.z1], [b.x1, y1, b.z1], [b.x1, y1, b.z0], [b.x0, y1, b.z0]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

function groundMesh(layout: CityLayout, tile: Rect): THREE.Mesh {
  const w = tile.x1 - tile.x0;
  const geometry = new THREE.PlaneGeometry(w, tile.z1 - tile.z0, GROUND_SEGMENTS, GROUND_SEGMENTS).rotateX(-Math.PI / 2);
  geometry.translate((tile.x0 + tile.x1) / 2, 0, (tile.z0 + tile.z1) / 2);
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, layout.groundAt(pos.getX(i), pos.getZ(i)));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: groundTexture(tile, layout.patches, GROUND_PX_PER_M) }));
}

const inside = (r: Rect, x: number, z: number) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;

/** The ground, buildings and trees of one tile. Buildings belong to the tile their middle is in. */
export function buildTile(layout: CityLayout, tile: Rect, materials: CityMaterials, trees: TreeParts): BuiltTile {
  const group = new THREE.Group();
  const ground = groundMesh(layout, tile);
  group.add(ground);
  const walls = Array.from({ length: FACADE_COUNT }, () => new QuadBuffer());
  const roofs = new QuadBuffer();
  for (const b of layout.buildings) if (inside(tile, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) addBuilding(b, walls[b.style] ?? walls[0], roofs);
  const owned: THREE.BufferGeometry[] = [ground.geometry];
  walls.forEach((buffer, style) => {
    if (buffer.isEmpty) return;
    const geometry = buffer.geometry();
    owned.push(geometry);
    group.add(new THREE.Mesh(geometry, materials.facades[style]));
  });
  if (!roofs.isEmpty) {
    const geometry = roofs.geometry();
    owned.push(geometry);
    group.add(new THREE.Mesh(geometry, materials.roof));
  }
  const here = layout.trees.filter((t) => inside(tile, t.x, t.z));
  const instanced: THREE.InstancedMesh[] = [];
  if (here.length) {
    const trunk = new THREE.InstancedMesh(trees.trunk, materials.trunk, here.length);
    const crown = new THREE.InstancedMesh(trees.crown, materials.crown, here.length);
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    here.forEach((t, i) => {
      m.compose(p.set(t.x, layout.groundAt(t.x, t.z), t.z), q, s.setScalar(t.scale));
      trunk.setMatrixAt(i, m);
      crown.setMatrixAt(i, m);
    });
    trunk.computeBoundingSphere();
    crown.computeBoundingSphere();
    instanced.push(trunk, crown);
    group.add(trunk, crown);
  }
  group.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });
  return {
    group,
    dispose() {
      group.removeFromParent();
      owned.forEach((g) => g.dispose());
      const groundMaterial = ground.material as THREE.MeshLambertMaterial;
      groundMaterial.map?.dispose();
      groundMaterial.dispose();
      instanced.forEach((mesh) => mesh.dispose());
    },
  };
}
