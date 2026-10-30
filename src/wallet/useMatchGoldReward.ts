import { useEffect, useRef, useState } from 'react';
import { creditWallet } from './walletStore';

/**
 * Credits `gold` once when a match ends and returns the amount actually credited (null before the end or if saving failed).
 * The guard re-arms when the next match starts so every finished match pays exactly once.
 */
export function useMatchGoldReward(isMatchOver: boolean, gold: number): number | null {
  const [creditedGold, setCreditedGold] = useState<number | null>(null);
  const hasPaid = useRef(false);

  useEffect(() => {
    if (!isMatchOver) {
      hasPaid.current = false;
      setCreditedGold(null);
      return;
    }
    if (hasPaid.current) return;
    hasPaid.current = true;
    setCreditedGold(creditWallet('gold', gold) ? gold : null);
  }, [isMatchOver, gold]);

  return creditedGold;
}
