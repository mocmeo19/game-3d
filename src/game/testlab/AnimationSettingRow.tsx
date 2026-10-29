import { Play } from 'lucide-react';
import { Select } from '../../components/UI/select/Select';
import { clipOptions } from '../../constants/mixamoClipOptions';
import { ROLE_LABEL, type MixCtx, type MixRole } from './animationRoles';
import { type AnimationClip, resolveAnimation } from './animationConfig';
import { animationSettingKey, BUILTIN_ANIMATION, type AnimationSettings } from './animationSettings';

interface Props {
  role: MixRole;
  context: MixCtx;
  clips: AnimationClip[];
  settings: AnimationSettings;
  onChange: (role: MixRole, context: MixCtx, file: string | null) => void;
  onPreview?: (id: number) => void;
}

export function AnimationSettingRow({ role, context, clips, settings, onChange, onPreview }: Props) {
  const key = animationSettingKey(role, context);
  const selected = settings[key] ?? '';
  const inherited = { ...settings };
  delete inherited[key];
  const defaultClip = resolveAnimation(clips, inherited, role, context);
  const preview = resolveAnimation(clips, settings, role, context);
  return (
    <div className={`rounded-xl border p-3 ${selected ? 'border-sky-300/35 bg-sky-400/5' : 'border-white/10 bg-black/15'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={`animation-${key}`} className="text-[13px] font-medium">{ROLE_LABEL[role]}</label>
        {onPreview && <button type="button" disabled={!preview} onClick={() => preview && onPreview(preview.id)}
          aria-label={`Xem thử ${ROLE_LABEL[role]}`}
          className="flex items-center gap-1 text-xs text-sky-200 hover:text-white disabled:opacity-30">
          <Play size={12} /> Xem
        </button>}
      </div>
      <Select id={`animation-${key}`} value={selected} onChange={(file) => onChange(role, context, file || null)}
        options={[
          { value: '', label: `Mặc định · ${defaultClip?.label ?? 'Chuyển động có sẵn'}` },
          { value: BUILTIN_ANIMATION, label: 'Chuyển động có sẵn' },
          ...clipOptions(clips),
        ]}
        className="w-full min-w-0 rounded-lg border border-white/15 bg-[#142c35] px-2 py-2 text-xs text-white focus:border-sky-300 focus:outline-hidden" />
      <p className="mt-1.5 text-[10px] text-white/45">{selected ? 'Đã tùy chỉnh' : 'Theo cấu hình mặc định'}</p>
    </div>
  );
}
