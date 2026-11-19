import * as THREE from 'three';
import type { CharacterModel, GunHold } from '../../../renderer/CharacterModel';
import type { Agent } from '../agents/agent';
import { disposeTree, gunMesh, knifeSlashPose } from '../models';
import { rayBox, WEAPONS, type Solid, type WeaponId, type WeaponState } from '../rules';
import { gripOfGun } from '../weapons/gunClass';
import { CombatAnimator } from './CombatAnimator';
import { GunHandAlignment } from './gunHandAlignment';
import { pointGunAt } from './gunAimPoint';
import { hitSideOf, weaponPhase, type CombatFrame, type CombatStance, type GunCarry, type HitSide } from './combatStateMachine';

/** How a weapon is held, from the weapon: pistols, SMG, rifles, sniper rifles, knife, grenades. */
const holdOf = (id: WeaponId, slot: number): GunHold => {
  if (slot === 3) return 'knife';
  if (slot === 4) return 'grenade';
  return gripOfGun(id);
};

/** Progress of the fall of a dead player's body, matching the rotation's easing. */
const easeFall = (k: number) => 1 - (1 - k) * (1 - k);
const KNIFE_SWING_S = 0.35;
const BODY_CLEARANCE = 0.62;
const MAX_BODY_PUSH = 0.45;
const TURN_SMOOTHING = 10;
const DEG = Math.PI / 180;
/** How long putting the rifle on the back takes when its clip has not loaded yet (s). */
const STOW_FALLBACK_S = 1;
/** Share of the stow clip after which the rifle has left the hands for the back, and of the draw before it is back in them. */
const STOW_RELEASE_AT = 0.6;
const DRAW_GRAB_AT = 0.35;
/** The slung rifle behind the upper back, barrel up over one shoulder (character-local, the body faces +z). */
const BACK_OFFSET = new THREE.Vector3(0, -0.08, -0.32);
const BACK_TILT = new THREE.Euler(-Math.PI / 2, 0, 0.55);
/** Past this aim blend the built-in aiming pose takes over from the clips (it lines the gun up with the sights). */
const BUILT_IN_AIM_FROM = 0.05;
/** How far the barrel turns from the clip's hands onto the aim point at full aim (weapon IK). */
const AIM_POINT_WEIGHT = 0.9;
/** Share of the gap between the hands' line and the aim taken out per frame by the sideways aim offset, and its limit (rad). */
const AIM_YAW_GAIN = 0.25;
const AIM_YAW_LIMIT = 0.6;
/** 1/s: how fast the sideways aim offset fades once the aim is let go. */
const AIM_YAW_RELEASE = 8;
/** The gun is still coming up for this long after the aim starts (the raise clip): its hands are no guide yet. */
const AIM_RAISE_S = 0.4;

export interface PlayerRigInput {
  dt: number;
  now: number;
  player: Agent;
  weapon: WeaponState | null;
  stance: CombatStance;
  firstPerson: boolean;
  /** 0..1 eased aim blend (over the shoulder or down the sights). */
  aimBlend: number;
  /** Aiming in third person keeps the combat clips (aim and aim-walk) instead of the built-in aiming pose. */
  clipAim: boolean;
  /** Where the crosshair is (world): an aiming gun turns its barrel onto it. */
  aimPoint: THREE.Vector3 | null;
  swingAt: number;
  swingHeavy: boolean;
  solids: Solid[];
}

/**
 * The player's own character in the battle game: poses the avatar (combat animation clips when they are loaded, the built-in
 * motion otherwise), places it, keeps it and the held gun clear of walls, and lays the body down when the player dies.
 */
