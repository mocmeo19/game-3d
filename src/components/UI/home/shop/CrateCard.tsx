import { Package } from 'lucide-react';
import { crateOdds, type CrateDef } from '../../../../shop/shopCatalog';
import { CURRENCY_LABEL } from '../../../../wallet/walletStore';
import { RARITY_META } from '../inventory/inventoryItems';
import { PriceTag } from './PriceTag';

interface CrateCardProps {
  crate: CrateDef;
  /** Items in it the player does not own yet. */
  remaining: number;
  canAfford: boolean;
  onOpen: () => void;
}

/** A crate on sale: what it holds, the odds of each rarity, and the open button. */
export function CrateCard({ crate, remaining, canAfford, onOpen }: CrateCardProps) {
  const disabled = remaining === 0 || !canAfford;
  return (
    <article
      aria-label={crate.name}
      className="flex w-[250px] flex-col overflow-hidden rounded-md border bg-[#0b1420]/90 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      style={{ borderColor: `${crate.accent}88` }}
    >
      <div className="relative grid h-32 place-items-center" style={{ background: `radial-gradient(circle at 50% 65%, ${crate.accent}66, transparent 70%)` }}>
        <Package size={64} strokeWidth={1.4} style={{ color: crate.accent }} className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        <h3 className="text-[17px] font-black uppercase italic">{crate.name}</h3>
        <p className="text-[11px] leading-relaxed text-white/65">{crate.description}</p>
        <ul aria-label="Tỉ lệ" className="flex flex-col gap-1 text-[11px]">
          {crateOdds(crate).map(({ rarity, percent }) => (
            <li key={rarity} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: RARITY_META[rarity].color }} />{RARITY_META[rarity].label}</span>
              <span className="font-mono text-white/75">{percent}%</span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-white/45">Chỉ ra vật phẩm bạn chưa có · còn {remaining} món</p>
        <button
          type="button"
          disabled={disabled}
          onClick={onOpen}
          className="mt-auto flex h-10 items-center justify-center gap-2 rounded-sm bg-linear-to-b from-[#ffe066] to-[#f2b705] text-[14px] font-black uppercase tracking-wide text-[#1a1306] transition hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-white/45"
        >
          {remaining === 0 ? 'Đã có tất cả' : canAfford ? 'Mở hòm' : `Không đủ ${CURRENCY_LABEL[crate.price.currency]}`}
          <span className="rounded-sm bg-black/70 px-1.5 py-0.5"><PriceTag price={crate.price} size="md" /></span>
        </button>
      </div>
    </article>
  );
}
