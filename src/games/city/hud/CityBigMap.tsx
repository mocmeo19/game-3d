import type { MouseEvent } from 'react';
import { X } from 'lucide-react';
import type { P2 } from '../../core/agents/nav';
import type { BlipKind, CityView } from '../citySnapshot';
import { BlipMarker } from './BlipMarker';
import { BLIP_STYLE } from './mapMarks';

interface CityBigMapProps {
  view: CityView;
  onWaypoint: (at: P2 | null) => void;
  onClose: () => void;
}

/** Mark size as a share of the map's width. */
const BLIP_SHARE = 0.008;

/** The whole city (M): every mark with a legend; a click sets the GPS waypoint. */
export function CityBigMap({ view, onWaypoint, onClose }: CityBigMapProps) {
  const b = view.mapBounds;
  const width = b.x1 - b.x0;
  const height = b.z1 - b.z0;
  const r = width * BLIP_SHARE;
  const route = view.route.map((p) => `${p.x},${p.z}`).join(' ');
  const kinds = [...new Set(view.blips.map((blip) => blip.kind))] as BlipKind[];

  const placeWaypoint = (e: MouseEvent<SVGSVGElement>) => {
    const matrix = e.currentTarget.getScreenCTM();
    if (!matrix) return;
    const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    onWaypoint({ x: at.x, z: at.y });
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-black/85 p-3 text-white sm:p-6" role="dialog" aria-modal="true" aria-label="Bản đồ thành phố">
      <header className="mb-2 flex items-center justify-between gap-3 pr-24">
        <div>
          <h2 className="text-lg font-bold">Thành phố Thiên Lộc</h2>
          <p className="text-xs text-white/60">Bấm vào bản đồ để đặt điểm đến · Esc hoặc M để đóng</p>
        </div>
        <div className="flex items-center gap-2">
          {view.waypoint && (
            <button type="button" onClick={() => onWaypoint(null)} className="rounded-md border border-white/25 px-3 py-1.5 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
              Xoá điểm đến
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" aria-label="Đóng bản đồ">
            <X size={20} />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <svg viewBox={`${b.x0} ${b.z0} ${width} ${height}`} className="min-h-0 flex-1 cursor-crosshair rounded-md bg-[#0b0f14]" preserveAspectRatio="xMidYMid meet" onClick={placeWaypoint} role="img" aria-label="Bản đồ, bấm để đặt điểm đến">
          <image href={view.mapImageUrl} x={b.x0} y={b.z0} width={width} height={height} preserveAspectRatio="none" />
          {route && <polyline points={route} fill="none" stroke="#c77dff" strokeWidth={r * 0.6} strokeLinejoin="round" strokeLinecap="round" />}
          {view.blips.map((blip) => (
            <BlipMarker key={blip.id} kind={blip.kind} x={blip.x} y={blip.z} r={r} letter={blip.letter} />
          ))}
          <g transform={`translate(${view.me.x} ${view.me.z}) rotate(${(-view.me.yaw * 180) / Math.PI})`}>
            <path d={`M0 ${-r * 1.6} L${r} ${r} L0 ${r * 0.4} L${-r} ${r}Z`} fill="#ffffff" stroke="#0b0f14" strokeWidth={r * 0.2} />
          </g>
        </svg>
        <ul className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-sm lg:w-52 lg:flex-col" aria-label="Chú giải">
          {kinds.map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: BLIP_STYLE[kind].color }} aria-hidden />
              {BLIP_STYLE[kind].name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
