import type { Agent } from '../../core/agents/agent';
import type { P2 } from '../../core/agents/nav';
import { equip, newInventory, newWeapon, selectSlot, WEAPONS, type Inventory, type WeaponId } from '../../core/rules';
import type { PlaceId } from '../map/cityPlaces';
import type { CitySave, HeroSave, SavedWeapon } from './citySave';
import { PROTAGONIST_ORDER, PROTAGONISTS, type ProtagonistId } from './protagonists';

/** A protagonist while not being played: where they wait, their money, their guns and health. */
export interface HeroState {
  money: number;
  pos: P2;
  inv: Inventory;
  health: number;
}

const freshWeapon = (id: WeaponId): SavedWeapon => ({ id, ammo: WEAPONS[id].magazine, reserve: WEAPONS[id].reserve });

function inventoryOf(weapons: readonly SavedWeapon[], grenades: readonly WeaponId[], armor: number): Inventory {
  const inv = newInventory('CT');
  inv.secondary = null;
  inv.active = 3;
  for (const saved of weapons) {
    const w = newWeapon(saved.id);
    w.ammo = saved.ammo;
    w.reserve = saved.reserve;
    equip(inv, w);
  }
  inv.grenades = [...grenades];
  inv.armor = armor;
  selectSlot(inv, inv.primary ? 1 : inv.secondary ? 2 : 3);
  return inv;
}

const savedWeapons = (inv: Inventory): SavedWeapon[] =>
  [inv.primary, inv.secondary].filter((w) => w !== null).map((w) => ({ id: w.id, ammo: w.ammo, reserve: w.reserve }));

/** The three protagonists, the one being played, and the missions passed. */
export class HeroRoster {
  active: ProtagonistId;
  readonly completed: Set<string>;
  private readonly heroes: Record<ProtagonistId, HeroState>;

  constructor(save: CitySave | null, place: (id: PlaceId) => P2) {
    this.active = save?.active ?? 'kha';
    this.completed = new Set(save?.completed ?? []);
    const heroes = {} as Record<ProtagonistId, HeroState>;
    for (const id of PROTAGONIST_ORDER) {
      const saved = save?.heroes[id];
      const hero = PROTAGONISTS[id];
      heroes[id] = saved
        ? { money: saved.money, pos: { x: saved.x, z: saved.z }, inv: inventoryOf(saved.weapons, saved.grenades, saved.armor), health: saved.health }
        : { money: hero.startMoney, pos: place(hero.home), inv: inventoryOf(hero.startWeapons.map(freshWeapon), [], 0), health: 100 };
    }
    this.heroes = heroes;
  }

  hero(id: ProtagonistId): HeroState {
    return this.heroes[id];
  }

  get current(): HeroState {
    return this.heroes[this.active];
  }

  /** Copies the player's body into the active protagonist (before a switch or a save). */
  store(player: Agent) {
    const hero = this.current;
    hero.pos = { x: player.pos.x, z: player.pos.z };
    hero.inv = player.inv;
    hero.health = player.alive ? player.health : 100;
  }

  /** Puts a protagonist into the player's body. */
  apply(player: Agent, id: ProtagonistId, groundAt: (x: number, z: number) => number) {
    this.active = id;
    const hero = this.heroes[id];
    player.inv = hero.inv;
    player.health = hero.health;
    player.pos.set(hero.pos.x, groundAt(hero.pos.x, hero.pos.z), hero.pos.z);
    player.vel.set(0, 0, 0);
  }

  toSave(): CitySave {
    const heroes = {} as Record<ProtagonistId, HeroSave>;
    for (const id of PROTAGONIST_ORDER) {
      const h = this.heroes[id];
      heroes[id] = { money: h.money, x: h.pos.x, z: h.pos.z, health: h.health, armor: h.inv.armor, weapons: savedWeapons(h.inv), grenades: [...h.inv.grenades] };
    }
    return { version: 1, active: this.active, completed: [...this.completed], heroes };
  }
}
