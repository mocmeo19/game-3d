import { Feather, Gem, Glasses, Hand, Ribbon, Shirt, type LucideIcon } from 'lucide-react';
import type { SlotId } from '../../constants/equipment';

/** Lucide has no clothing glyph for these slots, so they are drawn as 24×24 stroke paths in the same style. */
const CUSTOM_WEAR_ICON_PATHS: Partial<Record<SlotId, string[]>> = {
  outfit: ['M9 2h6l-1 4 3 3-1 3 4 10H4l4-10-1-3 3-3z'],
  underwear_top: ['M3 9c0 4 2 7 5 7s4-3 4-5c0 2 1 5 4 5s5-3 5-7', 'M3 9h18', 'M6 4l2 5', 'M18 4l-2 5'],
  underwear_bottom: ['M3 6h18l-1 4c-3 1-6 4-7 9h-2c-1-5-4-8-7-9z'],
  pants: ['M6 3h12l2 18h-5l-3-11-3 11H4z', 'M6 6h12'],
  skirt: ['M7 4h10l4 16H3z', 'M7 7h10'],
  socks: ['M9 2h6v10l3 3a3 3 0 0 1-4 4l-5-5z', 'M9 6h6'],
  shoes: ['M2 18V9l5 1c1 2 3 3 5 3l7 1a3 3 0 0 1 3 3v1z', 'M2 15h20'],
  hat: ['M2 18c3 1 7 1 10 1s7 0 10-1', 'M5 17c0-6 3-10 7-10s7 4 7 10'],
  horns: ['M8 20c-4-2-6-7-4-15 2 5 5 7 8 8', 'M16 20c4-2 6-7 4-15-2 5-5 7-8 8'],
  tail: ['M4 20c6 0 10-3 10-8s3-8 7-8', 'M21 4c-1 2-3 3-5 3'],
  nails: ['M10 2h4v5h-4z', 'M8 7h8v13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z'],
};

const LUCIDE_WEAR_ICONS: Partial<Record<SlotId, LucideIcon>> = {
  top: Shirt,
  gloves: Hand,
  jewelry: Gem,
  glasses: Glasses,
  wings: Feather,
  accessory: Ribbon,
};

export type WearSlotIconSource = { kind: 'lucide'; icon: LucideIcon } | { kind: 'paths'; paths: string[] };

export function resolveWearSlotIcon(slot: SlotId): WearSlotIconSource {
  const paths = CUSTOM_WEAR_ICON_PATHS[slot];
  if (paths) return { kind: 'paths', paths };
  return { kind: 'lucide', icon: LUCIDE_WEAR_ICONS[slot] ?? Shirt };
}
