import type { FighterGear } from '../../core/agents/fighterGear';
import type { HitGroup, Inventory } from '../../core/rules';

/** Hit multipliers in the city: a headshot is deadly but not CS-deadly, so a firefight lasts a little. */
const CITY_HIT_MULT: Record<HitGroup, number> = { head: 2.5, chest: 1, stomach: 1, legs: 0.8 };
/** Share of a hit body armour takes on itself (and loses as armour points). */
const ARMOUR_SHARE = 0.55;

/** The player's gear in the open world: body armour bought at the gun shop, and the car they may sit in. */
export class CityGear implements FighterGear {
  isDriving = false;

  constructor(private readonly inv: () => Inventory) {}

  absorbHit(damage: number, group: HitGroup) {
    const raw = damage * CITY_HIT_MULT[group];
    const inv = this.inv();
    if (inv.armor <= 0 || group === 'head' || group === 'legs') return { health: raw, helmet: false };
    const soaked = Math.min(inv.armor, raw * ARMOUR_SHARE);
    inv.armor = Math.max(0, inv.armor - soaked);
    return { health: raw - soaked, helmet: false };
  }

  speedFactor() {
    return 1;
  }

  get isBusy() {
    return false;
  }

  onDeath() {
    this.isDriving = false;
  }

  /** At the wheel the car moves the player, not the legs. */
  get isCarried() {
    return this.isDriving;
  }

  get isAboard() {
    return this.isDriving;
  }
}
