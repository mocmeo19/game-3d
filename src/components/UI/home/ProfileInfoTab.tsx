import { Copy } from 'lucide-react';
import type { CharacterState } from '../../../types/character';
import { WEAPON_KINDS } from '../../../constants/weaponKinds';
import { resolveVoice } from '../../../constants/voices';
import { encodeShareCode } from '../../../lib/persistence';

interface ProfileInfoTabProps {
  characterState: CharacterState;
  createdAt: string | null;
  onNotify: (message: string) => void;
}

export function ProfileInfoTab({ characterState, createdAt, onNotify }: ProfileInfoTabProps) {
  const weapon = WEAPON_KINDS[characterState.weapon];
  const voice = resolveVoice(characterState.voice, characterState.gender);
  const created = createdAt ? new Date(createdAt).toLocaleString('vi-VN') : '—';
  const rows: [string, string][] = [
    ['Giới tính', characterState.gender === 'female' ? 'Nữ' : 'Nam'],
    ['Vũ khí', weapon.name],
    ['Ngày tạo', created],
    ['Giọng nói', voice.ko]
  ];

  const copyShareCode = async () => {
    try {
      await navigator.clipboard.writeText(encodeShareCode(characterState));
      onNotify('Đã sao chép mã nhân vật');
    } catch {
      onNotify('Không dùng được clipboard');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] text-[#ffd34d]">{weapon.badge} {weapon.name}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/80">{weapon.description}</p>
      </div>
      <dl className="grid grid-cols-[96px_1fr] gap-y-2 rounded-md border border-white/10 bg-black/25 p-3 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-white/55">{label}</dt>
            <dd className="text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => { void copyShareCode(); }}
        className="flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] text-white hover:bg-white/20"
      >
        <Copy size={13} /> Sao chép mã nhân vật
      </button>
    </div>
  );
}
