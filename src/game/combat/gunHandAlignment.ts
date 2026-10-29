import * as THREE from 'three';

/** Distance (m) between the palms while both hold a rifle in the Mixamo clips; outside it the support hand is off the gun. */
const MIN_HAND_SPREAD = 0.15;
const MAX_HAND_SPREAD = 0.8;
/** The barrel must point at least this much forward (cosine) for the hands' line to be taken as the gun's line. */
const MIN_FORWARD = 0.4;
/** How fast (1/s) the gun moves between following the hands and its own aim, e.g. when the support hand leaves for a reload. */
const FOLLOW_RATE = 14;

const UP = new THREE.Vector3(0, 1, 0);

function findSkinnedMesh(body: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  body.traverse((object) => {
    if (!found && (object as THREE.SkinnedMesh).isSkinnedMesh) found = object as THREE.SkinnedMesh;
  });
  return found;
}

/**
 * Turns a two-handed gun along the line from the shooting hand to the support hand, as the combat clip holds them, so the gun
 * moves with the clip (fire kick, sway, stance) instead of keeping a direction of its own. When the support hand leaves the gun
 * (reload, drawing it) the gun eases back to the direction the caller gives it.
 */
export class GunHandAlignment {
  private readonly palms: { R: THREE.Object3D[]; L: THREE.Object3D[] } = { R: [], L: [] };
  private skinned: THREE.SkinnedMesh | null = null;
  private weight = 0;
  private lastPalmYaw: number | null = null;
  private readonly right = new THREE.Vector3();
  private readonly left = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly x = new THREE.Vector3();
  private readonly y = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly target = new THREE.Quaternion();

  /** Heading (rad, + towards the body's right) of the line from the shooting palm to the support palm in the last frame, if both hold the gun. */
  get palmYaw() {
    return this.lastPalmYaw;
  }

  /** Whether the gun currently follows the hands (fully or while easing in or out). */
  get following() {
    return this.weight > 1e-3;
  }

  /**
   * Blend `gun.quaternion` (already set to its own aim, in the space of `body`) towards the hands' line. `allowed` is false when
   * the hands are not meant to hold the gun together (pistol, no clip pose).
   */
  apply(gun: THREE.Object3D, body: THREE.Object3D, allowed: boolean, dt: number) {
    const aligned = allowed && this.handLine(body);
    this.lastPalmYaw = aligned ? Math.atan2(this.forward.x, this.forward.z) : null;
    this.weight = THREE.MathUtils.damp(this.weight, aligned ? 1 : 0, FOLLOW_RATE, dt);
    if (this.following) gun.quaternion.slerp(this.target, this.weight);
  }

  /** Sets `target` from the palms' line; false when the support hand is not on the gun. */
  private handLine(body: THREE.Object3D): boolean {
    if (!this.findPalms(body)) return false;
    body.updateMatrixWorld(true);
    this.palmCentre(this.palms.R, body, this.right);
    this.palmCentre(this.palms.L, body, this.left);
    const forward = this.forward.copy(this.left).sub(this.right);
    const spread = forward.length();
    if (spread < MIN_HAND_SPREAD || spread > MAX_HAND_SPREAD) return false;
    forward.divideScalar(spread);
    if (forward.z < MIN_FORWARD) return false;
    this.x.crossVectors(UP, forward).normalize();
    this.y.crossVectors(forward, this.x);
    this.target.setFromRotationMatrix(this.basis.makeBasis(this.x, this.y, forward));
    return true;
  }

  private palmCentre(bones: THREE.Object3D[], body: THREE.Object3D, out: THREE.Vector3) {
    out.set(0, 0, 0);
    for (const bone of bones) out.add(body.worldToLocal(bone.getWorldPosition(this.point)));
    return out.divideScalar(bones.length);
  }

  /** The wrist and the base of the middle finger of each hand: their midpoint is the palm. */
  private findPalms(body: THREE.Object3D) {
    if (!this.skinned?.parent) {
      // first use, or a new body (race or gender change) replaced the mesh and its bones
      this.skinned = findSkinnedMesh(body);
      const root = this.skinned?.skeleton.bones[0];
      const named = (name: string) => root?.getObjectByName(name);
      this.palms.R = [named('hand_r'), named('middle_01_r')].filter((bone): bone is THREE.Object3D => !!bone);
      this.palms.L = [named('hand_l'), named('middle_01_l')].filter((bone): bone is THREE.Object3D => !!bone);
    }
    return this.palms.R.length > 0 && this.palms.L.length > 0;
  }
}
