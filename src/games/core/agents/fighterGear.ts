import type { HitGroup } from '../rules';

/**
 * What a game adds to a fighter on top of the shared rules: armour that soaks hits and effects on speed (the battle royale
 * vest, helmet, boost and meds). A fighter without gear plays by the base rules (5 vs 5 kevlar and helmet in the inventory).
 */
export interface FighterGear {
  /** Health a hit takes once the gear has soaked it (the gear may wear down); `helmet` when a helmet took the hit. */
  absorbHit(damage: number, group: HitGroup): { health: number; helmet: boolean };
  /** Multiplies the fighter's top speed. */
  speedFactor(): number;
  /** Busy with something that keeps the fighter at walking pace (using a med). */
  readonly isBusy: boolean;
  /** The fighter has died: whatever was under way stops. */
  onDeath(): void;
  /** The game moves this fighter itself (riding a plane, falling, under a parachute): no AI and no walking. */
  readonly isCarried: boolean;
  /** Inside a vehicle: the body is hidden. */
  readonly isAboard: boolean;
}
