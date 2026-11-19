import type { GameSnapshot } from '../GameEngine';

/** The four strokes of the X around the crosshair. */
const STROKES = ['tl', 'tr', 'bl', 'br'] as const;

/** PUBG / CS:GO hit marker: a short X on the crosshair for each hit (yellow on the head, red on a kill); it replays per hit. */
export function HitMarker({ marker }: { marker: GameSnapshot['hitMarker'] }) {
  if (!marker) return null;
  return (
    <div key={marker.id} className={`cs-hitmarker ${marker.kind}`} aria-hidden>
      {STROKES.map((stroke) => <i key={stroke} className={stroke} />)}
    </div>
  );
}
