import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/** Event name used by the UI to ask the canvas for a .glb of the character (detail: file name without extension). */
export const EXPORT_GLB_EVENT = 'bns-export-glb';

/**
 * Bake the current morph-target mix of a mesh into a plain geometry (positions and normals), so the exported file carries the
 * character as it looks now instead of hundreds of slider morphs. Skin weights, UVs and the index are kept.
 */
const bakeMorphs = (mesh: THREE.Mesh): THREE.BufferGeometry | null => {
  const src = mesh.geometry;
  const inf = mesh.morphTargetInfluences;
  const morphs = src.morphAttributes.position;
  if (!inf || !morphs || !morphs.length) return null;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) out.setAttribute(name, (attr as THREE.BufferAttribute).clone());
  if (src.index) out.setIndex(src.index.clone());
  out.groups = src.groups.map((g) => ({ ...g }));
  const relative = src.morphTargetsRelative;
  const bake = (key: 'position' | 'normal') => {
    const base = out.getAttribute(key) as THREE.BufferAttribute | undefined;
    const targets = src.morphAttributes[key];
    if (!base || !targets) return;
    const orig = (src.getAttribute(key) as THREE.BufferAttribute).array as ArrayLike<number>;
    const arr = base.array as Float32Array;
    for (let m = 0; m < targets.length; m++) {
      const w = inf[m];
      if (!w) continue;
      const t = targets[m].array as ArrayLike<number>;
      for (let i = 0; i < arr.length; i++) arr[i] += relative ? t[i] * w : (t[i] - orig[i]) * w;
    }
    if (key === 'normal') {
      const v = new THREE.Vector3();
      for (let i = 0; i < arr.length; i += 3) {
        v.set(arr[i], arr[i + 1], arr[i + 2]).normalize();
        arr[i] = v.x;
        arr[i + 1] = v.y;
        arr[i + 2] = v.z;
      }
    }
  };
  bake('position');
  bake('normal');
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
};

/** Export `root` (the character with its clothes, hair and weapons, in its current pose) as a binary glTF. */
export const exportGLB = async (root: THREE.Object3D): Promise<ArrayBuffer> => {
  const swapped: { mesh: THREE.Mesh; geo: THREE.BufferGeometry; inf: number[] | undefined; dict: Record<string, number> | undefined }[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const baked = bakeMorphs(m);
    if (!baked) return;
    swapped.push({ mesh: m, geo: m.geometry, inf: m.morphTargetInfluences, dict: m.morphTargetDictionary });
    m.geometry = baked;
    m.morphTargetInfluences = undefined;
    m.morphTargetDictionary = undefined;
  });
  // stand the character on the ground (y = 0) in the file
  root.updateMatrixWorld(true);
  const lift = new THREE.Box3().setFromObject(root).min.y;
  const y0 = root.position.y;
  root.position.y -= Number.isFinite(lift) ? lift : 0;
  root.updateMatrixWorld(true);
  try {
    const result = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    return result as ArrayBuffer;
  } finally {
    root.position.y = y0;
    root.updateMatrixWorld(true);
    swapped.forEach(({ mesh, geo, inf, dict }) => {
      mesh.geometry.dispose();
      mesh.geometry = geo;
      mesh.morphTargetInfluences = inf;
      mesh.morphTargetDictionary = dict;
    });
  }
};

/** Hand a binary buffer to the browser as a download. */
export const downloadBlob = (data: ArrayBuffer, fileName: string, type = 'model/gltf-binary') => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
