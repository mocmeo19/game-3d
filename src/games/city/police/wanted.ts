import type { P2 } from '../../core/agents/nav';

/** The wanted level: stars, where the police last saw the player, and how long they have been out of sight. Pure logic. */

export const MAX_STARS = 5;

export type Crime = 'gunfire' | 'assault' | 'carjack' | 'murder' | 'copAssault' | 'copKill' | 'robbery' | 'carCrash';

/** Least stars a crime brings. */
const CRIME_STARS: Record<Crime, number> = { gunfire: 1, assault: 1, carjack: 1, carCrash: 1, murder: 2, robbery: 2, copAssault: 2, copKill: 3 };
/** Crimes that add a star on top of the current level each time (the chase heats up). */
const ESCALATES: ReadonlySet<Crime> = new Set(['copKill', 'murder']);

/** Seconds out of police sight needed to lose them, by stars. */
export const ESCAPE_S = [0, 9, 14, 20, 27, 35] as const;
/** The player must also be this far (m) from where they were last seen, by stars. */
export const SEARCH_RADIUS_M = [0, 70, 110, 160, 220, 290] as const;

export interface WantedState {
  stars: number;
  lastSeen: P2 | null;
  /** Seconds since any officer saw the player. */
  unseenFor: number;
  /** Murders since the stars last went up (every second one adds a star). */
  murders: number;
}

export const newWanted = (): WantedState => ({ stars: 0, lastSeen: null, unseenFor: 0, murders: 0 });

/** Stars after a crime seen (or reported) at `where`. */
export function reportCrime(state: WantedState, crime: Crime, where: P2): number {
  let stars = Math.max(state.stars, CRIME_STARS[crime]);
  if (crime === 'murder') {
    state.murders++;
    if (state.stars >= CRIME_STARS.murder && state.murders % 2 === 0) stars = state.stars + 1;
  } else if (ESCALATES.has(crime) && state.stars >= CRIME_STARS[crime]) stars = state.stars + 1;
  state.stars = Math.min(MAX_STARS, stars);
  state.lastSeen = { x: where.x, z: where.z };
  state.unseenFor = 0;
  return state.stars;
}

/** Sets the stars directly (a mission's chase, a paint job that loses them). */
export function setStars(state: WantedState, stars: number, where: P2 | null) {
  state.stars = Math.max(0, Math.min(MAX_STARS, Math.round(stars)));
  state.lastSeen = where && state.stars ? { x: where.x, z: where.z } : null;
  state.unseenFor = 0;
  if (!state.stars) state.murders = 0;
}

/**
 * One step of the search: seen by the police, the last-seen spot follows the player; out of sight long enough and far enough
 * from it, the stars are lost. Returns true on the step the player gets away.
 */
export function tickWanted(state: WantedState, dt: number, seen: boolean, player: P2): boolean {
  if (!state.stars) return false;
  if (seen) {
    state.lastSeen = { x: player.x, z: player.z };
    state.unseenFor = 0;
    return false;
  }
  state.unseenFor += dt;
  const from = state.lastSeen ?? player;
  const far = Math.hypot(player.x - from.x, player.z - from.z) > SEARCH_RADIUS_M[state.stars];
  if (state.unseenFor < ESCAPE_S[state.stars] || !far) return false;
  setStars(state, 0, null);
  return true;
}

/** The police are searching, not watching: the HUD stars blink. */
export const isSearching = (state: WantedState) => state.stars > 0 && state.unseenFor > 1.5;
