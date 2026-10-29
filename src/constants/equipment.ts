import { CharacterState } from '../types/character';
import { ASSETS, AssetGender, AssetInfo, SlotId } from './assets';
import { SKINS, SkinInfo } from './skins';

/**
 * Equipment model of the character creator. Every wearable is an MPFB asset that belongs to a slot; a character wears at
 * most one asset per slot. Older saves used procedural hair styles / costume ids, which are mapped onto MPFB assets here.
 */

export type { SlotId, AssetInfo, AssetGender };

export const ASSET_INFO: Record<string, AssetInfo> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

export interface SlotMeta {
  id: SlotId;
  label: string;
  /** Section of the creator the slot is shown in. */
  group: 'hair' | 'face' | 'wear';
}

export const SLOTS: SlotMeta[] = [
  { id: 'hair', label: 'Tóc', group: 'hair' },
  { id: 'eyebrows', label: 'Lông mày', group: 'face' },
  { id: 'eyelashes', label: 'Lông mi', group: 'face' },
  { id: 'beard', label: 'Râu', group: 'face' },
  { id: 'teeth', label: 'Răng', group: 'face' },
  { id: 'outfit', label: 'Đồ bộ', group: 'wear' },
  { id: 'top', label: 'Áo', group: 'wear' },
  { id: 'underwear_top', label: 'Đồ lót trên', group: 'wear' },
  { id: 'underwear_bottom', label: 'Đồ lót dưới', group: 'wear' },
  { id: 'pants', label: 'Quần', group: 'wear' },
  { id: 'skirt', label: 'Váy', group: 'wear' },
  { id: 'socks', label: 'Vớ', group: 'wear' },
  { id: 'shoes', label: 'Giày', group: 'wear' },
  { id: 'hat', label: 'Mũ', group: 'wear' },
  { id: 'gloves', label: 'Găng tay', group: 'wear' },
  { id: 'jewelry', label: 'Trang sức', group: 'wear' },
  { id: 'glasses', label: 'Kính', group: 'wear' },
  { id: 'horns', label: 'Sừng', group: 'wear' },
  { id: 'wings', label: 'Cánh', group: 'wear' },
  { id: 'tail', label: 'Đuôi', group: 'wear' },
  { id: 'nails', label: 'Móng tay', group: 'wear' },
  { id: 'accessory', label: 'Phụ kiện', group: 'wear' }
];

export const SLOT_IDS: SlotId[] = SLOTS.map((s) => s.id);

export const assetsOf = (slot: SlotId, gender: string): AssetInfo[] => ASSETS.filter((a) => a.slot === slot && a.genders.includes(gender as AssetGender));

export const assetUrl = (id: string, gender: string, ext: 'glb' | 'png') => `/models/assets/${id}.${gender === 'male' ? 'male' : 'female'}.${ext}`;

/* ───────── skins ───────── */

export const skinsOf = (gender: string): SkinInfo[] => SKINS.filter((s) => s.gender === 'both' || s.gender === gender);
export const defaultSkin = (gender: string) => (gender === 'male' ? 'young_asian_male' : 'young_asian_female');
export const skinInfo = (id: string | undefined, gender: string): SkinInfo | undefined => {
  const s = SKINS.find((x) => x.id === id);
  return s && (s.gender === 'both' || s.gender === gender) ? s : SKINS.find((x) => x.id === defaultSkin(gender));
};
export const skinUrl = (id: string) => `/models/skins/${id}.webp`;
/** The skin picker's photo: the skin on the face of the model (mpfb/build_skin_thumbs.py). */
export const skinThumbUrl = (id: string) => `/models/skins/thumbs/${id}.webp`;

/* ───────── ids saved by older versions (procedural hair styles / costumes) → MPFB assets ───────── */

const legacyHair = (id: string): string => {
  if (id.startsWith('ponytail')) return 'ponytail01';
  if (id.startsWith('twintail') || id.startsWith('braid')) return 'braid01';
  if (id.startsWith('bun') || id === 'empress' || id === 'topknot' || id === 'half_up') return 'short03';
  if (id === 'spiky' || id === 'pixie') return 'short04';
  if (id === 'bob_long') return 'bob02';
  if (id.startsWith('bob')) return 'bob01';
  if (id === 'wolf_cut' || id === 'swept') return 'short02';
  if (id.includes('long') || id === 'cascading' || id === 'medium_wave') return 'long01';
  return 'short01';
};

const DRESSY = new Set(['red_lotus', 'pure_white', 'qipao', 'dancer', 'noble_hanbok', 'summer_dress', 'academy', 'wuxia_robe', 'monk_robe']);
const WORKWEAR = new Set(['blackram', 'shadow_ninja', 'battle_armor', 'rogue_leather', 'gunslinger_coat', 'martial_vest']);

export const defaultOutfit = (gender: string) => (gender === 'male' ? 'male_casualsuit02' : 'female_casualsuit01');
export const DEFAULT_SHOES = 'shoes03';

const valid = (id: string | undefined, slot: SlotId, gender: string): string | null => {
  const a = id ? ASSET_INFO[id] : undefined;
  return a && a.slot === slot && a.genders.includes(gender as AssetGender) ? a.id : null;
};

