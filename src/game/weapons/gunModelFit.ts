import * as THREE from 'three';
import type { GunModelFit, GunModelShape } from './gunModelCatalog';

/**
 * Put a weapon model into the game's weapon frame (see gunMesh in ../models.ts): barrel along +z, top along +y, the origin where
 * the hand holds it. The model's own axes are not trusted (files come in any orientation and unit): its longest side becomes the
 * barrel (or, for a grenade, the height) and its second longest the height, then the fit corrects the direction and the hold.
 * Returns the fitted model, the muzzle point and where the other hand holds it, in the weapon frame.
 */
export function fitGunModel(model: THREE.Object3D, shape: GunModelShape, fit: GunModelFit): { root: THREE.Group; muzzle: THREE.Vector3; support: THREE.Vector3 } {
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);
  const raw = new THREE.Box3().setFromObject(holder);
  const size = raw.getSize(new THREE.Vector3());
  const axes = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a));
  const unit = (axis: number, sign: number) => new THREE.Vector3().setComponent(axis, sign);
  // the game frame's z (forward) and y (up) as directions of the model's own axes
  const [forwardAxis, upAxis] = shape === 'barrel' ? [axes[0], axes[1]] : [axes[1], axes[0]];
  const forward = unit(forwardAxis, fit.flipBarrel ? -1 : 1);
  const up = unit(upAxis, fit.flipUp ? -1 : 1);
  const side = new THREE.Vector3().crossVectors(up, forward);
  // rows of the rotation are the game axes in model space: model point → game point
  const rotation = new THREE.Matrix4().set(
    side.x, side.y, side.z, 0,
    up.x, up.y, up.z, 0,
    forward.x, forward.y, forward.z, 0,
    0, 0, 0, 1,
  );
  holder.quaternion.setFromRotationMatrix(rotation);
  const root = new THREE.Group();
  root.add(holder);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const extent = box.getSize(new THREE.Vector3());
  const span = shape === 'barrel' ? extent.z : extent.y;
  const scale = span > 1e-9 ? fit.length / span : 1;
  holder.scale.setScalar(scale);
  box.min.multiplyScalar(scale);
  box.max.multiplyScalar(scale);
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  const height = (t: number) => THREE.MathUtils.lerp(box.min.y, box.max.y, t);
  const grip = new THREE.Vector3(centerX, height(fit.gripHeight), THREE.MathUtils.lerp(box.min.z, box.max.z, fit.gripAlong));
  holder.position.copy(grip).negate();
  const muzzle = new THREE.Vector3(centerX, height(fit.muzzleHeight), shape === 'barrel' ? box.max.z : centerZ).sub(grip);
  const support = new THREE.Vector3(centerX, height(fit.supportHeight), THREE.MathUtils.lerp(box.min.z, box.max.z, fit.supportAlong)).sub(grip);
  return { root, muzzle, support };
}
