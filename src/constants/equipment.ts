import { lynTailModel } from './lynAppearance';
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
        : valid(state.gear?.tail, 'tail', g) ?? valid(lynTailModel(state) ?? undefined, 'tail', g);
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

/* ───────── class loadouts: the gear a class starts with when it is picked ───────── */

type Loadout = Partial<Record<SlotId, string>>;

const CLASS_LOADOUT: Record<string, { female: Loadout; male: Loadout }> = {
  blade_master: {
    female: { outfit: 'mindfront_kimono', shoes: 'culturalibre_heroine_boots_1', gloves: 'toigo_gloves_short' },
    male: { outfit: 'rehmanpolanski_viking_tunic', pants: 'rehmanpolanski_viking_pants', shoes: 'rehmanpolanski_viking_boots', gloves: 'toigo_gloves_short' }
  },
  kung_fu_master: {
    female: { outfit: 'elvs_fashion_stylized_qipoa', shoes: 'toigo_mj_cloth_shoes', gloves: 'learning_mma_fighting_gloves' },
    male: { outfit: 'donitz_monk_robe', shoes: 'toigo_mj_cloth_shoes', gloves: 'learning_mma_fighting_gloves' }
  },
  force_master: {
    female: { outfit: 'maciekg_wizard_robe', hat: 'maciekg_wizard_hat', shoes: 'maciekg_leather_boots' },
    male: { outfit: 'maciekg_wizard_robe', hat: 'maciekg_wizard_hat', shoes: 'maciekg_leather_boots' }
  },
  destroyer: {
    female: { outfit: 'matcreator_mc-scifi-armor_guardian', shoes: 'madmanny_tight_leather_boots', gloves: 'toigo_gloves_medium' },
    male: { outfit: 'matcreator_mc-scifi-armor_guardian', shoes: 'madmanny_tight_leather_boots', gloves: 'toigo_gloves_medium' }
  },
  assassin: {
    female: { outfit: 'mindfront_f_ninja', hat: 'culturalibre_heroine_mask_1', shoes: 'mindfront_shoes_biker_boots_female', gloves: 'toigo_gloves_short' },
    male: { outfit: 'matcreator_mc-bodysuit-2021', hat: 'culturalibre_hero_mask_2', shoes: 'mindfront_shoes_biker_boots_male', gloves: 'toigo_gloves_short' }
  },
  summoner: {
    female: { outfit: 'elvs_goddess_dress2', shoes: 'elvs_flatshoe_gemmed1' },
    male: { outfit: 'male_elegantsuit01', shoes: 'elvs_flatshoe_gemmed1' }
  },
  gunslinger: {
    female: { outfit: 'mindfront_tactical_vest_female', pants: 'elvs_jeans_bootcut', hat: 'fedora_cocked', shoes: 'mindfront_shoes_biker_boots_female', gloves: 'toigo_gloves_short' },
    male: { outfit: 'mindfront_tactical_vest_male', pants: 'mindfront_male_trousers_1', hat: 'fedora_cocked', shoes: 'mindfront_shoes_biker_boots_male', gloves: 'toigo_gloves_short' }
  },
  blade_dancer: {
    female: { outfit: 'punkduck_middle_length_qipao', pants: 'toigo_harem_pants', shoes: 'toigo_mj_cloth_shoes', gloves: 'toigo_gloves_long' },
    male: { outfit: 'punkduck_middle_length_qipao', pants: 'toigo_harem_pants', shoes: 'toigo_mj_cloth_shoes', gloves: 'toigo_gloves_short' }
  },
  warlock: {
    female: { outfit: 'punkduck_medieval_dress', hat: 'culturalibre_hero-heroine_hood_1', shoes: 'punkduck_medieval_boots' },
    male: { outfit: 'donitz_monk_robe', hat: 'donitz_monk_robe_hood', shoes: 'maciekg_leather_boots' }
  },
  soul_fighter: {
    female: { top: 'drednicolson_asymmetric_tunic_and_sash', pants: 'toigo_harem_pants', shoes: 'toigo_mj_cloth_shoes', gloves: 'learning_mma_fighting_gloves' },
    male: { top: 'elvs_male_boho_top1', pants: 'toigo_harem_pants', shoes: 'toigo_mj_cloth_shoes', gloves: 'learning_mma_fighting_gloves' }
  },
  warden: {
    female: { outfit: 'rehmanpolanski_viking_tunic', pants: 'rehmanpolanski_viking_pants', hat: 'culturalibre_warrior_helmet_02', shoes: 'rehmanpolanski_viking_boots', gloves: 'toigo_gloves_medium' },
    male: { outfit: 'rehmanpolanski_viking_tunic', pants: 'rehmanpolanski_viking_pants', hat: 'culturalibre_warrior_helmet_02', shoes: 'rehmanpolanski_viking_boots', gloves: 'toigo_gloves_medium' }
  },
  archer: {
    female: { outfit: 'culturalibre_heroine_suit_6', hat: 'culturalibre_hero-heroine_hood_2', shoes: 'punkduck_riding_boots', gloves: 'culturalibre_hero-heroine_gloves_1' },
    male: { outfit: 'rehmanpolanski_viking_tunic', pants: 'rehmanpolanski_viking_pants', shoes: 'culturalibre_male_boots', gloves: 'toigo_gloves_short' }
  },
  astromancer: {
    female: { outfit: 'elvs_goddess_dress5', shoes: 'elvs_flatshoe_gemmed1' },
    male: { outfit: 'maciekg_wizard_robe', shoes: 'elvs_basic_felt_elf_shoes' }
  },
  dual_blade: {
    female: { outfit: 'culturalibre_heroine_suit_7', shoes: 'culturalibre_heroine_boots_2', gloves: 'culturalibre_hero-heroine_gloves_2' },
    male: { outfit: 'matcreator_mc-bodysuit-2021', hat: 'culturalibre_hero_mask_1', shoes: 'culturalibre_hero_boots_2', gloves: 'toigo_gloves_short' }
  },
  musician: {
    female: { outfit: 'elvs_goddess_dress1', shoes: 'toigo_ballet_flats_with_flowers' },
    male: { outfit: 'wdg_mycenaean_tunic', shoes: 'dressupdoc_sandals1' }
  }
};

/** Dress the character in the starting gear of `cls`; hair, jewelry and accessories stay as they are. */
export const withClassLoadout = (state: CharacterState, cls: string): CharacterState => {
  const set = CLASS_LOADOUT[cls]?.[state.gender];
  if (!set) return state;
  let next: CharacterState = { ...state, characterClass: cls as CharacterState['characterClass'] };
  (['outfit', 'top', 'pants', 'skirt', 'shoes', 'hat', 'gloves', 'underwear_top', 'underwear_bottom'] as SlotId[]).forEach((slot) => {
    const id = set[slot];
    next = withEquipped(next, slot, id && valid(id, slot, state.gender) ? id : slot === 'shoes' ? DEFAULT_SHOES : slot === 'outfit' && !set.top ? defaultOutfit(state.gender) : null);
  });
  return next;
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
