import { WEAPONS, type WeaponId } from '../../core/rules';
import { PROTAGONIST_ORDER, type ProtagonistId } from './protagonists';

/** The open world's progress in this browser: who is played, the missions passed, and each protagonist's money and gear. */

const SAVE_KEY = 'bns.city-save.v1';
const SAVE_VERSION = 1;

export interface SavedWeapon {
  id: WeaponId;
  ammo: number;
  reserve: number;
}

export interface HeroSave {
  money: number;
  x: number;
  z: number;
  health: number;
  armor: number;
  weapons: SavedWeapon[];
  grenades: WeaponId[];
}

export interface CitySave {
  version: typeof SAVE_VERSION;
  active: ProtagonistId;
  completed: string[];
  heroes: Record<ProtagonistId, HeroSave>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isWeaponId = (v: unknown): v is WeaponId => typeof v === 'string' && v in WEAPONS;
const isProtagonist = (v: unknown): v is ProtagonistId => typeof v === 'string' && (PROTAGONIST_ORDER as readonly string[]).includes(v);

function parseWeapon(raw: unknown): SavedWeapon | null {
  if (!isRecord(raw) || !isWeaponId(raw.id) || !isNumber(raw.ammo) || !isNumber(raw.reserve)) return null;
  return { id: raw.id, ammo: Math.max(0, Math.round(raw.ammo)), reserve: Math.max(0, Math.round(raw.reserve)) };
}

function parseHero(raw: unknown): HeroSave | null {
  if (!isRecord(raw)) return null;
  const { money, x, z, health, armor, weapons, grenades } = raw;
  if (!isNumber(money) || !isNumber(x) || !isNumber(z) || !isNumber(health) || !isNumber(armor)) return null;
  if (!Array.isArray(weapons) || !Array.isArray(grenades)) return null;
  return {
    money: Math.max(0, Math.round(money)),
    x,
    z,
    health: Math.min(100, Math.max(1, health)),
    armor: Math.min(100, Math.max(0, armor)),
    weapons: weapons.map(parseWeapon).filter((w): w is SavedWeapon => w !== null),
    grenades: grenades.filter(isWeaponId),
  };
}

/** Checks a save read from storage, which may be from an older build or edited by hand; null when it cannot be used. */
export function parseCitySave(raw: unknown): CitySave | null {
  if (!isRecord(raw) || raw.version !== SAVE_VERSION || !isProtagonist(raw.active) || !Array.isArray(raw.completed) || !isRecord(raw.heroes)) return null;
  const heroes = {} as Record<ProtagonistId, HeroSave>;
  for (const id of PROTAGONIST_ORDER) {
    const hero = parseHero(raw.heroes[id]);
    if (!hero) return null;
    heroes[id] = hero;
  }
  return { version: SAVE_VERSION, active: raw.active, completed: raw.completed.filter((m): m is string => typeof m === 'string'), heroes };
}

/** The saved game, or null when there is none or it cannot be read (a new game starts; the broken save is left in place). */
export function loadCitySave(): CitySave | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    return text ? parseCitySave(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

/** Writes the save; false when the browser refuses (private mode, full storage), so the game can say so. */
export function writeCitySave(save: CitySave): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
