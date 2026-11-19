interface MissionObjectiveProps {
  title: string;
  objective: string;
}

/** The mission being played and what to do now, at the bottom of the screen. */
export function MissionObjective({ title, objective }: MissionObjectiveProps) {
  if (!objective) return null;
  return (
    <div className="pointer-events-none absolute bottom-10 left-1/2 w-[min(640px,80vw)] -translate-x-1/2 text-center [text-shadow:0_2px_4px_rgba(0,0,0,0.95)]" role="status" aria-live="polite">
      {title && <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#f5c542]">{title}</p>}
      <p className="text-lg font-semibold text-white">{objective}</p>
    </div>
  );
}
