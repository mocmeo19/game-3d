import * as THREE from 'three';

/** How the first-person hands hold a weapon: both on a long gun, both around a pistol grip, or one hand (knife, grenade). */
export type ViewHands = 'rifle' | 'pistol' | 'one';

const SLEEVE_WIDTH = 0.075;
const SLEEVE_LENGTH = 0.6;
/** Gap between the glove and the start of the sleeve along the forearm. */
const WRIST = 0.045;
const GLOVE_SIZE: [number, number, number] = [0.062, 0.085, 0.1];
/** Brown leather: black gloves vanish against black guns. */
const GLOVE_COLOR = 0x6b5440;
/** Hands sit a little under the point they hold (they wrap around the grip or handguard from below). */
const HAND_DROP = 0.018;
/**
 * Direction from each hand back along its forearm, in the camera-space holder (x right, y up, +z towards the camera): the right
 * forearm leaves the grip down and to the right, the left one leaves the handguard down and to the left.
 */
const REACH = {
  right: new THREE.Vector3(0.38, -0.55, 0.74).normalize(),
  leftRifle: new THREE.Vector3(-0.42, -0.62, 0.66).normalize(),
  leftPistol: new THREE.Vector3(-0.3, -0.6, 0.74).normalize(),
};
const FORWARD = new THREE.Vector3(0, 0, 1);

interface Arm {
  sleeve: THREE.Mesh;
  glove: THREE.Mesh;
  reach: THREE.Vector3;
  /** The gun's hold point the hand goes to (null: the grip, at the gun's origin). */
  anchor: THREE.Object3D | null;
}

/**
 * First-person forearms that hold the gun where its model says it is held: the right hand on the grip (the gun's origin), the
 * other hand on the gun's `support` point. They are placed again whenever the gun's model changes (a loaded model replacing the
 * box model moves its hold points). The arms belong to the weapon holder and are freed with it.
 */
export class ViewArms {
  readonly group = new THREE.Group();
  private readonly arms: Arm[] = [];
  private version = -1;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly gun: THREE.Object3D, hands: ViewHands, sleeveColor: number) {
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: sleeveColor, roughness: 0.85, metalness: 0.1 });
    const gloveMaterial = new THREE.MeshStandardMaterial({ color: GLOVE_COLOR, roughness: 0.7, metalness: 0.1 });
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const gloveBox = new THREE.BoxGeometry(...GLOVE_SIZE);
    const addArm = (reach: THREE.Vector3, anchor: THREE.Object3D | null) => {
      const sleeve = new THREE.Mesh(unitBox, sleeveMaterial);
      const glove = new THREE.Mesh(gloveBox, gloveMaterial);
      this.group.add(sleeve, glove);
      this.arms.push({ sleeve, glove, reach, anchor });
    };
    addArm(REACH.right, null);
    const support = gun.userData.support as THREE.Object3D | undefined;
    if (hands !== 'one' && support) addArm(hands === 'rifle' ? REACH.leftRifle : REACH.leftPistol, support);
  }

  /** Call every frame: cheap unless the gun's model has changed since the hands were placed. */
  update() {
    const version = (this.gun.userData.fitVersion as number | undefined) ?? 0;
    if (version === this.version) return;
    this.version = version;
    this.gun.updateMatrix();
    for (const arm of this.arms) {
      const hand = arm.anchor ? this.tmp.copy(arm.anchor.position) : this.tmp.set(0, 0, 0);
      hand.applyMatrix4(this.gun.matrix);
      hand.y -= HAND_DROP;
      arm.glove.position.copy(hand);
      arm.sleeve.quaternion.setFromUnitVectors(FORWARD, arm.reach);
      arm.sleeve.scale.set(SLEEVE_WIDTH, SLEEVE_WIDTH, SLEEVE_LENGTH);
      arm.sleeve.position.copy(hand).addScaledVector(arm.reach, WRIST + SLEEVE_LENGTH / 2);
    }
  }
}
