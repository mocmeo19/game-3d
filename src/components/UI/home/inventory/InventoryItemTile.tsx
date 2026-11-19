import { Check, Swords } from 'lucide-react';
import { RARITY_META, type InventoryItem } from './inventoryItems';

interface InventoryItemTileProps {
  item: InventoryItem;
  isSelected: boolean;
  isEquipped: boolean;
  onSelect: () => void;
  onQuickEquip: () => void;
}

/** Grid tile: thumbnail on a rarity-tinted card; click selects it, double-click equips or takes it off. */
export function InventoryItemTile({ item, isSelected, isEquipped, onSelect, onQuickEquip }: InventoryItemTileProps) {
  const rarity = RARITY_META[item.rarity];
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`${item.name}, ${rarity.label}${isEquipped ? ', đang trang bị' : ''}`}
      onClick={onSelect}
      onDoubleClick={onQuickEquip}
      className={`group relative flex aspect-[4/5] flex-col overflow-hidden rounded-sm border text-left transition focus-visible:outline-2 focus-visible:outline-[#ffd34d] ${isSelected ? 'border-[#ffd34d] shadow-[0_0_0_1px_#ffd34d]' : 'border-white/10 hover:border-white/40'}`}
      style={{ background: `linear-gradient(180deg, #1a2433 0%, ${rarity.color}40 100%)` }}
    >
      <span className="flex min-h-0 flex-1 items-center justify-center p-1.5">
        {item.thumbUrl
          ? <img src={item.thumbUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain transition-transform group-hover:scale-105" />
          : <Swords aria-hidden size={30} className="text-white/70" />}
      </span>
      <span className="truncate bg-black/55 px-1.5 py-1 text-[10px] font-semibold text-white/90">{item.name}</span>
      <span aria-hidden className="h-[3px] w-full" style={{ background: rarity.color }} />
      {isEquipped && (
        <span aria-hidden className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#ffd34d] text-[#1a1306]">
          <Check size={11} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}
