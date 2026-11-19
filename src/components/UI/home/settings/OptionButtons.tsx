import { useRef, type KeyboardEvent } from 'react';
import { sound } from '../../../../audio/soundManager';

export interface OptionChoice<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

interface OptionButtonsProps<T extends string | number> {
  label: string;
  /** null when no option matches (e.g. a custom graphics mix). */
  value: T | null;
  options: readonly OptionChoice<T>[];
  onChange: (value: T) => void;
}

const STEP_BY_KEY: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Lobby-style choice buttons (one selected, filled yellow) behaving as a radio group: arrow keys move the selection. */
export function OptionButtons<T extends string | number>({ label, value, options, onChange }: OptionButtonsProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = Math.max(0, selectedIndex);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    buttons.current[index]?.focus();
    if (option.value === value) return;
    sound.playClick();
    onChange(option.value);
  };

  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP_BY_KEY[event.key];
    if (!step) return;
    event.preventDefault();
    choose((focusIndex + step + options.length) % options.length);
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={moveSelection} className="flex flex-wrap gap-1.5">
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={String(option.value)}
            ref={(element) => { buttons.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={index === focusIndex ? 0 : -1}
            title={option.hint}
            onClick={() => choose(index)}
            className={`h-9 min-w-[88px] rounded-sm px-3 text-[13px] font-bold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd34d] ${isSelected
              ? 'bg-[#ffd34d] text-[#1a1306] shadow-[0_0_14px_rgba(255,211,77,0.35)]'
              : 'bg-white/8 text-white/70 hover:bg-white/14 hover:text-white'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
