import type { Solid, Team } from '../rules';
import type { P2 } from '../nav';

/**
 * "Cargo ship" 5 vs 5 map, after CrossFire's container-ship maps: a long deck at sea, CT at the stern under the bridge tower, T at
 * the bow, and stacks of shipping containers in between forming two side walkways, a wide middle lane and cross alleys.
 * Pure layout data (metres, deck at y = 0, bow towards -z): the scene builder draws it, the game collides with its solids.
 */

export type ContainerColor = 'red' | 'blue' | 'green' | 'orange' | 'grey' | 'yellow' | 'white';

export interface ContainerSpot {
  /** Centre on the deck; containers lie along the ship (length along z). */
  x: number;
  z: number;
  length: number;
  tiers: number;
  color: ContainerColor;
}

export type PropKind = 'hatch' | 'crate' | 'winch' | 'bollard' | 'deckhouse' | 'superstructure' | 'crane' | 'mast';

export interface PropBox {
  kind: PropKind;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/** A piece of hull between two cross sections: the deck spans |x| < halfWidth for z in [z0, z1]. */
export interface HullSection {
  z0: number;
  z1: number;
  halfWidth: number;
}

export const CONTAINER_WIDTH = 2.44;
export const CONTAINER_HEIGHT = 2.59;
const FORTY_FOOT = 12.19;
const TWENTY_FOOT = 6.06;
/** Bulwark (the steel wall along the deck edge) thickness: its inner face is where the deck ends. */
export const BULWARK = 0.4;
export const BULWARK_HEIGHT = 1.15;
/** Invisible colliders over the bulwark reach this high, so nobody jumps or throws a grenade into the sea. */
const EDGE_COLLIDER_HEIGHT = 40;

export const SHIP_STERN_Z = 62;
export const SHIP_BOW_Z = -64;

/** Deck outline from bow to stern; the bow narrows in steps. */
export const HULL: HullSection[] = [
  { z0: -64, z1: -61, halfWidth: 4 },
  { z0: -61, z1: -58, halfWidth: 7 },
  { z0: -58, z1: -54, halfWidth: 10 },
  { z0: -54, z1: -50, halfWidth: 12.5 },
  { z0: -50, z1: -46, halfWidth: 14.5 },
  { z0: -46, z1: SHIP_STERN_Z, halfWidth: 15.8 },
];
const MAX_HALF_WIDTH = 15.8;

/** Two containers side by side fill a stack column; the columns leave 4 m walkways along the sides and a 12 m middle lane. */
const COLUMN_X = { left: [-9.98, -7.52], right: [7.52, 9.98] } as const;
/** Bays along the ship, separated by 3.2 m cross alleys. */
const BAY = { A: -26.9, B: -11.5, C: 3.9, D: 19.3 } as const;
const BAY_E = 31.6;

const stack = (side: keyof typeof COLUMN_X, z: number, tiers: [number, number], colors: [ContainerColor, ContainerColor], length = FORTY_FOOT): ContainerSpot[] =>
  COLUMN_X[side].map((x, i) => ({ x, z, length, tiers: tiers[i], color: colors[i] }));

export const CONTAINERS: ContainerSpot[] = [
  ...stack('left', BAY.A, [2, 2], ['blue', 'red']),
  ...stack('left', BAY.B, [3, 2], ['orange', 'grey']),
  ...stack('left', BAY.C, [1, 2], ['green', 'blue']),
  ...stack('left', BAY.D, [2, 3], ['red', 'white']),
  ...stack('left', BAY_E, [1, 1], ['yellow', 'green'], TWENTY_FOOT),
  ...stack('right', BAY.A, [1, 2], ['grey', 'green']),
  ...stack('right', BAY.B, [2, 2], ['red', 'blue']),
  ...stack('right', BAY.C, [2, 3], ['white', 'orange']),
  ...stack('right', BAY.D, [1, 2], ['blue', 'yellow']),
  ...stack('right', BAY_E, [2, 1], ['orange', 'red'], TWENTY_FOOT),
  // the middle lane: single containers set off-centre so the lane zig-zags instead of giving one long sightline
  { x: -3.2, z: -29.5, length: TWENTY_FOOT, tiers: 1, color: 'green' },
  { x: 3.2, z: -23.6, length: TWENTY_FOOT, tiers: 2, color: 'yellow' },
  { x: 3.6, z: 7.6, length: TWENTY_FOOT, tiers: 1, color: 'red' },
  { x: -3.4, z: 22.4, length: TWENTY_FOOT, tiers: 2, color: 'blue' },
];

export const PROPS: PropBox[] = [
  // stern: accommodation block with the bridge on top, CT spawn in front of it
  { kind: 'superstructure', x: 0, z: 56, w: 24, d: 10, h: 11 },
  // hatch covers over the holds in the middle lane: waist-high cover
  { kind: 'hatch', x: 0, z: BAY.B, w: 7.6, d: 9, h: 1.05 },
  { kind: 'hatch', x: 0, z: 15.6, w: 7.6, d: 6, h: 1.05 },
  // deck crane between the bays
  { kind: 'crane', x: 0, z: -3.6, w: 2.4, d: 2.4, h: 7.5 },
  // bow (T side): winches, a small deckhouse and the foremast
  { kind: 'deckhouse', x: 0, z: -55.5, w: 6, d: 4, h: 3 },
  { kind: 'winch', x: -6.5, z: -48.5, w: 1.8, d: 1.4, h: 1.3 },
  { kind: 'winch', x: 6.5, z: -48.5, w: 1.8, d: 1.4, h: 1.3 },
  { kind: 'mast', x: 0, z: -47.5, w: 0.8, d: 0.8, h: 13 },
  { kind: 'crate', x: -10.5, z: -38, w: 1.3, d: 1.3, h: 1.3 },
  { kind: 'crate', x: -9.1, z: -38.4, w: 1.3, d: 1.3, h: 1.3 },
  { kind: 'crate', x: 11.2, z: -37, w: 1.3, d: 1.3, h: 1.3 },
  { kind: 'crate', x: 2.5, z: -40.5, w: 1.3, d: 1.3, h: 1.3 },
  // stern side (CT): crates and bollards for cover on the way out of spawn
  { kind: 'crate', x: -11, z: 39, w: 1.3, d: 1.3, h: 1.3 },
  { kind: 'crate', x: -11, z: 40.4, w: 1.3, d: 1.3, h: 2.6 },
  { kind: 'crate', x: 10.6, z: 38.5, w: 1.3, d: 1.3, h: 1.3 },
  { kind: 'crate', x: -2.8, z: 37.2, w: 1.3, d: 1.3, h: 1.3 },
  { kind: 'bollard', x: -14.3, z: 46, w: 0.6, d: 0.6, h: 0.75 },
  { kind: 'bollard', x: 14.3, z: 46, w: 0.6, d: 0.6, h: 0.75 },
  { kind: 'bollard', x: -14.3, z: -42, w: 0.6, d: 0.6, h: 0.75 },
  { kind: 'bollard', x: 14.3, z: -42, w: 0.6, d: 0.6, h: 0.75 },
];

export const SPAWN_CENTER: Record<Team, P2> = { CT: { x: 0, z: 44 }, T: { x: 0, z: -43 } };

export const SPAWNS: Record<Team, { x: number; z: number; yaw: number }[]> = {
  CT: [-6, -3, 0, 3, 6].map((x, i) => ({ x, z: 44 + (i % 2) * 1.6, yaw: 0 })),
  T: [-6, -3, 0, 3, 6].map((x, i) => ({ x, z: -43 - (i % 2) * 1.6, yaw: Math.PI })),
};

/** Bot destinations: the walkways, the middle lane and the alleys between them. */
export const POINTS: { attack: P2[]; hold: Record<Team, P2[]> } = {
  attack: [
    { x: 0, z: -35 }, { x: 0, z: 37 }, { x: -13.3, z: -12 }, { x: 13.3, z: -12 }, { x: -13.3, z: 10 }, { x: 13.3, z: 10 },
    { x: 0, z: -19.2 }, { x: 0, z: 11.6 }, { x: -8.7, z: -19.2 }, { x: 8.7, z: 11.6 },
  ],
  hold: {
    CT: [{ x: -13.3, z: 30 }, { x: 13.3, z: 30 }, { x: 0, z: 38 }, { x: -5.5, z: 27 }, { x: 5.5, z: 14 }, { x: -13.3, z: 12 }],
    T: [{ x: -13.3, z: -38 }, { x: 13.3, z: -38 }, { x: 0, z: -36 }, { x: -5, z: -40 }, { x: 5, z: -31 }],
  },
};

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Solid => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });

