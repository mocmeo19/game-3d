import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import type { CharacterState } from '../../../../types/character';
import { sound } from '../../../../audio/soundManager';
import { buildReel, CRATES, isSoldInShop, ITEM_PRICE, type CrateReel, type Price } from '../../../../shop/shopCatalog';
import { buyItem, openCrate } from '../../../../shop/shopActions';
import { useOwnedItems } from '../../../../shop/useOwnedItems';
import { useWalletBalances } from '../../../../wallet/useWalletBalances';
import { WalletBadge } from '../WalletBadge';
import {
  INVENTORY_CATEGORIES, equipItem, inventoryItems, isInCategory, isItemEquipped, sortInventory,
  type InventoryCategory, type InventoryItem
} from '../inventory/inventoryItems';
import { CrateCard } from './CrateCard';
import { CrateReveal } from './CrateReveal';
import { ShopItemDetail } from './ShopItemDetail';
import { ShopItemTile } from './ShopItemTile';
import { ShopSectionNav, type ShopSection } from './ShopSectionNav';

interface ShopScreenProps {
  characterState: CharacterState;
  onUpdateState: (state: CharacterState) => void;
  /** Shows a try-on look on the stage (null: the character as it is). */
  onPreview: (state: CharacterState | null) => void;
  onOpenTopUp: () => void;
  onNotify: (message: string) => void;
  onClose: () => void;
}

/** The shop over the lobby stage: crates to open, and the outfits and weapon skins on sale, tried on the character before buying. */
export function ShopScreen({ characterState, onUpdateState, onPreview, onOpenTopUp, onNotify, onClose }: ShopScreenProps) {
  const [section, setSection] = useState<ShopSection>('crates');
  const [query, setQuery] = useState('');
  const [isHidingOwned, setIsHidingOwned] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ crateName: string; reel: CrateReel } | null>(null);
  const owned = useOwnedItems();
  const balances = useWalletBalances();

  const { gender, weapon } = characterState;
  const forSale = useMemo(() => inventoryItems(gender, weapon).filter(isSoldInShop), [gender, weapon]);
  const counts = useMemo(
    () => Object.fromEntries(INVENTORY_CATEGORIES.map(({ id }) => [id, forSale.filter((item) => isInCategory(item, id) && !owned.has(item.key)).length])) as Record<InventoryCategory, number>,
    [forSale, owned]
  );
  const canAfford = (price: Price) => balances[price.currency] >= price.amount;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = section === 'crates'
    ? []
    : sortInventory(
      forSale.filter((item) => isInCategory(item, section)
        && (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
        && (!isHidingOwned || !owned.has(item.key))),
      'rarity'
    );
  const selectedItem = forSale.find((item) => item.key === selectedKey) ?? null;

  const select = (item: InventoryItem) => {
    sound.playClick();
    setSelectedKey(item.key);
    onPreview(equipItem(characterState, item));
  };

  const equip = (item: InventoryItem) => {
    sound.playCue('equip');
    onPreview(null);
    onUpdateState(equipItem(characterState, item));
  };

  const buy = (item: InventoryItem) => {
    const result = buyItem(item);
    if (!result.ok) {
      sound.playCue('error');
      onNotify(result.reason);
      return;
    }
    sound.playCue('save');
    onNotify(`Đã mua ${item.name}. Vật phẩm đã vào Kho đồ.`);
  };

  const open = (crateId: string) => {
    const crate = CRATES.find((candidate) => candidate.id === crateId);
    if (!crate) return;
    const result = openCrate(crate, forSale);
    if (!result.ok) {
      sound.playCue('error');
      onNotify(result.reason);
      return;
    }
    setReveal({ crateName: crate.name, reel: buildReel(forSale, result.value) });
  };

  const close = () => {
    onPreview(null);
    onClose();
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col animate-fade-in"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || reveal) return;
        event.stopPropagation();
        close();
      }}
    >
      <div aria-hidden className="absolute inset-y-0 left-0 w-[820px] max-w-full bg-linear-to-r from-[#060b12]/95 via-[#060b12]/85 to-transparent" />

      <header className="relative flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
        <button type="button" aria-label="Đóng cửa hàng" onClick={close} className="grid h-9 w-9 place-items-center rounded-sm border border-white/20 bg-black/40 text-white/80 hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <span aria-hidden className="h-6 w-1 rounded-full bg-[#ffd34d]" />
        <h2 className="text-[22px] font-black uppercase italic tracking-wide text-white text-shadow">Cửa hàng</h2>
        <div className="ml-auto">
          <WalletBadge onOpenTopUp={onOpenTopUp} />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 gap-3 px-5 pb-5">
        <ShopSectionNav selected={section} counts={counts} onSelect={(next) => { setSection(next); setSelectedKey(null); onPreview(null); }} />

        {section === 'crates' ? (
          <section aria-label="Quay hòm" className="flex min-h-0 flex-1 flex-wrap content-start gap-4 overflow-y-auto">
            {CRATES.map((crate) => (
              <CrateCard
                key={crate.id}
                crate={crate}
                remaining={forSale.filter((item) => !owned.has(item.key) && crate.weights[item.rarity] > 0).length}
                canAfford={canAfford(crate.price)}
                onOpen={() => open(crate.id)}
              />
            ))}
          </section>
        ) : (
          <>
            <section aria-label="Vật phẩm đang bán" className="flex min-h-0 w-[540px] max-w-[calc(100vw-200px)] flex-col">
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
                <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-white/15 bg-black/40 px-2 text-[12px] text-white/75">
                  <input type="checkbox" checked={isHidingOwned} onChange={(event) => setIsHidingOwned(event.target.checked)} className="accent-[#ffd34d]" />
                  Ẩn đồ đã có
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {visibleItems.length === 0
                  ? <p className="py-10 text-center text-[12px] text-white/50">Không có vật phẩm phù hợp.</p>
                  : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
                      {visibleItems.map((item) => (
                        <ShopItemTile key={item.key} item={item} isOwned={owned.has(item.key)} isSelected={item.key === selectedKey} onSelect={() => select(item)} />
                      ))}
                    </div>
                  )}
              </div>
            </section>
            <div className="ml-auto flex items-end">
              {selectedItem
                ? (
                  <ShopItemDetail
                    item={selectedItem}
                    isOwned={owned.has(selectedItem.key)}
                    isEquipped={isItemEquipped(characterState, selectedItem)}
                    canAfford={canAfford(ITEM_PRICE[selectedItem.rarity])}
                    onBuy={() => buy(selectedItem)}
                    onEquip={() => equip(selectedItem)}
                    onTopUp={onOpenTopUp}
                  />
                )
                : <p className="rounded-sm bg-black/50 px-3 py-2 text-[12px] text-white/60">Chọn một vật phẩm để mặc thử và xem giá</p>}
            </div>
          </>
        )}
      </div>

      {reveal && (
        <CrateReveal
          crateName={reveal.crateName}
          reel={reveal.reel}
          onEquip={() => { equip(reveal.reel.items[reveal.reel.prizeIndex]); setReveal(null); }}
          onClose={() => setReveal(null)}
        />
      )}
    </div>
  );
}
