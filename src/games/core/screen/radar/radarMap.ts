/** A game's map as the radar draws it (world metres, x right, z down the radar): floor, cover, labels and place names. */

/** An axis-aligned box seen from above. */
export interface RadarRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Something standing on the floor: a wall or tall stack blocks the view, low cover can be shot over. */
export interface RadarBlock extends RadarRect {
  isLow: boolean;
}

export interface RadarLabel {
  x: number;
  z: number;
  text: string;
  tone: 'ct' | 't' | 'neutral';
}

/** A named part of the map; the radar shows the name of the one the viewer stands in (the first match wins). */
export interface RadarCallout extends RadarRect {
  name: string;
}

export interface RadarMap {
  /** The playable floor as one outline. */
  floor: readonly { x: number; z: number }[];
  blocks: readonly RadarBlock[];
  labels: readonly RadarLabel[];
  callouts: readonly RadarCallout[];
  /** Zoom: metres per radar unit (the radar is 100 units across). */
  metresPerUnit: number;
}

const contains = (r: RadarRect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** The name of the place at (x, z), or '' outside every named part. */
export function calloutAt(map: RadarMap, x: number, z: number): string {
  return map.callouts.find((c) => contains(c, x, z))?.name ?? '';
}
