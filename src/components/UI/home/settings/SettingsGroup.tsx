import { useId, type ReactNode } from 'react';

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-md border border-white/8 bg-white/3 px-4 pb-1 sm:px-5">
      <h3 id={headingId} className="flex items-center gap-2 pt-3.5 pb-1 text-[12px] font-bold uppercase tracking-[0.18em] text-[#ffd34d]/90">
        <span aria-hidden className="h-3 w-1 rounded-full bg-[#ffd34d]" />
        {title}
      </h3>
      {children}
    </section>
  );
}
