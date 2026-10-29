import * as THREE from 'three';

/** Small math helpers shared by the character code. */

export const lerp = THREE.MathUtils.lerp;
export const clamp = THREE.MathUtils.clamp;

export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Gaussian bump from a squared distance. */
export const gauss = (d2: number, sigma: number) => Math.exp(-d2 / (2 * sigma * sigma));

/** Cross-section of an elliptical body part at height y. */
export interface Section {
  y: number;
  rx: number;
  rz: number;
  cx?: number;
  cz?: number;
}

export const disposeObject = (root: THREE.Object3D) => {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    const kill = (x: THREE.Material) => {
      (x as THREE.MeshBasicMaterial).map?.dispose();
      x.dispose();
    };
    if (Array.isArray(mat)) mat.forEach(kill);
    else if (mat) kill(mat);
  });
};

export const clearGroup = (g: THREE.Object3D) => {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    disposeObject(c);
  }
};
