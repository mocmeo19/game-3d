import { Swords } from 'lucide-react';
import { ITEM_PRICE } from '../../../../shop/shopCatalog';
import { CURRENCY_LABEL } from '../../../../wallet/walletStore';
import { RARITY_META, type InventoryItem } from '../inventory/inventoryItems';
import { PriceTag } from './PriceTag';

interface ShopItemDetailProps {
  item: InventoryItem;
  isOwned: boolean;
  isEquipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onTopUp: () => void;
}

const primaryButton = 'flex h-10 w-full items-center justify-center gap-2 rounded-sm text-[14px] font-black uppercase tracking-wide transition';

/** The selected shop item: preview, rarity, price and the buy (or equip, once owned) button. */
export function ShopItemDetail({ item, isOwned, isEquipped, canAfford, onBuy, onEquip, onTopUp }: ShopItemDetailProps) {
  const rarity = RARITY_META[item.rarity];
  const price = ITEM_PRICE[item.rarity];
  return (
    <section aria-label="Chi tiết vật phẩm" className="w-[300px] max-w-full overflow-hidden rounded-md border border-white/15 bg-[#0b1420]/90 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm">
      <div className="relative flex h-36 items-center justify-center" style={{ background: `radial-gradient(circle at 50% 60%, ${rarity.color}55, transparent 70%)` }}>
        {item.thumbUrl
          ? <img src={item.thumbUrl} alt="" draggable={false} className="h-full object-contain p-2" />
          : <Swords aria-hidden size={56} className="text-white/70" />}
        <span className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#0b1420]" style={{ background: rarity.color }}>{rarity.label}</span>
      </div>
      <div className="px-3 py-2.5">
        <h3 className="truncate text-[16px] font-extrabold uppercase italic">{item.name}</h3>
        <p className="text-[11px] text-white/55">{item.kind === 'weapon' ? 'Skin vũ khí' : item.slotLabel}{isOwned ? ' · Đã sở hữu' : ' · Đang mặc thử trên nhân vật'}</p>
        {item.kind === 'weapon' && <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">{item.description}</p>}
        <div className="mt-3 flex flex-col gap-2">
          {isOwned ? (
            <button type="button" disabled={isEquipped} onClick={onEquip} className={`${primaryButton} border border-white/30 text-white hover:bg-white/10 disabled:opacity-50`}>
              {isEquipped ? 'Đang trang bị' : 'Trang bị'}
            </button>
          ) : canAfford ? (
            <button type="button" onClick={onBuy} className={`${primaryButton} bg-linear-to-b from-[#ffe066] to-[#f2b705] text-[#1a1306] hover:brightness-110`}>
              Mua <span className="rounded-sm bg-black/70 px-1.5 py-0.5"><PriceTag price={price} size="md" /></span>
            </button>
          ) : (
            <>
              <button type="button" disabled className={`${primaryButton} border border-white/15 text-white/50`}>
                Không đủ {CURRENCY_LABEL[price.currency]} · <PriceTag price={price} size="md" />
              </button>
              {price.currency === 'diamonds'
                ? <button type="button" onClick={onTopUp} className="text-[12px] font-semibold text-[#6fd8ff] underline-offset-2 hover:underline">Nạp Kim cương</button>
                : <p className="text-center text-[11px] text-white/50">Chơi game để kiếm thêm Vàng.</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
