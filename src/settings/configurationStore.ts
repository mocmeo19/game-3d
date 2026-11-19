export const CONFIGURATION_KEYS = [
  'bns.render-settings.v1',
  'bns.audio.v1', 'nams-battle-royal-combat-animations-v1',
  'nams-battle-royal-gun-models-v1', 'bns.performance-overlay.v1', 'bns.gameplay.v1',
] as const;
export type ConfigurationKey = typeof CONFIGURATION_KEYS[number];
const DATABASE_NAME = 'nams-battle-royal';
const STORE_NAME = 'settings';
const values = new Map<ConfigurationKey, unknown>();
let database: Promise<IDBDatabase> | null = null;
let initialization: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    let failed = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () => reject(request.error ?? new Error('Cannot open configuration database'));
    request.onblocked = () => {
      failed = true;
      reject(new Error('Configuration database upgrade is blocked by another tab'));
    };
    request.onsuccess = () => {
      const connection = request.result;
      if (failed) { connection.close(); return; }
      connection.onversionchange = () => { connection.close(); database = null; };
      resolve(connection);
    };
  }).catch((error: unknown) => { database = null; throw error; });
  return database;
}

function legacyConfiguration(): Map<ConfigurationKey, unknown> {
  const legacy = new Map<ConfigurationKey, unknown>();
  for (const key of CONFIGURATION_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) legacy.set(key, JSON.parse(raw));
    } catch { /* Leave unreadable legacy data untouched. */ }
  }
  return legacy;
}

export function initializeConfigurations(): Promise<void> {
  initialization ??= openDatabase().then((connection) => new Promise<void>((resolve, reject) => {
    const legacy = legacyConfiguration();
    const loaded = new Map<ConfigurationKey, unknown>();
    const transaction = connection.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const key of CONFIGURATION_KEYS) {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result !== undefined) loaded.set(key, request.result);
        else if (legacy.has(key)) {
          store.put(legacy.get(key), key);
          loaded.set(key, legacy.get(key));
        }
      };
    }
    transaction.oncomplete = () => {
      for (const [key, value] of loaded) values.set(key, value);
      for (const key of legacy.keys()) {
        try { localStorage.removeItem(key); } catch { /* IndexedDB already owns the committed value. */ }
      }
      resolve();
    };
    transaction.onabort = () => reject(transaction.error ?? new Error('Cannot load configuration'));
  })).catch((error: unknown) => { initialization = null; throw error; });
  return initialization;
}

export const readConfiguration = (key: ConfigurationKey): unknown => values.get(key);

export async function writeConfiguration(key: ConfigurationKey, value: unknown): Promise<void> {
  const snapshot: unknown = structuredClone(value);
  const write = writes.then(async () => {
    await initializeConfigurations();
    const connection = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = connection.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(snapshot, key);
      transaction.oncomplete = () => { values.set(key, snapshot); resolve(); };
      transaction.onabort = () => reject(transaction.error ?? new Error('Cannot save configuration'));
    });
  });
  writes = write.catch(() => undefined);
  return write;
}
