import React from 'react';
import { STAT_LABELS, StatKey } from '../../constants/heroInfo';

/** Spider (radar) chart of the six hero stats. */
export const ProfileRadarChart: React.FC<{ stats: Record<StatKey, number> }> = ({ stats }) => {
  const keys = Object.keys(STAT_LABELS) as StatKey[];
  const W = 380;
  const H = 340;
  const cx = W / 2;
  const cy = 170;
  const R = 118;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / keys.length;
  const pt = (i: number, frac: number) => `${(cx + Math.cos(angle(i)) * R * frac).toFixed(1)},${(cy + Math.sin(angle(i)) * R * frac).toFixed(1)}`;
  const ring = (f: number) => keys.map((_, i) => pt(i, f)).join(' ');
  const data = keys.map((k, i) => pt(i, stats[k] / 100)).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Biểu đồ mạng nhện chỉ số nhân vật">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9fe3ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3fa0ff" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill={f === 1 ? 'rgba(255,255,255,0.05)' : 'none'} stroke="rgba(255,255,255,0.22)" strokeWidth={f === 1 ? 1.4 : 1} />
      ))}
      {keys.map((k, i) => (
        <line key={k} x1={cx} y1={cy} x2={cx + Math.cos(angle(i)) * R} y2={cy + Math.sin(angle(i)) * R} stroke="rgba(255,255,255,0.22)" />
      ))}
      <polygon points={data} fill="url(#radarFill)" stroke="#bff0ff" strokeWidth="2" strokeLinejoin="round" />
      {keys.map((k, i) => {
        const [x, y] = pt(i, stats[k] / 100).split(',').map(Number);
        return <circle key={k} cx={x} cy={y} r="3.6" fill="#ffffff" stroke="#3fa0ff" strokeWidth="1.5" />;
      })}
      {keys.map((k, i) => {
        const lx = cx + Math.cos(angle(i)) * (R + 30);
        const ly = cy + Math.sin(angle(i)) * (R + 30);
        const anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? 'middle' : Math.cos(angle(i)) > 0 ? 'start' : 'end';
        return (
          <g key={k} textAnchor={anchor}>
            <text x={lx} y={ly - 2} fill="rgba(255,255,255,0.85)" fontSize="13">
              {STAT_LABELS[k]}
            </text>
            <text x={lx} y={ly + 14} fill="#fde68a" fontSize="14" fontWeight="600">
              {stats[k]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

