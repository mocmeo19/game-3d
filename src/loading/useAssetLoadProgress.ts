import { useSyncExternalStore } from 'react';
import { getAssetLoadProgress, subscribeAssetLoadProgress, type AssetLoadProgress } from './assetLoadProgress';

export function useAssetLoadProgress(): AssetLoadProgress {
  return useSyncExternalStore(subscribeAssetLoadProgress, getAssetLoadProgress);
}
