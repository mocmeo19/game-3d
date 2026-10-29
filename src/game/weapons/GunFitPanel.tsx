import { RotateCcw } from 'lucide-react';
import type { GunModelFit } from './gunModelCatalog';
import { FIT_FIELDS } from './gunModelSettings';

interface Props {
  title: string;
  fit: GunModelFit;
  isDefault: boolean;
  onChange: (fit: GunModelFit) => void;
  onReset: () => void;
}

const fieldClass = 'w-full min-w-0 rounded-lg border border-white/15 bg-[#142c35] px-2 py-1.5 text-xs text-white focus:border-sky-300 focus:outline-hidden';

/** Corrections to how one model sits in the hand: its real length, which way it points and where it is held and fired from. */
export function GunFitPanel({ title, fit, isDefault, onChange, onReset }: Props) {
  return (
    <section aria-labelledby="gun-fit-title" className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="gun-fit-title" className="text-sm font-semibold text-white">Căn chỉnh · {title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/50">Áp dụng cho mọi vũ khí dùng mô hình này. Xem kết quả ở khung xem trước.</p>
        </div>
        {!isDefault && <button type="button" onClick={onReset} className="flex shrink-0 items-center gap-1 text-[11px] text-white/55 hover:text-white">
          <RotateCcw size={11} /> Gốc
        </button>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FIT_FIELDS.map((field) => <label key={field.key} className="flex flex-col gap-1 text-[11px] text-white/65">
          {field.label}{field.unit && ` (${field.unit})`}
          <input type="number" className={fieldClass} min={field.min} max={field.max} step={field.step} value={fit[field.key]}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (event.target.value.trim() === '' || !Number.isFinite(value)) return;
              onChange({ ...fit, [field.key]: value });
            }} />
        </label>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
        <label className="flex items-center gap-2"><input type="checkbox" checked={fit.flipBarrel} onChange={(event) => onChange({ ...fit, flipBarrel: event.target.checked })} /> Đảo hướng nòng</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={fit.flipUp} onChange={(event) => onChange({ ...fit, flipUp: event.target.checked })} /> Lật trên / dưới</label>
      </div>
    </section>
  );
}
