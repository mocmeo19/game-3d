import { Check } from 'lucide-react';
import { squadTagVars, type SquadTag } from './squadLineup';

interface SquadNameTagsProps {
  /** The player's tag first, then the mates' in lineup order. */
  tags: readonly SquadTag[];
}

/** Name plates over the squad's heads; their screen spots come from CSS variables the stage updates every frame. */
export function SquadNameTags({ tags }: SquadNameTagsProps) {
  return (
    <ul aria-label="Đội hình" className="pointer-events-none absolute inset-0 z-[5]">
      {tags.map((tag, index) => {
        const vars = squadTagVars(index);
        return (
          <li
            key={`${index}-${tag.name}`}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5 transition-opacity duration-300"
            style={{ left: `var(${vars.x}, -999px)`, top: `var(${vars.y}, -999px)`, opacity: `var(${vars.shown}, 0)` }}
          >
            <span className="flex items-center gap-1.5 rounded-sm border border-white/15 bg-black/60 px-2 py-0.5 text-[12px] font-bold whitespace-nowrap text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              {tag.ready && <Check size={13} strokeWidth={3} className="text-[#ffd34d]" aria-label="Sẵn sàng" />}
              {tag.name}
            </span>
            <span className="text-[10px] font-bold whitespace-nowrap text-[#ffd34d] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{tag.role}</span>
          </li>
        );
      })}
    </ul>
  );
}
