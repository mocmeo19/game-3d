import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPON_MODELS, weaponModelUrl } from '../../constants/weaponModels';
import type { WeaponSet } from './weapons';

const loadedProps = new Map<string, THREE.Object3D>();
const loadingProps = new Map<string, Promise<THREE.Object3D>>();

const loadProp = (file: string): Promise<THREE.Object3D> => {
  const loaded = loadedProps.get(file);
  if (loaded) return Promise.resolve(loaded);
  const pending = loadingProps.get(file);
  if (pending) return pending;

  const request = new GLTFLoader().loadAsync(weaponModelUrl(file))
    .then((gltf) => {
      loadedProps.set(file, gltf.scene);
      return gltf.scene;
    })
    .finally(() => loadingProps.delete(file));
  loadingProps.set(file, request);
  return request;
};

export class WeaponPropController {
  private selected: string | undefined;
  private generation = 0;
  private waiting = false;
  private timer: number | null = null;
  private disposed = false;

  constructor(
    private readonly handMatrix: (hand: 'L' | 'R') => THREE.Matrix4 | null,
    private readonly onReady: () => void
  ) {}

  build(id: string | undefined): WeaponSet {
    const set: WeaponSet = { R: [], L: [] };
    if (this.disposed) return set;
    if (this.selected !== id) {
      this.selected = id;
      this.generation++;
      this.waiting = false;
      this.cancelTimer();
    }
    const model = WEAPON_MODELS.find((item) => item.id === id);
    if (!model) return set;
    const generation = this.generation;
    const refresh = () => {
      if (!this.disposed && generation === this.generation) this.onReady();
    };
    const pending = model.parts.filter((part) => !loadedProps.has(part.file));
    if (pending.length > 0) {
      if (!this.waiting) {
        this.waiting = true;
        void Promise.all(pending.map((part) => loadProp(part.file)))
          .then(() => {
            if (generation === this.generation) this.waiting = false;
            refresh();
          })
          .catch((error: unknown) => {
            if (generation === this.generation) this.waiting = false;
            console.warn('Weapon model failed to load', id, error);
          });
      }
      return set;
    }

    const matrices = model.parts.map((part) => this.handMatrix(part.hand));
    if (matrices.some((matrix) => !matrix)) {
      if (this.timer === null) {
        this.timer = window.setTimeout(() => { this.timer = null; refresh(); }, 400);
      }
      return set;
    }
    this.cancelTimer();
    model.parts.forEach((part, index) => {
      const holder = new THREE.Group();
      const copy = loadedProps.get(part.file)!.clone(true);
      copy.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry = mesh.geometry.clone();
          mesh.castShadow = true;
        }
      });
      holder.add(copy);
      matrices[index]!.decompose(holder.position, holder.quaternion, holder.scale);
      set[part.hand].push(holder);
    });
    return set;
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.cancelTimer();
  }

  private cancelTimer() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}
