import { useState, type ReactNode } from 'react';
import { Check, RotateCcw, Save } from 'lucide-react';
import { LAB_WEAPONS, LAB_ZONES } from './labCatalog';
import { Select } from '../../components/UI/select/Select';
import { DEFAULT_GAME_SETTINGS, GAME_NUMBER_FIELDS, type GameSettings } from './gameSettings';

interface Props {
  settings: GameSettings;
  inGame?: boolean;
  renderPreview?: (settings: GameSettings) => ReactNode;
  onSave: (settings: GameSettings) => Promise<void>;
}
const inputClass = 'w-full rounded-lg border border-white/15 bg-[#142c35] px-3 py-2 text-sm text-white focus:border-sky-300 focus:outline-hidden';

export function GameSettingsPanel({ settings, onSave, inGame = true, renderPreview }: Props) {
  const [draft, setDraft] = useState(() => ({ ...settings }));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);
  const update = (next: GameSettings) => {
    setDraft(next);
    setMessage('');
    setError('');
  };
  return (
    <form className="flex flex-col gap-4" onSubmit={async (event) => {
      event.preventDefault();
      if (saving) return;
      setSaving(true);
      try {
        await onSave(draft);
        setMessage(inGame ? 'Đã lưu và áp dụng. Lần mở game sau sẽ tự động nạp cấu hình này.' : 'Đã lưu. Cấu hình sẽ tự động nạp khi mở Test Nhân Vật.');
        setError('');
      } catch {
        setError('Không lưu được cấu hình trên trình duyệt này. Hãy thử lại.');
        setMessage('');
      }
      finally { setSaving(false); }
    }}>
      <header>
        <h2 className="text-base font-semibold text-sky-100">Cấu hình game</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/55">
          Thông số mặc định cho Test Nhân Vật, được lưu trên trình duyệt này và tự động nạp khi mở game.
        </p>
      </header>
      {renderPreview?.(draft)}
      {['Di chuyển & vật lý', 'Camera', 'Khởi động game'].map((group) => <section key={group}
        className="rounded-xl border border-white/10 bg-black/15 p-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/55">{group}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GAME_NUMBER_FIELDS.filter((field) => field.group === group).map((field) => <label key={field.key}
            className="flex flex-col gap-1.5 text-xs text-white/75">
            <span>{field.label} <span className="text-white/40">({field.unit})</span></span>
            <input type="number" required min={field.min} max={field.max} step={field.step}
              value={Number.isFinite(draft[field.key]) ? draft[field.key] : ''} className={inputClass}
              onChange={(event) => update({ ...draft, [field.key]: event.target.valueAsNumber })} />
          </label>)}
          {group === 'Khởi động game' && <>
            <label className="flex flex-col gap-1.5 text-xs text-white/75">Trang bị ban đầu
              <Select<GameSettings['startWeapon']> className={inputClass} value={draft.startWeapon}
                onChange={(startWeapon) => update({ ...draft, startWeapon })}
                options={LAB_WEAPONS.map((weapon) => ({ value: weapon.id, label: weapon.label }))} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-white/75">Vị trí xuất hiện
              <Select className={inputClass} value={draft.startZone} onChange={(startZone) => update({ ...draft, startZone })}
                options={LAB_ZONES.map((zone) => ({ value: zone.id, label: zone.label }))} />
            </label>
          </>}
        </div>
      </section>)}
      <p className="text-xs leading-relaxed text-white/45">
        {inGame ? 'Lưu sẽ áp dụng ngay và đưa nhân vật về vị trí, trang bị ban đầu đã chọn.' : 'Cấu hình sẽ được áp dụng khi mở Test Nhân Vật.'}
        Tốc độ di chuyển còn chịu ảnh hưởng của thể hình, ngắm bắn và mang vật thể.
      </p>
      <div className="sticky bottom-0 flex flex-col gap-2 rounded-xl border border-white/10 bg-[#102430] p-3">
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-lg bg-sky-300 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:opacity-50">
          <Save size={15} /> {saving ? 'Đang lưu…' : inGame ? 'Lưu & áp dụng' : 'Lưu cấu hình game'}
        </button>
        <button type="button" onClick={() => update({ ...DEFAULT_GAME_SETTINGS })}
          className="flex items-center justify-center gap-2 py-1 text-xs text-white/60 hover:text-white">
          <RotateCcw size={13} /> Đặt lại thông số gốc
        </button>
        {dirty && !message && <p className="text-center text-xs text-amber-200">Có thay đổi chưa lưu</p>}
        {message && <p role="status" className="flex gap-1.5 text-xs text-emerald-200"><Check size={14} className="shrink-0" />{message}</p>}
        {error && <p role="alert" className="text-xs text-red-200">{error}</p>}
      </div>
    </form>
  );
}
