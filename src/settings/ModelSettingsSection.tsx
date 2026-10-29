import { useMemo, useState } from 'react';
import type { RaceType } from '../types/character';
import { ASSET_INFO, assetUrl, skinsOf, skinThumbUrl, defaultSkin, skinInfo } from '../constants/equipment';
import { SettingsPreview } from './SettingsPreview';
import { ModelChoicePreview } from './ModelChoicePreview';
import { previewCharacter } from './previewCharacter';
import {
  BODY_MODELS, DEFAULT_MODEL_SETTINGS, RACE_NAMES, TAIL_MODELS,
  loadModelSettings, saveModelSettings, normalizeModelSettings, type BodyModel,
} from './modelSettings';
import { useSettingsForm } from './useSettingsForm';
import { SettingsActions } from './SettingsActions';
import { Select } from '../components/UI/select/Select';

const input = 'w-full rounded-lg border border-white/15 bg-[#142c35] px-3 py-2.5 text-sm text-white';
const modelLabel = (key: string) => `${RACE_NAMES[key.split('_')[0] as RaceType]} · ${key.endsWith('_male') ? 'Nam' : 'Nữ'}`;

export function ModelSettingsSection({ active = true }: { active?: boolean }) {
  const form = useSettingsForm(loadModelSettings, saveModelSettings, DEFAULT_MODEL_SETTINGS);
  const { draft, update } = form;
  const models = useMemo(() => normalizeModelSettings(draft), [draft]);
  const [slot, setSlot] = useState<BodyModel>('jin_female');
  const [request, setRequest] = useState(0);
  const [skin, setSkin] = useState<string>();
  const [tail, setTail] = useState<string | null>(null);
  const preview = useMemo(() => {
    const state = previewCharacter(slot, models, 'idle', skin);
    if (tail) state.gear = { ...state.gear, tail };
    return state;
  }, [slot, models, tail, skin]);
  const show = (slot: BodyModel) => { setSlot(slot); setTail(null); setRequest((value) => value + 1); };
  return (
    <form onSubmit={form.submit} className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold text-white">Mô hình nhân vật</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">So sánh mô hình và tỉ lệ cơ thể trong preview 3D trước khi lưu.</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
            {(Object.keys(RACE_NAMES) as RaceType[]).map((race) => <fieldset key={race}
              className="min-w-0 rounded-2xl border border-white/10 bg-white/2.5 p-5">
              <legend className="px-2 text-sm font-semibold text-sky-100">Tộc {RACE_NAMES[race]}</legend>
              <div className="space-y-4">
                {BODY_MODELS.filter((key) => key.startsWith(`${race}_`)).map((slot) => <div key={slot} className="text-xs text-slate-300">
                  <label className="block space-y-1.5">
                    <span>Mô hình {modelLabel(slot)}</span>
                    <Select<BodyModel> aria-label={`Mô hình ${modelLabel(slot)}`} value={draft.bodies[slot]} className={input}
                      onChange={(model) => {
                        update({ ...draft, bodies: { ...draft.bodies, [slot]: model } });
                        show(slot);
                      }}
                      options={BODY_MODELS.filter((model) => model.split('_')[1] === slot.split('_')[1])
                        .map((model) => ({ value: model, label: modelLabel(model), hint: `${model}.glb` }))} />
                  </label>
                  <ModelChoicePreview model={draft.bodies[slot]} onPreview={() => show(slot)} />
                </div>)}
                <label className="block space-y-1.5 text-xs text-slate-300">Tỉ lệ cơ thể · {RACE_NAMES[race]}
                  <input type="number" required min="0.5" max="1.5" step="0.01" className={input}
                    value={Number.isFinite(draft.raceScale[race]) ? draft.raceScale[race] : ''}
                    onChange={(event) => {
                      update({ ...draft, raceScale: { ...draft.raceScale, [race]: event.target.valueAsNumber } });
                      setSlot(`${race}_female`);
                    }} />
                </label>
              </div>
            </fieldset>)}
          </div>
          <section className="rounded-2xl border border-white/10 bg-white/2.5 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Đặc điểm Lyn</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {([{ key: 'lynFluffyTail', label: 'Mẫu đuôi xù' }, { key: 'lynSlenderTail', label: 'Mẫu đuôi thon' }] as const)
                .map(({ key, label }) => <label key={key} className="space-y-1.5 text-xs text-slate-300">{label}
                  <Select aria-label={label} className={input} value={draft[key]} onChange={(tail) => {
                    update({ ...draft, [key]: tail });
                    setSlot('lyn_female'); setTail(tail); setRequest((value) => value + 1);
                  }} options={TAIL_MODELS.map((id) => ({ value: id, label: ASSET_INFO[id]?.name ?? id }))} />
                  <img src={assetUrl(draft[key], 'female', 'png')} alt={`Xem trước ${label.toLowerCase()}`}
                    loading="lazy" className="mt-2 h-32 w-full rounded-xl border border-white/10 bg-black/20 object-contain" />
                </label>)}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">Đuôi chọn trong Trang phục được ưu tiên. Tai thú chưa có mẫu.</p>
          </section>
          <p className="text-xs leading-relaxed text-slate-500">Thanh chỉnh chiều cao của nhân vật được tính cùng tỉ lệ cơ thể.</p>
        </div>
        <div className="order-first space-y-3 xl:sticky xl:top-24 xl:order-last">
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#102430] p-3 text-xs text-slate-300">
            <img src={skinThumbUrl(skin ?? defaultSkin(preview.gender))} alt="Skin dùng thử" className="h-12 w-12 rounded-lg object-cover" />
            <span className="min-w-0 flex-1">Skin dùng thử
              <span className="mt-1 block">
                <Select aria-label="Skin dùng thử" value={skin ?? defaultSkin(preview.gender)}
                  onChange={(next) => { setSkin(next); setRequest((value) => value + 1); }}
                  options={skinsOf(preview.gender).map((item) => ({ value: item.id, label: item.name }))}
                  className="w-full rounded-lg border border-white/15 bg-[#142c35] px-2 py-2 text-xs text-white" />
              </span>
            </span>
          </label>
          {skinInfo(skin, preview.gender)?.warning && <p className="rounded-xl border border-amber-200/20 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-200">{skinInfo(skin, preview.gender)?.warning}</p>}
          <SettingsPreview title={modelLabel(slot)} state={preview} models={models} active={active} request={request} />
        </div>
      </div>
      <SettingsActions {...form} />
    </form>
  );
}
