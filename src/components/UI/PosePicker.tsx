import { useState } from 'react';
import { Dices, RotateCcw, Check } from 'lucide-react';
import { PoseType } from '../../types/character';
import { STANCES } from '../../lib/useStances';
import { MPFB_PREFIX, POSE_GROUPS, poseTitle, useMpfbPoses } from '../../constants/mpfbPoses';
import { sound } from '../../audio/soundManager';
import { DANCE_POSES, dancePoseId } from '../../constants/dancePoses';
import { DancePoseGrid } from './DancePoseGrid';

const DANCE_GROUP = 'dance';

export function PosePicker({ pose, onChoose, onRandom }: {
  pose: PoseType | null;
  onChoose: (pose: PoseType | null) => void;
  onRandom: () => void;
}) {
  const [group, setGroup] = useState('basic');
  const poses = useMpfbPoses();
  const shown = poses.filter(POSE_GROUPS.find((item) => item.id === group)?.match ?? (() => true));
  const selected = poses.find((item) => MPFB_PREFIX + item.id === pose);
  const label = STANCES.find((item) => item.pose === pose)?.label
    ?? DANCE_POSES.find((item) => dancePoseId(item) === pose)?.label
    ?? (selected ? poseTitle(selected) : 'Animation');
  const choose = (next: PoseType | null) => {
    sound.playCue('pose');
    onChoose(next);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[18px] font-medium">Tạo dáng</h2>
        <button type="button" onClick={() => { sound.playClick(); onRandom(); }} className="gp-btn flex items-center gap-1.5 px-2! text-xs">
          <Dices size={14} /> Ngẫu nhiên
        </button>
      </div>
      <p className="mb-3 text-xs text-white/60">Chọn một dáng hoặc điệu nhảy để xem ngay trên nhân vật.</p>
      <div className="flex flex-wrap gap-1 mb-2" aria-label="Nhóm tạo dáng">
        {[{ id: 'basic', ko: 'Cơ bản' }, { id: DANCE_GROUP, ko: 'Điệu nhảy' }, ...POSE_GROUPS].map((item) => (
          <button type="button" key={item.id} aria-pressed={group === item.id} onClick={() => setGroup(item.id)} className={`gp-btn py-1! px-2! text-[11px] ${group === item.id ? 'is-on' : ''}`}>
            {item.ko}
          </button>
        ))}
      </div>
      <div className="max-h-[330px] overflow-y-auto border border-gp-line bg-black/40 p-1">
        {(group === 'basic' || group === 'all') && (
          <div className="grid grid-cols-2 gap-1">
            {STANCES.map((item) => (
              <button type="button" key={item.label} aria-pressed={pose === item.pose} onClick={() => choose(item.pose)} className={`gp-thumb min-h-16 p-2 text-xs flex items-center justify-between gap-2 text-left ${pose === item.pose ? 'is-sel text-amber-200' : 'text-white/80'}`}>
                {item.label}
                {pose === item.pose && <Check size={14} className="shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
        {(group === DANCE_GROUP || group === 'all') && (
          <div className={group === 'all' ? 'mt-2' : ''}><DancePoseGrid pose={pose} onChoose={choose} /></div>
        )}
        {group !== 'basic' && group !== DANCE_GROUP && (
          <div className={`grid grid-cols-3 gap-1 ${group === 'all' ? 'mt-2' : ''}`}>
            {shown.map((item) => {
              const id = (MPFB_PREFIX + item.id) as PoseType;
              return (
                <button type="button" key={item.id} aria-pressed={pose === id} title={`${poseTitle(item)} · ${item.author}`} onClick={() => choose(id)} className={`gp-thumb overflow-hidden text-left ${pose === id ? 'is-sel' : ''}`}>
                  <img src={`/poses/${item.id}.webp`} alt="" loading="lazy" draggable={false} className="aspect-square w-full object-contain bg-white/5" />
                  <span className="block truncate px-1.5 py-1 text-[10px] text-white/80">{poseTitle(item)}</span>
                </button>
              );
            })}
          </div>
        )}
        {group !== 'basic' && group !== DANCE_GROUP && shown.length === 0 && <p className="p-3 text-xs text-white/60">Chưa có dáng trong nhóm này.</p>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-amber-200 truncate" aria-live="polite">Đang chọn: {label}</p>
        <button type="button" disabled={pose === null} onClick={() => choose(null)} className="gp-btn shrink-0 flex items-center gap-1.5 px-2! text-xs">
          <RotateCcw size={13} /> Đứng nghỉ
        </button>
      </div>
    </>
  );
}
