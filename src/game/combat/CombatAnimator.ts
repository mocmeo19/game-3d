import * as THREE from 'three';
import type { RetargetPose } from '../../renderer/character/mixamo';
import { combatSlot, PISTOL_VARIANT } from './combatCatalog';
import { CombatClipLibrary } from './CombatClipLibrary';
import { PoseFrame, type PoseMask } from './combatPose';
import { loadCombatSettings, type CombatAnimationSettings } from './combatSettings';
import { selectCombatTracks, type CombatFrame, type CombatSelection, type CombatTrack, type GunClass } from './combatStateMachine';

/** Additive inputs of one frame (game.md 3.1): the view pitch, the aim's turn, the lean, a shot fired, a hit taken. */
export interface CombatAdditives {
  pitch: number;
  /** Sideways aim offset (rad, + towards the body's right): turns the chest and arms so the held gun lines up with the aim point. */
  yaw: number;
  /** -1 = fully left … 1 = fully right. */
  lean: number;
  shot: boolean;
  /** Direction towards the attacker in body space (x right, z forward) when a hit was taken this frame. */
  hitFrom: THREE.Vector3 | null;
}

/** Clips the first seconds of play need; the rest load in the background after them. */
const FIRST_SLOTS = [
  'Rifle_Idle', 'Rifle_Walk_Fwd', 'Rifle_Walk_Bwd', 'Rifle_Walk_Left', 'Rifle_Walk_Right', 'Rifle_Run', 'Rifle_Sprint',
  'Rifle_Aim_Idle', 'Rifle_Fire_Hip', 'Rifle_Reload_Tactical', 'Rifle_Equip', 'Crouch_Idle', 'Crouch_Walk', 'Prone_Idle',
  'Unarmed_Idle', 'Unarmed_Walk', 'Unarmed_Run',
];
const LAYER_MASK: Record<string, PoseMask> = { full: 'all', upper: 'all', lower: 'lower' };
const MIN_MOVE_RATE = 0.5;
const MAX_MOVE_RATE = 2.2;
const LAST_FRAME = 0.999;
const AIM_PITCH_LIMIT = 1.3;
const RIGHT_AXIS = new THREE.Vector3(1, 0, 0);
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const trackKey = (track: CombatTrack | null) => {
  if (!track) return '-';
  if (track.mode === 'loop') return track.family ?? track.slot;
  return track.mode === 'once' ? `${track.slot}@${track.startedAt}` : track.slot;
};

/**
 * Plays the combat animation slots on the player's avatar: picks the tracks for the frame (combatStateMachine), samples their clips,
 * layers the upper body over the legs, cross-fades between states and adds aim offset, recoil, lean and hit flinch on top. Returns
 * null while the clips it needs are still loading (or when the system is switched off): the caller then keeps the built-in motion.
 */
export class CombatAnimator {
  readonly settings: CombatAnimationSettings;
  /** True when the last pose came from a death clip, so the caller does not topple the body a second time. */
  drivesDeath = false;
  private readonly library = new CombatClipLibrary();
  private readonly target = new PoseFrame();
  private readonly layer = new PoseFrame();
  private readonly extra = new PoseFrame();
  private readonly fadeFrom = new PoseFrame();
  private readonly mixed = new PoseFrame();
  private readonly output = new PoseFrame();
  private readonly sampled = new Map<string, RetargetPose>();
  private readonly loopFiles = new Set<string>();
  /** Loops played last frame and this frame: a loop that was not playing starts from its first frame (a burst from its first shot). */
  private loopsBefore = new Set<string>();
  private loopsNow = new Set<string>();
  private readonly q = new THREE.Quaternion();
  private stateKey = '';
  private gunClass: GunClass = 'rifle';
  private fadeElapsed = 0;
  private fadeSeconds = 0;
  private recoil = 0;
  private flinch = 0;
  private readonly flinchAxis = new THREE.Vector3(1, 0, 0);

  constructor(settings: CombatAnimationSettings = loadCombatSettings()) {
    this.settings = settings;
    if (!settings.enabled) return;
    const fileOf = (slot: string) => settings.slots[slot]?.file ?? null;
    const first = FIRST_SLOTS.map(fileOf).filter((file): file is string => !!file);
    const rest = Object.keys(settings.slots).map(fileOf).filter((file): file is string => !!file);
    void this.library.preload([...first, ...rest]);
  }

