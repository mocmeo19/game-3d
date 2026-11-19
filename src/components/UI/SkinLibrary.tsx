import { defaultSkin, skinInfo, skinsOf, skinThumbUrl } from '../../constants/equipment';
import type { CharacterState } from '../../types/character';

export function SkinLibrary({ state, onPick }: {
  state: CharacterState; onPick: (id: string, color: string) => void;
}) {
  const selected = state.skin ?? defaultSkin(state.gender);
  const current = skinInfo(selected, state.gender);
  return (
    <>
      <div className="grid max-h-[150px] grid-cols-5 gap-1 overflow-y-auto border border-gp-line bg-black/40 p-1 pr-0.5">
        {skinsOf(state.gender).map((skin) => <button type="button" key={skin.id} aria-label={skin.name}
          title={skin.warning ? `${skin.name} · ${skin.warning}` : skin.name} aria-pressed={selected === skin.id}
          onClick={() => onPick(skin.id, skin.color)}
          className={`gp-thumb relative aspect-square overflow-hidden ${selected === skin.id ? 'is-sel' : ''}`}>
          <img src={skinThumbUrl(skin.id)} alt={skin.name} draggable={false} className="h-full w-full object-cover" loading="lazy" />
          {skin.warning && <span className="absolute bottom-0 inset-x-0 bg-amber-950/90 text-[8px] text-amber-200">Cần chỉnh UV</span>}
        </button>)}
      </div>
      <p className="mt-1 text-[11px] text-gp-text">{current?.name}</p>
      {current?.warning && <p className="mt-1 text-[10px] leading-relaxed text-amber-200">{current.warning}</p>}
    </>
  );
}