export class PlayerAvatarRig {
  private readonly animator = new CombatAnimator();
  private heldGun: THREE.Group | null = null;
  private heldGunId: WeaponId | null = null;
  private readonly gunAlignment = new GunHandAlignment();
  /** The barrel's direction in body space this frame (see heldGunLine). */
  private readonly gunLine = new THREE.Vector3();
  private hasGunLine = false;
  /** How far the drawn body is moved away from a wall so arms, legs and gun do not go into it (the hit box stays where it is). */
  private readonly bodyPush = new THREE.Vector2();
  private gunObstruction = 0;
  private groundOffset = 0;
  // animation state tracked from frame to frame
  private stance: CombatStance = 'stand';
  private stanceFrom: CombatStance = 'stand';
  private stanceAt = -99;
  private airborne = false;
  private airAt = -99;
  private landedAt = -99;
  private aiming = false;
  private aimChangedAt = -99;
  private lastYaw: number | null = null;
  private turnRate = 0;
  private lastIdle = Infinity;
  private reloading = false;
  private reloadEmpty = false;
  private shownGunId: WeaponId | null = null;
  private unequip: { id: WeaponId; at: number } | null = null;
  /** The rifle around a sprint: in the hands, going onto the back, on the back, or coming back. */
  private carry: GunCarry = 'hands';
  private carryAt = -99;
  private hitAt = -99;
  private hitSide: HitSide = 'front';
  private readonly hitFrom = new THREE.Vector3();
  private freshHit = false;
  private posedByClips = false;
  /** Sideways aim offset fed to the clips: turns the chest so the hands (and the gun in them) face the aim point. */
  private aimYaw = 0;

  constructor(private readonly model: CharacterModel) {}

  /** The player was hit by someone standing at `from` (world). */
  notifyHit(from: THREE.Vector3, player: Agent, now: number) {
    const dx = from.x - player.pos.x;
    const dz = from.z - player.pos.z;
    // body space: forward is the view direction, right is 90° clockwise from it
    const localZ = -Math.sin(player.yaw) * dx - Math.cos(player.yaw) * dz;
    const localX = Math.cos(player.yaw) * dx - Math.sin(player.yaw) * dz;
    this.hitFrom.set(localX, 0, localZ).normalize();
    this.hitSide = hitSideOf(localX, localZ);
    this.hitAt = now;
    this.freshHit = true;
  }

  /** Tuning saved in Settings → Chiến đấu (camera placement, lean, recoil…). */
  get tuning() {
    return this.animator.settings.tuning;
  }

  /** Eye shift at full lean (m), from the tuning in the settings. */
  get leanReach() {
    return this.animator.settings.tuning.leanOffsetM;
  }

  get leanSpeed() {
    return this.animator.settings.tuning.leanSpeed;
  }

  get leanAngle() {
    return this.animator.settings.tuning.leanAngleDeg * DEG;
  }

