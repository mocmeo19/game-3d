import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Low-poly nature props (trees, rocks, bushes, mushrooms, logs) from public/models/nature/LowpolyNaturePack.glb, for the Torchlight
 * world. Every prop is cut out of the pack, stood on y = 0 with its middle on the origin and scaled to the size asked for; it comes as
 * parts (one geometry and material each) so the world can instance them. Parts whose material has no colour of its own (leaves,
 * moss, stone) are `tint` parts: the world colours them per instance, as it does with its procedural shapes.
 */

export interface PropPart {
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
  tint: boolean;
}

export interface Prop {
  parts: PropPart[];
}

export interface PropOptions {
  /** Size to scale to: the height (default) or the longest side along the ground. */
  by?: 'height' | 'width';
  /** Make the tinted parts glow in this colour (swamp mushrooms). */
  glow?: number;
}

export interface NaturePack {
  prop(name: string, size: number, options?: PropOptions): Prop | null;
}

const URL = '/models/nature/LowpolyNaturePack.glb';
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const isWhite = (c: THREE.Color) => c.r > 0.95 && c.g > 0.95 && c.b > 0.95;

let loading: Promise<NaturePack | null> | null = null;
let loaded: NaturePack | null = null;

/** The pack once `loadNaturePack` has finished (null before that, or when it could not be loaded). */
export const naturePack = () => loaded;

export function loadNaturePack(): Promise<NaturePack | null> {
  loading ??= new GLTFLoader()
    .loadAsync(URL)
    .then((gltf) => {
      const nodes = new Map<string, THREE.Object3D>();
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.children.forEach((n) => nodes.set(key(n.name), n));
      const made = new Map<string, Prop | null>();
      loaded = {
        prop(name, size, options = {}) {
          const id = `${key(name)}|${size}|${options.by ?? 'height'}|${options.glow ?? ''}`;
          if (!made.has(id)) made.set(id, build(nodes.get(key(name)), size, options));
          return made.get(id) ?? null;
        }
      };
      return loaded;
    })
    .catch((e) => {
      console.warn('nature pack failed to load, using the built-in shapes', e);
      return null;
    });
  return loading;
}

function build(node: THREE.Object3D | undefined, size: number, options: PropOptions): Prop | null {
  if (!node) return null;
  // the node's own turn and scale stay (some props are modelled lying down), its place in the pack does not
  const own = new THREE.Matrix4().compose(new THREE.Vector3(), node.quaternion, node.scale);
  const inverse = node.matrixWorld.clone().invert();
  const raw: PropPart[] = [];
  node.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(own.clone().multiply(inverse.clone().multiply(mesh.matrixWorld)));
    const mat = src.clone();
    const stone = /stone/i.test(src.name);
    const trunk = /tree brown/i.test(src.name) && isWhite(mat.color);
    // trunks without a colour of their own get bark; stones are tinted like leaves
    if (trunk) mat.color.set(0x4a3426);
    const tint = !trunk && (isWhite(mat.color) || stone);
    if (stone) mat.color.set(0xffffff);
    mat.flatShading = true;
    mat.roughness = 1;
    mat.metalness = 0;
    mat.side = THREE.DoubleSide;
    if (tint && options.glow !== undefined) {
      mat.emissive = new THREE.Color(options.glow);
      mat.emissiveIntensity = 0.8;
    }
    raw.push({ geo, mat, tint });
  });
  if (!raw.length) return null;
  const box = new THREE.Box3();
  raw.forEach((p) => {
    p.geo.computeBoundingBox();
    box.union(p.geo.boundingBox!);
  });
  const dim = box.getSize(new THREE.Vector3());
  const k = size / (options.by === 'width' ? Math.max(dim.x, dim.z) : dim.y);
  const fit = new THREE.Matrix4()
    .makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  raw.forEach((p) => {
    p.geo.applyMatrix4(fit);
    p.geo.computeBoundingSphere();
  });
  return { parts: raw };
}
