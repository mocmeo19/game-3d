import type { GenderType } from '../../types/character';
import { sound } from '../../audio/soundManager';

const GENDERS: { id: GenderType; label: string; symbol: string }[] = [
  { id: 'female', label: 'Nữ', symbol: '♀' },
  { id: 'male', label: 'Nam', symbol: '♂' }
];

interface GenderPickerProps {
  gender: GenderType;
  onChange: (gender: GenderType) => void;
}

export function GenderPicker({ gender, onChange }: GenderPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Giới tính">
      {GENDERS.map((option) => {
        const isSelected = option.id === gender;
        return (
          <button
            key={option.id}
            role="radio"
            aria-checked={isSelected}
            onClick={() => {
              sound.playClick();
              if (!isSelected) onChange(option.id);
            }}
            className={`gp-btn h-9 flex items-center justify-center gap-1.5 ${isSelected ? 'is-on' : ''}`}
          >
            <span className="text-base leading-none" aria-hidden>{option.symbol}</span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
