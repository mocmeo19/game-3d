import { useMemo } from 'react';
import { SettingsPreview } from './SettingsPreview';
import { previewCharacter } from './previewCharacter';
import { SettingsActions } from './SettingsActions';
import { DEFAULT_RENDER_SETTINGS, loadRenderSettings, saveRenderSettings } from './renderSettings';
import { useSettingsForm } from './useSettingsForm';
import { Select } from '../components/UI/select/Select';
import { PerformanceOverlaySettingsCard } from '../performance/PerformanceOverlaySettingsCard';

const PIXEL_RATIO_OPTIONS = [
  { value: '0.75', label: '0.75× · Nhẹ' }, { value: '1', label: '1× · Tiết kiệm' },
  { value: '1.5', label: '1.5× · Cân bằng' }, { value: '2', label: '2× · Sắc nét' },
];

export function RenderSettingsSection({ active = true }: { active?: boolean }) {
  const form = useSettingsForm(loadRenderSettings, saveRenderSettings, DEFAULT_RENDER_SETTINGS);
  const { draft, update } = form;
  const character = useMemo(() => previewCharacter('female'), []);
  return (
    <form onSubmit={form.submit} className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold text-white">Hiển thị & hiệu năng</h2>
        <p className="mt-2 text-sm text-slate-400">Thiết lập chất lượng cho màn hình 3D và tất cả các game.</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { name: 'Nhẹ', pixelRatio: 1, shadows: false, antialias: false },
          { name: 'Cân bằng', pixelRatio: 1.5, shadows: true, antialias: true },
          { name: 'Sắc nét', pixelRatio: 2, shadows: true, antialias: true },
        ].map(({ name, ...preset }) => <button key={name} type="button" onClick={() => update(preset)}
          aria-pressed={JSON.stringify(preset) === JSON.stringify(draft)}
          className={`rounded-xl border p-3 text-xs ${draft.pixelRatio === preset.pixelRatio && draft.shadows === preset.shadows && draft.antialias === preset.antialias ? 'border-sky-300/50 bg-sky-300/10 text-sky-100' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
          <span className="block font-medium">{name}</span><span className="mt-1 block text-[10px] opacity-60">{preset.pixelRatio}×</span>
        </button>)}
      </div>
      <section className="space-y-6 rounded-2xl border border-white/10 bg-white/2.5 p-5">
        <label className="block space-y-2 text-sm text-slate-200">Giới hạn độ phân giải render
          <Select aria-label="Giới hạn độ phân giải render" value={String(draft.pixelRatio)} onChange={(ratio) => update({ ...draft, pixelRatio: Number(ratio) })}
            options={PIXEL_RATIO_OPTIONS} className="w-full rounded-lg border border-white/15 bg-[#142c35] px-3 py-3 text-sm text-white" />
        </label>
        {([
          { key: 'shadows', label: 'Đổ bóng', detail: 'Tắt để giảm tải GPU khi có nhiều vật thể.' },
          { key: 'antialias', label: 'Khử răng cưa', detail: 'Làm mịn cạnh mô hình và vật thể.' },
        ] as const).map(({ key, label, detail }) => <label key={key} className="flex cursor-pointer items-center justify-between gap-4">
          <span><span className="block text-sm text-slate-200">{label}</span>
            <span className="mt-1 block text-xs text-slate-500">{detail}</span></span>
          <input type="checkbox" checked={draft[key]} onChange={(event) => update({ ...draft, [key]: event.target.checked })}
            className="h-5 w-5 shrink-0 accent-sky-300" />
        </label>)}
      </section>
      <p className="text-xs leading-relaxed text-slate-500">
        Game có thể dùng độ phân giải thấp hơn giới hạn này để giữ tốc độ khung hình.
        Thay đổi được áp dụng khi mở lại màn hình 3D hoặc game.
      </p>
      <PerformanceOverlaySettingsCard />
      </div>
      <div className="order-first xl:sticky xl:top-24 xl:order-last">
        <SettingsPreview title="Chất lượng hình ảnh" state={character} render={draft} active={active} />
      </div>
      </div>
      <SettingsActions {...form} />
    </form>
  );
}
