import { useSyncExternalStore } from 'react';
import { getOwnedItems, subscribeOwnedItems } from './ownedItemsStore';

export function useOwnedItems(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeOwnedItems, getOwnedItems, getOwnedItems);
}
