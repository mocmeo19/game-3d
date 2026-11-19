import type { SlotNo, Team, WeaponId } from '../rules';

/** The state the engine hands to the React HUD, refreshed ten times a second and on events. */

export type Phase = 'menu' | 'freeze' | 'live' | 'roundEnd' | 'matchEnd';

/** What the player's bullet did: hit the body, hit the head, or finished the target off. */
export type HitMarkerKind = 'body' | 'head' | 'kill';

export interface KillEvent {
  id: number;
  killer: string;
  killerTeam: Team;
  victim: string;
  victimTeam: Team;
  weapon: WeaponId | 'zone';
  headshot: boolean;
  wallbang: boolean;
  mine: boolean;
}
export interface ScoreRow {
  id: number;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  hs: number;
  mvps: number;
  money: number;
  alive: boolean;
  me: boolean;
}

/** A fighter on the radar: feet position (m) and facing (rad, 0 looks toward -z). */
export interface RadarFighter {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** A teammate on the radar; `colorSlot` picks the same colour for them every round (CS:GO style). */
export interface RadarAlly extends RadarFighter {
  id: number;
  colorSlot: number;
  alive: boolean;
  /** Fired in the last moment: the blip flashes. */
  isFiring: boolean;
}

/** An enemy the team lost sight of: a "?" stays where they were last seen, fading over `ageS`. */
export interface RadarLastSeen {
  id: number;
  x: number;
  z: number;
  ageS: number;
}

/** What the radar shows, centred on the fighter being watched (`me`). */
export interface RadarView {
  me: RadarFighter & { colorSlot: number };
  allies: RadarAlly[];
  enemies: (Omit<RadarFighter, 'yaw'> & { id: number })[];
  lastSeen: RadarLastSeen[];
}

/** What every shooter game shows; `view` is the part only the game being played fills (rounds and shop, or the zone and bag). */
export interface GameSnapshot<TView = unknown> {
  phase: Phase;
  paused: boolean;
  loaded: boolean;
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  alive: boolean;
  team: Team;
  weapon: { id: WeaponId; name: string; ammo: number; reserve: number; reloading: boolean; mag: number } | null;
  slots: { slot: SlotNo; id: WeaponId; name: string; active: boolean }[];
  killfeed: KillEvent[];
  killConfirm: { id: number; headshot: boolean } | null;
  /** The player's last hit, while its marker shows on the crosshair; `id` changes with every hit. */
  hitMarker: { id: number; kind: HitMarkerKind } | null;
  rows: ScoreRow[];
  message: string;
  radar: RadarView;
  /** Directions (deg, 0 = ahead, positive = right) damage came from recently. */
  hurt: number[];
  spectating: string;
  killedBy: string;
  scope: number;
  thirdPerson: boolean;
  aiming: boolean;
  /** Looking down the sights (no crosshair). */
  ads: boolean;
  alive5: Record<Team, boolean[]>;
  view: TView;
}
