import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WeaponId } from '../rules';
import { gunModel, gunModelUrl, type GunModelDef, type GunModelFit } from './gunModelCatalog';
import { fitGunModel } from './gunModelFit';
import { loadGunModelSettings } from './gunModelSettings';

/**
 * Weapon models loaded from public/models/guns, shared by every gun drawn (in hands, on the ground, in the first-person view):
 * each file is fetched and parsed once, each fitted model built once, and copies share its geometry and materials. Shared meshes
 * carry `userData.sharedAsset`, so code that frees a weapon's own meshes leaves them alone. The library lives as long as the page.
 */

const MAX_METALNESS = 0.35;
const MIN_ROUGHNESS = 0.4;
const files = new Map<string, Promise<THREE.Group>>();
const fitted = new Map<string, Promise<Fitted | null>>();
const ready = new Map<string, Fitted>();
let plainMetal: THREE.MeshStandardMaterial | null = null;

export interface Fitted {
  root: THREE.Group;
  muzzle: THREE.Vector3;
  support: THREE.Vector3;
}

const fitKey = (def: GunModelDef, fit: GunModelFit) => `${def.id}|${JSON.stringify(fit)}`;

function loadFile(file: string): Promise<THREE.Group> {
  let request = files.get(file);
  if (!request) {
    request = new GLTFLoader().loadAsync(gunModelUrl(file)).then((gltf) => gltf.scene);
    files.set(file, request);
  }
  return request;
}

/** Ready the model's materials for the arena: there is no environment map, so very metallic surfaces would render black. */
function prepare(model: THREE.Object3D, def: GunModelDef) {
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.userData.sharedAsset = true;
    if (def.plainMetal) {
      plainMetal ??= new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.55, metalness: 0.3 });
      mesh.material = plainMetal;
      return;
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.metalness = Math.min(material.metalness, MAX_METALNESS);
      material.roughness = Math.max(material.roughness, MIN_ROUGHNESS);
    }
  });
}

/** The model fitted to the weapon frame (built once per model and fit); null when its file cannot be loaded. */
export function fittedGunModel(def: GunModelDef, fit: GunModelFit): Promise<Fitted | null> {
  const key = fitKey(def, fit);
  let request = fitted.get(key);
  if (!request) {
    request = loadFile(def.file).then((scene) => {
      const source = def.node ? scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(def.node)) : scene;
      if (!source) throw new Error(`node "${def.node}" not found in ${def.file}`);
      const model = source.clone(true);
      model.position.set(0, 0, 0);
      prepare(model, def);
      const result = fitGunModel(model, def.shape, fit);
      ready.set(key, result);
      return result;
    }).catch((error: unknown) => {
      // the weapon keeps its box model; the warning names the file so it can be fixed
      console.warn(`weapon model ${def.id} not loaded`, error);
      return null;
    });
    fitted.set(key, request);
  }
  return request;
}

/** Free the meshes a weapon built itself (the box model), never the shared ones of a loaded model. */
function disposeOwn(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.sharedAsset) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  });
}

function swapIn(group: THREE.Group, model: Fitted) {
  const muzzle = group.userData.muzzle as THREE.Object3D | undefined;
  const support = group.userData.support as THREE.Object3D | undefined;
  for (const child of [...group.children]) {
    if (child === muzzle || child === support) continue;
    group.remove(child);
    disposeOwn(child);
  }
  group.add(model.root.clone(true));
  muzzle?.position.copy(model.muzzle);
  support?.position.copy(model.support);
  // whoever placed hands on the box model (the first-person arms) re-places them on this one
  group.userData.fitVersion = ((group.userData.fitVersion as number | undefined) ?? 0) + 1;
}

/**
 * Give a weapon built by gunMesh the model chosen for it in the settings. A model already loaded replaces the box model at once;
 * otherwise the box model shows until the file is in.
 */
export function attachGunModel(group: THREE.Group, id: WeaponId) {
  const settings = loadGunModelSettings();
  const modelId = settings.assignments[id];
  const def = modelId ? gunModel(modelId) : undefined;
  const fit = modelId ? settings.fits[modelId] : undefined;
  if (!def || !fit) return;
  const loaded = ready.get(fitKey(def, fit));
  if (loaded) {
    swapIn(group, loaded);
    return;
  }
  void fittedGunModel(def, fit).then((model) => model && swapIn(group, model));
}
