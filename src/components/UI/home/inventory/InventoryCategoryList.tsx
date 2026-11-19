import { INVENTORY_CATEGORIES, type InventoryCategory } from './inventoryItems';
import { sound } from '../../../../audio/soundManager';

interface InventoryCategoryListProps {
  selected: InventoryCategory;
  counts: Record<InventoryCategory, number>;
  onSelect: (category: InventoryCategory) => void;
}

export function InventoryCategoryList({ selected, counts, onSelect }: InventoryCategoryListProps) {
  return (
    <nav aria-label="Loại vật phẩm" className="flex w-[132px] shrink-0 flex-col gap-0.5 overflow-y-auto no-scrollbar">
      {INVENTORY_CATEGORIES.map(({ id, label }) => {
        const isActive = id === selected;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isActive}
            onClick={() => { sound.playClick(); onSelect(id); }}
            className={`relative flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] font-bold uppercase tracking-wide transition ${isActive ? 'bg-linear-to-r from-[#ffd34d]/25 to-transparent text-[#ffd34d]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
          >
            <span aria-hidden className={`absolute inset-y-1 left-0 w-[3px] ${isActive ? 'bg-[#ffd34d]' : 'bg-transparent'}`} />
            <span className="truncate">{label}</span>
            <span className="text-[10px] font-semibold text-white/40">{counts[id]}</span>
          </button>
        );
      })}
    </nav>
  );
}
