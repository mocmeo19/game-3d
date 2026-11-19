import { useEffect, useState } from 'react';
import type { Phase } from '../engine/snapshotTypes';

const BEST_KILLS_KEY = 'clothes.arena.best';

const readBestKills = () => {
  try {
    return Number(localStorage.getItem(BEST_KILLS_KEY)) || 0;
  } catch {
    return 0;
  }
};

const saveBestKills = (kills: number) => {
  try {
    localStorage.setItem(BEST_KILLS_KEY, String(kills));
  } catch {
    // the record is a nicety: without storage it lasts until the page closes
  }
};

/** The most kills the player has made in one shooter match; a finished match that beats it becomes the new record. */
export function useBestKills(phase: Phase, myKills: number, isRecorded: boolean) {
  const [best, setBest] = useState(readBestKills);
  useEffect(() => {
    if (!isRecorded || phase !== 'matchEnd' || myKills <= best) return;
    setBest(myKills);
    saveBestKills(myKills);
  }, [isRecorded, phase, myKills, best]);
  return best;
}
