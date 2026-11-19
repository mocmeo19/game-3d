import { useEffect, useState } from 'react';

/**
 * Animations from Mixamo that come with the project (public/animations, listed in manifest.json). A character's pose id is
 * `mixamo:<file>`; the character plays the clip in a loop (see CharacterModel and renderer/character/mixamo.ts).
 */

export const MIXAMO_PREFIX = 'mixamo:';

export interface MixamoClipInfo {
  /** File name inside public/animations (also the pose id after the prefix). */
  file: string;
  label: string;
  /** What the lab uses the clip for (idle, run, crouch, stab, …), if anything. */
  role: string | null;
  /** The weapon the clip was made for (rifle, knife, sword), `dance` for dances, or null. */
  ctx: string | null;
}

/** The file of a `mixamo:<file>` pose, or null for any other pose. */
export const mixamoClipFile = (pose: string): string | null => (pose.startsWith(MIXAMO_PREFIX) ? pose.slice(MIXAMO_PREFIX.length) : null);

export const MIXAMO_GROUPS: { id: string; ko: string; match: (c: MixamoClipInfo) => boolean }[] = [
  { id: 'all', ko: 'Tất cả', match: () => true },
  { id: 'move', ko: 'Di chuyển', match: (c) => /walk|run|jump|fall|roll|vault|climb|strafe|turn/i.test(c.label) && !c.ctx },
  { id: 'pose', ko: 'Tư thế', match: (c) => /idle|crouch|prone|crawl|sit|lay|lying|sleep/i.test(c.label) && !/rifle|knife|sword/i.test(c.label) },
  { id: 'fight', ko: 'Chiến đấu', match: (c) => (!!c.ctx && c.ctx !== 'dance') || /rifle|knife|sword|stab|melee|throw|fire|reload|draw/i.test(c.label) },
  { id: 'dance', ko: 'Nhảy múa', match: (c) => c.ctx === 'dance' }
];

let cache: MixamoClipInfo[] | null = null;
let loading: Promise<MixamoClipInfo[]> | null = null;

export const loadMixamoClips = (): Promise<MixamoClipInfo[]> => {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch('/animations/manifest.json')
    .then((r) => r.json() as Promise<MixamoClipInfo[]>)
    .then((list) => (cache = list))
    .catch(() => {
      loading = null;
      return [];
    });
  return loading;
};

export const useMixamoClips = (): MixamoClipInfo[] => {
  const [list, setList] = useState<MixamoClipInfo[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    void loadMixamoClips().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return list;
};
