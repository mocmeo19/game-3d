import { Check, Music } from 'lucide-react';
import { PoseType } from '../../types/character';
import { DANCE_POSES, dancePoseId } from '../../constants/dancePoses';

export function DancePoseGrid({ pose, onChoose }: { pose: PoseType | null; onChoose: (pose: PoseType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {DANCE_POSES.map((dance) => {
        const id = dancePoseId(dance);
        const selected = pose === id;
        return (
          <button type="button" key={dance.file} aria-pressed={selected} onClick={() => onChoose(id)} className={`gp-thumb min-h-12 p-2 text-xs flex items-center gap-2 text-left ${selected ? 'is-sel text-amber-200' : 'text-white/80'}`}>
            <Music size={14} className="shrink-0 opacity-70" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{dance.label}</span>
            {selected && <Check size={14} className="shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