  update(input: PlayerRigInput) {
    const { dt, player: p, firstPerson } = input;
    const model = this.model;
    const w = input.weapon;
    model.group.visible = !firstPerson && model.ready;
    model.group.rotation.set(0, 0, 0);
    model.group.position.set(0, 0, 0);
    const holdsGun = !!w && WEAPONS[w.id].slot <= 2;
    this.updateBodyPush(dt, p, firstPerson, input.solids);
    this.track(input, holdsGun);

    // the combat clips pose the body while the avatar stands untransformed (bones are posed in the world frame); in the
    // first-person view the same pose holds the gun there (FirstPersonArms places the body, the clips move it)
    const additives = { pitch: p.pitch, yaw: this.aimYaw, lean: p.lean, shot: this.consumeShot(w), hitFrom: this.freshHit ? this.hitFrom : null };
    const posed = model.ready && (model.group.visible || firstPerson);
    const clipPose = posed ? this.animator.update(dt, this.combatFrame(input, holdsGun), additives) : null;
    // the built-in motion has no lying pose: prone aiming in third person stays with the clips, as does all third-person aiming
    // where the aim clips are used; through the eye the built-in pose lines the sights up with the crosshair
    const builtInAim = holdsGun && p.alive && input.aimBlend > BUILT_IN_AIM_FROM && (firstPerson || (!input.clipAim && this.stance !== 'prone'));
    const pose = builtInAim ? null : clipPose;
    this.posedByClips = !!pose;
    this.freshHit = false;
    model.setRetarget(pose);
    // grenades are not drawn in the hand, so the arms keep their ordinary pose for them
    const hold = w && WEAPONS[w.id].slot <= 3 ? holdOf(w.id, WEAPONS[w.id].slot) : undefined;
    const reloadProgress = w && w.reloadLeft > 0 && WEAPONS[w.id].reload > 0 ? 1 - w.reloadLeft / WEAPONS[w.id].reload : -1;
    model.animateGame(dt, {
      speed: p.alive ? p.speed2d : 0, armed: holdsGun && p.alive && this.carry !== 'back', crouch: p.alive ? p.crouch : 0, pitch: p.alive ? p.pitch : 0, airborne: p.alive && !p.onGround, vy: p.vel.y,
      hold, aim: input.aimBlend, reload: reloadProgress,
      // running with the weapon lowered, until a shot or an aim raises it
      lowered: p.alive && holdsGun && w && w.cooldown <= 0 && reloadProgress < 0 ? THREE.MathUtils.clamp((p.speed2d - 3.6) / 1.6, 0, 1) : 0
    });
    this.updateGun(input, holdsGun, reloadProgress, !!pose);
    this.updateAimYaw(input, !!pose);
    if (!firstPerson) this.place(input, !!pose);
  }

  /** Aim pitch (rad) the clips bent the upper body by this frame. */
  get appliedPitch() {
    return this.animator.appliedPitch;
  }

  /**
   * Barrel direction (body space) of a rifle the clip holds in both hands this frame, or null. The hip clips hold it across the
   * chest, so the first-person view turns the body until this line runs along the line of sight (see FirstPersonArms).
   */
  get heldGunLine(): THREE.Vector3 | null {
    return this.hasGunLine ? this.gunLine : null;
  }

  /** True while the combat clips pose the body (false until they are loaded, or when switched off). */
  get clipPosed() {
    return this.posedByClips;
  }

  /** The muzzle of the gun in the character's hand (the first-person view puts its flash there). */
  get muzzle(): THREE.Object3D | null {
    return (this.heldGun?.userData.muzzle as THREE.Object3D | undefined) ?? null;
  }

  /** Put the avatar back in its bind frame: asset callbacks fit the model between frames. */
  resetToBind() {
    this.model.group.position.set(0, 0, 0);
    this.model.group.rotation.set(0, 0, 0);
    this.model.group.scale.setScalar(1);
    this.model.group.updateMatrixWorld(true);
  }

  hideGun() {
    if (this.heldGun) this.heldGun.visible = false;
  }

  dispose() {
    this.animator.dispose();
    if (this.heldGun) disposeTree(this.heldGun);
  }

  /** Follow the gameplay state over time: stance changes, take-off and landing, aiming, reloads, switching away from a gun. */
  private track(input: PlayerRigInput, holdsGun: boolean) {
    const { now, player: p, weapon: w } = input;
    if (input.stance !== this.stance) {
      this.stanceFrom = this.stance;
      this.stance = input.stance;
      this.stanceAt = now;
    }
    const airborne = p.alive && !p.onGround;
    if (airborne !== this.airborne) {
      if (airborne) this.airAt = now;
      else this.landedAt = now;
      this.airborne = airborne;
    }
    const aiming = input.aimBlend > 0.5;
    if (aiming !== this.aiming) {
      this.aiming = aiming;
      this.aimChangedAt = now;
    }
    if (input.dt > 0) {
      const yawDelta = this.lastYaw === null ? 0 : Math.atan2(Math.sin(p.yaw - this.lastYaw), Math.cos(p.yaw - this.lastYaw));
      this.turnRate = THREE.MathUtils.damp(this.turnRate, yawDelta / input.dt, TURN_SMOOTHING, input.dt);
      this.lastYaw = p.yaw;
    }
    const reloading = !!w && w.reloadLeft > 0;
    if (reloading && !this.reloading) this.reloadEmpty = w.ammo === 0;
    this.reloading = reloading;
    const gunId = holdsGun && w ? w.id : null;
    if (this.shownGunId && !gunId && p.alive) this.unequip = { id: this.shownGunId, at: now };
    if (gunId || !p.alive || (this.unequip && now - this.unequip.at > this.animator.settings.tuning.unequipMs / 1000)) this.unequip = null;
    this.shownGunId = gunId;
    this.trackCarry(input, holdsGun);
  }

