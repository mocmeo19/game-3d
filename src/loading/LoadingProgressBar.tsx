interface LoadingProgressBarProps {
  /** 0–1, or null when the amount of work is not known yet. */
  ratio: number | null;
  label: string;
  accentClassName?: string;
}

export function LoadingProgressBar({ ratio, label, accentClassName = 'bg-amber-300' }: LoadingProgressBarProps) {
  const percent = ratio === null ? null : Math.round(ratio * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10"
    >
      {percent === null ? (
        <div className={`absolute inset-y-0 w-1/3 rounded-full ${accentClassName} motion-safe:animate-loading-sweep`} />
      ) : (
        <div className={`h-full rounded-full ${accentClassName} transition-[width] duration-300 ease-out`} style={{ width: `${percent}%` }} />
      )}
    </div>
  );
}
