import type { RadarLevel, RadarPoint } from './radarGeometry';

/** A fighter's marker: a dot (a triangle when they are above or below the viewer), or a cross once dead. */
export type RadarBlipProps =
  | { kind: 'dead'; at: RadarPoint; color: string }
  | {
      kind: 'alive';
      at: RadarPoint;
      color: string;
      level: RadarLevel;
      /** Which way they face (clockwise degrees on the radar), or null to leave the direction out (an enemy). */
      headingDeg: number | null;
      isFiring: boolean;
    };

const SHAPE: Record<Exclude<RadarLevel, 'same'>, string> = {
  above: 'M0 -3.6L3.3 2.4L-3.3 2.4Z',
  below: 'M0 3.6L3.3 -2.4L-3.3 -2.4Z',
};
const OUTLINE = '#000000b3';

/** One fighter on the radar, CS:GO style. */
export function RadarBlip(props: RadarBlipProps) {
  const { at, color } = props;
  if (props.kind === 'dead') {
    return (
      <text x={at.x} y={at.y} fontSize={7} fontWeight={900} fill={color} stroke={OUTLINE} strokeWidth={0.6} textAnchor="middle" dominantBaseline="central">
        ×
      </text>
    );
  }
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      {props.isFiring && <circle r={4.6} fill="none" stroke="#ffffff" strokeWidth={1} strokeOpacity={0.9} />}
      {props.headingDeg !== null && <path d="M0 -6.4L2.1 -3.2L-2.1 -3.2Z" transform={`rotate(${props.headingDeg})`} fill={color} stroke={OUTLINE} strokeWidth={0.4} />}
      {props.level === 'same' ? (
        <circle r={2.7} fill={color} stroke={OUTLINE} strokeWidth={0.7} />
      ) : (
        <path d={SHAPE[props.level]} fill={color} stroke={OUTLINE} strokeWidth={0.7} />
      )}
    </g>
  );
}