  /** Aim pitch (rad) the last pose bent the upper body by, without the recoil (0 while sprinting or unarmed). */
  appliedPitch = 0;

  /** Current recoil kick of the upper body (rad), for the gun held in the hands. */
  get recoilAngle() {
    return this.recoil;
  }

  update(dt: number, frame: CombatFrame, additives: CombatAdditives): RetargetPose | null {
    this.drivesDeath = false;
    if (!this.settings.enabled) return null;
    const tuning = this.settings.tuning;
    this.updateAdditiveState(dt, additives);
    this.gunClass = frame.gunClass;
    const selection = selectCombatTracks(frame, this.clipLength, tuning.hitMs / 1000);
    this.sampled.clear();
    [this.loopsBefore, this.loopsNow] = [this.loopsNow, this.loopsBefore];
    this.loopsNow.clear();
    if (!this.sampleLayer(selection.base, dt, frame.now, this.target)) return null;
    if (selection.upper && this.sampleLayer([selection.upper], dt, frame.now, this.extra)) this.target.blend(this.extra, 1, 'upper');
    if (selection.overlay && this.sampleLayer([selection.overlay], dt, frame.now, this.extra)) {
      const progress = (frame.now - frame.hitAt) / (tuning.hitMs / 1000);
      this.target.blend(this.extra, tuning.hitWeight * Math.sin(Math.PI * THREE.MathUtils.clamp(progress, 0, 1)), 'upper');
    }
    this.crossfade(dt, selection);
    this.output.copy(this.mixed);
    if (!selection.dead) this.applyAdditives(frame, additives);
    this.drivesDeath = selection.dead;
    return this.output.toRetarget();
  }

  dispose() {
    this.library.dispose();
  }

  /** The slot that actually plays: a pistol uses its own clip for a state when one is set, the rifle clip otherwise. */
  private resolve(slot: string): string {
    if (this.gunClass !== 'pistol') return slot;
    const variant = PISTOL_VARIANT[slot];
    return variant && this.settings.slots[variant]?.file ? variant : slot;
  }

  /** Seconds a slot's clip lasts at its configured speed; null while it is not loaded or has no clip. */
  private readonly clipLength = (slot: string): number | null => {
    const config = this.settings.slots[this.resolve(slot)];
    if (!config?.file) return null;
    const source = this.library.get(config.file);
    return source ? source.duration(source.clipNames[0]) / config.speed : null;
  };

  /** Weighted mix of the tracks into `into`; false when the main track's clip is not available yet. */
  private sampleLayer(tracks: CombatTrack[], dt: number, now: number, into: PoseFrame): boolean {
    let total = 0;
    let leaderPhase: number | null = null;
    for (const track of tracks) {
      const sample = this.sampleTrack(track, dt, now, leaderPhase);
      if (!sample) {
        if (total === 0) return false;
        continue;
      }
      if (leaderPhase === null && track.mode === 'loop') leaderPhase = sample.phase;
      if (total === 0) into.copy(this.layer);
      else into.blend(this.layer, track.weight / (total + track.weight));
      total += track.weight;
    }
    return total > 0;
  }

