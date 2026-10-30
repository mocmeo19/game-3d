import { useSyncExternalStore } from 'react';
import { getWalletBalances, subscribeWallet, type WalletBalances } from './walletStore';

export function useWalletBalances(): WalletBalances {
  return useSyncExternalStore(subscribeWallet, getWalletBalances, getWalletBalances);
}
