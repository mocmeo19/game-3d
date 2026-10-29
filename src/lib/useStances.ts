import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseType } from '../types/character';
import { MPFB_PREFIX, MpfbPose, POSE_GROUPS, useMpfbPoses } from '../constants/mpfbPoses';

/**
 * Stance poses on the home and character-select screens: the player picks a pose from the "Tạo dáng" menu and the character holds
 * it (or goes back to the animated rest stance). Poses live only here: they are
 * never written into the saved character.
 */

export interface Stance {
  /** `null` is the rest stance (the character's own pose). */
  pose: PoseType | null;
  label: string;
}

/** Poses offered in the "Tạo dáng" menu. */
export const STANCES: Stance[] = [
  { pose: null, label: 'Đứng nghỉ' },
  { pose: 'combat_ready', label: 'Thủ thế' },
  { pose: 'bow', label: 'Cúi chào' },
  { pose: 'dance', label: 'Nhảy múa' },
  { pose: 'jump', label: 'Nhảy' },
  { pose: 'vault', label: 'Vượt chướng ngại' },
  { pose: 'meditate', label: 'Thiền' }
];

/** Built-in poses the "Dáng ngẫu nhiên" button draws from (calm ones only). */
const RANDOM_BUILTIN: PoseType[] = ['combat_ready', 'bow'];
const STANDING = ['stand', 'action', 'fashion'].map((id) => POSE_GROUPS.find((g) => g.id === id)!.match);

export function useStances(enabled: boolean) {
  const mpfb = useMpfbPoses();
  const standing = useRef<MpfbPose[]>([]);
  standing.current = mpfb.filter((p) => STANDING.some((match) => match(p)));

  const [pose, setPose] = useState<PoseType | null>(null);
  const last = useRef<PoseType | null>(null);
  const flourishTimer = useRef(0);

  const pick = useCallback((): PoseType => {
    let next: PoseType = 'combat_ready';
    for (let i = 0; i < 6; i++) {
      const pool = standing.current;
      next = pool.length && Math.random() < 0.55 ? (`${MPFB_PREFIX}${pool[Math.floor(Math.random() * pool.length)].id}` as PoseType) : RANDOM_BUILTIN[Math.floor(Math.random() * RANDOM_BUILTIN.length)];
      if (next !== last.current) break;
    }
    last.current = next;
    return next;
  }, []);

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

  return { pose, choose, flourish, random: () => choose(pick()) };
}
