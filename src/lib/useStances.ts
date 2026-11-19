import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseType } from '../types/character';

/**
 * Stance poses on the home and character-select screens: a weapon preview or a greeting the character holds for a moment (or the
 * animated rest stance). Poses live only here: they are never written into the saved character.
 */

export interface Stance {
  /** `null` is the rest stance (the character's own pose). */
  pose: PoseType | null;
  label: string;
}

/** Named poses (offered by the test field). */
export const STANCES: Stance[] = [
  { pose: null, label: 'Đứng nghỉ' },
  { pose: 'combat_ready', label: 'Thủ thế' },
  { pose: 'bow', label: 'Cúi chào' },
  { pose: 'dance', label: 'Nhảy múa' },
  { pose: 'jump', label: 'Nhảy' },
  { pose: 'vault', label: 'Vượt chướng ngại' },
  { pose: 'meditate', label: 'Thiền' }
];

export function useStances(enabled: boolean) {
  const [pose, setPose] = useState<PoseType | null>(null);
  const flourishTimer = useRef(0);

  // outside these screens the character is simply at rest
  useEffect(() => {
    if (!enabled) setPose(null);
  }, [enabled]);

  /** Choose a pose by hand (`null` goes back to the rest stance). */
  const choose = useCallback((next: PoseType | null) => {
    window.clearTimeout(flourishTimer.current);
    setPose(next);
  }, []);

  /** A short greeting (when a character is picked); the character returns to rest afterwards. */
  const flourish = useCallback((next: PoseType, ms = 2600) => {
    window.clearTimeout(flourishTimer.current);
    setPose(next);
    flourishTimer.current = window.setTimeout(() => setPose(null), ms);
  }, []);

  useEffect(() => () => window.clearTimeout(flourishTimer.current), []);

  return { pose, choose, flourish };
}
