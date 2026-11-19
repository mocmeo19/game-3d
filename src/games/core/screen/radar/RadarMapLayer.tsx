import { uprightDeg, type RadarCenter } from './radarGeometry';
import type { RadarLabel, RadarMap } from './radarMap';

/** Label size in metres: it is drawn in world space, so it zooms with the map. */
const LABEL_SIZE_M = 4.2;
const LABEL_FILL: Record<RadarLabel['tone'], string> = { ct: '#8cb8ff', t: '#f3c066', neutral: '#e8ece9' };

interface RadarMapLayerProps {
  map: RadarMap;
  center: RadarCenter;
}

/** The map under the blips, drawn in world metres inside the radar's world transform: floor, cover and upright labels. */
export function RadarMapLayer({ map, center }: RadarMapLayerProps) {
  const floor = map.floor.map((p) => `${p.x},${p.z}`).join(' ');
  const labelTurn = uprightDeg(center);
  return (
    <g>
      <polygon points={floor} fill="#59605b" stroke="#b9c1bb" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
      {map.blocks.map((b, i) => (
        <rect
          key={i}
          x={b.x0}
          y={b.z0}
          width={b.x1 - b.x0}
          height={b.z1 - b.z0}
          fill={b.isLow ? '#3d4440' : '#161b18'}
          stroke="#00000080"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {map.labels.map((label) => (
        <text
          key={label.text}
          x={label.x}
          y={label.z}
          transform={`rotate(${labelTurn} ${label.x} ${label.z})`}
          fontSize={LABEL_SIZE_M}
          fontWeight={800}
          fill={LABEL_FILL[label.tone]}
          fillOpacity={0.85}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label.text}
        </text>
      ))}
    </g>
  );
}
