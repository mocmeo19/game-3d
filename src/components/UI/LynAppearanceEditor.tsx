import type { CharacterState } from '../../types/character';

interface Props {
  cosmetics: CharacterState['cosmetics'];
  onChange: (cosmetics: CharacterState['cosmetics']) => void;
}

export function LynAppearanceEditor({ cosmetics, onChange }: Props) {
  return (
    <div className="mt-2 space-y-2 border-t border-gp-line pt-2">
      <div className="text-[11px] text-gp-mute">Đặc điểm Lyn</div>
      <p className="text-[11px] text-gp-mute">Tai thú · Chưa có mẫu</p>
      <div className="grid grid-cols-2 gap-1">
        {([
          ['fox_bushy', 'Đuôi xù'], ['cat_slender', 'Đuôi mèo thon'],
        ] as const).map(([id, label]) => <button type="button" key={id}
          onClick={() => onChange({ ...cosmetics, tailType: id })}
          className={`gp-btn px-1! ${cosmetics.tailType === id ? 'is-on' : ''}`}>
          {label}
        </button>)}
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-gp-text">
        <input type="color" value={cosmetics.furColorPrimary} aria-label="Màu lông đuôi"
          onChange={(event) => onChange({ ...cosmetics, furColorPrimary: event.target.value })}
          className="gp-color h-6 w-6 rounded-full border border-gp-line" />
        Màu lông đuôi
      </label>
    </div>
  );
}
