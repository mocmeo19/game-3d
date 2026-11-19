import type { BlipKind } from '../citySnapshot';
import { BLIP_STYLE } from './mapMarks';

interface BlipMarkerProps {
  kind: BlipKind;
  x: number;
  y: number;
  /** Radius in the SVG's units. */
  r: number;
  /** A protagonist's initial in place of the glyph (story mission markers). */
  letter?: string;
  /** Faded when pinned to the minimap's edge. */
  isFaded?: boolean;
}

/** One mark on the minimap or the big map: a coloured disc with its glyph. */
export function BlipMarker({ kind, x, y, r, letter, isFaded = false }: BlipMarkerProps) {
  const style = BLIP_STYLE[kind];
  return (
    <g transform={`translate(${x} ${y})`} opacity={isFaded ? 0.65 : 1}>
      <circle r={r} fill="#0b0f14" stroke={style.color} strokeWidth={r * 0.22} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.15} fontWeight={800} fill={style.color}>
        {letter ?? style.glyph}
      </text>
    </g>
  );
}
