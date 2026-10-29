import { Crosshair, Shield, Plus, Skull } from 'lucide-react';
import type { GameSnapshot, ShopItem } from './GameEngine';
import type { BuyItem } from './rules';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function TopBar({ s }: { s: GameSnapshot }) {
  const clock = s.phase === 'freeze' || s.phase === 'live' ? s.timer : 0;
  return (
    <div className="cs-top" aria-label="Tỉ số">
      <div className="cs-alive ct">{s.alive5.CT.map((a, i) => <i key={i} className={a ? '' : 'dead'} />)}</div>
      <b className="cs-team ct">{s.score.CT}</b>
      <div className={`cs-clock ${s.phase === 'freeze' ? 'freeze' : clock <= 10 && s.phase === 'live' ? 'low' : ''}`}>
        <strong>{fmtTime(clock)}</strong>
        <small>ROUND {s.round}</small>
      </div>
      <b className="cs-team t">{s.score.T}</b>
      <div className="cs-alive t">{s.alive5.T.map((a, i) => <i key={i} className={a ? '' : 'dead'} />)}</div>
    </div>
  );
}

/** Rotating radar: the viewer is centred and looks up. */
export function Radar({ s }: { s: GameSnapshot }) {
  const { me, allies, enemies } = s.radar;
  const R = 46;
  const scale = 1.1;
  const toLocal = (x: number, z: number) => {
    const dx = (x - me.x) / scale;
    const dz = (z - me.z) / scale;
    // rotate so the view direction (-sin yaw, -cos yaw) points up
    const c = Math.cos(-me.yaw);
    const sn = Math.sin(-me.yaw);
    return { x: dx * c - dz * sn, y: dx * sn + dz * c };
  };
  const clip = (p: { x: number; y: number }) => {
    const d = Math.hypot(p.x, p.y);
    return d > R - 3 ? { x: (p.x / d) * (R - 3), y: (p.y / d) * (R - 3) } : p;
  };
  const roads = [
    [toLocal(0, -112), toLocal(0, 112)],
    [toLocal(-112, -27), toLocal(112, -27)]
  ];
  return (
    <svg viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} className="cs-radar" role="img" aria-label="Radar: xanh là đồng đội, đỏ là đối thủ đã bị phát hiện">
      <defs>
        <clipPath id="radar-clip">
          <circle r={R} />
        </clipPath>
      </defs>
      <circle r={R} fill="#0d1612cc" stroke="#ffffff30" />
      <g clipPath="url(#radar-clip)">
        {roads.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff18" strokeWidth={8 / scale} />)}
        {s.br &&
          [s.br.zone.cur, s.br.zone.next].map((c, i) => {
            if (!c || c.r <= 0) return null;
            const p = toLocal(c.x, c.z);
            return <circle key={`z${i}`} cx={p.x} cy={p.y} r={c.r / scale} fill="none" stroke={i ? '#ffffffcc' : '#3d7dff'} strokeWidth={i ? 0.8 : 1.4} />;
          })}
        {allies.map((a, i) => {
          const p = clip(toLocal(a.x, a.z));
          return a.alive ? <circle key={i} cx={p.x} cy={p.y} r="2.4" fill="#6fa5ff" /> : <text key={i} x={p.x} y={p.y + 2} fontSize="6" fill="#6fa5ff88" textAnchor="middle">×</text>;
        })}
        {enemies.map((e, i) => {
          const p = clip(toLocal(e.x, e.z));
          return <circle key={i} cx={p.x} cy={p.y} r="2.6" fill="#ff5b4a" />;
        })}
      </g>
      <path d="M0 -5L3.5 3.5L0 2L-3.5 3.5Z" fill="#fff" />
    </svg>
  );
}

export function KillFeed({ s }: { s: GameSnapshot }) {
  return (
    <ul className="cs-feed" aria-live="polite">
      {s.killfeed.map((k) => (
        <li key={k.id} className={k.mine ? 'mine' : ''}>
          <span className={k.killerTeam === 'CT' ? 'ct' : 't'}>{k.killer}</span>
          <em>{k.weapon === 'zone' ? 'BO XANH' : k.weapon === 'knife' ? 'DAO' : k.weapon.toUpperCase()}</em>
          {k.wallbang && <em title="Xuyên tường">⟂</em>}
          {k.headshot && <Skull size={13} aria-label="trúng đầu" />}
          <span className={k.victimTeam === 'CT' ? 'ct' : 't'}>{k.victim}</span>
        </li>
      ))}
    </ul>
  );
}

