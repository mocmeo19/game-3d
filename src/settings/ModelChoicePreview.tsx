import { Eye } from 'lucide-react';
import { RACE_NAMES, type BodyModel } from './modelSettings';
import type { RaceType } from '../types/character';

export function ModelChoicePreview({ model, onPreview }: { model: BodyModel; onPreview: () => void }) {
  const race = model.split('_')[0] as RaceType;
  return (
    <button type="button" onClick={onPreview}
      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-2 text-left hover:border-sky-300/40 hover:bg-sky-300/5">
      <img src={`/races/${race}.jpg`} alt="" loading="lazy" className="h-12 w-12 rounded-lg object-cover object-top" />
      <span className="min-w-0 flex-1"><span className="block text-xs text-slate-200">{RACE_NAMES[race]} · {model.endsWith('_male') ? 'Nam' : 'Nữ'}</span>
        <span className="mt-1 block text-[10px] text-slate-500">Xem mô hình thực tế trong 3D</span></span>
      <Eye size={15} className="mr-1 text-sky-200" />
    </button>
  );
}
