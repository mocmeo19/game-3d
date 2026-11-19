import type { GameSnapshot } from '../GameEngine';

export function WeaponPanel({ s }: { s: GameSnapshot }) {
  const w = s.weapon;
  const gun = !!w && w.mag > 1;
  return (
    <div className="cs-weapon">
      <ol className="cs-slots">
        {s.slots.map((sl, i) => (
          <li key={`${sl.slot}-${sl.id}-${i}`} className={sl.active ? 'on' : ''}>
            <kbd>{sl.slot}</kbd>
            {sl.name}
          </li>
        ))}
      </ol>
      {w && (
        <div className="cs-ammo">
          {!gun ? (
            <strong className="name">{w.name}</strong>
          ) : w.reloading ? (
            <strong className="reloading">NẠP ĐẠN…</strong>
          ) : (
            <>
              <strong className={w.ammo <= Math.ceil(w.mag * 0.2) ? 'low' : ''}>{w.ammo}</strong>
              <span>/ {w.reserve}</span>
            </>
          )}
          {gun && <small>{w.name}</small>}
        </div>
      )}
    </div>
  );
}
