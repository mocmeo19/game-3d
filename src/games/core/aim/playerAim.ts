import * as THREE from 'three';
import { anglesTo } from '../agents/agent';
import type { CombatStance } from '../combat/combatStateMachine';
import type { Solid } from '../rules';
import { AimCamera, type AimView } from './aimCamera';
import { AimController, isAiming, type AimMode, type AimStyle, type Perspective } from './aimModes';
import { castAimPoint, firstObstacle, type BodyHit } from './aimTrajectory';
import { FreeLook } from './freeLook';
import { ScopeSway } from './scopeSway';
import { ViewRecoil } from './viewRecoil';

/** How far the crosshair ray looks for something to aim at (m). */
const AIM_RANGE = 250;
/** A muzzle further than this from the eye is a stale or broken reading: shots then leave from the eye. */
const MAX_MUZZLE_FROM_EYE = 1.5;

export interface AimStepInput {
  dt: number;
  now: number;
  style: AimStyle;
  perspective: Perspective;
  /** Aim button down. */
  pressed: boolean;
  canAim: boolean;
  freeLookHeld: boolean;
  holdBreathHeld: boolean;
  /** The gun in hand has a magnifying scope. */
  scoped: boolean;
  stance: CombatStance;
}

/**
 * The player's aiming (aim.md): the mode chosen from the aim button, the camera that follows it, free look, scope sway, and where
 * shots go. Each frame the crosshair ray from the camera finds the aim point; shots leave the muzzle towards it (from the eye when
 * looking through it), and a wall between the muzzle and that point is reported for the HUD.
 */
export class PlayerAim {
  readonly controller = new AimController();
  readonly camera = new AimCamera();
  readonly freeLook = new FreeLook();
  readonly sway = new ScopeSway();
  /** The recoil the view shows; shots are aimed from it so the crosshair stays true. */
  readonly recoil = new ViewRecoil();
  /** The camera view of the last frame: how far into each aim, and whether it is at the eye. */
  view: AimView = { firstPersonView: false, ads: 0, shoulder: 0 };
  /** The point the crosshair is on (world), updated every frame. */
  readonly point = new THREE.Vector3();
  /** Where a wall stops shots from the muzzle short of the aim point, or null when the way is clear. */
  blockedAt: THREE.Vector3 | null = null;
  holdingBreath = false;
  private readonly muzzle = new THREE.Vector3();
  private muzzleValid = false;
  private readonly direction = new THREE.Vector3();
  private readonly blocked = new THREE.Vector3();

  get mode(): AimMode {
    return this.controller.mode;
  }

  /** The aim mode for this step, free look and the breath. */
  step(input: AimStepInput) {
    const mode = this.controller.update(input);
    this.freeLook.update(input.dt, input.freeLookHeld && !isAiming(mode));
    this.holdingBreath = this.sway.update(input.dt, mode === 'ADS' && input.scoped, input.holdBreathHeld, input.stance);
    return mode;
  }

  /** Mouse turn (rad): taken by free look while it is held, otherwise it turns the body (returns false). */
  look(dYaw: number, dPitch: number) {
    return this.freeLook.take(dYaw, dPitch);
  }

  reset(perspective: Perspective) {
    this.controller.reset(perspective);
    this.camera.snap(perspective === 'fpp' ? 'FPP_HIP' : 'TPP_HIP');
    this.freeLook.reset();
    this.recoil.reset();
    this.muzzleValid = false;
    this.blockedAt = null;
  }

  /** Find the aim point along the camera's view (after the camera is placed this frame). */
  castView(camera: THREE.Camera, solids: Solid[], hitBody: BodyHit) {
    camera.getWorldDirection(this.direction);
    castAimPoint(camera.position, this.direction, solids, hitBody, AIM_RANGE, this.point);
  }

  /** Take the muzzle of the gun in the drawn hands (null when there is none) and check for a wall between it and the aim point. */
  trackMuzzle(muzzle: THREE.Object3D | null, solids: Solid[]) {
    this.muzzleValid = !!muzzle && !this.view.firstPersonView;
    if (!this.muzzleValid) {
      this.blockedAt = null;
      return;
    }
    muzzle!.getWorldPosition(this.muzzle);
    this.blockedAt = firstObstacle(this.muzzle, this.point, solids, this.blocked);
  }

  /** Where the player's bullet starts: the muzzle in third person, the eye when looking through it. */
  shotOrigin(eye: THREE.Vector3) {
    if (!this.muzzleValid || this.muzzle.distanceTo(eye) > MAX_MUZZLE_FROM_EYE) return eye;
    return this.muzzle.clone();
  }

  /**
   * Aim angles for the player's bullet from `origin`: towards the point the crosshair is on. The camera shows the recoil punch
   * (`recoil.shown`) and the shot adds the gun's punch again, so the shown punch is taken back out here. While free looking the
   * camera is elsewhere: the gun shoots where the body faces.
   */
  shotAngles(camera: THREE.Camera, origin: THREE.Vector3, body: [number, number], solids: Solid[], hitBody: BodyHit): [number, number] {
    if (this.freeLook.yaw !== 0 || this.freeLook.pitch !== 0) return [body[0] + this.sway.yaw, body[1] + this.sway.pitch];
    this.castView(camera, solids, hitBody);
    const [yaw, pitch] = anglesTo(origin, this.point);
    return [yaw + this.recoil.shown[0], pitch - this.recoil.shown[1]];
  }
}