export function Vitals({ s }: { s: GameSnapshot }) {
  return (
    <div className="cs-vitals">
      <div className={`cs-hp ${s.health <= 25 ? 'low' : ''}`}>
        <Plus size={20} strokeWidth={3} />
        <strong>{s.health}</strong>
      </div>
      <div className="cs-armor">
        <Shield size={18} />
        <strong>{s.armor}</strong>
        {s.helmet && <small>MŨ</small>}
      </div>
      <div className="cs-money">
        <b>$</b>
        {s.money.toLocaleString('en-US')}
      </div>
    </div>
  );
}

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

export function HurtIndicator({ s }: { s: GameSnapshot }) {
  return (
    <div className="cs-hurt" aria-hidden>
      {s.hurt.map((deg, i) => (
        <i key={i} style={{ transform: `rotate(${deg}deg)` }} />
      ))}
    </div>
  );
}

const SHOP_GROUPS: { title: string; items: BuyItem[] }[] = [
  { title: 'Súng lục', items: ['glock', 'usp', 'deagle'] },
  { title: 'Tiểu liên', items: ['mp9'] },
  { title: 'Súng trường', items: ['ak47', 'm4a4', 'awp'] },
  { title: 'Trang bị', items: ['kevlar', 'helmet'] },
  { title: 'Lựu đạn', items: ['he', 'flash', 'smoke'] }
];

export function BuyMenu({ s, onBuy, onClose }: { s: GameSnapshot; onBuy: (item: BuyItem) => void; onClose: () => void }) {
  if (!s.buyOpen) return null;
  const byItem = new Map<BuyItem, ShopItem>(s.shop.map((it) => [it.item, it]));
  return (
    <div className="cs-buy" role="dialog" aria-label="Menu mua đồ">
      <header>
        <div>
          <span>MUA ĐỒ</span>
          <small>Còn {s.buyLeft}s · Nhấn B hoặc Esc để đóng</small>
        </div>
        <strong>${s.money.toLocaleString('en-US')}</strong>
      </header>
      <div className="cs-buy-grid">
        {SHOP_GROUPS.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            {g.items.map((item) => {
              const it = byItem.get(item);
              if (!it) return null;
              return (
                <button key={item} disabled={!!it.block} title={it.block || `Mua ${it.name}`} onClick={() => onBuy(item)}>
                  <span>{it.name}</span>
                  <b>${it.price}</b>
                  {it.block && <small>{it.block}</small>}
                </button>
              );
            })}
          </section>
        ))}
      </div>
      <button className="cs-buy-close" onClick={onClose}>
        Đóng
      </button>
    </div>
  );
}

export function Scoreboard({ s, force = false }: { s: GameSnapshot; force?: boolean }) {
  if (!s.scoreboard && !force) return null;
  const table = (team: 'CT' | 'T') => (
    <section className={team === 'CT' ? 'ct' : 't'}>
      <header>
        <b>{team}</b>
        <strong>{s.score[team]}</strong>
      </header>
      <table aria-label={`Thống kê đội ${team}`}>
        <thead>
          <tr>
            <th scope="col">Người chơi</th>
            <th scope="col">Tiền</th>
            <th scope="col">Hạ gục</th>
            <th scope="col">Hỗ trợ</th>
            <th scope="col">Bị hạ</th>
            <th scope="col">Trúng đầu %</th>
            <th scope="col">MVP</th>
          </tr>
        </thead>
        <tbody>
          {s.rows
            .filter((r) => r.team === team)
            .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
            .map((r) => (
              <tr key={r.id} className={`${r.me ? 'me' : ''} ${r.alive ? '' : 'dead'}`}>
                <td>{r.name}</td>
                <td>{team === s.team ? `$${r.money}` : '—'}</td>
                <td>{r.kills}</td>
                <td>{r.assists}</td>
                <td>{r.deaths}</td>
                <td>{r.kills ? Math.round((r.hs / r.kills) * 100) : 0}</td>
                <td>{r.mvps ? `★${r.mvps}` : ''}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
  return (
    <div className="cs-board" role="region" aria-label="Bảng thống kê trận đấu">
      <div className="cs-board-title">
        <div><h2>Bảng thống kê trận đấu</h2><p>Vòng {s.round} · Đấu đội 5 vs 5</p></div>
        {!force && <span><kbd>Tab</kbd> Thả để đóng</span>}
      </div>
      {table('CT')}
      {table('T')}
    </div>
  );
}

export function Banner({ s }: { s: GameSnapshot }) {
  if (!s.banner) return null;
  return (
    <div className={`cs-banner ${s.banner.winner === 'CT' ? 'ct' : 't'}`} role="status">
      <strong>{s.banner.winner === 'CT' ? 'CT THẮNG' : 'T THẮNG'}</strong>
      <span>{s.banner.reason}</span>
      {s.banner.mvp && <small>★ MVP: {s.banner.mvp}</small>}
    </div>
  );
}

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
