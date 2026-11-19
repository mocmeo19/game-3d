import { Crosshair } from 'lucide-react';
import type { GameSnapshot } from '../GameEngine';

export function DeathInfo({ s }: { s: GameSnapshot }) {
  if (s.alive || s.phase === 'menu' || s.phase === 'matchEnd') return null;
  return (
    <div className="cs-death">
      {s.killedBy && <strong>{s.killedBy}</strong>}
      {s.spectating && (
        <span>
          <Crosshair size={14} /> Đang theo dõi <b>{s.spectating}</b> · Nhấp chuột / Space để đổi
        </span>
      )}
    </div>
  );
}
