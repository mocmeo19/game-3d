import type { GameSnapshot } from '../GameEngine';

export function HurtIndicator({ s }: { s: GameSnapshot }) {
  return (
    <div className="cs-hurt" aria-hidden>
      {s.hurt.map((deg, i) => (
        <i key={i} style={{ transform: `rotate(${deg}deg)` }} />
      ))}
    </div>
  );
}
