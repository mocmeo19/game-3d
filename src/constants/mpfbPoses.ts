import { useEffect, useState } from 'react';

/**
 * Poses from the MakeHuman / MPFB pose packs (poses01–05, CC0), converted from BVH to the app's joint table by
 * scratch tooling into public/poses/mpfb.json (thumbnails next to it as <id>.webp). A character's pose id is `mpfb:<id>`.
 */

export type Rot = [number, number, number];

export interface MpfbPose {
  id: string;
  name: string;
  author: string;
  license: string;
  tags: string[];
  pose: Partial<Record<'hips' | 'torso' | 'neck' | 'head' | 'shL' | 'shR' | 'elL' | 'elR' | 'hpL' | 'hpR' | 'knL' | 'knR', Rot>> & { hipsDrop?: number };
}

export const MPFB_PREFIX = 'mpfb:';

/** Categories shown as filters, matched against the pack tags. */
export const POSE_GROUPS: { id: string; ko: string; match: (p: MpfbPose) => boolean }[] = [
  { id: 'all', ko: 'Tất cả', match: () => true },
  { id: 'stand', ko: 'Đứng', match: (p) => p.tags.some((t) => ['standing', 'natural', 'default', 'casual', 'formal', 'military'].includes(t)) },
  { id: 'action', ko: 'Hành động', match: (p) => p.tags.some((t) => ['hero', 'superhero', 'stance', 'gun', 'archery', 'wizard', 'fight', 'martial arts'].includes(t)) || /fight|boxing|hadouken|ninja|warhammer|archer|gun|spider|summon|sisyphus/.test(p.id) },
  { id: 'fashion', ko: 'Thời trang', match: (p) => p.tags.some((t) => ['fashion', 'posing', 'model'].includes(t)) || /fashion|couture|posing|sohh/.test(p.id) },
  { id: 'sport', ko: 'Thể thao', match: (p) => p.tags.some((t) => ['sport', 'tennis', 'fitness', 'yoga', 'gymnastics'].includes(t)) },
  { id: 'sit', ko: 'Ngồi', match: (p) => p.tags.includes('sitting') || /sit|lotus/.test(p.id) },
  { id: 'emotion', ko: 'Cảm xúc', match: (p) => p.tags.some((t) => ['emotion', 'gesture'].includes(t)) }
];

let cache: MpfbPose[] | null = null;
let loading: Promise<MpfbPose[]> | null = null;
const byId = new Map<string, MpfbPose>();

export const loadMpfbPoses = (): Promise<MpfbPose[]> => {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch('/poses/mpfb.json')
    .then((r) => r.json() as Promise<MpfbPose[]>)
    .then((list) => {
      cache = list;
      list.forEach((p) => byId.set(p.id, p));
      return list;
    })
    .catch(() => {
      loading = null;
      return [];
    });
  return loading;
};

/** The joint table of a `mpfb:<id>` pose, or null while the list is still loading / for other ids. */
export const getMpfbPose = (poseId: string): MpfbPose['pose'] | null => {
  if (!poseId.startsWith(MPFB_PREFIX)) return null;
  if (!cache) void loadMpfbPoses();
  return byId.get(poseId.slice(MPFB_PREFIX.length))?.pose ?? null;
};

/** Readable title from the pack name: "pd_fashion01" → "Pd fashion 01". */
export const poseTitle = (p: MpfbPose) => {
  const s = p.name.replace(/[_-]+/g, ' ').replace(/([a-z])(\d)/gi, '$1 $2').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const useMpfbPoses = (): MpfbPose[] => {
  const [list, setList] = useState<MpfbPose[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    void loadMpfbPoses().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return list;
};
