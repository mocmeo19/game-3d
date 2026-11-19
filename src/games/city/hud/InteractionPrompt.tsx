import type { CityView } from '../citySnapshot';

interface InteractionPromptProps {
  prompt: string;
  progress: CityView['progress'];
}

/** Top left help box: what F does here, and the bar of something being held (robbing a till, an arrest). */
export function InteractionPrompt({ prompt, progress }: InteractionPromptProps) {
  if (!prompt && !progress) return null;
  return (
    <div className="pointer-events-none absolute left-4 top-4 flex max-w-xs flex-col gap-2 rounded-md bg-black/70 px-3 py-2 text-sm text-white shadow-lg" role="status" aria-live="polite">
      {prompt && (
        <p>
          <kbd className="mr-2 rounded border border-white/40 bg-white/10 px-1.5 py-0.5 text-xs font-bold">F</kbd>
          {prompt}
        </p>
      )}
      {progress && (
        <div>
          <p className="mb-1 text-xs text-white/80">{progress.label}</p>
          <div className="h-1.5 overflow-hidden rounded bg-white/15">
            <div className="h-full bg-[#f5c542]" style={{ width: `${Math.round(progress.share * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
