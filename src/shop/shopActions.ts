import type { InventoryItem } from '../components/UI/home/inventory/inventoryItems';
import { creditWallet, CURRENCY_LABEL, debitWallet, getWalletBalances } from '../wallet/walletStore';
import { getOwnedItems, grantItems } from './ownedItemsStore';
import { ITEM_PRICE, rollCrate, type CrateDef, type Price } from './shopCatalog';

export type ShopResult<T = undefined> = { ok: true; value: T } | { ok: false; reason: string };

const SAVE_FAILED = 'Không lưu được giao dịch. Số dư không bị trừ.';

/** Pays a price and hands over the item keys; the payment is given back if the items cannot be saved. */
function payAndGrant(price: Price, keys: readonly string[]): ShopResult {
  if (getWalletBalances()[price.currency] < price.amount) return { ok: false, reason: `Không đủ ${CURRENCY_LABEL[price.currency]}.` };
  if (!debitWallet(price.currency, price.amount)) return { ok: false, reason: SAVE_FAILED };
  if (!grantItems(keys)) {
    creditWallet(price.currency, price.amount);
    return { ok: false, reason: SAVE_FAILED };
  }
  return { ok: true, value: undefined };
}

export function buyItem(item: InventoryItem): ShopResult {
  if (getOwnedItems().has(item.key)) return { ok: false, reason: 'Bạn đã sở hữu vật phẩm này.' };
  return payAndGrant(ITEM_PRICE[item.rarity], [item.key]);
}

/** Opens a crate: the prize is drawn first, so nothing is paid when every item in it is already owned. */
export function openCrate(crate: CrateDef, pool: readonly InventoryItem[]): ShopResult<InventoryItem> {
  const prize = rollCrate(crate, pool, getOwnedItems());
  if (!prize) return { ok: false, reason: 'Bạn đã sở hữu mọi vật phẩm trong hòm này.' };
  const paid = payAndGrant(crate.price, [prize.key]);
  return paid.ok ? { ok: true, value: prize } : paid;
}
