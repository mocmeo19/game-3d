import { CharacterState } from '../../types/character';
import { ASSET_INFO, assetsOf, assetUrl, equipped, SlotId, withEquipped } from '../../constants/equipment';
import { sound } from '../../audio/soundManager';

/** Thumbnail grid for one equipment slot (hair, hat, shoes …) with a "none" tile. */
export const EquipmentGrid = ({
  slot,
  state,
  onChange,
  cols = 4,
  tall = true,
  maxHeight = 232,
  noneLabel = 'Không'
}: {
  slot: SlotId;
  state: CharacterState;
  onChange: (next: CharacterState) => void;
  cols?: number;
  /** Portrait (5:7) tiles for full-body items, square for small ones. */
  tall?: boolean;
  maxHeight?: number;
  noneLabel?: string;
}) => {
  const items = assetsOf(slot, state.gender);
  const current = equipped(state, slot);
  const aspect = tall ? 'aspect-5/7' : 'aspect-square';
  const pick = (id: string | null) => {
    sound.playCue('equip');
    onChange(withEquipped(state, slot, id));
  };
  return (
    <>
      <div
        className="grid gap-1 overflow-y-auto pr-0.5 bg-black/40 p-1 border border-gp-line"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxHeight }}
      >
        <button
          title={noneLabel}
          aria-pressed={current === null}
          onClick={() => pick(null)}
          className={`gp-thumb ${current === null ? 'is-sel' : ''} ${aspect} flex items-center justify-center text-[10px] text-gp-mute`}
        >
          {noneLabel}
        </button>
        {items.map((a) => (
          <button
            key={a.id}
            title={`${a.name} · ${a.author}${a.license === 'CC0' ? '' : ' (' + a.license + ')'}`}
            aria-label={a.name}
            aria-pressed={current === a.id}
            onClick={() => pick(a.id)}
            className={`gp-thumb ${current === a.id ? 'is-sel' : ''} ${aspect} overflow-hidden`}
          >
            <img src={assetUrl(a.id, state.gender, 'png')} alt={a.name} draggable={false} className="w-full h-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gp-text truncate">{current ? ASSET_INFO[current]?.name : noneLabel}</p>
    </>
  );
};

export { MarkingIcon } from './MarkingIcon';
