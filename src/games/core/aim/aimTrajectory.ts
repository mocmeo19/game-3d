import * as THREE from 'three';
import { rayBox, type Solid } from '../rules';

/**
 * Aim point and bullet path (aim.md 4). The camera and the muzzle are not in the same place, above all in third person, so the
 * shot is worked out in two steps: a ray from the camera along its view finds the point the player aims at (the first wall or
 * body the crosshair is on), then the bullet leaves the muzzle towards that point. A wall between the muzzle and that point, which
 * the camera can see over (aiming from behind cover), stops the bullet: the HUD marks where.
 */

/** A hit nearer than this along the camera ray is ignored: it is the character itself or the camera's own wall gap. */
const MIN_AIM_DISTANCE = 0.3;
/** Something this close in front of the aim point is the target itself, not cover in the way. */
const BLOCK_MARGIN = 0.35;

/** Distance along a ray to the first body it hits within `far`, or null. */
export type BodyHit = (origin: THREE.Vector3, direction: THREE.Vector3, far: number) => number | null;

/** The point the crosshair is on: the first wall or body along the camera ray, or the end of the range. */
export function castAimPoint(origin: THREE.Vector3, direction: THREE.Vector3, solids: Solid[], hitBody: BodyHit, range: number, out = new THREE.Vector3()) {
  let far = range;
  for (const solid of solids) {
    const hit = rayBox(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, solid, far);
    if (hit && hit[0] > MIN_AIM_DISTANCE) far = Math.min(far, hit[0]);
  }
  const body = hitBody(origin, direction, far);
  if (body !== null) far = Math.min(far, body);
  return out.copy(origin).addScaledVector(direction, far);
}

/** Where a wall stops a shot from `from` to `to` before it reaches `to` (aiming from behind cover), or null if the way is clear. */
export function firstObstacle(from: THREE.Vector3, to: THREE.Vector3, solids: Solid[], out = new THREE.Vector3()): THREE.Vector3 | null {
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (length <= BLOCK_MARGIN) return null;
  direction.divideScalar(length);
  let nearest = length - BLOCK_MARGIN;
  let blocked = false;
  for (const solid of solids) {
    const hit = rayBox(from.x, from.y, from.z, direction.x, direction.y, direction.z, solid, nearest);
    if (hit && hit[1] > 0) {
      nearest = Math.max(0, hit[0]);
      blocked = true;
    }
  }
  return blocked ? out.copy(from).addScaledVector(direction, nearest) : null;
}
