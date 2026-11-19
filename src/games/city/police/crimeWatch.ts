import type { Agent } from '../../core/agents/agent';
import { activeWeapon, WEAPONS, type WeaponId } from '../../core/rules';

/** Notices the player's crimes the shared combat code does not report: firing a gun, and hurting someone who lives. */
export class CrimeWatch {
  private weapon: WeaponId | null = null;
  private ammo = 0;
  private readonly hurt = new WeakSet<Agent>();

  /** The player fired a gun since the last frame (a magazine went down; works for silenced guns too). */
  playerFired(player: Agent): boolean {
    const w = activeWeapon(player.inv);
    const isGun = !!w && WEAPONS[w.id].slot <= 2;
    const fired = isGun && w.id === this.weapon && w.ammo < this.ammo;
    this.weapon = w?.id ?? null;
    this.ammo = w?.ammo ?? 0;
    return fired;
  }

  /** People the player has hurt for the first time (each counts once). */
  newVictims(people: readonly Agent[], player: Agent): Agent[] {
    const out: Agent[] = [];
    for (const a of people) {
      if (a.isPlayer || this.hurt.has(a) || !a.damageFrom.has(player)) continue;
      this.hurt.add(a);
      out.push(a);
    }
    return out;
  }
}
