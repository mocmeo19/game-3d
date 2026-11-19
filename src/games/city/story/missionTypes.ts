import type { WeaponId } from '../../core/rules';
import type { PlaceId } from '../map/cityPlaces';
import type { VehicleKind } from '../vehicles/vehicleSpecs';
import type { ProtagonistId } from './protagonists';

/** A line of a mission's conversation, shown as a subtitle. */
export interface DialogueLine {
  speaker: string;
  text: string;
}

/** One thing a mission asks; a mission is a list of these done in order. */
export type MissionStep =
  /** Reach a place (on foot or in any car, or only in a car). */
  | { kind: 'goto'; place: PlaceId; text: string; inVehicle?: boolean }
  /** A conversation; the game goes on while it plays. */
  | { kind: 'talk'; lines: readonly DialogueLine[] }
  /** A car of this kind waits at a place: get in. */
  | { kind: 'takeVehicle'; place: PlaceId; vehicle: VehicleKind; text: string }
  /** Bring the car taken in the last `takeVehicle` step to a place in one piece. */
  | { kind: 'deliver'; place: PlaceId; text: string }
  /** Gang members hold a place: take them all down. */
  | { kind: 'eliminate'; place: PlaceId; count: number; weapon: WeaponId; text: string; boss?: string }
  /** The police come with this many stars: lose them. */
  | { kind: 'evade'; stars: number; text: string }
  /** Pick something up at a place. */
  | { kind: 'collect'; place: PlaceId; item: string; text: string }
  /** A car runs from a place: catch up and stay close to it until it gives up. */
  | { kind: 'chase'; place: PlaceId; vehicle: VehicleKind; text: string; driver: string };

export interface Mission {
  id: string;
  title: string;
  /** Who plays it (the mission marker shows their initial). */
  protagonist: ProtagonistId;
  /** Where its marker stands. */
  start: PlaceId;
  /** Money for passing it. */
  reward: number;
  /** Missions that must be passed first. */
  requires: readonly string[];
  steps: readonly MissionStep[];
}
