import { useEffect, useState } from 'react';
import { markingThumbs } from '../../renderer/character/markingThumbs';
import { CharacterState } from '../../types/character';

/** The marking as seen on the avatar's own face (see renderer/character/markingThumbs.ts). */
export const MarkingIcon = ({ id, state }: { id: string; state: CharacterState }) => {
  const [thumbs, setThumbs] = useState<Record<string, string> | null>(null);
  const c = state.cosmetics;
  useEffect(() => {
    let live = true;
    setThumbs(null);
    markingThumbs(state).then((t) => live && setThumbs(t)).catch((e) => console.warn('marking thumbnails unavailable', e));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gender, state.skin, c.skinTone, c.faceMarkingColor]);
  return thumbs?.[id] ? <img src={thumbs[id]} alt="" draggable={false} className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse bg-black/30" />;
};
