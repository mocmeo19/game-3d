import { Package } from 'lucide-react';
import { sound } from '../../../../audio/soundManager';
import { INVENTORY_CATEGORIES, type InventoryCategory } from '../inventory/inventoryItems';

/** Crates first, then the locker's categories of items on sale. */
export type ShopSection = 'crates' | InventoryCategory;

interface ShopSectionNavProps {
  selected: ShopSection;
  /** Items on sale the player does not own yet, per category. */
  counts: Record<InventoryCategory, number>;
  onSelect: (section: ShopSection) => void;
}

const sectionLabel = (id: InventoryCategory, label: string) => (id === 'weapons' ? 'Skin vũ khí' : label);

export function ShopSectionNav({ selected, counts, onSelect }: ShopSectionNavProps) {
  const entry = (id: ShopSection, label: string, count: number | null) => {
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
        <span className="flex items-center gap-1.5 truncate">{id === 'crates' && <Package size={14} aria-hidden />}{label}</span>
        {count !== null && <span className="text-[10px] font-semibold text-white/40">{count}</span>}
      </button>
    );
  };
  return (
    <nav aria-label="Mục cửa hàng" className="flex w-[140px] shrink-0 flex-col gap-0.5 overflow-y-auto no-scrollbar">
      {entry('crates', 'Quay hòm', null)}
      <span aria-hidden className="my-1 h-px bg-white/10" />
      {INVENTORY_CATEGORIES.map(({ id, label }) => entry(id, sectionLabel(id, label), counts[id]))}
    </nav>
  );
}
