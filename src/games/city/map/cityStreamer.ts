import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CityScenery } from './cityScenery';
import { DRAWN_AROUND_M, distanceToTile, STREAM_RADII, wantedDetail, type CityTile, type TileDetail, type TileManifest } from './cityTiles';

export const TILES_DIR = '/maps/city/tiles/';
/** three's Draco decoder, copied from three/examples/jsm/libs/draco/gltf (see public/draco/README.md). */
const DRACO_DECODER_PATH = '/draco/gltf/';

/**
 * GPU memory (MB) the full textures may take together; nearer tiles get theirs first, the rest keep the reduced one. A
 * fixed radius alone is not enough: downtown, several 4096px tiles (about 90 MB each) meet at one corner.
 */
const FULL_TEXTURE_BUDGET_MB = 200;
/** Downloads at once: enough to keep up with a fast car, few enough not to choke the connection. */
const MAX_REQUESTS = 4;
/** How often (s) the wanted set is worked out again. */
const PLAN_S = 0.3;

/** A tile in memory: its mesh, the texture it shows and what is being fetched for it. */
interface TileSlot {
  tile: CityTile;
  mesh: THREE.Mesh | null;
  detail: TileDetail;
  texture: THREE.Texture | null;
  /** The texture detail being fetched, or null. */
  fetching: Exclude<TileDetail, 'none'> | null;
  meshFetching: boolean;
}

/** Loads the tiles around the camera, frees the far ones, and swaps full and reduced textures by distance. */
export class CityStreamer implements CityScenery {
  readonly group = new THREE.Group();
  private readonly slots = new Map<string, TileSlot>();
  private readonly draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
  private readonly gltf = new GLTFLoader().setDRACOLoader(this.draco);
  private readonly images = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none' });
  private requests = 0;
  private planAt = -1;
  private disposed = false;

  constructor(private readonly manifest: TileManifest) {
    this.group.name = 'city-tiles';
  }

  /** Called every frame; re-plans a few times a second. */
  update(camera: THREE.Vector3, timeS: number) {
    if (timeS - this.planAt < PLAN_S) return;
    this.planAt = timeS;
    const wanted = this.manifest.tiles
      .map((tile) => {
        const distance = distanceToTile(tile, camera.x, camera.z);
        const current = this.slots.get(tile.id)?.detail ?? 'none';
        return { tile, distance, detail: wantedDetail(current, distance, STREAM_RADII) };
      })
      .sort((a, b) => a.distance - b.distance);
    let fullMB = 0;
    for (const { tile, detail } of wanted) {
      if (detail === 'none') {
        this.release(tile.id);
        continue;
      }
      const cost = textureMB(tile.size);
      const affordable = detail === 'hi' && fullMB + cost <= FULL_TEXTURE_BUDGET_MB;
      if (affordable) fullMB += cost;
      this.want(tile, affordable ? 'hi' : 'lo');
    }
  }

  /**
   * Every tile right around x/z is drawn, at least with its reduced texture. False only after a jump (the start, a respawn):
   * driving fast the reduced textures are there long before the car, so the loading cover never shows on the road.
   */
  isDrawnAround(x: number, z: number): boolean {
    for (const tile of this.manifest.tiles) {
      if (distanceToTile(tile, x, z) > DRAWN_AROUND_M) continue;
      const slot = this.slots.get(tile.id);
      if (!slot?.mesh || !slot.texture) return false;
    }
    return true;
  }

  private want(tile: CityTile, detail: Exclude<TileDetail, 'none'>) {
    let slot = this.slots.get(tile.id);
    if (!slot) {
      slot = { tile, mesh: null, detail: 'none', texture: null, fetching: null, meshFetching: false };
      this.slots.set(tile.id, slot);
    }
    if (!slot.mesh && !slot.meshFetching) void this.fetchMesh(slot);
    if (slot.detail !== detail && slot.fetching !== detail) void this.fetchTexture(slot, detail);
  }

  private release(id: string) {
    const slot = this.slots.get(id);
    if (!slot) return;
    this.slots.delete(id);
    if (slot.mesh) {
      slot.mesh.removeFromParent();
      slot.mesh.geometry.dispose();
      (slot.mesh.material as THREE.Material).dispose();
    }
    disposeTexture(slot.texture);
  }

  /** Whether a fetch for `slot` is still wanted when it lands (the tile may have been freed or the engine closed). */
  private isCurrent(slot: TileSlot) {
    return !this.disposed && this.slots.get(slot.tile.id) === slot;
  }

  private async fetchMesh(slot: TileSlot) {
    if (this.requests >= MAX_REQUESTS) return;
    this.requests++;
    slot.meshFetching = true;
    try {
      const gltf = await this.gltf.loadAsync(TILES_DIR + slot.tile.glb);
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
      });
      const mesh = meshes[0];
      if (!mesh || !this.isCurrent(slot)) {
        for (const m of meshes) m.geometry.dispose();
        return;
      }
      mesh.updateMatrixWorld(true);
      mesh.removeFromParent();
      mesh.matrixAutoUpdate = false;
      mesh.material = new THREE.MeshBasicMaterial({ map: slot.texture, toneMapped: false, fog: true });
      // a tile shows once it has a texture: an untextured tile would flash white
      mesh.visible = !!slot.texture;
      slot.mesh = mesh;
      this.group.add(mesh);
    } catch (error) {
      console.warn(`City tile ${slot.tile.id} did not load`, error);
    } finally {
      slot.meshFetching = false;
      this.requests--;
    }
  }

  private async fetchTexture(slot: TileSlot, detail: Exclude<TileDetail, 'none'>) {
    if (this.requests >= MAX_REQUESTS) return;
    this.requests++;
    slot.fetching = detail;
    try {
      const bitmap = await this.images.loadAsync(TILES_DIR + (detail === 'hi' ? slot.tile.tex : slot.tile.texLo));
      if (!this.isCurrent(slot) || slot.fetching !== detail) {
        bitmap.close();
        return;
      }
      const texture = new THREE.Texture(bitmap);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      disposeTexture(slot.texture);
      slot.texture = texture;
      slot.detail = detail;
      if (slot.mesh) {
        const material = slot.mesh.material as THREE.MeshBasicMaterial;
        material.map = texture;
        material.needsUpdate = true;
        slot.mesh.visible = true;
      }
    } catch (error) {
      console.warn(`City tile texture ${slot.tile.id} did not load`, error);
    } finally {
      if (slot.fetching === detail) slot.fetching = null;
      this.requests--;
    }
  }

  dispose() {
    this.disposed = true;
    for (const id of [...this.slots.keys()]) this.release(id);
    this.group.removeFromParent();
    this.draco.dispose();
  }
}

/** GPU memory (MB) of a square RGBA texture with its mipmaps. */
const textureMB = (size: number) => (size * size * 4 * 4) / 3 / 1e6;

function disposeTexture(texture: THREE.Texture | null) {
  if (!texture) return;
  const image: unknown = texture.image;
  texture.dispose();
  if (image instanceof ImageBitmap) image.close();
}
