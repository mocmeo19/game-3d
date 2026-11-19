import { CharacterState } from '../types/character';
import { migrateEquipmentSlots } from '../constants/equipment';
import { isWeaponKind, weaponKindFromLegacyClass } from '../constants/weaponKinds';
import {
  DEFAULT_BODY,
  DEFAULT_FACE,
  DEFAULT_COSMETICS,
  getInitialCharacter,
  ENVIRONMENTS,
  LEGACY_ENVIRONMENTS
} from '../constants/presets';

export const SLOT_COUNT = 4;
const SLOTS_KEY = 'bns.slots.v1';
const AUTOSAVE_KEY = 'bns.autosave.v1';
const CODE_PREFIX = 'BNS1:';

export interface Slot {
  savedAt: number;
  thumb: string;
  state: CharacterState;
}

/** Fields of characters saved before race, class and the Lyn features were removed. */
const RETIRED_STATE_KEYS = ['race', 'characterClass'];
const RETIRED_COSMETIC_KEYS = ['earType', 'tailType', 'furColorPrimary', 'furColorSecondary'];

const withoutKeys = (source: object, keys: string[]): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...source };
  keys.forEach((key) => delete copy[key]);
  return copy;
};

/** Coerce arbitrary parsed JSON into a complete CharacterState, or null if it is not one. */
export const sanitizeState = (raw: unknown): CharacterState | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<CharacterState> & { characterClass?: unknown };
  if (!r.body || typeof r.body !== 'object' || !r.face || typeof r.face !== 'object') return null;

  const base = getInitialCharacter();
  const weapon = isWeaponKind(r.weapon) ? r.weapon : weaponKindFromLegacyClass(r.characterClass) ?? base.weapon;

  const env = typeof r.environment === 'string' ? (LEGACY_ENVIRONMENTS[r.environment] ?? r.environment) : base.environment;
  const environment = (ENVIRONMENTS.some((e) => e.id === env) ? env : base.environment) as CharacterState['environment'];
  const cosmetics = withoutKeys(r.cosmetics && typeof r.cosmetics === 'object' ? r.cosmetics : {}, RETIRED_COSMETIC_KEYS);

  return migrateEquipmentSlots({
    ...base,
    ...(withoutKeys(r, RETIRED_STATE_KEYS) as Partial<CharacterState>),
    weapon,
    environment,
    name: typeof r.name === 'string' ? r.name.slice(0, 18) : base.name,
    body: { ...DEFAULT_BODY, ...r.body },
    face: { ...DEFAULT_FACE, ...r.face },
    cosmetics: { ...DEFAULT_COSMETICS, ...(cosmetics as Partial<CharacterState['cosmetics']>) }
  });
};

const readJSON = (key: string): unknown => {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const writeJSON = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage full or unavailable (private mode)
  }
};

export const loadAutosave = (): CharacterState | null => sanitizeState(readJSON(AUTOSAVE_KEY));
export const saveAutosave = (state: CharacterState) => writeJSON(AUTOSAVE_KEY, state);

export const loadSlots = (): (Slot | null)[] => {
  const raw = readJSON(SLOTS_KEY);
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const s = arr[i] as Partial<Slot> | null | undefined;
    const state = s ? sanitizeState(s.state) : null;
    return s && state ? { savedAt: Number(s.savedAt) || 0, thumb: String(s.thumb ?? ''), state } : null;
  });
};

export const saveSlot = (index: number, state: CharacterState, thumb: string): boolean => {
  const slots = loadSlots();
  slots[index] = { savedAt: Date.now(), thumb, state };
  return writeJSON(SLOTS_KEY, slots);
};

export const deleteSlot = (index: number): void => {
  const slots = loadSlots();
  slots[index] = null;
  writeJSON(SLOTS_KEY, slots);
};

/** Shrink a full-resolution screenshot to a small JPEG so four slots fit comfortably in localStorage. */
export const makeThumb = (dataUrl: string, height = 180): Promise<string> =>
  new Promise((resolve) => {
    if (!dataUrl) return resolve('');
    const img = new Image();
    img.onload = () => {
      const scale = height / img.height;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });

/** Compact, copy-pasteable character code (UTF-8 safe base64). */
export const encodeShareCode = (state: CharacterState): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return CODE_PREFIX + btoa(bin);
};

export const decodeShareCode = (code: string): CharacterState | null => {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith(CODE_PREFIX)) return null;
    const bin = atob(trimmed.slice(CODE_PREFIX.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return sanitizeState(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
};

/** '#e59b27' -> '229 155 39' for use in `rgb(var(--accent-rgb) / a)`. */
export const hexToRgbTriplet = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '223 186 115';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** 2–18 characters, letters/digits only (any script, so Hangul names work). */
export const isValidName = (name: string): boolean => /^[\p{L}\p{N}]{2,18}$/u.test(name.trim());

const NAME_A =['Seo', 'Han', 'Ryu', 'Mi', 'Jin', 'Hae', 'Yeon', 'Baek', 'Cheon', 'Su', 'Lan', 'Wol'];
const NAME_B = ['rin', 'ha', 'ran', 'yeon', 'woo', 'hwa', 'mi', 'jin', 'sol', 'ryeong', 'ah', 'lee'];
export const randomName = (): string =>
  NAME_A[Math.floor(Math.random() * NAME_A.length)] + NAME_B[Math.floor(Math.random() * NAME_B.length)];