const migrateSockEquipment = (state: CharacterState): CharacterState => {
  const underwearSock = valid(state.gear?.underwear_bottom, 'socks', state.gender);
  const shoeSock = valid(state.shoes, 'socks', state.gender);
  if (!underwearSock && !shoeSock) return state;

  const gear = { ...state.gear };
  const wearColors = { ...state.cosmetics.wearColors };
  const existingSock = valid(gear.socks, 'socks', state.gender);
  gear.socks = existingSock ?? underwearSock ?? shoeSock!;

  if (!existingSock && !wearColors.socks) {
    const color = underwearSock
      ? wearColors.underwear_bottom || state.cosmetics.outfitMain
      : wearColors.shoes || state.cosmetics.outfitAccent;
    if (color) wearColors.socks = color;
  }
  if (underwearSock) {
    delete gear.underwear_bottom;
    delete wearColors.underwear_bottom;
  }
  if (shoeSock) delete wearColors.shoes;

  return {
    ...state,
    shoes: shoeSock ? 'none' : state.shoes,
    gear,
    cosmetics: { ...state.cosmetics, wearColors }
  };
};

const migrateBodysuitEquipment = (state: CharacterState): CharacterState => {
  const oldSlots = (['underwear_top', 'pants'] as const).filter((slot) =>
    valid(state.gear?.[slot], 'outfit', state.gender)
  );
  const sourceSlot = oldSlots[0];
  if (!sourceSlot) return state;
  const bodysuit = state.gear![sourceSlot]!;

  const gear = { ...state.gear };
  const wearColors = { ...state.cosmetics.wearColors };
  const color = wearColors[sourceSlot] || state.cosmetics.outfitMain;
  if (color) wearColors.outfit = color;
  else delete wearColors.outfit;
  for (const slot of oldSlots) {
    delete gear[slot];
    delete wearColors[slot];
  }

  return { ...state, costume: bodysuit, gear, cosmetics: { ...state.cosmetics, wearColors } };
};

export const migrateEquipmentSlots = (state: CharacterState): CharacterState => {
  const migrated = migrateBodysuitEquipment(migrateSockEquipment(state));
  const armsleeve = valid(migrated.gear?.underwear_top, 'gloves', migrated.gender);
  if (!armsleeve) return migrated;

  const gear = { ...migrated.gear };
  const wearColors = { ...migrated.cosmetics.wearColors };
  const existingGloves = valid(gear.gloves, 'gloves', migrated.gender);
  gear.gloves = existingGloves ?? armsleeve;
  if (!existingGloves && !wearColors.gloves) {
    const color = wearColors.underwear_top || migrated.cosmetics.outfitMain;
    if (color) wearColors.gloves = color;
  }
  delete gear.underwear_top;
  delete wearColors.underwear_top;

  return { ...migrated, gear, cosmetics: { ...migrated.cosmetics, wearColors } };
};

/** The asset currently worn in `slot` (null = nothing; for brows / lashes null means the built-in ones). */
export const equipped = (state: CharacterState, slot: SlotId): string | null => {
  const g = state.gender;
  switch (slot) {
    case 'hair': {
      const id = state.cosmetics.hairStyle;
      if (!id || id === 'none' || id === 'bald') return null;
      return valid(id, 'hair', g) ?? valid(legacyHair(id), 'hair', g);
    }
    case 'outfit': {
      const id = state.costume;
      const direct = valid(id, 'outfit', g);
      if (direct) return direct;
      if (id === 'none') return null;
      if (DRESSY.has(id)) return valid(g === 'male' ? 'male_elegantsuit01' : 'female_elegantsuit01', 'outfit', g);
      if (WORKWEAR.has(id)) return valid(g === 'male' ? 'male_worksuit01' : 'female_sportsuit01', 'outfit', g);
      return valid(defaultOutfit(g), 'outfit', g);
    }
    case 'shoes':
      return state.shoes === 'none' ? null : valid(state.shoes, 'shoes', g) ?? valid(DEFAULT_SHOES, 'shoes', g);
    case 'hat':
      return valid(state.hat, 'hat', g);
    case 'tail':
      return state.gear?.tail === 'none' ? null
        : valid(state.gear?.tail, 'tail', g);
    default:
      return valid(state.gear?.[slot], slot, g);
  }
};

/** Returns a copy of the state with `slot` set to `id` (null = take it off). */
export const withEquipped = (state: CharacterState, slot: SlotId, id: string | null): CharacterState => {
  switch (slot) {
    case 'hair':
      return { ...state, cosmetics: { ...state.cosmetics, hairStyle: id ?? 'none' } };
    case 'outfit':
      return { ...state, costume: id ?? 'none' };
    case 'shoes':
      return { ...state, shoes: id ?? 'none' };
    case 'hat':
      return { ...state, hat: id ?? undefined };
    case 'tail':
      return { ...state, gear: { ...state.gear, tail: id ?? 'none' } };
    default: {
      const gear = { ...(state.gear ?? {}) };
      if (id) gear[slot] = id;
      else delete gear[slot];
      return { ...state, gear };
    }
  }
};

/** Face-hair slots that take their own colour (stored in cosmetics.wearColors). */
export type FaceHairSlot = 'eyebrows' | 'eyelashes' | 'beard';
export const FACE_HAIR_SLOTS: FaceHairSlot[] = ['eyebrows', 'eyelashes', 'beard'];

const darken = (hex: string, k: number) => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};

/** Colour used when the user has not picked one: brows / beard follow the hair, lashes stay near-black. */
export const defaultFaceHairColor = (c: CharacterState['cosmetics'], slot: FaceHairSlot): string =>
  slot === 'eyelashes' ? '#2b211d' : slot === 'eyebrows' ? darken(c.hairColorPrimary, 0.85) : c.hairColorPrimary;

/** The user's colour for a face-hair slot, or undefined to keep the default. */
export const faceHairOverride = (c: CharacterState['cosmetics'], slot: FaceHairSlot): string | undefined => c.wearColors?.[slot] || undefined;

/** Colour of a worn tail: its own pick, else the outfit accent, else the model's colour. */
export const tailColor = (state: CharacterState, modelColor?: string): string =>
  state.cosmetics.wearColors?.tail || state.cosmetics.outfitAccent || modelColor || '#4a4a4f';