  /** A rifle goes onto the back when a sprint starts and comes back into the hands (over the weapon's draw time) when it ends. */
  private trackCarry(input: PlayerRigInput, holdsGun: boolean) {
    const { now, player: p, weapon: w } = input;
    const setCarry = (next: GunCarry) => {
      this.carry = next;
      this.carryAt = now;
    };
    if (!p.alive || !holdsGun || !w || WEAPONS[w.id].slot !== 1) {
      if (this.carry !== 'hands') setCarry('hands');
      return;
    }
    if (p.sprinting) {
      if (this.carry === 'hands' || this.carry === 'drawing') setCarry('stowing');
      else if (this.carry === 'stowing' && now - this.carryAt >= this.stowSeconds) setCarry('back');
      return;
    }
    if (this.carry === 'stowing' || this.carry === 'back') setCarry('drawing');
    else if (this.carry === 'drawing' && w.deployLeft <= 0) setCarry('hands');
  }

  private get stowSeconds() {
    return this.animator.clipSeconds('Rifle_Stow_Back') ?? STOW_FALLBACK_S;
  }

  /** The rifle is on the back: once it is slung, late in putting it away, and early in taking it out again. */
  private gunOnBack(w: WeaponState | null, now: number) {
    if (this.carry === 'back') return true;
    if (this.carry === 'stowing') return (now - this.carryAt) / this.stowSeconds >= STOW_RELEASE_AT;
    if (this.carry !== 'drawing' || !w) return false;
    const deploy = WEAPONS[w.id].deploy;
    return deploy > 0 && 1 - w.deployLeft / deploy < DRAW_GRAB_AT;
  }

  /** True once per shot: the weapon's time since its last shot started again. */
  private consumeShot(w: WeaponState | null) {
    const idle = w ? w.idle : Infinity;
    const shot = idle < this.lastIdle && idle < 0.05;
    this.lastIdle = idle;
    return shot;
  }

  private combatFrame(input: PlayerRigInput, holdsGun: boolean): CombatFrame {
    const { now, player: p, weapon: w } = input;
    const def = w ? WEAPONS[w.id] : null;
    const forwardX = -Math.sin(p.yaw);
    const forwardZ = -Math.cos(p.yaw);
    return {
      now, gunClass: def && def.slot === 2 ? 'pistol' : 'rifle', firstPerson: input.firstPerson, alive: p.alive, diedAt: p.diedAt, deathSide: this.hitSide,
      stance: this.stance, stanceFrom: this.stanceFrom, stanceAt: this.stanceAt,
      forward: p.vel.x * forwardX + p.vel.z * forwardZ, right: p.vel.x * -forwardZ + p.vel.z * forwardX,
      sprinting: p.sprinting, carry: this.carry, carryAt: this.carryAt, airborne: this.airborne, vy: p.vel.y, airAt: this.airAt, landedAt: this.landedAt,
      turnRate: this.turnRate,
      phase: weaponPhase({
        alive: p.alive, holdsGun: holdsGun || this.unequip !== null, unequipping: this.unequip !== null,
        deployLeft: w?.deployLeft ?? 0, reloadLeft: w?.reloadLeft ?? 0, sinceShot: w?.idle ?? Infinity, aiming: this.aiming,
      }),
      sinceShot: w?.idle ?? Infinity, aiming: this.aiming, aimChangedAt: this.aimChangedAt,
      reloadProgress: w && def && def.reload > 0 ? 1 - w.reloadLeft / def.reload : 0, reloadEmpty: this.reloadEmpty,
      deployProgress: w && def && def.deploy > 0 ? 1 - w.deployLeft / def.deploy : 1,
      unequipAt: this.unequip?.at ?? -99, hitAt: this.hitAt, hitSide: this.hitSide,
    };
  }

