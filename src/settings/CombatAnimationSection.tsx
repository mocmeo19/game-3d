import { useMemo, useState } from 'react';
import { useMixamoClips } from '../constants/mixamoPoses';
import { COMBAT_GROUPS, COMBAT_SLOTS, type CombatGroup } from '../games/core/combat/combatCatalog';
import { defaultCombatSettings, loadCombatSettings, saveCombatSettings } from '../games/core/combat/combatSettings';
import { CombatSlotRow } from '../games/core/combat/CombatSlotRow';
import { CombatTuningPanel } from '../games/core/combat/CombatTuningPanel';
import { previewCharacter } from './previewCharacter';
import { SettingsActions } from './SettingsActions';
import { SettingsPreview } from './SettingsPreview';
import { useSettingsForm } from './useSettingsForm';

/** Settings → Chiến đấu: the clip, timing and blend of every combat animation slot of the battle game (see game.md). */
export function CombatAnimationSection({ active = true }: { active?: boolean }) {
  const form = useSettingsForm(loadCombatSettings, saveCombatSettings, defaultCombatSettings());
  const settings = form.draft;
  const clips = useMixamoClips();
  const [group, setGroup] = useState<CombatGroup>('locomotion');
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const state = useMemo(() => previewCharacter('female', previewFile ? `mixamo:${previewFile}` : 'idle'), [previewFile]);
  const groupInfo = COMBAT_GROUPS.find((item) => item.id === group);
  const preview = (file: string) => {
    setPreviewFile(file);
    setRequest((value) => value + 1);
  };
  return (
    <form onSubmit={form.submit} className="space-y-5">
      <p className="rounded-xl border border-sky-300/15 bg-sky-300/5 p-3 text-xs leading-relaxed text-sky-100/75">
        Animation chiến đấu của Nam’s Battle Royal, dùng cho cả góc nhìn thứ nhất và thứ ba. Mỗi mục là một animation trong game.md;
        chọn clip trong thư viện, tốc độ và thời gian chuyển tiếp. Khi giữ chuột phải để ngắm, súng dùng tư thế ngắm có sẵn để thẳng
        thước ngắm. Lưu cấu hình rồi vào trận mới để áp dụng.
      </p>
      <label className="flex items-center gap-2 text-sm text-white">
        <input type="checkbox" checked={settings.enabled} onChange={(event) => form.update({ ...settings, enabled: event.target.checked })} />
        Dùng animation từ thư viện (tắt: chỉ dùng chuyển động có sẵn)
      </label>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <fieldset disabled={!settings.enabled} className="min-w-0 space-y-4 disabled:opacity-50">
          <div role="group" aria-label="Nhóm animation" className="flex flex-wrap gap-1.5">
            {COMBAT_GROUPS.map((item) => <button type="button" key={item.id} aria-pressed={group === item.id} onClick={() => setGroup(item.id)}
              className={`rounded-lg border px-3 py-2 text-xs ${group === item.id ? 'border-sky-300/40 bg-sky-400/15 text-sky-100' : 'border-white/10 text-white/60 hover:bg-white/5'}`}>
              {item.label}
            </button>)}
          </div>
          {groupInfo && <p className="text-xs text-white/50">{groupInfo.detail}</p>}
          {!clips.length && <p role="status" className="text-xs text-white/50">Đang tải thư viện animation…</p>}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {COMBAT_SLOTS.filter((def) => def.group === group).map((def) => <CombatSlotRow key={def.id} def={def} config={settings.slots[def.id]}
              clips={clips} previewing={!!previewFile && previewFile === settings.slots[def.id]?.file}
              onChange={(config) => form.update({ ...settings, slots: { ...settings.slots, [def.id]: config } })} onPreview={preview} />)}
          </div>
          <CombatTuningPanel group="additive" title="Lớp cộng thêm (Additive)" tuning={settings.tuning}
            description="Không cần clip riêng: thân trên nghiêng theo góc ngắm, giật theo từng phát bắn, nghiêng người (Q / E) và phản ứng theo hướng trúng đạn."
            onChange={(tuning) => form.update({ ...settings, tuning })} />
          </fieldset>
          <CombatTuningPanel group="camera" title="Camera và vị trí súng" tuning={settings.tuning}
            description="Vị trí camera sau lưng nhân vật, khi giữ chuột phải để ngắm qua vai (kiểu PUBG), và vị trí tay cầm súng ở góc nhìn thứ nhất. Súng có ống ngắm vẫn vào ống ngắm."
            onChange={(tuning) => form.update({ ...settings, tuning })} />
        </div>
        <div className="order-first space-y-3 xl:sticky xl:top-24 xl:order-last">
          <SettingsPreview title={clips.find((clip) => clip.file === previewFile)?.label ?? 'Animation chiến đấu'} state={state} active={active} request={request} />
          <p className="text-[11px] leading-relaxed text-white/45">
            Xem thử phát clip lặp lại trên nhân vật mẫu. Lật trái/phải, giữ hướng hông và các lớp cộng thêm chỉ thấy trong game.
          </p>
        </div>
      </div>
      <SettingsActions {...form} />
    </form>
  );
}
