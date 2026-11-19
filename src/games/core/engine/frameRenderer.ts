import * as THREE from 'three';
import { rendererPixelRatio } from '../../../settings/renderSettings';
import { getGameplaySettings } from '../../../settings/gameplaySettings';
import { transitionSeconds, type AimMode, type GunGrip } from '../aim/aimModes';
import type { Agent } from '../agents/agent';
import type { PlayerAim } from '../aim/playerAim';
import type { FirstPersonArms } from '../combat/FirstPersonArms';
import type { PlayerAvatarRig } from '../combat/PlayerAvatarRig';
import type { ViewModel } from '../models';
import type { PlayerStanceKeys } from '../input/playerStanceKeys';
import { activeWeapon, aimPunch, inaccuracy, rayBox, WEAPONS, type WeaponState } from '../rules';
import { gripOfGun } from '../weapons/gunClass';
import type { Combat } from './combat';
import type { MatchContext } from './matchContext';

/** Vertical field of view the camera is built with, CS:GO's 90° horizontal at 4:3 (the player's setting replaces it in first person). */
export const VFOV = 74;
/** Lowest the camera goes over the ground (m). */
const CAMERA_GROUND_CLEARANCE = 0.3;
/** Camera distance on the start menu, where the character is shown off (the in-game camera comes from the settings). */
const TPP_MENU_DISTANCE = 3.6;
/** Field of view down iron sights or a red dot (no magnification). */
const IRON_SIGHT_FOV = 61;
const gripOf = (w: WeaponState | null): GunGrip => (w ? gripOfGun(w.id) : 'rifle');

/** The parts of the game a frame draws. */
export interface FrameParts {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  /** The element the canvas fills (its size is the picture's size). */
  host: HTMLElement;
  /** Where the per-frame HUD values (crosshair gap, flash, smoke) are set as CSS variables. */
  root: HTMLElement;
  rig: PlayerAvatarRig;
  fpArms: FirstPersonArms;
  vm: ViewModel;
  aim: PlayerAim;
  stance: PlayerStanceKeys;
  /** The player's character, hidden while it rides the plane. */
  playerBody: THREE.Object3D;
  /** The game's own world drawing each frame (battle royale: loot culling and the zone wall); `timeS` is wall-clock seconds. */
  updateWorldView: (cameraPosition: THREE.Vector3, timeS: number) => void;
  /** The game places the camera for this fighter itself (riding a plane); false leaves it to the aim camera. */
  placeGameCamera: (target: Agent, camera: THREE.PerspectiveCamera, eyeFovDeg: number) => boolean;
}

