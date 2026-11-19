import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import type { CharacterState } from '../../../../types/character';
import {
  INVENTORY_CATEGORIES, equipItem, inventoryItems, isInCategory, isItemEquipped, sortInventory, unequipItem,
  type InventoryCategory, type InventoryItem, type InventorySort
} from './inventoryItems';
import { InventoryCategoryList } from './InventoryCategoryList';
import { InventoryItemTile } from './InventoryItemTile';
import { InventoryItemDetail } from './InventoryItemDetail';
import { sound } from '../../../../audio/soundManager';
import { useOwnedItems } from '../../../../shop/useOwnedItems';

interface InventoryScreenProps {
  characterState: CharacterState;
  onUpdateState: (state: CharacterState) => void;
  onSaveOutfit: () => Promise<void>;
  savingOutfit: boolean;
  onSaveWeapon: () => Promise<void>;
  savingWeapon: boolean;
  onClose: () => void;
  onOpenShop: () => void;
}

/** Full-screen locker over the lobby stage: categories left, item grid, live preview on the character, detail card right. */
export function InventoryScreen(props: InventoryScreenProps) {
  const { characterState, onUpdateState, onClose } = props;
  const [category, setCategory] = useState<InventoryCategory>('all');
  const [sort, setSort] = useState<InventorySort>('rarity');
  const [query, setQuery] = useState('');
  const [isEquippedOnly, setIsEquippedOnly] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { gender, weapon } = characterState;
  const owned = useOwnedItems();
  // only what the player owns: bought in the shop, won from a crate, or worn when the shop first opened
  const allItems = useMemo(() => inventoryItems(gender, weapon).filter((item) => owned.has(item.key)), [gender, weapon, owned]);
  const counts = useMemo(
    () => Object.fromEntries(INVENTORY_CATEGORIES.map(({ id }) => [id, allItems.filter((item) => isInCategory(item, id)).length])) as Record<InventoryCategory, number>,
    [allItems]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = sortInventory(
    allItems.filter((item) => isInCategory(item, category)
      && (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
      && (!isEquippedOnly || isItemEquipped(characterState, item))),
    sort
  );
  const selectedItem = allItems.find((item) => item.key === selectedKey) ?? null;

  const toggleEquip = (item: InventoryItem) => {
    sound.playCue('equip');
    onUpdateState(isItemEquipped(characterState, item) ? unequipItem(characterState, item) : equipItem(characterState, item));
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col animate-fade-in"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div aria-hidden className="absolute inset-y-0 left-0 w-[760px] max-w-full bg-linear-to-r from-[#060b12]/95 via-[#060b12]/85 to-transparent" />

      <header className="relative flex items-center gap-3 px-5 pt-4 pb-3">
        <button type="button" aria-label="Đóng kho đồ" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-sm border border-white/20 bg-black/40 text-white/80 hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <span aria-hidden className="h-6 w-1 rounded-full bg-[#ffd34d]" />
        <h2 className="text-[22px] font-black uppercase italic tracking-wide text-white text-shadow">Kho đồ</h2>
        <span className="text-[12px] text-white/50">{allItems.length} vật phẩm</span>
      </header>

      <div className="relative flex min-h-0 flex-1 gap-3 px-5 pb-5">
        <InventoryCategoryList selected={category} counts={counts} onSelect={(next) => { setCategory(next); setSelectedKey(null); }} />

        <section aria-label="Vật phẩm" className="flex min-h-0 w-[540px] max-w-[calc(100vw-200px)] flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-sm border border-white/15 bg-black/40 px-2 text-white/60 focus-within:border-[#ffd34d]/70">
              <Search size={14} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm vật phẩm"
                aria-label="Tìm vật phẩm"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/35"
              />
            </label>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value === 'name' ? 'name' : 'rarity')}
              aria-label="Sắp xếp"
              className="h-8 rounded-sm border border-white/15 bg-[#0b1420] px-2 text-[12px] text-white"
            >
              <option value="rarity">Độ hiếm</option>
              <option value="name">Tên A–Z</option>
            </select>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-white/15 bg-black/40 px-2 text-[12px] text-white/75">
              <input type="checkbox" checked={isEquippedOnly} onChange={(event) => setIsEquippedOnly(event.target.checked)} className="accent-[#ffd34d]" />
              Đang trang bị
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {visibleItems.length === 0
              ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center text-[12px] text-white/50">
                  <p>{allItems.length === 0 ? 'Kho đồ đang trống.' : 'Không có vật phẩm phù hợp.'}</p>
                  <button type="button" onClick={props.onOpenShop} className="rounded-sm border border-[#ffd34d]/60 bg-[#ffd34d]/10 px-3 py-1.5 font-semibold text-[#ffe9a6] hover:bg-[#ffd34d]/20">
                    Đến Cửa hàng
                  </button>
                </div>
              )
              : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
                  {visibleItems.map((item) => (
                    <InventoryItemTile
                      key={item.key}
                      item={item}
                      isSelected={item.key === selectedKey}
                      isEquipped={isItemEquipped(characterState, item)}
                      onSelect={() => { sound.playClick(); setSelectedKey(item.key); }}
                      onQuickEquip={() => toggleEquip(item)}
                    />
                  ))}
                </div>
              )}
          </div>
        </section>

        <div className="ml-auto flex items-end">
          {selectedItem
            ? (
              <InventoryItemDetail
                item={selectedItem}
                isEquipped={isItemEquipped(characterState, selectedItem)}
                isSaving={selectedItem.kind === 'weapon' ? props.savingWeapon : props.savingOutfit}
                onToggleEquip={() => toggleEquip(selectedItem)}
                onSave={() => { void (selectedItem.kind === 'weapon' ? props.onSaveWeapon() : props.onSaveOutfit()); }}
              />
            )
            : <p className="rounded-sm bg-black/50 px-3 py-2 text-[12px] text-white/60">Chọn một vật phẩm để xem chi tiết · Nhấn đúp để trang bị nhanh</p>}
        </div>
      </div>
    </div>
  );
}
