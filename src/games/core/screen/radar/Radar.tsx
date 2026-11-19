import { useId } from 'react';
import type { RadarView } from '../../engine/snapshotTypes';
import { headingDeg, levelOf, pinToEdge, RADAR_HALF, toRadar, worldTransform, type RadarCenter } from './radarGeometry';
import { calloutAt, type RadarMap } from './radarMap';
import { RadarBlip } from './RadarBlip';
import { RadarMapLayer } from './RadarMapLayer';

/** A circle drawn on the radar: the current safe zone (blue) or the next one (white). */
export interface RadarRing {
  x: number;
  z: number;
  r: number;
  isNext: boolean;
}

/** A straight road drawn under the dots, `width` metres wide. */
export interface RadarLine {
  from: { x: number; z: number };
  to: { x: number; z: number };
  width: number;
}

interface RadarProps {
  radar: RadarView;
  /** The map drawn under the blips, with its zoom and place names; without one the radar is plain. */
  map?: RadarMap;
  lines?: readonly RadarLine[];
  rings?: readonly RadarRing[];
}

/** Zoom when the game gives no map (metres per radar unit). */
const DEFAULT_METRES_PER_UNIT = 1.1;
/** CS:GO's teammate colours: each player keeps one for the match (yellow, purple, green, blue, orange). */
const TEAM_COLORS = ['#f2e14a', '#a35cf2', '#3fbf5a', '#3d93f5', '#f58b2e'] as const;
const ENEMY_COLOR = '#ff3b30';
/** How long (s) a "?" for an enemy lost from sight stays, fading out (matches LAST_SEEN_S in radarSnapshot.ts). */
const LAST_SEEN_FADE_S = 3;
/** The viewer's field of view as a soft wedge in front of their blip. */
const VIEW_CONE = 'M0 0L-17 -24A29.4 29.4 0 0 1 17 -24Z';
const CORNER = 5;

const teamColor = (slot: number) => TEAM_COLORS[slot % TEAM_COLORS.length];

/** Rotating CS:GO style radar: the viewer is centred and looks up, the map turns under them. */
export function Radar({ radar, map, lines = [], rings = [] }: RadarProps) {
  const ids = useId();
  const { me, allies, enemies, lastSeen } = radar;
  const metresPerUnit = map?.metresPerUnit ?? DEFAULT_METRES_PER_UNIT;
  const center: RadarCenter = me;
  const place = (x: number, z: number) => pinToEdge(toRadar(center, x, z, metresPerUnit));
  const callout = map ? calloutAt(map, me.x, me.z) : '';
  const side = RADAR_HALF * 2;
  return (
    <div className="cs-radar">
      <svg viewBox={`${-RADAR_HALF} ${-RADAR_HALF} ${side} ${side}`} role="img" aria-label="Radar: chấm màu là đồng đội, đỏ là đối thủ đã bị phát hiện, dấu hỏi là nơi đối thủ vừa mất dấu">
        <defs>
          <clipPath id={`${ids}clip`}>
            <rect x={-RADAR_HALF} y={-RADAR_HALF} width={side} height={side} rx={CORNER} />
          </clipPath>
          <radialGradient id={`${ids}cone`} cx="0.5" cy="1" r="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.32} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={-RADAR_HALF} y={-RADAR_HALF} width={side} height={side} rx={CORNER} fill="#070a09d9" />
        <g clipPath={`url(#${ids}clip)`}>
          <g transform={worldTransform(center, metresPerUnit)}>
            {map && <RadarMapLayer map={map} center={center} />}
            {lines.map((line, i) => (
              <line key={i} x1={line.from.x} y1={line.from.z} x2={line.to.x} y2={line.to.z} stroke="#ffffff18" strokeWidth={line.width} />
            ))}
            {rings.map((ring, i) =>
              ring.r > 0 ? (
                <circle key={`z${i}`} cx={ring.x} cy={ring.z} r={ring.r} fill="none" stroke={ring.isNext ? '#ffffffcc' : '#3d7dff'} strokeWidth={ring.isNext ? 1.4 : 2.4} vectorEffect="non-scaling-stroke" />
              ) : null,
            )}
          </g>
          {lastSeen.map((e) => {
            const at = place(e.x, e.z);
            return (
              <text key={`q${e.id}`} x={at.x} y={at.y} fontSize={7} fontWeight={900} fill={ENEMY_COLOR} fillOpacity={1 - e.ageS / LAST_SEEN_FADE_S} stroke="#000000b3" strokeWidth={0.5} textAnchor="middle" dominantBaseline="central">
                ?
              </text>
            );
          })}
          {allies.map((a) =>
            a.alive ? (
              <RadarBlip key={a.id} kind="alive" at={place(a.x, a.z)} color={teamColor(a.colorSlot)} level={levelOf(me.y, a.y)} headingDeg={headingDeg(center, a.yaw)} isFiring={a.isFiring} />
            ) : (
              <RadarBlip key={a.id} kind="dead" at={place(a.x, a.z)} color={teamColor(a.colorSlot)} />
            ),
          )}
          {enemies.map((e) => (
            <RadarBlip key={e.id} kind="alive" at={place(e.x, e.z)} color={ENEMY_COLOR} level={levelOf(me.y, e.y)} headingDeg={null} isFiring={false} />
          ))}
          <path d={VIEW_CONE} fill={`url(#${ids}cone)`} />
          <RadarBlip kind="alive" at={{ x: 0, y: 0 }} color={teamColor(me.colorSlot)} level="same" headingDeg={0} isFiring={false} />
        </g>
        <rect x={-RADAR_HALF} y={-RADAR_HALF} width={side} height={side} rx={CORNER} fill="none" stroke="#ffffff38" strokeWidth={0.8} />
      </svg>
      {callout && <div className="cs-radar-callout">{callout}</div>}
    </div>
  );
}
