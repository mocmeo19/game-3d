import { SILHOUETTE_VIEWBOX, SILHOUETTES, type SilhouetteKind } from './gunSilhouettes';

interface GunSilhouetteProps {
  kind: SilhouetteKind;
  className?: string;
}

/** A weapon's side view in the current text colour, shared by inventory cards and the kill feed. */
export function GunSilhouette({ kind, className }: GunSilhouetteProps) {
  return (
    <svg aria-hidden viewBox={SILHOUETTE_VIEWBOX} preserveAspectRatio="xMidYMid meet" className={className} fill="currentColor">
      {SILHOUETTES[kind].map((points) => (
        <polygon key={points} points={points} />
      ))}
    </svg>
  );
}
