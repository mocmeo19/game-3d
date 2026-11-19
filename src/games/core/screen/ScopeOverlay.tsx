import type { GameSnapshot } from '../GameEngine';

export function ScopeOverlay({ s }: { s: GameSnapshot }) {
  if (!s.scope) return null;
  return (
    <div className="cs-scope" aria-hidden>
      <div className="lens" />
      <i className="h" />
      <i className="v" />
    </div>
  );
}
