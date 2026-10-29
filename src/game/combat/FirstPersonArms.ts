import * as THREE from 'three';
import type { CharacterModel } from '../../renderer/CharacterModel';

/** Where the first-person view draws: its scene (camera space, camera at the origin looking down -z). */
export interface FirstPersonView {
  /** False while the combat clips do not pose the body (still loading, or aiming with the built-in sights). */
  posed: boolean;
  scene: THREE.Scene;
  /** The world scene the body goes back to when it does not hold the gun in this view. */
  home: THREE.Scene;
  /** Pitch (rad) the clips bent the chest and arms up by: the view already looks that way, so the body is turned back by it. */
  pitch: number;
  /** Placement of the body from the settings (m, degrees): right, forward, down, and a tilt of the held gun. */
  side: number;
  forward: number;
  down: number;
  tiltDeg: number;
}

/**
 * Only the arms may show (with the gun): the trunk's bones are shrunk (their children scaled back, so the arms keep their place
 * and size), which folds the chest and back into a point under the camera; the neck is shrunk with everything on it (head, hair,
 * hats), since the camera is inside the head.
 */
const BONES_TO_HIDE = ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'];
const HIDDEN_SCALE = 0.02;
const HIDDEN_NECK_SCALE = 1e-3;
/** The eye sits in front of and a little above the head bone. */
const EYE_OFFSET = new THREE.Vector3(0, 0.06, 0.09);

const TURN_AROUND = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const RIGHT_AXIS = new THREE.Vector3(1, 0, 0);
const DEG = Math.PI / 180;

/**
 * The player's own character in the first-person view: the same model, posed by the same combat clips as in third person (see
 * PlayerAvatarRig), holding the same gun. This only places it: it moves into the first-person scene, the eye at the camera,
 * turned back by the view pitch so the arms and gun stay where the view looks, with everything but the arms hidden.
 */
export class FirstPersonArms {
  private readonly bones = new Map<string, THREE.Bone>();
  private skinKey: THREE.Skeleton | null = null;
  private readonly eye = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly tilt = new THREE.Quaternion();
  private readonly offset = new THREE.Vector3();

  constructor(private readonly model: CharacterModel) {}

  /**
   * Place the body (already posed this frame, still untransformed) in the first-person scene. False when it is not used (it is
   * then back in the world scene): the caller keeps its own first-person gun.
   */
  update(view: FirstPersonView): boolean {
    if (!view.posed || !this.model.ready || !this.findBones()) {
      this.release(view.home);
      return false;
    }
    const group = this.model.group;
    if (group.parent !== view.scene) view.scene.add(group);
    const head = this.bones.get('head')!;
    group.updateMatrixWorld(true);
    this.eye.setFromMatrixPosition(head.matrixWorld).add(EYE_OFFSET);
    this.hideAllButArms();
    // undo the clips' aim pitch (the view already looks that way), tilt by the setting, then turn round to face the view (-z)
    const lift = view.pitch - view.tiltDeg * DEG;
    this.turn.copy(TURN_AROUND).multiply(this.tilt.setFromAxisAngle(RIGHT_AXIS, lift));
    this.offset.copy(this.eye).applyQuaternion(this.turn).negate();
    // the clips hold the gun under the eye (the aim pose): it is moved a little off the line of sight, by the settings
    this.offset.x += view.side;
    this.offset.y -= view.down;
    this.offset.z -= view.forward;
    group.position.copy(this.offset);
    group.quaternion.copy(this.turn);
    group.visible = true;
    group.updateMatrixWorld(true);
    return true;
  }

  /** Give the model back to the world scene (third person, death). */
  release(home: THREE.Scene) {
    const group = this.model.group;
    if (group.parent !== home) home.add(group);
  }

  private findBones() {
    let skeleton: THREE.Skeleton | null = null;
    this.model.group.traverse((object) => {
      if (!skeleton && (object as THREE.SkinnedMesh).isSkinnedMesh) skeleton = (object as THREE.SkinnedMesh).skeleton;
    });
    if (!skeleton) return false;
    if (skeleton !== this.skinKey) {
      // a new body (race or gender change) brings new bones
      this.skinKey = skeleton;
      this.bones.clear();
      this.model.group.traverse((object) => {
        if ((object as THREE.Bone).isBone) this.bones.set(object.name, object as THREE.Bone);
      });
    }
    return this.bones.has('head');
  }

  private hideAllButArms() {
    for (const name of BONES_TO_HIDE) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      bone.scale.multiplyScalar(HIDDEN_SCALE);
      for (const child of bone.children) {
        child.position.divideScalar(HIDDEN_SCALE);
        child.scale.divideScalar(HIDDEN_SCALE);
      }
    }
    this.bones.get('neck_01')?.scale.multiplyScalar(HIDDEN_NECK_SCALE);
    this.bones.get('pelvis')?.updateWorldMatrix(false, true);
  }
}
