import { useEffect, useRef } from 'react';
import { creditWallet } from './walletStore';

/**
 * Pays `goldPerKill` for every kill made while playing. Kills restored from a save are taken as the starting point,
 * so loading a hero never pays for old kills; a counter that drops (new journey) simply resets that point.
 */
export function useKillGoldReward(isPlaying: boolean, kills: number, goldPerKill: number): void {
  const paidUpToKills = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const paidUpTo = paidUpToKills.current;
    if (paidUpTo === null || kills < paidUpTo) {
      paidUpToKills.current = kills;
      return;
    }
    const newKills = kills - paidUpTo;
    if (newKills === 0) return;
    if (creditWallet('gold', newKills * goldPerKill)) paidUpToKills.current = kills;
  }, [isPlaying, kills, goldPerKill]);
}
