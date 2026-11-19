import { useId } from 'react';
import type { CityView } from '../citySnapshot';
import { BlipMarker } from './BlipMarker';
import { minimapReach, toMinimap } from './mapMarks';

interface CityMinimapProps {
  view: CityView;
}

/** The turning minimap in the corner: the city picture, the GPS route, the marks, the player's arrow and where they are. */
export function CityMinimap({ view }: CityMinimapProps) {
  const clipId = useId();
  const { me, mapBounds: b } = view;
  const reach = minimapReach(view.vehicle?.speedKmh ?? 0);
  const yawDeg = (me.yaw * 180) / Math.PI;
  const route = view.route.map((p) => `${p.x},${p.z}`).join(' ');
  const blipR = reach * 0.075;
  const isWanted = view.wanted.stars > 0;
  return (
    <aside className="flex flex-col items-center gap-1" aria-label="Bản đồ nhỏ">
      <div className={`h-44 w-44 overflow-hidden rounded-full border-[3px] bg-[#0b0f14] shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-52 sm:w-52 ${isWanted ? 'animate-pulse border-[#3d7bff]' : 'border-white/70'}`}>
        <svg viewBox={`${-reach} ${-reach} ${reach * 2} ${reach * 2}`} className="h-full w-full" role="img" aria-label={`Bạn đang ở ${view.placeName}`}>
          <defs>
            <clipPath id={clipId}>
              <circle r={reach} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <g transform={`rotate(${yawDeg}) translate(${-me.x} ${-me.z})`}>
              <image href={view.mapImageUrl} x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} preserveAspectRatio="none" opacity={0.92} />
              {route && <polyline points={route} fill="none" stroke="#c77dff" strokeWidth={reach * 0.035} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />}
            </g>
            {view.blips.map((blip) => {
              const at = toMinimap(me, blip.x, blip.z, reach - blipR);
              return <BlipMarker key={blip.id} kind={blip.kind} x={at.x} y={at.y} r={blipR} letter={blip.letter} isFaded={at.isEdge} />;
            })}
          </g>
          <path d={`M0 ${-reach * 0.09} L${reach * 0.06} ${reach * 0.07} L0 ${reach * 0.035} L${-reach * 0.06} ${reach * 0.07}Z`} fill="#ffffff" stroke="#0b0f14" strokeWidth={reach * 0.012} />
        </svg>
      </div>
      <p className="max-w-52 truncate rounded bg-black/55 px-2 py-0.5 text-xs font-semibold text-white/90">{view.placeName}</p>
    </aside>
  );
}
