import type { WeaponKind } from '../../types/character';
import { WEAPON_KIND_LIST } from '../../constants/weaponKinds';
import { sound } from '../../audio/soundManager';

interface WeaponKindGridProps {
  selected: WeaponKind;
  onSelect: (weapon: WeaponKind) => void;
}

export function WeaponKindGrid({ selected, onSelect }: WeaponKindGridProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Loại vũ khí">
      {WEAPON_KIND_LIST.map((kind) => {
        const isSelected = kind.id === selected;
        return (
          <button
            key={kind.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={kind.description}
            onClick={() => {
              sound.playBladeWhoosh();
              if (!isSelected) onSelect(kind.id);
            }}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${isSelected ? 'border-amber-300 bg-amber-300/10' : 'border-white/15 bg-black/25 hover:border-white/40'}`}
            style={{ boxShadow: isSelected ? `0 0 10px ${kind.color}66` : undefined }}
          >
            <span className="text-[22px] leading-none" aria-hidden>{kind.badge}</span>
            <span className={`text-[11px] leading-tight ${isSelected ? 'text-amber-200' : 'text-white/85'}`}>{kind.name}</span>
          </button>
        );
      })}
    </div>
  );
}
