import type { CombatStance } from '../combat/combatStateMachine';

/**
 * Scope sway and holding the breath (PUBG: Shift while scoped). Looking through a magnifying scope the aim drifts on a slow figure
 * eight, less when crouched and least lying down; holding the breath steadies it for a few seconds, then the breath runs out and
 * has to come back before it can be held again.
 */

/** Drift (rad) standing, scoped, breathing normally. */
const SWAY = 0.0042;
const STANCE_FACTOR: Record<CombatStance, number> = { stand: 1, crouch: 0.6, prone: 0.28 };
const HELD_FACTOR = 0.12;
const BREATH_HOLD_S = 4;
const BREATH_RECOVER_S = 3;
/** Breath needed before it can be held again after running out. */
const BREATH_TO_HOLD = 0.25;
/** 1/s: how fast the sway settles in or out (raising the scope, starting or stopping to hold the breath). */
const SETTLE_RATE = 6;

export class ScopeSway {
  /** Aim drift this frame (rad). */
  yaw = 0;
  pitch = 0;
  /** 0..1 breath left to hold. */
  breath = 1;
  private holding = false;
  /** The breath ran out while the key was held: it has to be let go before the breath can be held again. */
  private spent = false;
  private amount = 0;
  private time = 0;

  /**
   * `scoped`: aiming through a magnifying scope. `holdBreath`: the hold-breath key is down. Returns whether the breath is held this
   * frame.
   */
  update(dt: number, scoped: boolean, holdBreath: boolean, stance: CombatStance) {
    this.time += dt;
    if (!scoped || !holdBreath) {
      this.holding = false;
      this.spent = false;
    } else if (!this.holding && !this.spent && this.breath >= BREATH_TO_HOLD) this.holding = true;
    if (this.holding) {
      this.breath = Math.max(0, this.breath - dt / BREATH_HOLD_S);
      if (this.breath === 0) {
        this.holding = false;
        this.spent = true;
      }
    } else this.breath = Math.min(1, this.breath + dt / BREATH_RECOVER_S);
    const want = scoped ? SWAY * STANCE_FACTOR[stance] * (this.holding ? HELD_FACTOR : 1) : 0;
    this.amount += (want - this.amount) * (1 - Math.exp(-SETTLE_RATE * dt));
    this.yaw = this.amount * Math.sin(this.time * 0.9);
    this.pitch = this.amount * 0.6 * Math.sin(this.time * 1.8 + 0.7);
    return this.holding;
  }
}
