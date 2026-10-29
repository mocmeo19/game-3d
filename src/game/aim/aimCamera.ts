import * as THREE from 'three';
import { rayBox, type Solid } from '../rules';
import type { CombatTuning } from '../combat/combatSettings';
import type { AimMode } from './aimModes';

/**
 * The camera of the aim modes (aim.md 3): at the eye for first person and down the sights, behind the shoulder in third person,
 * pulled in over the shoulder while aiming. Each mode keeps a weight that eases towards the chosen one, so a change of mode
 * glides (and a change of mind half way just glides back); the view always looks along the aim angles, so the crosshair stays on
 * the same target through a transition. In third person the camera never goes through a wall: it comes in at once when something
 * is in the way and goes back out gently when it is gone.
 */

const MODES: AimMode[] = ['FPP_HIP', 'TPP_HIP', 'TPP_SHOULDER', 'ADS'];
/** Under this much third-person weight the camera is at the eye: the body is hidden and the first-person gun shown. */
const FIRST_PERSON_BELOW = 0.12;
const WALL_GAP = 0.2;
const MIN_REACH = 0.2;
/** 1/s: how fast the camera backs out to its distance once a wall is gone. */
const REACH_RETURN_RATE = 6;
const FLOOR = 0.2;

export interface AimCameraInput {
  dt: number;
  mode: AimMode;
  /** Eye of the character the camera follows. */
  eye: THREE.Vector3;
  /** View angles (aim plus half the recoil punch, free look and scope sway). */
  yaw: number;
  pitch: number;
  /** Lean roll at the eye (rad). */
  roll: number;
  /** Seconds to settle into `mode`; 0 jumps straight there. */
  transitionS: number;
  /** Field of view at the eye (first person) and down the sights. */
  eyeFov: number;
  adsFov: number;
  /** Third-person distance override (the menu's wider framing), or null for the tuning. */
  menuDistance: number | null;
  tuning: CombatTuning;
  solids: Solid[];
}

export interface AimView {
  /** The camera is at the eye: draw the first-person gun, not the body. */
  firstPersonView: boolean;
  /** 0..1 how far into each aim. */
  ads: number;
  shoulder: number;
}

export class AimCamera {
  private readonly weight: Record<AimMode, number> = { FPP_HIP: 0, TPP_HIP: 1, TPP_SHOULDER: 0, ADS: 0 };
  /** Share of the wanted third-person distance the camera is at (walls pull it in). */
  private reachShare = 1;
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly pivot = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly spot = new THREE.Vector3();

  /** Jump straight into a mode (respawn, a new character to follow). */
  snap(mode: AimMode) {
    for (const m of MODES) this.weight[m] = m === mode ? 1 : 0;
    this.reachShare = 1;
  }

  place(camera: THREE.PerspectiveCamera, input: AimCameraInput): AimView {
    this.ease(input);
    const w = this.weight;
    const t = input.tuning;
    const third = w.TPP_HIP + w.TPP_SHOULDER;
    const shoulderShare = third > 1e-4 ? w.TPP_SHOULDER / third : 0;
    const fov = w.FPP_HIP * input.eyeFov + w.TPP_HIP * t.cameraFov + w.TPP_SHOULDER * t.shoulderFov + w.ADS * input.adsFov;
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const { yaw, pitch } = input;
    this.forward.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    // the third-person spot: behind the eye and off to the right, closer and higher over the shoulder while aiming
    const distance = input.menuDistance ?? THREE.MathUtils.lerp(t.cameraDistance, t.shoulderDistance, shoulderShare);
    const side = THREE.MathUtils.lerp(t.cameraSide, t.shoulderSide, shoulderShare);
    this.pivot.copy(input.eye);
    this.pivot.y += 0.05 + t.shoulderLift * shoulderShare;
    this.back.copy(this.forward).multiplyScalar(-distance).addScaledVector(this.right, side);
    const wanted = this.back.length();
    if (wanted > 1e-4) this.back.divideScalar(wanted);
    const share = wanted > 1e-4 ? this.clearShare(wanted, input) : 1;
    this.spot.copy(this.pivot).addScaledVector(this.back, wanted * share);
    camera.position.copy(input.eye).lerp(this.spot, third);
    camera.position.y = Math.max(FLOOR, camera.position.y);
    // a lean tilts the view through the eye and over the shoulder, not from behind
    const roll = input.roll * (w.FPP_HIP + w.ADS + w.TPP_SHOULDER);
    camera.rotation.set(pitch, yaw, roll, 'YXZ');
    return { firstPersonView: third < FIRST_PERSON_BELOW, ads: w.ADS, shoulder: w.TPP_SHOULDER };
  }

  private ease(input: AimCameraInput) {
    const k = input.transitionS <= 0 ? 1 : 1 - Math.exp((-3 * input.dt) / input.transitionS);
    let sum = 0;
    for (const m of MODES) {
      this.weight[m] += ((m === input.mode ? 1 : 0) - this.weight[m]) * k;
      sum += this.weight[m];
    }
    for (const m of MODES) this.weight[m] /= sum;
  }

  /** Share of the way back (along `back`) the camera can go before a wall, eased out after a wall is gone. */
  private clearShare(wanted: number, input: AimCameraInput) {
    let reach = wanted;
    const p = this.pivot;
    const d = this.back;
    for (const solid of input.solids) {
      const hit = rayBox(p.x, p.y, p.z, d.x, d.y, d.z, solid, reach);
      if (hit) reach = Math.max(MIN_REACH, hit[0] - WALL_GAP);
    }
    const allowed = Math.min(1, reach / wanted);
    // in at once (never a frame inside the wall), out gently
    const out = this.reachShare + (allowed - this.reachShare) * (1 - Math.exp(-REACH_RETURN_RATE * input.dt));
    this.reachShare = allowed < this.reachShare ? allowed : out;
    return this.reachShare;
  }
}
