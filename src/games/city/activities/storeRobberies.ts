import type { P2 } from '../../core/agents/nav';
import type { PlaceId } from '../map/cityPlaces';
import { distance2d } from '../map/streetSampling';

/** The corner shops that can be held up. */
export const STORES: readonly PlaceId[] = ['storeA', 'storeB', 'storeC', 'storeD', 'storeE'];

/** Stand at the counter with a gun drawn this long (s) to empty the till. */
const HOLD_UP_S = 5;
const COUNTER_REACH_M = 4;
/** A robbed shop has nothing in the till for this long (s of play). */
const RESTOCK_S = 300;
const CASH_MIN = 250;
const CASH_RANGE = 550;

export type RobberyEvent = { kind: 'progress'; store: PlaceId; share: number } | { kind: 'robbed'; store: PlaceId; cash: number };

/** Holding up corner shops: aim a gun at the counter for a few seconds, take the till, and expect the police. */
export class StoreRobberies {
  private readonly restockAt = new Map<PlaceId, number>();
  private store: PlaceId | null = null;
  private held = 0;

  isOpen(store: PlaceId, now: number) {
    return (this.restockAt.get(store) ?? 0) <= now;
  }

  update(dt: number, now: number, player: P2, armedOnFoot: boolean, place: (id: PlaceId) => P2, random: () => number): RobberyEvent | null {
    const at = armedOnFoot ? STORES.find((s) => this.isOpen(s, now) && distance2d(place(s), player) < COUNTER_REACH_M) : undefined;
    if (!at) {
      this.store = null;
      this.held = 0;
      return null;
    }
    if (at !== this.store) {
      this.store = at;
      this.held = 0;
    }
    this.held += dt;
    if (this.held < HOLD_UP_S) return { kind: 'progress', store: at, share: this.held / HOLD_UP_S };
    this.restockAt.set(at, now + RESTOCK_S);
    this.store = null;
    this.held = 0;
    return { kind: 'robbed', store: at, cash: Math.round(CASH_MIN + random() * CASH_RANGE) };
  }
}
