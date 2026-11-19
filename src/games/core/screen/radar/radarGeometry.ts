/**
 * Radar maths, kept free of React: world metres → radar units around the viewer, with the viewer's facing pointing up. World x is
 * to the right and world z towards the bottom of an unrotated radar (yaw 0 looks toward -z, so it already points up).
 */

/** Half the side of the square radar, in radar units (the SVG view box). */
export const RADAR_HALF = 50;
/** Blips outside the radar are pinned this far inside its edge, so a teammate far away still shows their direction. */
const EDGE_INSET = 3.5;
/** A fighter this much higher or lower (m) than the viewer is drawn as an up or down triangle (CS:GO style). */
const LEVEL_STEP_M = 1.8;
const DEG = 180 / Math.PI;

export interface RadarPoint {
  x: number;
  y: number;
}

/** Where the radar is centred and which way it faces. */
export interface RadarCenter {
  x: number;
  z: number;
  yaw: number;
}

export type RadarLevel = 'same' | 'above' | 'below';

/** A world position in radar units: the viewer at the centre, their facing up. */
export function toRadar(center: RadarCenter, x: number, z: number, metresPerUnit: number): RadarPoint {
  const dx = (x - center.x) / metresPerUnit;
  const dz = (z - center.z) / metresPerUnit;
  const c = Math.cos(center.yaw);
  const s = Math.sin(center.yaw);
  return { x: dx * c - dz * s, y: dx * s + dz * c };
}

/** SVG transform that draws world-space shapes (metres) the way toRadar places points. */
export function worldTransform(center: RadarCenter, metresPerUnit: number): string {
  return `rotate(${center.yaw * DEG}) scale(${1 / metresPerUnit}) translate(${-center.x} ${-center.z})`;
}

/** Degrees (clockwise) that keep a label drawn in world space upright on the rotating radar. */
export const uprightDeg = (center: RadarCenter) => -center.yaw * DEG;

/** Degrees (clockwise) a blip's direction marker turns by, for a fighter facing `yaw`. */
export const headingDeg = (center: RadarCenter, yaw: number) => (center.yaw - yaw) * DEG;

/** Keep a point on the radar: one past the edge is moved onto it, along the line from the centre. */
export function pinToEdge(p: RadarPoint): RadarPoint {
  const limit = RADAR_HALF - EDGE_INSET;
  const far = Math.max(Math.abs(p.x), Math.abs(p.y));
  if (far <= limit) return p;
  return { x: (p.x / far) * limit, y: (p.y / far) * limit };
}

/** Whether a fighter at height `y` is on the viewer's level, above it or below it. */
export function levelOf(viewerY: number, y: number): RadarLevel {
  const dy = y - viewerY;
  if (dy > LEVEL_STEP_M) return 'above';
  if (dy < -LEVEL_STEP_M) return 'below';
  return 'same';
}
