import { Check, Swords } from 'lucide-react';
import { ITEM_PRICE } from '../../../../shop/shopCatalog';
import { RARITY_META, type InventoryItem } from '../inventory/inventoryItems';
import { PriceTag } from './PriceTag';

interface ShopItemTileProps {
  item: InventoryItem;
  isOwned: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

/** A shop grid tile: the item on a rarity-tinted card with its price, or "owned". */
export function ShopItemTile({ item, isOwned, isSelected, onSelect }: ShopItemTileProps) {
  const rarity = RARITY_META[item.rarity];
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`${item.name}, ${rarity.label}${isOwned ? ', đã sở hữu' : ''}`}
      onClick={onSelect}
      className={`group relative flex aspect-[4/5] flex-col overflow-hidden rounded-sm border text-left transition focus-visible:outline-2 focus-visible:outline-[#ffd34d] ${isSelected ? 'border-[#ffd34d] shadow-[0_0_0_1px_#ffd34d]' : 'border-white/10 hover:border-white/40'}`}
      style={{ background: `linear-gradient(180deg, #1a2433 0%, ${rarity.color}40 100%)` }}
    >
      <span className={`flex min-h-0 flex-1 items-center justify-center p-1.5 ${isOwned ? 'opacity-55' : ''}`}>
        {item.thumbUrl
          ? <img src={item.thumbUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain transition-transform group-hover:scale-105" />
          : <Swords aria-hidden size={30} className="text-white/70" />}
      </span>
      <span className="truncate bg-black/55 px-1.5 pt-1 text-[10px] font-semibold text-white/90">{item.name}</span>
      <span className="flex h-5 items-center bg-black/55 px-1.5 pb-0.5">
        {isOwned
          ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300"><Check size={11} strokeWidth={3} aria-hidden /> Đã có</span>
          : <PriceTag price={ITEM_PRICE[item.rarity]} />}
      </span>
      <span aria-hidden className="h-[3px] w-full" style={{ background: rarity.color }} />
    </button>
  );
}
