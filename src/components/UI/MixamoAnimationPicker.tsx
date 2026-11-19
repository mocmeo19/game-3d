import { useState } from 'react';
import { Check, Play, Square } from 'lucide-react';
import { PoseType } from '../../types/character';
import { MIXAMO_GROUPS, MIXAMO_PREFIX, useMixamoClips } from '../../constants/mixamoPoses';
import { sound } from '../../audio/soundManager';

interface MixamoAnimationPickerProps {
  pose: PoseType | null;
  onChoose: (pose: PoseType | null) => void;
}

export function MixamoAnimationPicker({ pose, onChoose }: MixamoAnimationPickerProps) {
  const [group, setGroup] = useState('all');
  const clips = useMixamoClips();
  const shownClips = clips.filter(MIXAMO_GROUPS.find((item) => item.id === group)?.match ?? (() => true));
  const selectedClip = clips.find((item) => MIXAMO_PREFIX + item.file === pose);
  const playing = pose?.startsWith(MIXAMO_PREFIX) ?? false;

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[18px] font-medium">Animation</h2>
        <span className="text-xs text-white/50 shrink-0">{shownClips.length} clip</span>
      </div>
      <p className="mb-3 text-xs text-white/60">Chọn clip để phát lặp trên nhân vật.</p>
      <div className="flex flex-wrap gap-1 mb-2" aria-label="Nhóm animation">
        {MIXAMO_GROUPS.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={group === item.id}
            onClick={() => setGroup(item.id)}
            className={`gp-btn py-1! px-2! text-[11px] ${group === item.id ? 'is-on' : ''}`}
          >
            {item.ko}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 max-h-[400px] overflow-y-auto border border-gp-line bg-black/40 p-1">
        {shownClips.map((clip) => {
          const id = (MIXAMO_PREFIX + clip.file) as PoseType;
          const active = pose === id;
          return (
            <button
              type="button"
              key={clip.file}
              aria-pressed={active}
              onClick={() => { sound.playCue('pose'); onChoose(id); }}
              className={`gp-thumb min-h-14 p-2 text-xs flex items-center gap-2 text-left ${active ? 'is-sel text-amber-200' : 'text-white/80'}`}
            >
              {active ? <Check size={14} className="shrink-0" aria-hidden="true" />
                : <Play size={14} className="shrink-0" aria-hidden="true" />}
              <span>{clip.label}</span>
            </button>
          );
        })}
        {shownClips.length === 0 && (
          <p className="col-span-2 p-2 text-xs text-white/60">Chưa có animation trong nhóm này.</p>
        )}
      </div>
      <div className="mt-3 border-t border-white/15 pt-3">
        <p className="text-xs text-amber-200 mb-2" aria-live="polite">
          {playing ? `Đang phát: ${selectedClip?.label ?? 'Animation'}` : 'Chưa chọn animation'}
        </p>
        <button
          type="button"
          disabled={!playing}
          onClick={() => { sound.playClick(); onChoose(null); }}
          className="gp-btn flex items-center gap-1.5 px-3! py-1.5! text-xs"
        >
          <Square size={13} /> Dừng · Đứng nghỉ
        </button>
      </div>
    </>
  );
}
