import { Gear, Item, SLOTS } from './torchRules';
import { newBook, SkillBook } from './torchSkills';

/** Progress of one hero in the Torchlight world, kept in the browser (one save per character name). */

export interface TorchSave {
  v: 1;
  level: number;
  xp: number;
  gold: number;
  essence: number;
  kills: number;
  gear: Gear;
  bag: Item[];
  potions: { hp: number; mp: number };
  book: SkillBook;
  pos: { x: number; z: number };
  /** Epoch milliseconds. */
  savedAt: number;
}

const key = (name: string) => `torch-save-v1:${name}`;

const isItem = (x: unknown): x is Item => {
  const i = x as Item;
  return !!i && typeof i.id === 'number' && typeof i.name === 'string' && SLOTS.includes(i.slot) && typeof i.level === 'number' && Array.isArray(i.affixes) && typeof i.enhance === 'number';
};

export function loadSave(name: string): TorchSave | null {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<TorchSave>;
    if (s.v !== 1 || typeof s.level !== 'number' || !s.gear || !Array.isArray(s.bag)) return null;
    const gear: Gear = {};
    for (const slot of SLOTS) if (isItem(s.gear[slot])) gear[slot] = s.gear[slot];
    const fresh = newBook();
    const book: SkillBook = { ...fresh, ...(s.book ?? {}), slots: [...(s.book?.slots ?? fresh.slots), null, null, null, null, null].slice(0, 5) };
    return {
      v: 1,
      level: Math.max(1, Math.floor(s.level)),
      xp: Math.max(0, s.xp ?? 0),
      gold: Math.max(0, Math.floor(s.gold ?? 0)),
      essence: Math.max(0, Math.floor(s.essence ?? 0)),
      kills: Math.max(0, Math.floor(s.kills ?? 0)),
      gear,
      bag: s.bag.filter(isItem),
      potions: { hp: s.potions?.hp ?? 3, mp: s.potions?.mp ?? 3 },
      book,
      pos: { x: s.pos?.x ?? 0, z: s.pos?.z ?? 6 },
      savedAt: s.savedAt ?? 0
    };
  } catch {
    return null;
  }
}

export function writeSave(name: string, save: TorchSave): boolean {
  try {
    localStorage.setItem(key(name), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(name: string) {
  try {
    localStorage.removeItem(key(name));
  } catch {
    /* storage unavailable */
  }
}
