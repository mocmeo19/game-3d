import { Play, RotateCcw } from 'lucide-react';
import type { MixamoClipInfo } from '../../constants/mixamoPoses';
import { clipOptions } from '../../constants/mixamoClipOptions';
import { Select } from '../../components/UI/select/Select';
import type { CombatSlotDef } from './combatCatalog';
import {
  defaultSlotConfig, SLOT_BLEND_RANGE, SLOT_REF_SPEED_RANGE, SLOT_SPEED_RANGE, type CombatSlotConfig,
} from './combatSettings';

interface Props {
  def: CombatSlotDef;
  config: CombatSlotConfig;
  clips: MixamoClipInfo[];
  previewing: boolean;
  onChange: (config: CombatSlotConfig) => void;
  onPreview: (file: string) => void;
}

const PRIORITY_LABEL: Record<CombatSlotDef['priority'], string> = { required: 'Bắt buộc', recommended: 'Nên có', advanced: 'Nâng cao' };
const BUILTIN = '';
const fieldClass = 'w-full min-w-0 rounded-lg border border-white/15 bg-[#142c35] px-2 py-1.5 text-xs text-white focus:border-sky-300 focus:outline-hidden disabled:opacity-40';
const numberOf = (value: string, fallback: number) => (value.trim() === '' || !Number.isFinite(Number(value)) ? fallback : Number(value));

/** One animation slot of the combat system: which clip fills it and how it is played. */
export function CombatSlotRow({ def, config, clips, previewing, onChange, onPreview }: Props) {
  const id = `combat-${def.id}`;
  const isDefault = JSON.stringify(config) === JSON.stringify(defaultSlotConfig(def.id));
  const fitted = def.playback === 'fitReload' || def.playback === 'fitDeploy';
  const knownFile = !config.file || clips.some((clip) => clip.file === config.file);
  const options = [
    { value: BUILTIN, label: 'Chuyển động có sẵn (không dùng clip)' },
    ...(knownFile ? [] : [{ value: config.file ?? BUILTIN, label: `${config.file} (không còn trong thư viện)` }]),
    ...clipOptions(clips),
  ];
  const set = (patch: Partial<CombatSlotConfig>) => onChange({ ...config, ...patch });
  return (
    <div className={`rounded-xl border p-3 ${previewing ? 'border-sky-300/50 bg-sky-400/10' : isDefault ? 'border-white/10 bg-black/15' : 'border-amber-200/30 bg-amber-200/5'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <label htmlFor={id} className="block text-[13px] font-medium text-white">{def.label}</label>
          <p className="mt-0.5 truncate font-mono text-[10px] text-white/40">{def.id} · {PRIORITY_LABEL[def.priority]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!isDefault && <button type="button" onClick={() => onChange(defaultSlotConfig(def.id))} aria-label={`Khôi phục mặc định ${def.label}`}
            className="flex items-center gap-1 text-[11px] text-white/55 hover:text-white"><RotateCcw size={11} /> Gốc</button>}
          <button type="button" disabled={!config.file} onClick={() => config.file && onPreview(config.file)} aria-label={`Xem thử ${def.label}`}
            className="flex items-center gap-1 text-xs text-sky-200 hover:text-white disabled:opacity-30"><Play size={12} /> Xem</button>
        </div>
      </div>
      <Select id={id} value={config.file ?? BUILTIN} options={options} onChange={(file) => set({ file: file || null })} className={fieldClass} />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[10px] text-white/55">Tốc độ (×)
          <input type="number" className={fieldClass} disabled={fitted} title={fitted ? 'Tự khớp với thời gian của hành động trong game' : undefined}
            min={SLOT_SPEED_RANGE.min} max={SLOT_SPEED_RANGE.max} step={0.05} value={config.speed}
            onChange={(event) => set({ speed: numberOf(event.target.value, config.speed) })} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-white/55">Chuyển tiếp (ms)
          <input type="number" className={fieldClass} min={SLOT_BLEND_RANGE.min} max={SLOT_BLEND_RANGE.max} step={10} value={config.blendMs}
            onChange={(event) => set({ blendMs: numberOf(event.target.value, config.blendMs) })} />
        </label>
        {def.refSpeed !== undefined && <label className="flex flex-col gap-1 text-[10px] text-white/55">Tốc độ gốc (m/s)
          <input type="number" className={fieldClass} min={SLOT_REF_SPEED_RANGE.min} max={SLOT_REF_SPEED_RANGE.max} step={0.1} value={config.refSpeed}
            onChange={(event) => set({ refSpeed: numberOf(event.target.value, config.refSpeed) })} />
        </label>}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/65">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={config.mirror} onChange={(event) => set({ mirror: event.target.checked })} /> Lật trái/phải</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={config.lockFacing} onChange={(event) => set({ lockFacing: event.target.checked })} /> Giữ hướng hông</label>
        {fitted && <span className="text-white/40">Tự khớp thời gian {def.playback === 'fitReload' ? 'nạp đạn' : 'rút súng'}</span>}
      </div>
    </div>
  );
}
