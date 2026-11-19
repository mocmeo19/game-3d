import { Check, RotateCcw, Save } from 'lucide-react';

interface Props { dirty: boolean; message: string; error: string; saving: boolean; reset: () => void }

export function SettingsActions({ dirty, message, error, saving, reset }: Props) {
  return (
    <div className="sticky bottom-0 z-10 rounded-2xl border border-white/10 bg-[#102230] p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={reset} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <RotateCcw size={14} /> Khôi phục mặc định
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-sky-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50">
          <Save size={15} /> {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
      </div>
      {dirty && <p className="mt-3 text-xs text-amber-200">Có thay đổi chưa lưu</p>}
      {message && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-200"><Check size={14} />{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-200">{error}</p>}
    </div>
  );
}
