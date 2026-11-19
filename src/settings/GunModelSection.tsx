import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Select } from '../components/UI/select/Select';
import { WEAPONS, type WeaponId } from '../games/core/rules';
import { GUN_MODELS, gunModel } from '../games/core/weapons/gunModelCatalog';
import { defaultGunModelSettings, loadGunModelSettings, saveGunModelSettings } from '../games/core/weapons/gunModelSettings';
import { GunFitPanel } from '../games/core/weapons/GunFitPanel';
import { GunModelPreview } from '../games/core/weapons/GunModelPreview';
import { SettingsActions } from './SettingsActions';
import { useSettingsForm } from './useSettingsForm';

const BUILTIN = '';
const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
const MODEL_OPTIONS = [
  { value: BUILTIN, label: 'Mô hình khối có sẵn' },
  ...GUN_MODELS.map((model) => ({ value: model.id, label: model.label, hint: `Nguồn: ${model.source}` })),
];
const fieldClass = 'w-full min-w-0 rounded-lg border border-white/15 bg-[#142c35] px-2.5 py-2 text-xs text-white';

/** Settings → Vũ khí: the 3D model of each weapon of the battle game and how each model sits in the hand. */
export function GunModelSection() {
  const form = useSettingsForm(loadGunModelSettings, saveGunModelSettings, defaultGunModelSettings());
  const settings = form.draft;
  const [weapon, setWeapon] = useState<WeaponId>('ak47');
  const modelId = settings.assignments[weapon];
  const fit = modelId ? settings.fits[modelId] : null;
  const def = modelId ? gunModel(modelId) : undefined;
  return (
    <form onSubmit={form.submit} className="space-y-5">
      <p className="rounded-xl border border-sky-300/15 bg-sky-300/5 p-3 text-xs leading-relaxed text-sky-100/75">
        Mô hình 3D của từng vũ khí trong Nam’s Battle Royal: trên tay nhân vật, góc nhìn thứ nhất, bot và súng rơi dưới đất.
        Lưu cấu hình rồi vào trận mới để áp dụng.
      </p>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {WEAPON_IDS.map((id) => {
            const selected = id === weapon;
            return <li key={id} className={`rounded-xl border p-3 ${selected ? 'border-sky-300/50 bg-sky-400/10' : 'border-white/10 bg-black/15'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor={`gun-${id}`} className="text-[13px] font-medium text-white">{WEAPONS[id].name}</label>
                <button type="button" aria-pressed={selected} onClick={() => setWeapon(id)}
                  className="flex items-center gap-1 text-xs text-sky-200 hover:text-white">
                  <SlidersHorizontal size={12} /> {selected ? 'Đang chỉnh' : 'Xem & chỉnh'}
                </button>
              </div>
              <Select id={`gun-${id}`} value={settings.assignments[id] ?? BUILTIN} options={MODEL_OPTIONS} className={fieldClass}
                onChange={(model) => {
                  form.update({ ...settings, assignments: { ...settings.assignments, [id]: model || null } });
                  setWeapon(id);
                }} />
            </li>;
          })}
        </ul>
        <div className="order-first space-y-3 xl:sticky xl:top-24 xl:order-last">
          <p className="text-xs font-semibold text-white">{WEAPONS[weapon].name} · {def?.label ?? 'Mô hình khối có sẵn'}</p>
          <GunModelPreview modelId={modelId} fit={fit} />
          {def && fit && <GunFitPanel title={def.label} fit={fit}
            isDefault={JSON.stringify(fit) === JSON.stringify(def.fit)}
            onChange={(next) => form.update({ ...settings, fits: { ...settings.fits, [def.id]: next } })}
            onReset={() => form.update({ ...settings, fits: { ...settings.fits, [def.id]: { ...def.fit } } })} />}
        </div>
      </div>
      <SettingsActions {...form} />
    </form>
  );
}
