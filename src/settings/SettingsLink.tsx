import { Settings2 } from 'lucide-react';

export function SettingsLink({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/settings" aria-label="Cài đặt ứng dụng" title="Cài đặt ứng dụng"
      className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 text-white/80 transition hover:border-sky-200/60 hover:text-white">
      <Settings2 size={16} />{!compact && <span className="text-xs">Cài đặt</span>}
    </a>
  );
}
