import { equip, GRENADE_LIMIT, newWeapon, WEAPONS, type Inventory, type WeaponId } from '../../core/rules';

/** What the gun shops sell and what buying does to the inventory. Pure logic. */

export type ShopItemId = WeaponId | 'armor' | 'ammo';

export interface ShopItem {
  id: ShopItemId;
  name: string;
  price: number;
  detail: string;
}

const gun = (id: WeaponId, price: number, detail: string): ShopItem => ({ id, name: WEAPONS[id].name, price, detail });

export const GUN_SHOP: readonly ShopItem[] = [
  { id: 'armor', name: 'Áo giáp', price: 400, detail: 'Giáp đầy 100' },
  { id: 'ammo', name: 'Đạn dự trữ', price: 150, detail: 'Nạp đầy đạn cho súng đang có' },
  gun('glock', 250, 'Súng lục'),
  gun('deagle', 700, 'Súng lục uy lực'),
  gun('mp9', 1100, 'Tiểu liên'),
  gun('ump', 1300, 'Tiểu liên'),
  gun('s12k', 1600, 'Shotgun'),
  gun('ak47', 2400, 'Súng trường'),
  gun('m4a4', 2700, 'Súng trường'),
  gun('scar', 3000, 'Súng trường'),
  gun('m249', 4500, 'Súng máy'),
  gun('awp', 5000, 'Súng bắn tỉa'),
  gun('he', 300, 'Lựu đạn'),
];

export type PurchaseResult = { ok: true; money: number; message: string } | { ok: false; message: string };

const isWeaponId = (id: ShopItemId): id is WeaponId => id in WEAPONS;

/** The item is already as good as it gets (the gun carried, full armour). */
export function isOwned(item: ShopItem, inv: Inventory): boolean {
  if (item.id === 'armor') return inv.armor >= 100;
  if (item.id === 'ammo') return false;
  if (item.id === 'he') return inv.grenades.filter((g) => g === 'he').length >= (GRENADE_LIMIT.he ?? 1);
  return inv.primary?.id === item.id || inv.secondary?.id === item.id;
}

export function buy(item: ShopItem, inv: Inventory, money: number): PurchaseResult {
  if (money < item.price) return { ok: false, message: 'Không đủ tiền.' };
  if (isOwned(item, inv)) return { ok: false, message: 'Bạn đã có món này.' };
  if (item.id === 'armor') inv.armor = 100;
  else if (item.id === 'ammo') {
    const guns = [inv.primary, inv.secondary].filter((w) => w !== null);
    if (!guns.length) return { ok: false, message: 'Bạn chưa có súng để nạp đạn.' };
    for (const w of guns) w.reserve = WEAPONS[w.id].reserve;
  } else if (item.id === 'he') inv.grenades.push('he');
  else if (isWeaponId(item.id)) equip(inv, newWeapon(item.id));
  return { ok: true, money: money - item.price, message: `Đã mua ${item.name}.` };
}
