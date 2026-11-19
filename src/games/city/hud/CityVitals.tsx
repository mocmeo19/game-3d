interface CityVitalsProps {
  health: number;
  armor: number;
}

const LOW_HEALTH = 30;

/** Health and armour under the minimap. */
export function CityVitals({ health, armor }: CityVitalsProps) {
  const isLow = health <= LOW_HEALTH;
  return (
    <div className="flex w-44 gap-1 sm:w-52" role="group" aria-label={`Máu ${health}, giáp ${Math.round(armor)}`}>
      <div className="h-2 flex-[3] overflow-hidden rounded-sm bg-black/60">
        <div className={`h-full transition-[width] duration-150 ${isLow ? 'bg-[#e5483b]' : 'bg-[#5fcf6f]'}`} style={{ width: `${health}%` }} />
      </div>
      <div className="h-2 flex-[2] overflow-hidden rounded-sm bg-black/60">
        <div className="h-full bg-[#4f8dff] transition-[width] duration-150" style={{ width: `${Math.min(100, armor)}%` }} />
      </div>
    </div>
  );
}
