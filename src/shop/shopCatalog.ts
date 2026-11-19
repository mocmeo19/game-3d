import type { InventoryItem, Rarity } from '../components/UI/home/inventory/inventoryItems';
import type { Currency } from '../wallet/walletStore';

export interface Price {
  currency: Currency;
  amount: number;
}

/** Everyday items cost gold earned by playing; epic and legendary ones cost topped-up diamonds. */
export const ITEM_PRICE: Record<Rarity, Price> = {
  common: { currency: 'gold', amount: 600 },
  rare: { currency: 'gold', amount: 1800 },
  epic: { currency: 'diamonds', amount: 120 },
  legendary: { currency: 'diamonds', amount: 360 },
};

export interface CrateDef {
  id: string;
  name: string;
  description: string;
  price: Price;
  /** Chance of each rarity, in relative weights. */
  weights: Record<Rarity, number>;
  accent: string;
}

export const CRATES: readonly CrateDef[] = [
  {
    id: 'supply', name: 'Hòm Tiếp Tế', description: 'Trang phục và skin vũ khí đủ loại, đôi khi có món hiếm.',
    price: { currency: 'gold', amount: 1500 }, weights: { common: 60, rare: 28, epic: 10, legendary: 2 }, accent: '#4aa3f0',
  },
  {
    id: 'elite', name: 'Hòm Tinh Anh', description: 'Chỉ từ Hiếm trở lên, tỉ lệ Sử thi và Huyền thoại cao.',
    price: { currency: 'diamonds', amount: 90 }, weights: { common: 0, rare: 55, epic: 35, legendary: 10 }, accent: '#f2a93b',
  },
];

const RARITIES: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

/** Each rarity's share of a crate in percent, for the odds shown on its card. */
export function crateOdds(crate: CrateDef): { rarity: Rarity; percent: number }[] {
  const total = RARITIES.reduce((sum, rarity) => sum + crate.weights[rarity], 0);
  return RARITIES.filter((rarity) => crate.weights[rarity] > 0).map((rarity) => ({ rarity, percent: Math.round((crate.weights[rarity] / total) * 1000) / 10 }));
}

/**
 * Draws a crate's prize from the items the player does not own yet: a rarity by the crate's weights (only rarities with something
 * left to win count), then an item of it. Null when nothing is left to win.
 */
export function rollCrate(crate: CrateDef, pool: readonly InventoryItem[], owned: ReadonlySet<string>, random: () => number = Math.random): InventoryItem | null {
  const left = pool.filter((item) => !owned.has(item.key));
  const open = RARITIES.filter((rarity) => crate.weights[rarity] > 0 && left.some((item) => item.rarity === rarity));
  const total = open.reduce((sum, rarity) => sum + crate.weights[rarity], 0);
  if (total <= 0) return null;
  let roll = random() * total;
  const rarity = open.find((candidate) => (roll -= crate.weights[candidate]) < 0) ?? open[open.length - 1];
  const choices = left.filter((item) => item.rarity === rarity);
  return choices[Math.floor(random() * choices.length)] ?? null;
}

/** What the shop sells and crates hold: every wearable, and the weapon skins that have a model (the plain forms are not sold). */
export const isSoldInShop = (item: InventoryItem): boolean => item.kind === 'wear' || item.thumbUrl !== null;

/** The strip of items a crate spins through before stopping on its prize. */
export interface CrateReel {
  items: InventoryItem[];
  prizeIndex: number;
  /** Where on the prize's tile the strip stops, from -0.4 (left edge) to 0.4 (right edge) of a tile. */
  landing: number;
}

const REEL_LENGTH = 34;
const REEL_PRIZE_INDEX = 29;

export function buildReel(pool: readonly InventoryItem[], prize: InventoryItem, random: () => number = Math.random): CrateReel {
  const items = Array.from({ length: REEL_LENGTH }, (_, index) => (index === REEL_PRIZE_INDEX ? prize : pool[Math.floor(random() * pool.length)]));
  return { items, prizeIndex: REEL_PRIZE_INDEX, landing: (random() - 0.5) * 0.8 };
}
