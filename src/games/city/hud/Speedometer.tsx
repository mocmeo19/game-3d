import type { CityView } from '../citySnapshot';

interface SpeedometerProps {
  vehicle: NonNullable<CityView['vehicle']>;
}

const DAMAGED = 0.35;

/** Speed and the car's condition while driving, above the weapon panel. */
export function Speedometer({ vehicle }: SpeedometerProps) {
  const isDamaged = vehicle.health < DAMAGED;
  return (
    <div className="pointer-events-none absolute bottom-36 right-4 flex flex-col items-end gap-1 [text-shadow:0_2px_4px_rgba(0,0,0,0.9)]" aria-label={`${vehicle.name}, ${vehicle.speedKmh} km/h`}>
      <span className="text-xs font-semibold text-white/80">{vehicle.name}</span>
      <span className="text-4xl font-black tabular-nums text-white">
        {vehicle.speedKmh}
        <small className="ml-1 text-sm font-semibold text-white/70">km/h</small>
      </span>
      <div className="h-1.5 w-32 overflow-hidden rounded bg-black/60">
        <div className={`h-full ${isDamaged ? 'bg-[#e5483b]' : 'bg-[#f5c542]'}`} style={{ width: `${Math.round(vehicle.health * 100)}%` }} />
      </div>
    </div>
  );
}
