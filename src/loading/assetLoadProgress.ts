import { DefaultLoadingManager } from 'three';

export interface AssetLoadProgress {
  isLoading: boolean;
  itemsLoaded: number;
  itemsTotal: number;
  /** URL of the most recent file that finished loading. */
  lastUrl: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let snapshot: AssetLoadProgress = { isLoading: false, itemsLoaded: 0, itemsTotal: 0, lastUrl: '' };
let isInstalled = false;

const publish = (next: AssetLoadProgress) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

/**
 * Every GLTFLoader / TextureLoader created without its own manager reports to three's
 * DefaultLoadingManager, so one hook here covers models, gun props and textures.
 * Nothing else in the app sets these callbacks; if that changes, chain them here.
 */
const installManagerHooks = () => {
  if (isInstalled) return;
  isInstalled = true;
  DefaultLoadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
    publish({ isLoading: true, itemsLoaded, itemsTotal, lastUrl: url });
  };
  DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    publish({ isLoading: itemsLoaded < itemsTotal, itemsLoaded, itemsTotal, lastUrl: url });
  };
  DefaultLoadingManager.onLoad = () => {
    publish({ ...snapshot, isLoading: false, itemsLoaded: snapshot.itemsTotal });
  };
};

export function subscribeAssetLoadProgress(listener: Listener): () => void {
  installManagerHooks();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAssetLoadProgress(): AssetLoadProgress {
  return snapshot;
}

/**
 * Share of the files queued after `baselineLoaded` that have finished, 0–1; null when none were queued.
 * three never resets its counters, so a screen passes the count it saw when it opened.
 */
export function assetLoadRatio(progress: AssetLoadProgress, baselineLoaded: number): number | null {
  const queued = progress.itemsTotal - baselineLoaded;
  if (queued <= 0) return null;
  return Math.min(1, Math.max(0, (progress.itemsLoaded - baselineLoaded) / queued));
}

/** Short readable name of a loaded file, e.g. "/models/female.glb" → "female.glb". */
export function assetFileName(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.slice(path.lastIndexOf('/') + 1);
}
