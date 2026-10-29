import { useState } from 'react';
import { CharacterState } from '../../types/character';
import { ASSET_INFO, equipped, SLOTS, SlotId, FACE_HAIR_SLOTS } from '../../constants/equipment';
import { HAIR_PALETTE } from '../../constants/presets';
import { sound } from '../../audio/soundManager';
import { EquipmentGrid } from './EquipmentGrid';
import { WearSlotTabs } from './WearSlotTabs';

/** Shared clothing and dye controls for character creation and the character profile. */
export function CostumeEditor({ characterState, onUpdateState, maxHeight = 232 }: {
  characterState: CharacterState;
  onUpdateState: (state: CharacterState) => void;
  maxHeight?: number;
}) {
  const [wearSlot, setWearSlot] = useState<SlotId>('outfit');
  const cos = characterState.cosmetics;

  return (
    <div className="flex gap-1.5">
      {/* the tab column scrolls inside the height of the panel next to it instead of stretching the editor */}
      <div className="relative w-9 shrink-0">
        <div className="no-scrollbar absolute inset-0 overflow-y-auto overflow-x-hidden">
          <WearSlotTabs characterState={characterState} selectedSlot={wearSlot} onSelectSlot={setWearSlot} />
        </div>
      </div>
      <div role="tabpanel" aria-label={SLOTS.find((sl) => sl.id === wearSlot)?.label} className="flex-1 min-w-0">
      <EquipmentGrid
        key={wearSlot}
        slot={wearSlot}
        state={characterState}
        onChange={onUpdateState}
        cols={wearSlot === 'outfit' || wearSlot === 'skirt' || wearSlot === 'pants' || wearSlot === 'top' ? 4 : 5}
        tall={wearSlot === 'outfit' || wearSlot === 'skirt' || wearSlot === 'pants' || wearSlot === 'top'}
        maxHeight={maxHeight}
        noneLabel="Không mặc"
      />
      
      {(() => {
        // each worn piece has its own colour; legacy main/accent colours still apply until a piece is coloured
        const slotLabel = SLOTS.find((sl) => sl.id === wearSlot)?.label ?? '';
        const wornId = equipped(characterState, wearSlot);
        const own = cos.wearColors?.[wearSlot];
        const legacy = ['shoes', 'jewelry', 'accessory'].includes(wearSlot) ? cos.outfitAccent : cos.outfitMain;
        const value = own || legacy || ASSET_INFO[wornId ?? '']?.color || '#888888';
        const current = value.toLowerCase();
        const setWear = (hex: string | undefined) => {
          const next = { ...(cos.wearColors ?? {}) };
          if (hex) next[wearSlot] = hex;
          else delete next[wearSlot];
          onUpdateState({ ...characterState, cosmetics: { ...cos, wearColors: next } });
        };
        const allSlots = SLOTS.filter((sl) => sl.group === 'wear' && equipped(characterState, sl.id)).map((sl) => sl.id);
        return (
          <>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-white">
                Màu: <span className="text-gp-hot">{slotLabel}</span>
                {!wornId && <span className="text-gp-mute"> (chưa mặc)</span>}
              </span>
              <span className="w-4 h-4 border border-white/40" style={{ background: value }} title={value} />
            </div>
            <div className={`mt-1 grid grid-cols-12 gap-[3px] bg-black/40 p-1.5 border border-gp-line ${wornId ? '' : 'opacity-40 pointer-events-none'}`}>
              {HAIR_PALETTE.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  aria-label={c}
                  aria-pressed={current === c.toLowerCase()}
                  onClick={() => {
                    sound.playClick();
                    setWear(c);
                  }}
                  className={`aspect-square border ${current === c.toLowerCase() ? 'border-white ring-2 ring-gp-hot z-10 scale-110' : 'border-black/60'} transition-transform`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-1.5 flex-wrap">
              <label className={`flex items-center gap-2 text-[11px] text-gp-text cursor-pointer ${wornId ? '' : 'opacity-40 pointer-events-none'}`}>
                <input
                  type="color"
                  value={value}
                  onChange={(e) => setWear(e.target.value)}
                  aria-label={`Màu ${slotLabel} tùy chọn`}
                  className="gp-color w-6 h-6 rounded-full border border-gp-line"
                />
                Tùy chọn
              </label>
              <div className="flex gap-1">
                <button
                  className="gp-btn py-0.5! px-2! text-[10px]"
                  disabled={!own}
                  title={`Trả ${slotLabel} về màu gốc`}
                  onClick={() => {
                    sound.playClick();
                    setWear(undefined);
                  }}
                >
                  Đặt lại
                </button>
                <button
                  className="gp-btn py-0.5! px-2! text-[10px]"
                  disabled={!wornId || allSlots.length < 2}
                  title="Nhuộm mọi món đang mặc bằng màu này"
                  onClick={() => {
                    sound.playClick();
                    const next = { ...(cos.wearColors ?? {}) };
                    allSlots.forEach((id) => (next[id] = value));
                    onUpdateState({ ...characterState, cosmetics: { ...cos, wearColors: next } });
                  }}
                >
                  Áp cho tất cả
                </button>
                <button
                  className="gp-btn py-0.5! px-2! text-[10px]"
                  disabled={!Object.keys(cos.wearColors ?? {}).some((k) => !(FACE_HAIR_SLOTS as string[]).includes(k))}
                  title="Trả mọi món về màu gốc"
                  onClick={() => {
                    sound.playClick();
                    // brow / lash / beard colours live in the same map but are not clothes
                    const kept = Object.fromEntries(Object.entries(cos.wearColors ?? {}).filter(([k]) => (FACE_HAIR_SLOTS as string[]).includes(k)));
                    onUpdateState({ ...characterState, cosmetics: { ...cos, wearColors: kept, outfitMain: undefined, outfitAccent: undefined } });
                  }}
                >
                  Gốc hết
                </button>
              </div>
            </div>
          </>
        );
      })()}
      </div>
    </div>
  );
}