/** Draws a frame: the camera, the world, the first-person gun and the HUD values too chatty for React; adapts the resolution. */
export class FrameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly rig: PlayerAvatarRig;
  private readonly fpArms: FirstPersonArms;
  private readonly vm: ViewModel;
  private readonly aim: PlayerAim;
  private readonly stance: PlayerStanceKeys;
  private readonly playerBody: THREE.Object3D;
  private readonly updateWorldView: FrameParts['updateWorldView'];
  private readonly placeGameCamera: FrameParts['placeGameCamera'];
  private gunObstruction = 0;
  private bob = 0;
  private readonly sway = { x: 0, y: 0 };
  /** First-person vertical field of view from the gameplay settings, fixed for the match. */
  readonly eyeFovDeg = getGameplaySettings().firstPersonFovDeg;

  constructor(
    private readonly ctx: MatchContext,
    parts: FrameParts,
    private readonly fight: Pick<Combat, 'hitBody' | 'aimSpread' | 'recoilScaleOf'>,
  ) {
    this.renderer = parts.renderer;
    this.camera = parts.camera;
    this.host = parts.host;
    this.root = parts.root;
    this.rig = parts.rig;
    this.fpArms = parts.fpArms;
    this.vm = parts.vm;
    this.aim = parts.aim;
    this.stance = parts.stance;
    this.playerBody = parts.playerBody;
    this.updateWorldView = parts.updateWorldView;
    this.placeGameCamera = parts.placeGameCamera;
  }

  /** The first-person gun lags behind a mouse turn. */
  swayBy(dx: number, dy: number) {
    this.sway.x = THREE.MathUtils.clamp(this.sway.x + dx * 0.0006, -0.12, 0.12);
    this.sway.y = THREE.MathUtils.clamp(this.sway.y + dy * 0.0006, -0.12, 0.12);
  }

  /**
   * Adaptive resolution: when frames take too long the picture is drawn at a lower pixel ratio (and sharpens again when there is
   * time to spare), so a weak GPU loses sharpness before it loses smoothness.
   */
  private adaptTime = 0;
  private adaptFrames = 0;
  private pixelRatio = rendererPixelRatio(1.5);
  adaptResolution(dt: number) {
    this.adaptTime += dt;
    this.adaptFrames++;
    if (this.adaptTime < 1.5) return;
    const ms = (this.adaptTime / this.adaptFrames) * 1000;
    this.adaptTime = this.adaptFrames = 0;
    const max = rendererPixelRatio(1.5);
    let next = this.pixelRatio;
    if (ms > 24) next = Math.max(0.6, this.pixelRatio - 0.15);
    else if (ms < 13) next = Math.min(max, this.pixelRatio + 0.1);
    if (Math.abs(next - this.pixelRatio) < 0.01) return;
    this.pixelRatio = next;
    this.renderer.setPixelRatio(next);
    this.resize();
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private placeCamera(dt: number) {
    const p = this.ctx.player;
    const target = this.ctx.viewTarget();
    const w = activeWeapon(p.inv);
    const scope = p.alive && w && w.zoom > 0 ? WEAPONS[w.id].scope : undefined;
    if (!target) return { firstPerson: false, scoped: !!scope };
    if (this.placeGameCamera(target, this.camera, this.eyeFovDeg)) return { firstPerson: false, scoped: false };
    const menu = this.ctx.phase === 'menu';
    const own = target === p && p.alive && !menu;
    const aim = this.aim;
    // a scope is down the sights whatever the aim mode (a 5 vs 5 scope zooms with the button)
    const mode: AimMode = !own ? 'TPP_HIP' : scope ? 'ADS' : aim.mode;
    const tw = activeWeapon(target.inv);
    const gunPunch: [number, number] = tw ? aimPunch(tw.id, tw.recoil, this.fight.recoilScaleOf(target)) : [0, 0];
    // the player's own view eases into the punch and shakes on each shot; a fighter being watched shows the punch as it is
    if (own) aim.recoil.update(dt, gunPunch);
    const [px, py] = own ? aim.recoil.shown : gunPunch;
    const lookYaw = own ? aim.freeLook.yaw + aim.sway.yaw : 0;
    const lookPitch = own ? aim.freeLook.pitch + aim.sway.pitch : 0;
    const easing = mode === 'ADS' || aim.view.ads > 0.05 ? 'ADS' : 'TPP_SHOULDER';
    aim.view = aim.camera.place(this.camera, {
      // the view kicks by the whole aim punch, so a spray lands around the crosshair rather than drifting away from it
      shake: own ? aim.recoil.shakeRoll : 0,
      dt, mode, eye: target.eye(), yaw: target.yaw - px + lookYaw, pitch: THREE.MathUtils.clamp(target.pitch + py + lookPitch, -1.55, 1.55),
      roll: -target.lean * this.rig.leanAngle * this.rig.tuning.leanCameraRoll, transitionS: menu ? 0 : transitionSeconds(easing, gripOf(w)),
      eyeFov: this.eyeFovDeg, adsFov: scope ? scope[w!.zoom - 1] : IRON_SIGHT_FOV, menuDistance: menu ? TPP_MENU_DISTANCE : null,
      tuning: this.rig.tuning, solids: this.ctx.solids,
    });
    // the shoulder camera stays above a hillside behind the player
    if (this.ctx.rules.cameraClearsTerrain) this.camera.position.y = Math.max(this.camera.position.y, this.ctx.terrain.heightAt(this.camera.position.x, this.camera.position.z) + CAMERA_GROUND_CLEARANCE);
    return { firstPerson: aim.view.firstPersonView && p.alive && !menu, scoped: !!scope };
  }

  render(dt: number) {
    const p = this.ctx.player;
    for (const a of this.ctx.agents) {
      if (!a.body) continue;
      a.body.group.visible = !a.gear?.isAboard;
      a.body.group.position.copy(a.pos);
      a.body.group.rotation.y = a.yaw + Math.PI;
      a.body.update(dt, { speed: a.speed2d, crouch: a.crouch, pitch: a.pitch, alive: a.alive, dead: this.ctx.now - a.diedAt, airborne: !a.onGround });
    }
    const { firstPerson, scoped } = this.placeCamera(dt);
    this.aim.castView(this.camera, this.ctx.solids, this.fight.hitBody);
    // the shadow-casting sun follows the camera along the sky's sun direction
    this.ctx.arena.sun.target.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.ctx.arena.sun.position.copy(this.ctx.arena.sun.target.position).addScaledVector(this.ctx.arena.sunDir, 70);
    const timeS = performance.now() / 1000;
    this.ctx.arena.update(timeS, this.camera.position);
    this.updateWorldView(this.camera.position, timeS);

    // the player's own character (drawn whenever the camera is outside it, also as a body after death); in the first-person
    // view the same character holds the gun there (see FirstPersonArms), and comes back to the world when that view ends
    const w = activeWeapon(p.inv);
    const viewModelShown = firstPerson && !scoped && !!w;
    if (!viewModelShown) this.fpArms.release(this.ctx.arena.scene);
    this.rig.update({
      dt, now: this.ctx.now, player: p, weapon: w, stance: this.stance.value, firstPerson, aimBlend: Math.max(this.aim.view.ads, this.aim.view.shoulder),
      clipAim: true, aimPoint: this.aim.point,
      swingAt: this.ctx.feedback.swingAt, swingHeavy: this.ctx.feedback.swingHeavy, solids: this.ctx.solids,
    });
    // the rig shows the character every frame; on the plane it rides inside, out of sight
    if (p.gear?.isAboard) this.playerBody.visible = false;
    // shots leave this muzzle in third person; a wall between it and the crosshair point is marked on the HUD
    this.aim.trackMuzzle(!firstPerson && p.alive ? this.rig.muzzle : null, this.ctx.solids);

    const viewer = this.ctx.viewTarget();
    this.ctx.sfx.listener = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, yaw: viewer?.yaw ?? p.yaw };

    this.renderer.clear();
    this.renderer.render(this.ctx.arena.scene, this.camera);
    if (firstPerson && !scoped && w) {
      const forward = this.camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      let wallDistance = 2;
      for (const offset of [-0.24, 0, 0.24]) {
        const origin = this.camera.position.clone().addScaledVector(right, offset);
        for (const solid of this.ctx.solids) {
          const hit = rayBox(origin.x, origin.y, origin.z, forward.x, forward.y, forward.z, solid, wallDistance);
          if (hit && hit[0] > 0.02) wallDistance = Math.min(wallDistance, hit[0]);
        }
      }
      this.gunObstruction = THREE.MathUtils.damp(this.gunObstruction, Math.max(0, 1.22 - wallDistance), 16, dt);
      const speed = p.speed2d;
      this.bob += speed * dt * 1.7;
      this.sway.x *= Math.exp(-dt * 10);
      this.sway.y *= Math.exp(-dt * 10);
      this.ctx.feedback.kick *= Math.exp(-dt * 16);
      const def = WEAPONS[w.id];
      this.vm.setWeapon(w.id);
      this.vm.update(
        dt,
        {
          bobPhase: this.bob,
          bobAmount: p.onGround ? Math.min(1, speed / 5) : 0.2,
          swayX: this.sway.x,
          swayY: this.sway.y,
          kick: this.ctx.feedback.kick,
          reload: w.reloadLeft > 0 ? 1 - w.reloadLeft / def.reload : 0,
          deploy: def.deploy ? 1 - w.deployLeft / def.deploy : 1,
          inspect: this.ctx.now - this.ctx.feedback.inspectAt < 2.4 ? this.ctx.now - this.ctx.feedback.inspectAt : -1,
          swing: this.ctx.now - this.ctx.feedback.swingAt < 0.35 ? (this.ctx.now - this.ctx.feedback.swingAt) / 0.35 : p.pin ? 0.15 : 0,
          swingHeavy: this.ctx.feedback.swingHeavy,
          crouch: p.crouch,
          aim: this.aim.view.ads,
          obstruction: this.gunObstruction
        },
        this.camera.aspect
      );
      // the player's character, posed by the combat clips, holds the gun here; the view's own gun and arms stand in until those
      // clips are loaded, and while aiming (their sights line up with the crosshair)
      const tuning = this.rig.tuning;
      const bodyHolds = this.fpArms.update({
        posed: this.rig.clipPosed, scene: this.vm.scene, home: this.ctx.arena.scene, pitch: this.rig.appliedPitch, gunLine: this.rig.heldGunLine,
        side: tuning.fpSide, forward: tuning.fpForward, down: tuning.fpDown, tiltDeg: tuning.fpTiltDeg,
      });
      this.vm.setBodyHolds(bodyHolds ? this.rig.muzzle : null);
      this.renderer.clearDepth();
      this.renderer.render(this.vm.scene, this.vm.camera);
    }
    this.rig.resetToBind();

    // per-frame HUD values, too chatty for React: crosshair gap, flash and smoke whiteout
    const style = this.root.style;
    let gap = 5;
    if (w && WEAPONS[w.id].slot <= 2) {
      const inacc = inaccuracy(w, { speed: p.speed2d, crouched: p.crouch > 0.5, airborne: !p.onGround, prone: p.prone > 0.5 }) * this.fight.aimSpread(p);
      // the lines open up only part of the way the real spread does: a moving crosshair that is too wide hides the target
      gap = THREE.MathUtils.clamp((Math.tan(inacc) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * (this.host.clientHeight / 2) * 0.45, 3, 34);
    }
    style.setProperty('--ch-gap', `${gap.toFixed(1)}px`);
    // where cover in front of the muzzle would stop the shot, marked on the screen (PUBG's blocked-aim marker)
    const block = this.aim.blockedAt?.clone().project(this.camera);
    style.setProperty('--block-on', block && block.z < 1 ? '1' : '0');
    if (block) style.setProperty('--block-at', `${((block.x * this.host.clientWidth) / 2).toFixed(1)}px ${((-block.y * this.host.clientHeight) / 2).toFixed(1)}px`);
    style.setProperty('--flash', (p.alive ? Math.max(0, Math.min(1, (p.blindUntil - this.ctx.now) / 1.4)) : 0).toFixed(3));
    style.setProperty('--smoke', this.ctx.effects.smokeDensity(this.camera.position).toFixed(3));
  }
}