  /** Keep the drawn body clear of walls: arms, legs and the gun reach further than the collision circle. */
  private updateBodyPush(dt: number, p: Agent, firstPerson: boolean, solids: Solid[]) {
    const want = new THREE.Vector2();
    if (p.alive && !firstPerson) {
      for (const s of solids) {
        if (s.max.y < p.pos.y + 0.25 || s.min.y > p.pos.y + 1.6) continue;
        if (p.pos.x < s.min.x - BODY_CLEARANCE || p.pos.x > s.max.x + BODY_CLEARANCE || p.pos.z < s.min.z - BODY_CLEARANCE || p.pos.z > s.max.z + BODY_CLEARANCE) continue;
        const cx = Math.max(s.min.x, Math.min(s.max.x, p.pos.x));
        const cz = Math.max(s.min.z, Math.min(s.max.z, p.pos.z));
        const dx = p.pos.x - cx;
        const dz = p.pos.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < BODY_CLEARANCE && d > 1e-4) {
          want.x += (dx / d) * (BODY_CLEARANCE - d);
          want.y += (dz / d) * (BODY_CLEARANCE - d);
        }
      }
      want.clampLength(0, MAX_BODY_PUSH);
    }
    this.bodyPush.lerp(want, Math.min(1, dt * 18));
  }

  private updateGun(input: PlayerRigInput, holdsGun: boolean, reloadProgress: number, animated: boolean) {
    const { dt, player: p, weapon: w } = input;
    const model = this.model;
    this.hasGunLine = false;
    // while the hands put a gun away, that gun stays in them
    const shownId = this.unequip?.id ?? (w && WEAPONS[w.id].slot <= 3 ? w.id : null);
    if (shownId !== this.heldGunId) {
      if (this.heldGun) {
        this.heldGun.removeFromParent();
        disposeTree(this.heldGun);
      }
      this.heldGun = shownId ? gunMesh(shownId) : null;
      if (this.heldGun) model.group.add(this.heldGun);
      this.heldGunId = shownId;
    }
    const gun = this.heldGun;
    if (!gun) return;
    const longGun = holdsGun || this.unequip !== null;
    gun.visible = p.alive;
    if (this.gunOnBack(w, input.now)) {
      gun.position.copy(model.gameBackPoint(new THREE.Vector3())).add(BACK_OFFSET);
      gun.rotation.copy(BACK_TILT);
      this.gunObstruction = THREE.MathUtils.damp(this.gunObstruction, 0, 18, dt);
      return;
    }
    gun.position.copy(model.gameWeaponGrip(new THREE.Vector3())).add(new THREE.Vector3(0, 0.02, 0.06));
    gun.rotation.set(longGun ? -p.pitch : 0.6, 0, 0);
    // a rifle lies along both hands of the clip; a pistol (one hand on the grip) keeps its own aim
    const twoHanded = animated && longGun && p.alive && shownId !== null && WEAPONS[shownId].slot === 1;
    this.gunAlignment.apply(gun, model.group, twoHanded, dt);
    if (twoHanded) {
      this.gunLine.set(0, 0, 1).applyQuaternion(gun.quaternion);
      this.hasGunLine = true;
    }
    if (animated && longGun && p.alive && input.aimPoint && !input.firstPerson) this.aimGunAtPoint(gun, input);
    if (animated && longGun) {
      // a gun following the clip's hands already gets the recoil and the lean from them
      if (!this.gunAlignment.following) {
        gun.rotation.x -= this.animator.recoilAngle;
        gun.rotation.z = p.lean * this.leanAngle;
      }
    } else if (holdsGun && reloadProgress >= 0) {
      // while reloading the gun tips towards the free hand
      const bell = Math.sin(Math.PI * reloadProgress);
      gun.rotation.x += 0.35 * bell;
      gun.rotation.z += 0.3 * bell;
    }
    this.swingKnife(gun, input, w);
    if (holdsGun && p.alive && !input.firstPerson) this.clearGunOfWalls(gun, input);
    else this.gunObstruction = THREE.MathUtils.damp(this.gunObstruction, 0, 18, dt);
  }

  /**
   * Sideways aim offset: the aim clips hold the rifle at an angle to the body, so while aiming the chest turns until the line between
   * the hands points at the aim point (measured on the posed body, corrected a share per frame); it fades when the aim ends.
   */
  private updateAimYaw(input: PlayerRigInput, animated: boolean) {
    const { dt, player: p } = input;
    const palmYaw = this.gunAlignment.palmYaw;
    if (!animated || !input.aimPoint || input.aimBlend < 0.5 || palmYaw === null) {
      this.aimYaw *= Math.exp(-AIM_YAW_RELEASE * dt);
      return;
    }
    // while the gun is raised or a hit reaction throws the arms about, hold the offset instead of chasing the hands
    if (input.now - this.aimChangedAt < AIM_RAISE_S || input.now - this.hitAt < this.animator.settings.tuning.hitMs / 1000) return;
    const gun = this.heldGun!;
    const toAim = input.aimPoint.clone().sub(p.pos).setY(0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -(p.yaw + Math.PI));
    const aimYaw = Math.atan2(toAim.x - gun.position.x, toAim.z - gun.position.z);
    const gap = Math.atan2(Math.sin(aimYaw - palmYaw), Math.cos(aimYaw - palmYaw));
    this.aimYaw = THREE.MathUtils.clamp(this.aimYaw + gap * AIM_YAW_GAIN, -AIM_YAW_LIMIT, AIM_YAW_LIMIT);
  }

  /** Weapon IK: while aiming, the barrel turns from where the clip's hands hold it onto the point the crosshair is on. */
  private aimGunAtPoint(gun: THREE.Group, input: PlayerRigInput) {
    const { player: p } = input;
    const bodyYaw = p.yaw + Math.PI;
    // where the gun will be once the body is placed (see place): the body stands untransformed while it is posed
    const gunWorld = gun.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), bodyYaw);
    gunWorld.x += p.pos.x + this.bodyPush.x;
    gunWorld.y += p.pos.y - this.model.getAnchors().feetY + this.groundOffset;
    gunWorld.z += p.pos.z + this.bodyPush.y;
    pointGunAt(gun, gunWorld, input.aimPoint!, bodyYaw, input.aimBlend * AIM_POINT_WEIGHT);
  }

  private swingKnife(gun: THREE.Group, input: PlayerRigInput, w: WeaponState | null) {
    const knifeProgress = (input.now - input.swingAt) / KNIFE_SWING_S;
    if (w?.id !== 'knife' || knifeProgress < 0 || knifeProgress >= 1) return;
    const knifeSwing = Math.sin(Math.PI * knifeProgress);
    if (input.swingHeavy) {
      gun.position.z -= knifeSwing * 0.3;
      gun.rotation.x -= knifeSwing * 0.22;
      return;
    }
    const slash = knifeSlashPose(knifeProgress);
    gun.position.x += slash.x;
    gun.position.y += slash.y;
    gun.position.z += slash.z;
    gun.rotation.x += slash.rx;
    gun.rotation.y += slash.ry;
    gun.rotation.z += slash.rz;
  }

  /** Evaluate the gun in its final third-person world transform and pull it back from any wall its barrel would go into. */
  private clearGunOfWalls(gun: THREE.Group, input: PlayerRigInput) {
    const { dt, player: p } = input;
    const model = this.model;
    model.group.position.set(p.pos.x + this.bodyPush.x, p.pos.y - model.getAnchors().feetY + this.groundOffset, p.pos.z + this.bodyPush.y);
    model.group.rotation.set(0, p.yaw + Math.PI, 0);
    model.group.updateMatrixWorld(true);
    const muzzle = gun.userData.muzzle as THREE.Object3D | undefined;
    const start = gun.getWorldPosition(new THREE.Vector3());
    const end = muzzle?.getWorldPosition(new THREE.Vector3());
    let needed = 0;
    let embedded = false;
    if (end) {
      const delta = end.clone().sub(start);
      const length = delta.length();
      delta.normalize();
      // the barrel has width and height: test a few parallel rays, not only the centre line, so a wall beside or above it is felt too
      const side = new THREE.Vector3().crossVectors(delta, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.07);
      const lift = new THREE.Vector3(0, 0.07, 0);
      for (const off of [new THREE.Vector3(), side, side.clone().negate(), lift]) {
        const o = start.clone().add(off);
        for (const solid of input.solids) {
          const hit = rayBox(o.x, o.y, o.z, delta.x, delta.y, delta.z, solid, length);
          if (!hit) continue;
          if (hit[0] <= 0.02) {
            if (off.lengthSq() === 0) embedded = true;
            else needed = Math.max(needed, length + 0.12);
          } else needed = Math.max(needed, length - hit[0] + 0.12);
        }
      }
    }
    // pulled back at once when a wall comes closer (no frame of clipping), eased out when it goes away
    const want = Math.min(1.2, needed);
    this.gunObstruction = want > this.gunObstruction ? want : THREE.MathUtils.damp(this.gunObstruction, want, 14, dt);
    gun.position.z -= this.gunObstruction;
    if (embedded) gun.visible = false;
  }

  /**
   * Put the body where the player is. A clip that lays the body down (prone, dying) keeps its lowest point on the ground; without
   * a death clip the body topples backwards about the feet.
   */
  private place(input: PlayerRigInput, animated: boolean) {
    const { dt, now, player: p } = input;
    const model = this.model;
    const fall = p.alive || (animated && this.animator.drivesDeath) ? 0 : Math.min(1, (now - p.diedAt) / 0.6);
    // the clips lean the upper body themselves; the built-in motion leans the whole body about the feet
    const lean = p.alive && !animated ? p.lean * this.leanAngle : 0;
    model.group.rotation.set((-Math.PI / 2) * (1 - (1 - fall) * (1 - fall)), p.yaw + Math.PI, lean, 'YXZ');
    // the model turns about its origin (above the feet): as it falls over its origin comes down, so the body lies on the ground instead of at hip height
    const feetY = model.getAnchors().feetY;
    model.group.position.set(p.pos.x + this.bodyPush.x, p.pos.y + THREE.MathUtils.lerp(-feetY, 0.2, easeFall(fall)), p.pos.z + this.bodyPush.y);
    if (!animated || !(p.onGround || !p.alive) || !model.group.visible) {
      this.groundOffset *= Math.max(0, 1 - dt * 8);
      return;
    }
    model.group.position.y = p.pos.y - feetY + this.groundOffset;
    // the avatar measures from its own group down: this group's world matrix must already hold the placement above
    model.group.updateMatrixWorld(true);
    const low = model.lowestWorldY();
    if (low !== null) this.groundOffset += (p.pos.y - low) * Math.min(1, dt * 30);
    model.group.position.y = p.pos.y - feetY + this.groundOffset;
  }
}
