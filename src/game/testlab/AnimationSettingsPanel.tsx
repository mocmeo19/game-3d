import { useState } from 'react';
import { Hand, Swords, RotateCcw } from 'lucide-react';
import { type LabSnapshot, type MixCtx, type MixRole } from './TestLabEngine';
import { ACTION_ROLES, MOVEMENT_ROLES, POSTURE_ROLES } from './animationConfig';
import { AnimationSettingRow } from './AnimationSettingRow';

interface Props {
  autoSave?: boolean;
  snapshot: Pick<LabSnapshot, 'mixamo' | 'animationSettings' | 'mixamoOn' | 'mixamoManual'>;
  onChange: (role: MixRole, context: MixCtx, file: string | null) => Promise<void> | void;
  onPreview?: (id: number | null) => void;
  onEnable?: () => void;
  onReset: () => Promise<void> | void;
}
const WEAPON_GROUPS = [
  { id: 'rifle', label: 'Súng' }, { id: 'knife', label: 'Dao' },
  { id: 'sword', label: 'Vũ khí lớp' }, { id: 'grenade', label: 'Lựu đạn' },
] as const;

export function AnimationSettingsPanel({ snapshot, onChange, onPreview, onEnable, onReset, autoSave = true }: Props) {
  const [group, setGroup] = useState<'unarmed' | 'weapons'>('unarmed');
  const [weapon, setWeapon] = useState<typeof WEAPON_GROUPS[number]['id']>('rifle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const commit = async (save: () => Promise<void> | void) => {
    setSaving(true);
    setSaveError('');
    try { await save(); }
    catch { setSaveError('Không lưu được cấu hình animation. Hãy thử lại.'); }
    finally { setSaving(false); }
  };
  const clips = snapshot.mixamo.filter((clip) => clip.file);
  const context = group === 'unarmed' || weapon === 'grenade' ? null : weapon;
  const combat: MixRole[] = weapon === 'rifle' ? ['fire', 'reload'] : weapon === 'knife' ? ['stab', 'slash'] : [];
  const sections = group === 'weapons' && weapon === 'grenade'
    ? [{ title: 'Ném lựu đạn', roles: ['throw'] as MixRole[] }]
    : [
      ...(group === 'weapons' && combat.length ? [{ title: 'Chiến đấu', roles: combat }] : []),
      { title: 'Di chuyển', roles: MOVEMENT_ROLES },
      { title: 'Tư thế', roles: POSTURE_ROLES },
      { title: 'Hành động', roles: ACTION_ROLES },
    ];
  const activePreview = snapshot.mixamo.find((clip) => clip.id === snapshot.mixamoManual);
  return (
    <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
      <header>
        <h2 className="text-base font-semibold text-sky-100">Cấu hình animation</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/55">
          {autoSave ? 'Chọn chuyển động theo cách trang bị. Thay đổi được tự động lưu trên trình duyệt này.' : 'Thử clip trên nhân vật, chọn cho từng hành động rồi lưu khi đã hài lòng.'}
        </p>
      </header>
      {saving && <p role="status" className="text-xs text-sky-200">Đang lưu…</p>}
      {saveError && <p role="alert" className="text-xs text-red-200">{saveError}</p>}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
        {(['unarmed', 'weapons'] as const).map((id) => {
          const Icon = id === 'unarmed' ? Hand : Swords;
          return <button type="button" key={id} aria-pressed={group === id} onClick={() => setGroup(id)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm transition-colors ${group === id ? 'bg-sky-400/20 text-sky-100' : 'text-white/55 hover:bg-white/5'}`}>
            <Icon size={16} /> {id === 'unarmed' ? 'Tay không' : 'Vũ khí'}
          </button>;
        })}
      </div>
      {group === 'weapons' && <div className="grid grid-cols-4 gap-1">
        {WEAPON_GROUPS.map((item) => <button type="button" key={item.id} aria-pressed={weapon === item.id}
          onClick={() => setWeapon(item.id)}
          className={`rounded-lg border px-1 py-2 text-xs ${weapon === item.id ? 'border-sky-300/40 bg-sky-400/10 text-sky-100' : 'border-white/10 text-white/55 hover:bg-white/5'}`}>
          {item.label}
        </button>)}
      </div>}
      {group === 'weapons' && context && <p className="text-xs leading-relaxed text-white/50">
        Đặt clip riêng khi cầm {WEAPON_GROUPS.find((item) => item.id === weapon)?.label.toLowerCase()}.
        Các mục chưa tùy chỉnh dùng clip mặc định hoặc kế thừa thiết lập tay không.
      </p>}
      {!snapshot.mixamoOn && onEnable && <button type="button" onClick={onEnable}
        className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-2 text-xs text-amber-100">
        Bật animation để dùng cấu hình
      </button>}
      {snapshot.mixamoManual !== null && onPreview && <div className="rounded-xl border border-sky-300/25 bg-sky-400/10 p-3 text-xs">
        <p className="mb-2 text-sky-100">Đang xem thử: {activePreview?.label ?? 'Animation'}</p>
        <button type="button" onClick={() => onPreview(null)} className="text-sky-200 underline">
          Kết thúc xem thử · trở về hành động tự động
        </button>
      </div>}
      {!clips.length && <p role="status" className="text-xs text-white/50">Đang tải danh sách animation…</p>}
      {clips.length > 0 && sections.map((section) => <section key={section.title}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">{section.title}</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {section.roles.map((role) => <AnimationSettingRow key={`${context}-${role}`} role={role} context={context}
            clips={clips} settings={snapshot.animationSettings}
            onChange={(role, ctx, file) => { void commit(() => onChange(role, ctx, file)); }} onPreview={onPreview} />)}
        </div>
      </section>)}
      {clips.length > 0 && <button type="button" onClick={() => { void commit(onReset); }}
        className="flex items-center justify-center gap-2 rounded-lg border border-white/15 p-2.5 text-xs text-white/60 hover:bg-white/5">
        <RotateCcw size={13} /> Khôi phục toàn bộ animation mặc định
      </button>}
    </fieldset>
  );
}
