/** Which locker items the player owns (bought in the shop, won from crates, or worn when the shop opened), by inventory key. */

const OWNED_KEY = 'bns.owned-items.v1';
/** Keys look like `wear:<asset id>` or `weapon:<style id>`. */
const ITEM_KEY = /^(wear|weapon):\S{1,120}$/;
const MAX_ITEMS = 5000;

interface OwnedRecord {
  /** The items worn at the time were granted once, so nobody loses the look they already had. */
  seeded: boolean;
  keys: ReadonlySet<string>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
const EMPTY: OwnedRecord = { seeded: false, keys: new Set() };
let cached: OwnedRecord | null = null;

function readStored(): OwnedRecord {
  try {
    const text = localStorage.getItem(OWNED_KEY);
    if (!text) return EMPTY;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    const record = parsed as Record<string, unknown>;
    const keys = Array.isArray(record.keys) ? record.keys.filter((key): key is string => typeof key === 'string' && ITEM_KEY.test(key)).slice(0, MAX_ITEMS) : [];
    return { seeded: record.seeded === true, keys: new Set(keys) };
  } catch {
    return EMPTY;
  }
}

function write(next: OwnedRecord): boolean {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify({ seeded: next.seeded, keys: [...next.keys] }));
  } catch {
    return false;
  }
  cached = next;
  listeners.forEach((listener) => listener());
  return true;
}

function current(): OwnedRecord {
  if (cached === null) cached = readStored();
  return cached;
}

export function getOwnedItems(): ReadonlySet<string> {
  return current().keys;
}

/** Adds items to what the player owns; returns false (nothing changed) when storage fails. */
export function grantItems(keys: readonly string[]): boolean {
  const record = readStored();
  const next = new Set(record.keys);
  keys.forEach((key) => next.add(key));
  return write({ seeded: record.seeded, keys: next });
}

/** The first time the locker or shop opens, what the character already wears becomes theirs. */
export function seedOwnedItems(wornKeys: readonly string[]): void {
  const record = readStored();
  if (record.seeded) return;
  write({ seeded: true, keys: new Set([...record.keys, ...wornKeys]) });
}

const onStorage = (event: StorageEvent) => {
  if (event.key !== OWNED_KEY && event.key !== null) return;
  cached = readStored();
  listeners.forEach((listener) => listener());
};

/** Subscribes to ownership changes in this tab and in other tabs of the same browser. */
export function subscribeOwnedItems(listener: Listener): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}
