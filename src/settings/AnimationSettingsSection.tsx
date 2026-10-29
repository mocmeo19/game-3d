import { useSettingsForm } from './useSettingsForm';
import { SettingsActions } from './SettingsActions';
import { SettingsPreview } from './SettingsPreview';
import { previewCharacter } from './previewCharacter';
import { getModelSettings } from './modelSettings';
import type { AnimationSettings } from '../game/testlab/animationSettings';
import { useEffect, useMemo, useState } from 'react';
import { AnimationSettingsPanel } from '../game/testlab/AnimationSettingsPanel';
import { Select } from '../components/UI/select/Select';
import { ROLE_LABEL, type MixCtx, type MixRole } from '../game/testlab/animationRoles';
import { type AnimationClip } from '../game/testlab/animationConfig';
import { animationSettingKey, loadAnimationSettings, saveAnimationSettings } from '../game/testlab/animationSettings';

const persistSettings = async (value: AnimationSettings) => { await saveAnimationSettings(value); return value; };

export function AnimationSettingsSection({ active = true }: { active?: boolean }) {
  const form = useSettingsForm(loadAnimationSettings, persistSettings, {});
  const settings = form.draft;
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [request, setRequest] = useState(0);
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void fetch('/animations/manifest.json', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('manifest');
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error('manifest');
      const entries: AnimationClip[] = value.flatMap((item: unknown, id) => {
        if (!item || typeof item !== 'object') return [];
        const clip = item as Record<string, unknown>;
        if (typeof clip.file !== 'string' || !/^[a-z0-9-]+\.fbx$/i.test(clip.file)
          || typeof clip.label !== 'string') return [];
        const role = typeof clip.role === 'string' && Object.hasOwn(ROLE_LABEL, clip.role) ? clip.role as MixRole : null;
        const ctx: MixCtx = clip.ctx === 'rifle' || clip.ctx === 'knife' || clip.ctx === 'sword' ? clip.ctx : null;
        return [{ id, file: clip.file, label: clip.label, role, ctx, use: null, ready: false, playing: false }];
      });
      if (!entries.length) throw new Error('manifest');
      if (!controller.signal.aborted) setClips(entries);
    }).catch(() => { if (!controller.signal.aborted) setError('Không tải được thư viện animation.'); });
    return () => controller.abort();
  }, [revision]);

  const models = getModelSettings();
  const clip = clips.find((clip) => clip.id === previewId);
  const state = useMemo(() => previewCharacter('jin_female', models, clip?.file ? `mixamo:${clip.file}` : 'idle'), [models, clip]);
  const inspect = (id: number | null) => { setPreviewId(id); setRequest((value) => value + 1); };
  return (
    <form onSubmit={form.submit} className="space-y-5">
      <p className="rounded-xl border border-sky-300/15 bg-sky-300/5 p-3 text-xs leading-relaxed text-sky-100/75">
        Chọn clip trong thư viện để xem thử. Các lựa chọn chỉ được áp dụng sau khi bấm Lưu cấu hình.
      </p>
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">
        {error}{!clips.length && <button type="button" onClick={() => setRevision((value) => value + 1)} className="underline">Thử lại</button>}
      </div>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {(!error || clips.length > 0) && <AnimationSettingsPanel autoSave={false}
        snapshot={{ mixamo: clips, animationSettings: settings, mixamoOn: true, mixamoManual: previewId }}
        onChange={(role, context, file) => {
          const next = { ...settings };
          const key = animationSettingKey(role, context);
          if (file === null) delete next[key]; else next[key] = file;
          form.update(next);
        }} onReset={form.reset} onPreview={inspect} />}
      <div className="order-first space-y-3 xl:sticky xl:top-24 xl:order-last">
        <label className="block text-xs text-slate-300">Thử clip trong thư viện
          <span className="mt-2 block">
            <Select aria-label="Thử clip trong thư viện" value={previewId === null ? '' : String(previewId)}
              onChange={(id) => inspect(id === '' ? null : Number(id))}
              options={[{ value: '', label: 'Tư thế đứng' }, ...clips.map((clip) => ({ value: String(clip.id), label: clip.label, hint: clip.file ?? undefined }))]}
              className="w-full rounded-xl border border-white/15 bg-[#142c35] px-3 py-3 text-xs" />
          </span>
        </label>
        <SettingsPreview title={clip?.label ?? 'Animation nhân vật'} state={state} active={active} request={request} />
      </div>
      </div>
      <SettingsActions {...form} />
    </form>
  );
}
