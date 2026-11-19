import type { GameSnapshot } from '../GameEngine';

/** Classic dynamic crosshair; its gap is the --ch-gap CSS variable the engine updates every frame. */
export function CrosshairView({ s }: { s: GameSnapshot }) {
  // down the sights the gun's own sights aim: no crosshair (as in PUBG)
  if (!s.alive || s.scope > 0 || s.ads) return null;
  // while aiming the lines are shorter and the centre dot stays: the point of impact must remain visible
  return (
    <div className={`cs-crosshair${s.aiming ? ' ads' : ''}`} aria-hidden>
      <i className="l" />
      <i className="r" />
      <i className="u" />
      <i className="d" />
      <b />
      <em className="block" title="Vật cản trước nòng súng" />
    </div>
  );
}
