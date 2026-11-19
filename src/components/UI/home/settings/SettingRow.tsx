import type { ReactNode } from 'react';

interface SettingRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** One setting: its name and a short explanation on the left, the control on the right (stacked on narrow screens). */
export function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-white/6 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-white/90">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-white/45">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
