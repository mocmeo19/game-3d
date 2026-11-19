import type { CharacterState, GenderType, WeaponKind } from '../../../../types/character';
import { ASSETS } from '../../../../constants/assets';
import { assetUrl, equipped, SLOTS, withEquipped, type SlotId } from '../../../../constants/equipment';
import { weaponStyleOf, weaponStyles } from '../../../../constants/weaponStyles';
import { weaponModelIcon } from '../../../../constants/weaponModels';

export type InventoryCategory = 'all' | 'outfit' | 'top' | 'bottom' | 'shoes' | 'headwear' | 'accessories' | 'weapons';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type InventoryItem =
  | { kind: 'wear'; key: string; id: string; slot: SlotId; name: string; slotLabel: string; thumbUrl: string; rarity: Rarity }
  | { kind: 'weapon'; key: string; id: string; name: string; slotLabel: string; thumbUrl: string | null; rarity: Rarity; description: string };

export const INVENTORY_CATEGORIES: { id: InventoryCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'outfit', label: 'Đồ bộ' },
  { id: 'top', label: 'Áo' },
  { id: 'bottom', label: 'Quần & váy' },
  { id: 'shoes', label: 'Giày' },
  { id: 'headwear', label: 'Mũ & kính' },
  { id: 'accessories', label: 'Phụ kiện' },
  { id: 'weapons', label: 'Vũ khí' }
];

const CATEGORY_SLOTS: Record<Exclude<InventoryCategory, 'all' | 'weapons'>, SlotId[]> = {
  outfit: ['outfit'],
  top: ['top', 'underwear_top'],
  bottom: ['pants', 'skirt', 'underwear_bottom', 'socks'],
  shoes: ['shoes'],
  headwear: ['hat', 'glasses', 'horns'],
  accessories: ['gloves', 'jewelry', 'accessory', 'wings', 'tail', 'nails']
};

const WEAR_SLOT_IDS = new Set<SlotId>(Object.values(CATEGORY_SLOTS).flat());
const slotLabel = (slot: SlotId): string => SLOTS.find((meta) => meta.id === slot)?.label ?? slot;

export const RARITY_META: Record<Rarity, { label: string; color: string; order: number }> = {
  legendary: { label: 'Huyền thoại', color: '#f2a93b', order: 0 },
  epic: { label: 'Sử thi', color: '#b06cf0', order: 1 },
  rare: { label: 'Hiếm', color: '#4aa3f0', order: 2 },
  common: { label: 'Thường', color: '#9aa4ae', order: 3 }
};

/** Items carry no rarity of their own, so one is derived from the id: stable across sessions and roughly 5/15/30/50 %. */
function itemRarity(id: string): Rarity {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  const roll = (hash >>> 0) % 100;
  if (roll < 5) return 'legendary';
  if (roll < 20) return 'epic';
  if (roll < 50) return 'rare';
  return 'common';
}

export function inventoryItems(gender: GenderType, weapon: WeaponKind): InventoryItem[] {
  const wear: InventoryItem[] = ASSETS
    .filter((asset) => WEAR_SLOT_IDS.has(asset.slot) && asset.genders.includes(gender))
    .map((asset) => ({
      kind: 'wear', key: `wear:${asset.id}`, id: asset.id, slot: asset.slot, name: asset.name,
      slotLabel: slotLabel(asset.slot), thumbUrl: assetUrl(asset.id, gender, 'png'), rarity: itemRarity(asset.id)
    }));
  const weapons: InventoryItem[] = weaponStyles(weapon).map((style) => ({
    kind: 'weapon', key: `weapon:${style.id}`, id: style.id, name: style.name, slotLabel: 'Vũ khí',
    thumbUrl: style.model ? weaponModelIcon(style.model) : null, rarity: itemRarity(style.id), description: style.desc
  }));
  return [...weapons, ...wear];
}

export function isInCategory(item: InventoryItem, category: InventoryCategory): boolean {
  if (category === 'all') return true;
  if (category === 'weapons') return item.kind === 'weapon';
  return item.kind === 'wear' && CATEGORY_SLOTS[category].includes(item.slot);
}

export function isItemEquipped(state: CharacterState, item: InventoryItem): boolean {
  if (item.kind === 'weapon') return weaponStyleOf(state.weapon, state.weaponStyle).id === item.id;
  return equipped(state, item.slot) === item.id;
}

/** Keys of the items the character wears and holds right now. */
export function wornItemKeys(state: CharacterState): string[] {
  return inventoryItems(state.gender, state.weapon).filter((item) => isItemEquipped(state, item)).map((item) => item.key);
}

export function equipItem(state: CharacterState, item: InventoryItem): CharacterState {
  if (item.kind === 'weapon') return { ...state, weaponStyle: item.id };
  return withEquipped(state, item.slot, item.id);
}

/** Weapons cannot be taken off: unequipping one goes back to the standard form. */
export function unequipItem(state: CharacterState, item: InventoryItem): CharacterState {
  if (item.kind === 'weapon') return { ...state, weaponStyle: undefined };
  return withEquipped(state, item.slot, null);
}

export type InventorySort = 'rarity' | 'name';

export function sortInventory(items: InventoryItem[], sort: InventorySort): InventoryItem[] {
  const byName = (a: InventoryItem, b: InventoryItem) => a.name.localeCompare(b.name, 'vi');
  if (sort === 'name') return [...items].sort(byName);
  return [...items].sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order || byName(a, b));
}
