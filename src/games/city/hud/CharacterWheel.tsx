import { Lock, X } from 'lucide-react';
import type { ProtagonistView } from '../citySnapshot';
import type { ProtagonistId } from '../story/protagonists';

interface CharacterWheelProps {
  heroes: readonly ProtagonistView[];
  onPick: (id: ProtagonistId) => void;
  onClose: () => void;
}

/** Choosing who to play (Tab): one card per protagonist with their money and where they are; 1, 2, 3 pick too. */
export function CharacterWheel({ heroes, onPick, onClose }: CharacterWheelProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Chọn nhân vật">
      <div className="flex w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between text-white">
          <h2 className="text-lg font-bold">Chọn nhân vật</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {heroes.map((hero, i) => (
            <button
              key={hero.id}
              type="button"
              disabled={!hero.isUnlocked}
              onClick={() => onPick(hero.id)}
              aria-current={hero.isActive ? 'true' : undefined}
              className={`flex flex-col gap-1 rounded-lg border p-4 text-left text-white transition focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45 ${hero.isActive ? 'border-[#f5c542] bg-[#f5c542]/15' : 'border-white/20 bg-black/60 hover:bg-white/10'}`}
            >
              <span className="flex items-center justify-between text-xs text-white/60">
                <kbd className="rounded border border-white/30 px-1.5">{i + 1}</kbd>
                {!hero.isUnlocked && <Lock size={14} aria-label="Chưa mở" />}
              </span>
              <span className="text-2xl font-black">{hero.name}</span>
              <span className="text-sm text-white/75">{hero.role}</span>
              {hero.isUnlocked ? (
                <>
                  <span className="text-sm font-bold tabular-nums text-[#7bd88f]">${hero.money.toLocaleString('vi-VN')}</span>
                  <span className="truncate text-xs text-white/60">{hero.place}</span>
                </>
              ) : (
                <span className="text-xs text-white/60">Xuất hiện ở phần sau của câu chuyện</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
