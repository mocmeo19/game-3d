import type { Slot } from '../../lib/persistence';
import { SettingsLink } from '../../settings/SettingsLink';
import { AudioControls } from './AudioControls';
import { CharacterSlotCard } from './select/CharacterSlotCard';
import { EmptySlotCard } from './select/EmptySlotCard';
import { SelectedCharacterBar } from './select/SelectedCharacterBar';
import { useSuppressPerformanceOverlay } from '../../performance/performanceOverlaySuppression';

interface CharacterSelectProps {
  slots: (Slot | null)[];
  selected: number | null;
  onPick: (index: number) => void;
  onEnter: () => void;
  onEdit: (index: number) => void;
  onCreate: () => void;
}

/**
 * Character selection in the lobby style: the picked character stands on the 3D stage behind this overlay,
 * the roster of save slots is on the right and the enter-lobby launcher bottom-left.
 */
export function CharacterSelect({ slots, selected, onPick, onEnter, onEdit, onCreate }: CharacterSelectProps) {
  const filledCount = slots.filter(Boolean).length;
  const current = selected !== null ? slots[selected] : null;
  useSuppressPerformanceOverlay();

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none animate-fade-in">
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/55 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/60 to-transparent" />

      <header className="absolute left-6 top-5 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-8 w-1.5 rounded-full bg-[#ffd34d]" />
          <div>
            <h1 className="text-[26px] font-black uppercase italic leading-none tracking-wide text-white text-shadow">Chọn nhân vật</h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/60">Chọn chiến binh để vào sảnh</p>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <SettingsLink />
          <AudioControls placement="below-left" />
        </div>
      </header>

      <section
        aria-label="Đội hình"
        className="pointer-events-auto absolute right-5 top-5 flex max-h-[calc(100%-8.5rem)] w-[320px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-lg border border-white/15 bg-linear-to-b from-[#0d1826]/90 to-[#08101a]/90 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm animate-rise-in"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/30 px-4 py-2.5">
          <span aria-hidden className="h-4 w-1 rounded-full bg-[#ffd34d]" />
          <h2 className="flex-1 text-[15px] font-bold uppercase tracking-wider">Đội hình</h2>
          <span className="rounded-sm bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/75">{filledCount}/{slots.length}</span>
        </header>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-3">
          {slots.map((slot, index) => slot
            ? <CharacterSlotCard key={index} slot={slot} isSelected={selected === index} onPick={() => onPick(index)} onEnter={onEnter} />
            : <EmptySlotCard key={index} onCreate={onCreate} />)}
        </div>
      </section>

      {current && selected !== null && (
        <div className="absolute bottom-5 left-5 animate-rise-in">
          <SelectedCharacterBar slot={current} onEdit={() => onEdit(selected)} onEnter={onEnter} />
        </div>
      )}
    </div>
  );
}
