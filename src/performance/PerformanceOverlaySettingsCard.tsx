import { useState } from 'react';
import { Select } from '../components/UI/select/Select';
import type { SelectOption } from '../components/UI/select/selectModel';
import {
  savePerformanceOverlaySettings, usePerformanceOverlaySettings,
  type PerformanceOverlayCorner, type PerformanceOverlaySettings,
} from './performanceOverlaySettings';

const CORNER_OPTIONS: SelectOption<PerformanceOverlayCorner>[] = [
  { value: 'top-left', label: 'Góc trên trái' }, { value: 'top-right', label: 'Góc trên phải' },
  { value: 'bottom-left', label: 'Góc dưới trái' }, { value: 'bottom-right', label: 'Góc dưới phải' },
];

/** Saved and applied immediately, separate from the render-quality form that needs the Save button. */
export function PerformanceOverlaySettingsCard() {
  const settings = usePerformanceOverlaySettings();
  const [hasSaveError, setHasSaveError] = useState(false);

  const applySettings = (next: PerformanceOverlaySettings) => {
    setHasSaveError(false);
    savePerformanceOverlaySettings(next).catch(() => setHasSaveError(true));
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/2.5 p-5">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-sm text-slate-200">Hiện FPS và RAM</span>
          <span className="mt-1 block text-xs text-slate-500">Hiện trên mọi màn hình. Tự động lưu. RAM chỉ đo được trên Chrome/Edge.</span>
        </span>
        <input type="checkbox" checked={settings.isVisible} onChange={(event) => applySettings({ ...settings, isVisible: event.target.checked })}
          className="h-5 w-5 shrink-0 accent-sky-300" />
      </label>
      <label className="block space-y-2 text-sm text-slate-200">Vị trí
        <Select<PerformanceOverlayCorner> aria-label="Vị trí thống kê FPS và RAM" value={settings.corner}
          onChange={(corner) => applySettings({ ...settings, corner })} options={CORNER_OPTIONS} disabled={!settings.isVisible}
          className="w-full rounded-lg border border-white/15 bg-[#142c35] px-3 py-3 text-sm text-white" />
      </label>
      {hasSaveError && <p role="alert" className="text-xs text-rose-300">Không lưu được cài đặt. Thử lại.</p>}
    </section>
  );
}
