import { useRef, type KeyboardEvent } from 'react';
import type { CharacterState } from '../../types/character';
import { equipped, SLOTS, type SlotId } from '../../constants/equipment';
import { WearSlotIcon } from './WearSlotIcon';

const WEAR_SLOTS = SLOTS.filter((sl) => sl.group === 'wear');

/** Vertical icon tab list for picking which clothing slot the costume editor shows. */
export function WearSlotTabs({ characterState, selectedSlot, onSelectSlot }: {
  characterState: CharacterState;
  selectedSlot: SlotId;
  onSelectSlot: (slot: SlotId) => void;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const wearColors = characterState.cosmetics.wearColors;

  const focusTab = (index: number) => {
    const wrapped = (index + WEAR_SLOTS.length) % WEAR_SLOTS.length;
    onSelectSlot(WEAR_SLOTS[wrapped].id);
    tabRefs.current[wrapped]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keyTargets: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: WEAR_SLOTS.length - 1 };
    const targetIndex = keyTargets[event.key];
    if (targetIndex === undefined) return;
    event.preventDefault();
    focusTab(targetIndex);
  };

  return (
    <div role="tablist" aria-orientation="vertical" aria-label="Vị trí trang phục" className="flex flex-col gap-1 pr-0.5">
      {WEAR_SLOTS.map((sl, index) => {
        const isSelected = sl.id === selectedSlot;
        const pieceColor = wearColors?.[sl.id];
        const isWorn = equipped(characterState, sl.id) !== null;
        return (
          <button
            key={sl.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-label={isWorn ? `${sl.label} (đang mặc)` : sl.label}
            title={sl.label}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelectSlot(sl.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`gp-btn relative flex shrink-0 items-center justify-center p-0! w-8 h-8 ${isSelected ? 'is-on' : ''}`}
          >
            <WearSlotIcon slot={sl.id} />
            {isWorn && (
              <span
                className="absolute right-0.5 bottom-0.5 w-1.5 h-1.5 border border-black/60"
                style={{ background: pieceColor ?? '#f0c64a' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
