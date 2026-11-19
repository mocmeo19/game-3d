import type { P2 } from '../../core/agents/nav';
import type { CityMap } from './cityWorld';

/**
 * A random open spot between `minR` and `maxR` metres from a centre: on the walkable street, or where a car fits.
 * Null when a few tries find nothing (deep inside a block of towers); the caller simply tries again on a later frame.
 */
export function randomStreetPoint(map: CityMap, centre: P2, minR: number, maxR: number, random: () => number, needDrive = false, tries = 20): P2 | null {
  for (let i = 0; i < tries; i++) {
    const angle = random() * Math.PI * 2;
    const r = minR + random() * (maxR - minR);
    const x = centre.x + Math.cos(angle) * r;
    const z = centre.z + Math.sin(angle) * r;
    if (needDrive ? map.isDrivable(x, z) : map.isStreet(x, z)) return { x, z };
  }
  return null;
}

/** Yaw that looks from `from` toward `to` (0 faces -z, like agents and cars). */
export const yawToward = (from: P2, to: P2) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

export const distance2d = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.z - b.z);