  /** Pose one track's clip into `this.layer`. Loops after the first follow its phase, so blended walk cycles stay in step. */
  private sampleTrack(track: CombatTrack, dt: number, now: number, leaderPhase: number | null): { phase: number } | null {
    const slot = this.resolve(track.slot);
    const def = combatSlot(slot);
    const config = this.settings.slots[slot];
    if (!def || !config?.file) return null;
    const source = this.library.get(config.file);
    if (!source) return null;
    const clip = source.clipNames[0];
    const loopKey = track.mode === 'loop' ? track.family ?? track.slot : null;
    const entering = loopKey !== null && !this.loopsBefore.has(loopKey);
    if (loopKey !== null) this.loopsNow.add(loopKey);
    let pose = this.sampled.get(config.file);
    if (!pose) {
      let step = 0;
      if (track.mode === 'loop') {
        const moveRate = config.refSpeed > 0 && track.moveSpeed > 0
          ? THREE.MathUtils.clamp(track.moveSpeed / config.refSpeed, MIN_MOVE_RATE, MAX_MOVE_RATE) : 1;
        // a file last played once must be restarted as a loop (and the other way round)
        source.play(clip, config.speed * moveRate, { restart: entering || !this.loopFiles.has(config.file) });
        this.loopFiles.add(config.file);
        if (leaderPhase === null) step = dt;
        else source.seek(leaderPhase);
      } else {
        source.play(clip, 0, { once: true, restart: this.loopFiles.delete(config.file) });
        const progress = track.mode === 'fit' ? track.progress : ((now - track.startedAt) * config.speed) / source.duration(clip);
        source.seek(THREE.MathUtils.clamp(progress, 0, LAST_FRAME));
      }
      const sampled = source.sample(step, 'all', config.mirror, false);
      if (!sampled) return null;
      pose = sampled;
      this.sampled.set(config.file, pose);
    }
    this.layer.clear().read(pose, LAYER_MASK[def.layer]);
    if (config.lockFacing) this.layer.cancelFacing();
    return { phase: source.phase };
  }

  /** A change of state fades from the last pose shown to the new one over the new slot's blend time. */
  private crossfade(dt: number, selection: CombatSelection) {
    const baseKey = trackKey(selection.base[0] ?? null);
    const upperKey = trackKey(selection.upper);
    const key = `${baseKey}|${upperKey}`;
    if (key !== this.stateKey) {
      const baseChanged = !this.stateKey.startsWith(`${baseKey}|`);
      const slot = baseChanged || !selection.upper ? selection.base[0]?.slot : selection.upper.slot;
      this.fadeSeconds = this.mixed.empty ? 0 : (this.settings.slots[slot ?? '']?.blendMs ?? 0) / 1000;
      this.fadeElapsed = 0;
      this.fadeFrom.copy(this.mixed);
      this.stateKey = key;
    }
    this.fadeElapsed += dt;
    if (this.fadeElapsed >= this.fadeSeconds) {
      this.mixed.copy(this.target);
      return;
    }
    this.mixed.copy(this.fadeFrom).blend(this.target, smoothstep(this.fadeElapsed / this.fadeSeconds)).keepOnly(this.target);
  }

  private updateAdditiveState(dt: number, additives: CombatAdditives) {
    const tuning = this.settings.tuning;
    const kick = tuning.recoilKickDeg * DEG;
    if (additives.shot) this.recoil = Math.min(this.recoil + kick, kick * 3);
    this.recoil *= Math.exp(-dt / (tuning.recoilRecoverMs / 1000));
    if (additives.hitFrom && additives.hitFrom.lengthSq() > 1e-6) {
      // the chest is pushed away from the attacker: turn about the axis across the line of fire
      this.flinchAxis.crossVectors(additives.hitFrom, UP).normalize();
      this.flinch = 1;
    }
    this.flinch *= Math.exp(-dt / (tuning.hitMs / 3000));
  }

  private applyAdditives(frame: CombatFrame, additives: CombatAdditives) {
    const tuning = this.settings.tuning;
    const limit = frame.stance === 'prone' ? tuning.proneAimLimitDeg * DEG : AIM_PITCH_LIMIT;
    const share = frame.sprinting || frame.phase === 'UNARMED' ? 0 : tuning.aimPitchShare;
    const pitch = THREE.MathUtils.clamp(additives.pitch, -limit, limit) * share;
    this.appliedPitch = pitch;
    // aim offset and recoil: tip the chest and arms up about the body's right axis (the body faces +z)
    this.output.rotateUpper(this.q.setFromAxisAngle(RIGHT_AXIS, -(pitch + this.recoil)));
    if (additives.yaw !== 0) this.output.rotateUpper(this.q.setFromAxisAngle(UP, additives.yaw));
    if (additives.lean !== 0) this.output.rotateUpper(this.q.setFromAxisAngle(FORWARD_AXIS, additives.lean * tuning.leanAngleDeg * DEG));
    if (this.flinch > 1e-3) this.output.rotateUpper(this.q.setFromAxisAngle(this.flinchAxis, this.flinch * tuning.hitFlinchDeg * DEG));
  }
}