/** Every box the players, bullets and grenades collide with on the ship. */
export function cargoShipSolids(): Solid[] {
  const solids: Solid[] = [];
  // deck edges: from the bulwark's inner face out past the widest hull, on both sides of each section, plus the stern and bow ends
  const outer = MAX_HALF_WIDTH + 2;
  for (const s of HULL) {
    const inner = s.halfWidth - BULWARK;
    solids.push(box(inner, outer, 0, EDGE_COLLIDER_HEIGHT, s.z0, s.z1), box(-outer, -inner, 0, EDGE_COLLIDER_HEIGHT, s.z0, s.z1));
  }
  solids.push(box(-outer, outer, 0, EDGE_COLLIDER_HEIGHT, SHIP_STERN_Z - BULWARK, SHIP_STERN_Z + 2));
  solids.push(box(-outer, outer, 0, EDGE_COLLIDER_HEIGHT, SHIP_BOW_Z - 2, SHIP_BOW_Z + BULWARK));
  for (const c of CONTAINERS) {
    const hw = CONTAINER_WIDTH / 2;
    solids.push(box(c.x - hw, c.x + hw, 0, c.tiers * CONTAINER_HEIGHT, c.z - c.length / 2, c.z + c.length / 2));
  }
  for (const p of PROPS) solids.push(box(p.x - p.w / 2, p.x + p.w / 2, 0, p.h, p.z - p.d / 2, p.z + p.d / 2));
  return solids;
}

/** Half the side of the square the bots' path grid covers (the ship, centred on the origin). */
export const SHIP_NAV_HALF = 66;
/** A fine grid: the walkways are only 4 m wide. */
export const SHIP_NAV_CELL = 1;
