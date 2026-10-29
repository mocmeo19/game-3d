import * as THREE from 'three';
import type { RetargetPose } from '../../renderer/character/mixamo';

/**
 * A body pose in the retarget format (see renderer/character/mixamo.ts) held in fixed slots, so poses can be blended, masked and
 * bent every frame without allocating. Bones are listed parents first, which is the order the avatar must apply them in.
 */

const TRUNK = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head'] as const;
const FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'];
const LIMB_CHAIN: [string, string][] = [
  ['clavicle', 'upperarm'], ['upperarm', 'lowerarm'], ['lowerarm', 'hand'], ['hand', 'middle_01'],
  ...FINGERS.flatMap((f): [string, string][] => [[`${f}_01`, `${f}_02`], [`${f}_02`, `${f}_03`]]),
  ['thigh', 'calf'], ['calf', 'foot'], ['foot', 'ball'],
];
const LIMBS: { bone: string; child: string; upper: boolean }[] = (['l', 'r'] as const).flatMap((side) =>
  LIMB_CHAIN.map(([bone, child]) => ({ bone: `${bone}_${side}`, child: `${child}_${side}`, upper: !/^(thigh|calf|foot)/.test(bone) })),
);
const TRUNK_INDEX = new Map<string, number>(TRUNK.map((name, i) => [name, i]));
const LIMB_INDEX = new Map(LIMBS.map((limb, i) => [limb.bone, i]));
/** How much of an upper-body bend each trunk bone takes (pelvis none, chest and head all of it). */
const UPPER_SHARE = [0, 0.25, 0.6, 1, 1, 1];

/** `all` the whole body; `upper` the spine, head and arms; `lower` only the legs (the hips stay with whoever turns the body). */
export type PoseMask = 'all' | 'upper' | 'lower';

const inMask = (mask: PoseMask, upper: boolean) => mask === 'all' || (mask === 'upper') === upper;
const trunkInMask = (mask: PoseMask, i: number) => mask === 'all' || (mask === 'upper' && i > 0);

const IDENTITY = new THREE.Quaternion();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

export class PoseFrame {
  readonly turns = TRUNK.map(() => new THREE.Quaternion());
  readonly hasTurn = TRUNK.map(() => false);
  readonly dirs = LIMBS.map(() => new THREE.Vector3(0, -1, 0));
  readonly hasDir = LIMBS.map(() => false);
  private readonly out: RetargetPose = { deltas: [], aims: [] };

  get empty() {
    return !this.hasTurn.some(Boolean) && !this.hasDir.some(Boolean);
  }

  clear() {
    this.hasTurn.fill(false);
    this.hasDir.fill(false);
    return this;
  }

  copy(other: PoseFrame) {
    for (let i = 0; i < TRUNK.length; i++) {
      this.turns[i].copy(other.turns[i]);
      this.hasTurn[i] = other.hasTurn[i];
    }
    for (let i = 0; i < LIMBS.length; i++) {
      this.dirs[i].copy(other.dirs[i]);
      this.hasDir[i] = other.hasDir[i];
    }
    return this;
  }

  /** Take a sampled clip pose; bones outside the mask are left as they are. */
  read(pose: RetargetPose, mask: PoseMask = 'all') {
    for (const [bone, q] of pose.deltas) {
      const i = TRUNK_INDEX.get(bone);
      if (i === undefined || !trunkInMask(mask, i)) continue;
      this.turns[i].copy(q);
      this.hasTurn[i] = true;
    }
    for (const aim of pose.aims) {
      const i = LIMB_INDEX.get(aim.bone);
      if (i === undefined || !inMask(mask, LIMBS[i].upper)) continue;
      this.dirs[i].copy(aim.dir);
      this.hasDir[i] = true;
    }
    return this;
  }

  /** Move the masked bones towards `other` by `weight` (0 keeps this pose, 1 takes the other's). */
  blend(other: PoseFrame, weight: number, mask: PoseMask = 'all') {
    if (weight <= 0) return this;
    for (let i = 0; i < TRUNK.length; i++) {
      if (!other.hasTurn[i] || !trunkInMask(mask, i)) continue;
      if (this.hasTurn[i] && weight < 1) this.turns[i].slerp(other.turns[i], weight);
      else this.turns[i].copy(other.turns[i]);
      this.hasTurn[i] = true;
    }
    for (let i = 0; i < LIMBS.length; i++) {
      if (!other.hasDir[i] || !inMask(mask, LIMBS[i].upper)) continue;
      if (this.hasDir[i] && weight < 1) this.dirs[i].lerp(other.dirs[i], weight).normalize();
      else this.dirs[i].copy(other.dirs[i]);
      this.hasDir[i] = true;
    }
    return this;
  }

  /** Forget the bones `other` does not pose, so whoever poses them otherwise (the built-in motion) takes them at once. */
  keepOnly(other: PoseFrame) {
    for (let i = 0; i < TRUNK.length; i++) this.hasTurn[i] &&= other.hasTurn[i];
    for (let i = 0; i < LIMBS.length; i++) this.hasDir[i] &&= other.hasDir[i];
    return this;
  }

  /** Undo the heading the clip gives the hips, so the body keeps facing where the player aims. */
  cancelFacing() {
    if (!this.hasTurn[0]) return this;
    tmpV.copy(FORWARD).applyQuaternion(this.turns[0]);
    if (tmpV.x * tmpV.x + tmpV.z * tmpV.z < 1e-6) return this;
    tmpQ.setFromAxisAngle(UP, -Math.atan2(tmpV.x, tmpV.z));
    return this.rotateAll(tmpQ);
  }

  /** Turn the whole pose about the body's origin. */
  rotateAll(q: THREE.Quaternion) {
    for (let i = 0; i < TRUNK.length; i++) if (this.hasTurn[i]) this.turns[i].premultiply(q);
    for (let i = 0; i < LIMBS.length; i++) if (this.hasDir[i]) this.dirs[i].applyQuaternion(q);
    return this;
  }

  /** Bend the trunk above the hips by `q` (spread up the spine) and carry the arms with the chest. */
  rotateUpper(q: THREE.Quaternion) {
    for (let i = 1; i < TRUNK.length; i++) {
      if (!this.hasTurn[i]) continue;
      tmpQ.copy(IDENTITY).slerp(q, UPPER_SHARE[i]);
      this.turns[i].premultiply(tmpQ);
    }
    for (let i = 0; i < LIMBS.length; i++) if (this.hasDir[i] && LIMBS[i].upper) this.dirs[i].applyQuaternion(q);
    return this;
  }

  /** The pose for the avatar. The returned object is reused: it is valid until the next call. */
  toRetarget(): RetargetPose {
    this.out.deltas.length = 0;
    this.out.aims.length = 0;
    for (let i = 0; i < TRUNK.length; i++) if (this.hasTurn[i]) this.out.deltas.push([TRUNK[i], this.turns[i]]);
    for (let i = 0; i < LIMBS.length; i++) {
      if (this.hasDir[i]) this.out.aims.push({ bone: LIMBS[i].bone, child: LIMBS[i].child, dir: this.dirs[i] });
    }
    return this.out;
  }
}
