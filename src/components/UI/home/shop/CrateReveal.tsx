import { useEffect, useState } from 'react';
import { Swords } from 'lucide-react';
import { sound } from '../../../../audio/soundManager';
import type { CrateReel } from '../../../../shop/shopCatalog';
import { RARITY_META } from '../inventory/inventoryItems';

interface CrateRevealProps {
  crateName: string;
  reel: CrateReel;
  onEquip: () => void;
  onClose: () => void;
}

const TILE_PX = 96;
const GAP_PX = 8;
const WINDOW_PX = 520;
const SPIN_MS = 4200;

/** Opening a crate: a strip of items races past a marker and slows to a stop on the prize, which is then shown big. */
export function CrateReveal({ crateName, reel, onEquip, onClose }: CrateRevealProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const prize = reel.items[reel.prizeIndex];
  const rarity = RARITY_META[prize.rarity];
  const stop = reel.prizeIndex * (TILE_PX + GAP_PX) + TILE_PX / 2 + reel.landing * TILE_PX - WINDOW_PX / 2;

  useEffect(() => {
    // without motion the prize is shown at once
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsRevealed(true);
      return;
    }
    const frame = requestAnimationFrame(() => setIsSpinning(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (isRevealed) sound.playTriumph();
  }, [isRevealed]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Mở ${crateName}`} className="fixed inset-0 z-80 grid place-items-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-5 text-white">
        <h2 className="text-[20px] font-black uppercase italic tracking-wide">{crateName}</h2>
        <div className="relative h-[124px] w-full max-w-[520px] overflow-hidden rounded-md border border-white/15 bg-[#0b1420]">
          <ul
            aria-hidden
            className="absolute top-3 left-0 flex gap-2"
            style={{
              transform: `translateX(${isSpinning || isRevealed ? -stop : 0}px)`,
              transition: isSpinning && !isRevealed ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.1, 1)` : undefined,
            }}
            onTransitionEnd={() => setIsRevealed(true)}
          >
            {reel.items.map((item, index) => (
              <li
                key={index}
                className="flex h-[100px] shrink-0 flex-col overflow-hidden rounded-sm border border-white/10"
                style={{ width: TILE_PX, background: `linear-gradient(180deg, #1a2433 0%, ${RARITY_META[item.rarity].color}55 100%)` }}
              >
                <span className="flex min-h-0 flex-1 items-center justify-center p-1">
                  {item.thumbUrl ? <img src={item.thumbUrl} alt="" draggable={false} className="h-full w-full object-contain" /> : <Swords size={28} className="text-white/70" />}
                </span>
                <span className="h-[3px]" style={{ background: RARITY_META[item.rarity].color }} />
              </li>
            ))}
          </ul>
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#ffd34d] shadow-[0_0_10px_#ffd34d]" />
        </div>

        {isRevealed ? (
          <div className="flex flex-col items-center gap-3 animate-rise-in">
            <p role="status" className="text-[12px] uppercase tracking-[0.25em] text-white/60">Bạn nhận được</p>
            <p className="text-[22px] font-black uppercase italic" style={{ color: rarity.color }}>{prize.name}</p>
            <p className="text-[12px] text-white/60">{rarity.label} · {prize.kind === 'weapon' ? 'Skin vũ khí' : prize.slotLabel}</p>
            <div className="flex gap-2">
              <button type="button" onClick={onEquip} className="h-10 rounded-sm bg-linear-to-b from-[#ffe066] to-[#f2b705] px-5 text-[13px] font-black uppercase text-[#1a1306] hover:brightness-110">Trang bị ngay</button>
              <button type="button" onClick={onClose} autoFocus className="h-10 rounded-sm border border-white/30 px-5 text-[13px] font-bold uppercase text-white hover:bg-white/10">Đóng</button>
            </div>
          </div>
        ) : (
          <p role="status" className="text-[12px] uppercase tracking-[0.25em] text-white/60">Đang mở hòm…</p>
        )}
      </div>
    </div>
  );
}
