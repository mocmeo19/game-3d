import React from 'react';
import { Plus, Play, Pencil } from 'lucide-react';
import { RACES, CLASSES } from '../../constants/presets';
import { Slot } from '../../lib/persistence';
import { sound } from '../../audio/soundManager';

/**
 * Character selection, shown at start-up when more than one character is saved: the chosen character stands on the 3D
 * stage behind this overlay, the saved characters are listed on the right.
 */
export const CharacterSelect: React.FC<{
  slots: (Slot | null)[];
  selected: number | null;
  onPick: (index: number) => void;
  onEnter: () => void;
  onEdit: (index: number) => void;
  onCreate: () => void;
}> = ({ slots, selected, onPick, onEnter, onEdit, onCreate }) => {
  const filled = slots.map((s, i) => [s, i] as const).filter(([s]) => !!s) as [Slot, number][];
  const current = selected !== null ? slots[selected] : null;
  const hasFree = slots.some((s) => !s);
  return (
    <>
      <h1 className="absolute top-4 left-6 z-10 text-[26px] font-semibold tracking-wide text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] animate-rise-in">
        Chọn nhân vật
      </h1>

      <div className="absolute right-4 top-4 bottom-28 w-80 z-10 flex flex-col gap-2 animate-rise-in">
        <div className="gp flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-gp-line flex items-center justify-between">
            <span className="text-[13px] text-white">Nhân vật đã lưu</span>
            <span className="text-[11px] text-gp-mute">
              {filled.length}/{slots.length}
            </span>
          </div>
          <div className="p-2 space-y-1.5 overflow-y-auto min-h-0">
            {filled.map(([slot, i]) => {
              const sel = selected === i;
              const race = RACES[slot.state.race];
              const cls = CLASSES[slot.state.characterClass];
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-pressed={sel}
                  onClick={() => {
                    sound.playClick();
                    onPick(i);
                  }}
                  onDoubleClick={onEnter}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onEnter();
                  }}
                  className={`group relative flex gap-2 p-1.5 border cursor-pointer transition-colors ${sel ? 'border-gp-hot bg-gp-hot/10' : 'border-gp-line bg-black/30 hover:border-white/30'}`}
                >
                  <div className="w-16 h-20 shrink-0 overflow-hidden bg-linear-to-b from-[#3b3f4a] to-[#15171c] border border-white/10">
                    {slot.thumb ? <img src={slot.thumb} alt="" className="w-full h-full object-cover" draggable={false} /> : null}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className={`text-[14px] font-semibold truncate ${sel ? 'text-gp-hot' : 'text-white'}`}>{slot.state.name}</div>
                    <div className="text-[11px] text-gp-text truncate">
                      {race?.emblem} {race?.name} · {slot.state.gender === 'female' ? 'Nữ' : 'Nam'}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: cls?.color }}>
                      {cls?.badge} {cls?.name}
                    </div>
                    <div className="text-[10px] text-gp-mute mt-0.5">Lưu {new Date(slot.savedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-2 border-t border-gp-line">
            <button
              className="gp-btn w-full flex items-center justify-center gap-1.5"
              disabled={!hasFree}
              title={hasFree ? 'Tạo nhân vật mới' : 'Đã đủ ô lưu, hãy xoá bớt một nhân vật'}
              onClick={() => {
                sound.playClick();
                onCreate();
              }}
            >
              <Plus size={14} /> Tạo nhân vật mới
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 inset-x-0 mx-auto w-fit z-10 flex flex-col items-center gap-2 animate-rise-in">
        {current && (
          <p className="text-[12px] text-white/85 drop-shadow-sm">
            {current.state.name} · {RACES[current.state.race]?.name} · {CLASSES[current.state.characterClass]?.name}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            className="gp-btn gp-btn-big px-6! flex items-center gap-2"
            disabled={selected === null || !current}
            onClick={() => {
              sound.playClick();
              if (selected !== null) onEdit(selected);
            }}
          >
            <Pencil size={15} /> Chỉnh sửa
          </button>
          <button
            className="gp-btn gp-btn-big character-start px-10! flex items-center gap-2"
            disabled={!current}
            onClick={() => {
              sound.playTriumph();
              onEnter();
            }}
          >
            <Play size={16} /> Bắt đầu
          </button>
        </div>
      </div>
    </>
  );
};
