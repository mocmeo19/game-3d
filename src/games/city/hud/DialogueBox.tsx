import type { DialogueLine } from '../story/missionTypes';

interface DialogueBoxProps {
  line: DialogueLine | null;
}

/** The line being spoken, as a subtitle with the speaker's name (Enter skips it). */
export function DialogueBox({ line }: DialogueBoxProps) {
  if (!line) return null;
  return (
    <div className="pointer-events-none absolute bottom-28 left-1/2 w-[min(720px,86vw)] -translate-x-1/2 text-center" role="log" aria-live="polite">
      <p className="inline rounded bg-black/60 px-3 py-1.5 text-base leading-relaxed text-white">
        <strong className="mr-2 text-[#f5c542]">{line.speaker}:</strong>
        {line.text}
      </p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/45">Enter: bỏ qua</p>
    </div>
  );
}
