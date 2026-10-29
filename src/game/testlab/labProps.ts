import * as THREE from 'three';

/**
 * An object (tree, car, crate, ...) the user loaded from a .glb into the test lab. It stands on the floor at a position and yaw of its
 * own, scaled so that its longest side is `size` metres, and can be a solid for the character to bump into, climb onto or vault over.
 */

export type PropCollide = 'box' | 'trunk' | 'none';

export interface LabPropInfo {
  id: number;
  name: string;
  size: number;
  collide: PropCollide;
  clips: number;
  playing: boolean;
}

/** A model whose longest side is outside these is taken to be in the wrong units and fitted to a default size. */
const SANE_MIN = 0.2;
const SANE_MAX = 40;
const DEFAULT_SIZE = 2;

export class LabProp {
  /** Position on the floor and yaw of the prop; its middle is on the origin of this group. */
  readonly group = new THREE.Group();
  readonly meshes: THREE.Mesh[] = [];
  collide: PropCollide = 'box';
  size: number;
  playing = false;
  /** Set by the lab: the solid the character collides with and its outline for the debug view. */
  solid: { min: THREE.Vector3; max: THREE.Vector3 } | null = null;
  helper: THREE.Object3D | null = null;

  private readonly holder = new THREE.Group();
  private readonly native: THREE.Box3;
  private readonly nativeLongest: number;
  private readonly mixer: THREE.AnimationMixer | null;
  private readonly clips: THREE.AnimationClip[];

  constructor(readonly id: number, readonly name: string, private readonly body: THREE.Object3D, clips: THREE.AnimationClip[] = []) {
    this.clips = clips;
    this.holder.add(body);
    this.group.add(this.holder);
    body.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
    });
    this.native = this.measure();
    const dim = this.native.getSize(new THREE.Vector3());
    this.nativeLongest = Math.max(dim.x, dim.y, dim.z, 1e-4);
    this.size = this.nativeLongest >= SANE_MIN && this.nativeLongest <= SANE_MAX ? this.nativeLongest : DEFAULT_SIZE;
    this.mixer = clips.length ? new THREE.AnimationMixer(body) : null;
    this.fit();
  }

  /** Bounds of the model as posed (skinning included), before it is scaled or moved. */
  private measure(): THREE.Box3 {
    this.body.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const mesh of this.meshes) {
      (mesh as THREE.SkinnedMesh).skeleton?.update();
      const count = mesh.geometry.attributes.position.count;
      const step = Math.max(1, Math.floor(count / 8000));
      for (let i = 0; i < count; i += step) {
        mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(v);
      }
    }
    return box.isEmpty() ? new THREE.Box3().setFromObject(this.body, true) : box;
  }

  /** Scale to `size` and put the model's middle on the group origin with its bottom on the floor. */
  private fit() {
    const k = this.size / this.nativeLongest;
    this.holder.scale.setScalar(k);
    this.holder.position.set(-((this.native.min.x + this.native.max.x) / 2) * k, -this.native.min.y * k, -((this.native.min.z + this.native.max.z) / 2) * k);
  }

  setSize(size: number) {
    this.size = size;
    this.fit();
  }

  /** Width, height and depth of the prop in metres (before it is turned). */
  dimensions() {
    const d = this.native.getSize(new THREE.Vector3());
    const k = this.size / this.nativeLongest;
    return new THREE.Vector3(d.x * k, d.y * k, d.z * k);
  }

  /** Axis-aligned bounds in the world, for the way the prop is turned now; `trunk` keeps only a narrow column in the middle. */
  bounds(mode: PropCollide = this.collide): THREE.Box3 {
    const d = this.dimensions();
    const half = new THREE.Vector3(d.x / 2, 0, d.z / 2);
    if (mode === 'trunk') {
      const w = Math.max(0.15, Math.min(d.x, d.z) * 0.15);
      half.set(w, 0, w);
    }
    const yaw = this.group.rotation.y;
    const c = Math.abs(Math.cos(yaw));
    const s = Math.abs(Math.sin(yaw));
    const hx = half.x * c + half.z * s;
    const hz = half.x * s + half.z * c;
    const p = this.group.position;
    return new THREE.Box3(new THREE.Vector3(p.x - hx, p.y, p.z - hz), new THREE.Vector3(p.x + hx, p.y + d.y, p.z + hz));
  }

  info(): LabPropInfo {
    return { id: this.id, name: this.name, size: +this.size.toFixed(2), collide: this.collide, clips: this.clips.length, playing: this.playing };
  }

  /** Start or stop every clip of the file (a door that swings, a wheel that turns). */
  toggleAnimation() {
    if (!this.mixer) return;
    this.playing = !this.playing;
    if (this.playing) this.clips.forEach((c) => this.mixer!.clipAction(c).reset().play());
    else this.mixer.stopAllAction();
  }

  update(dt: number) {
    if (this.playing) this.mixer?.update(dt);
  }

  dispose() {
    this.mixer?.stopAllAction();
    this.group.removeFromParent();
    const textures = new Set<THREE.Texture>();
    this.body.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      mats.forEach((m) => {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
        m.dispose();
      });
    });
    textures.forEach((t) => t.dispose());
  }
}
