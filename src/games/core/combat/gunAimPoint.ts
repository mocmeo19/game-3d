import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const local = new THREE.Vector3();
const x = new THREE.Vector3();
const y = new THREE.Vector3();
const basis = new THREE.Matrix4();
const target = new THREE.Quaternion();
/** A point closer to the gun than this (m) gives no usable direction. */
const MIN_DISTANCE = 0.5;

/**
 * Turn a held gun (barrel along its +z, in the body's space) towards a point in the world, the way weapon IK keeps the barrel on
 * the aim point while the clip poses the arms: `weight` 0 leaves the gun as the hands hold it, 1 points it straight at the target.
 * `bodyYaw` is the body's turn about the vertical (the body space is the world turned by it).
 */
export function pointGunAt(gun: THREE.Object3D, gunWorld: THREE.Vector3, aimPoint: THREE.Vector3, bodyYaw: number, weight: number) {
  if (weight <= 0) return;
  local.copy(aimPoint).sub(gunWorld);
  if (local.lengthSq() < MIN_DISTANCE * MIN_DISTANCE) return;
  local.applyAxisAngle(UP, -bodyYaw).normalize();
  x.crossVectors(UP, local);
  if (x.lengthSq() < 1e-6) return;
  x.normalize();
  y.crossVectors(local, x);
  target.setFromRotationMatrix(basis.makeBasis(x, y, local));
  gun.quaternion.slerp(target, Math.min(1, weight));
}
