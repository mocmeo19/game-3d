import { Backpack, HardHat, Shield, Users, Crosshair, X } from 'lucide-react';
import type { GameSnapshot, RoyaleSnapshot } from './GameEngine';
import { AMMO_NAME, AmmoType, MEDS, MedId } from './royale';
import { WeaponId, WEAPONS, WORLD_LIMIT } from './rules';

/** Battle royale HUD: survivors, zone timer, health + boost, armour, healing, loot prompt, inventory and map screens. */

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export function RoyaleTop({ br }: { br: RoyaleSnapshot }) {
  const z = br.zone;
  return (
    <>
      <div className="br-count" aria-label="Số người còn sống">
        <span>
          <Users size={14} /> <b>{br.alive}</b> CÒN SỐNG
        </span>
        <span>
          <Crosshair size={14} /> <b>{br.kills}</b> HẠ GỤC
        </span>
      </div>
      <div className={`br-zone ${z.shrinking ? 'shrinking' : ''}`} role="status">
        {z.next ? (
          <>
            <b>{z.shrinking ? 'BO ĐANG THU HẸP' : 'BO THU HẸP SAU'}</b>
            <strong>{mmss(z.timeLeft)}</strong>
          </>
        ) : (
          <b>VÒNG CUỐI</b>
        )}
        {z.outside && <em>Ngoài bo · cách {Math.ceil(z.distance)} m · −{z.dps}/s</em>}
      </div>
    </>
  );
}

const ArmourIcon = ({ kind, item }: { kind: 'vest' | 'helmet'; item: RoyaleSnapshot['vest'] }) => (
  <div className={`br-gear ${item ? '' : 'none'}`} title={item ? `${kind === 'vest' ? 'Áo giáp' : 'Mũ'} cấp ${item.level}` : kind === 'vest' ? 'Chưa có áo giáp' : 'Chưa có mũ'}>
    {kind === 'vest' ? <Shield size={18} /> : <HardHat size={18} />}
    {item && <small>{item.level}</small>}
    {item && <i style={{ width: `${(item.durability / item.max) * 100}%` }} />}
  </div>
);

export function RoyaleVitals({ s, br }: { s: GameSnapshot; br: RoyaleSnapshot }) {
  const hp = s.health;
  return (
    <div className="br-vitals">
      <div className="br-gearrow">
        <ArmourIcon kind="helmet" item={br.helmet} />
        <ArmourIcon kind="vest" item={br.vest} />
        <div className={`br-gear ${br.backpack ? '' : 'none'}`} title={br.backpack ? `Balo cấp ${br.backpack}` : 'Chưa có balo'}>
          <Backpack size={18} />
          {br.backpack > 0 && <small>{br.backpack}</small>}
        </div>
      </div>
      <div className="br-boost" aria-label={`Tăng lực ${Math.round(br.boost)}`}>
        {[20, 60, 90, 100].map((cap, i, arr) => {
          const lo = i ? arr[i - 1] : 0;
          return (
            <i key={cap} style={{ flex: cap - lo }}>
              <b style={{ width: `${Math.max(0, Math.min(1, (br.boost - lo) / (cap - lo))) * 100}%` }} />
            </i>
          );
        })}
      </div>
      <div className={`br-health ${hp <= 25 ? 'low' : ''}`} aria-label={`Máu ${hp}`}>
        <b style={{ width: `${hp}%` }} />
      </div>
      <div className="br-meds">
        <span title="H · hồi máu">
          <kbd>H</kbd> {br.meds.bandage} băng · {br.meds.firstaid} sơ cứu · {br.meds.medkit} y tế
        </span>
        <span title="J · tăng lực">
          <kbd>J</kbd> {br.meds.energy} nước · {br.meds.painkiller} thuốc
        </span>
      </div>
    </div>
  );
}

export function HealProgress({ br }: { br: RoyaleSnapshot }) {
  if (!br.healing) return null;
  const deg = br.healing.progress * 360;
  return (
    <div className="br-heal" role="status">
      <div className="ring" style={{ background: `conic-gradient(#f2f2ea ${deg}deg, #ffffff22 ${deg}deg)` }} />
      <span>{br.healing.name}</span>
    </div>
  );
}

export function LootHint({ br, onTake }: { br: RoyaleSnapshot; onTake: () => void }) {
  if (!br.hint || br.invOpen) return null;
  return (
    <button className="br-hint" onClick={onTake}>
      <kbd>F</kbd> Nhặt {br.hint}
      {br.near.length > 1 && <small> · Tab xem {br.near.length} món</small>}
    </button>
  );
}

export type DropWhat = { ammo?: AmmoType; med?: MedId; grenade?: WeaponId; gear?: 'vest' | 'helmet' | 'backpack' };

export function InventoryScreen({
  br,
  s,
  onTake,
  onDrop,
  onUse,
  onClose
}: {
  br: RoyaleSnapshot;
  s: GameSnapshot;
  onTake: (id: number) => void;
  onDrop: (what: DropWhat) => void;
  onUse: (med: MedId) => void;
  onClose: () => void;
}) {
  if (!br.invOpen) return null;
  const load = br.weight / br.capacity;
  const guns = s.slots.filter((x) => x.slot <= 2);
  return (
    <div className="br-inv" role="dialog" aria-label="Túi đồ">
      <section className="near">
        <h3>XUNG QUANH</h3>
        {br.near.length === 0 && <p className="empty">Không có gì trong tầm tay.</p>}
        <ul>
          {br.near.map((n) => (
            <li key={n.id}>
              <button onClick={() => onTake(n.id)} className={n.upgrade ? 'up' : ''}>
                <span>{n.name}</span>
                <small>{n.crate ? 'Hòm' : n.upgrade ? 'Tốt hơn' : 'Nhặt'}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="bag">
        <header>
          <h3>BALO</h3>
          <button className="close" aria-label="Đóng túi đồ" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className={`weight ${load > 0.9 ? 'full' : ''}`} title={`${br.weight} / ${br.capacity}`}>
          <i style={{ width: `${Math.min(100, load * 100)}%` }} />
          <span>
            {br.weight} / {br.capacity}
          </span>
        </div>
        <h4>Trang bị</h4>
        <div className="row">
          {(['helmet', 'vest'] as const).map((g) => {
            const it = br[g];
            return (
              <button key={g} disabled={!it} onClick={() => onDrop({ gear: g })} title="Bỏ xuống">
                {g === 'vest' ? 'Áo giáp' : 'Mũ'} {it ? `cấp ${it.level} · ${Math.round(it.durability)}/${it.max}` : '—'}
              </button>
            );
          })}
          <button disabled={!br.backpack} onClick={() => onDrop({ gear: 'backpack' })} title="Bỏ xuống">
            Balo {br.backpack ? `cấp ${br.backpack}` : '—'}
          </button>
        </div>
        <h4>Vũ khí</h4>
        <div className="row">
          {guns.length ? (
            guns.map((g) => (
              <span key={g.slot} className="chip">
                {g.slot} · {g.name}
              </span>
            ))
          ) : (
            <span className="chip dim">Chỉ có dao</span>
          )}
        </div>
        <h4>Đạn</h4>
        <ul className="list">
          {(Object.keys(br.ammo) as AmmoType[])
            .filter((t) => br.ammo[t] > 0)
            .map((t) => (
              <li key={t}>
                <span>{AMMO_NAME[t]}</span>
                <b>{br.ammo[t]}</b>
                <button onClick={() => onDrop({ ammo: t })}>Bỏ</button>
              </li>
            ))}
        </ul>
        <h4>Hồi phục</h4>
        <ul className="list">
          {(Object.keys(br.meds) as MedId[])
            .filter((m) => br.meds[m] > 0)
            .map((m) => (
              <li key={m}>
                <span>{MEDS[m].name}</span>
                <b>{br.meds[m]}</b>
                <button onClick={() => onUse(m)}>Dùng</button>
                <button onClick={() => onDrop({ med: m })}>Bỏ</button>
              </li>
            ))}
        </ul>
        {br.grenades.length > 0 && (
          <>
            <h4>Lựu đạn</h4>
            <ul className="list">
              {br.grenades.map((g, i) => (
                <li key={`${g}-${i}`}>
                  <span>{WEAPONS[g].name}</span>
                  <button onClick={() => onDrop({ grenade: g })}>Bỏ</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/** Big map (M): buildings, roads, the zone and the next circle, the player. North (−z) is up. */
export function BigMap({ br, onClose }: { br: RoyaleSnapshot; onClose: () => void }) {
  if (!br.mapOpen) return null;
  const L = WORLD_LIMIT;
  const z = br.zone;
  return (
    <div className="br-map" role="dialog" aria-label="Bản đồ" onClick={onClose}>
      <svg viewBox={`${-L} ${-L} ${L * 2} ${L * 2}`}>
        <rect x={-L} y={-L} width={L * 2} height={L * 2} fill="#56683f" />
        <rect x={-5} y={-L} width={10} height={L * 2} fill="#6b6d69" />
        <rect x={-L} y={-31} width={L * 2} height={8} fill="#6b6d69" />
        {br.buildings.map((b, i) => (
          <rect key={i} x={b.minX} y={b.minZ} width={b.maxX - b.minX} height={b.maxZ - b.minZ} fill="#b8a98a" stroke="#3d3528" strokeWidth={0.6} />
        ))}
        <circle cx={z.cur.x} cy={z.cur.z} r={z.cur.r} fill="none" stroke="#3d7dff" strokeWidth={1.6} />
        {z.next && z.next.r > 0 && <circle cx={z.next.x} cy={z.next.z} r={z.next.r} fill="none" stroke="#ffffff" strokeWidth={1} />}
        <g transform={`translate(${br.me.x} ${br.me.z}) rotate(${(-br.me.yaw * 180) / Math.PI})`}>
          <path d="M0 -4.5L3 3L0 1.6L-3 3Z" fill="#ffd34d" stroke="#000" strokeWidth={0.5} />
        </g>
      </svg>
      <p>M hoặc nhấp để đóng · Vòng xanh: bo hiện tại · Vòng trắng: bo tiếp theo</p>
    </div>
  );
}

export function RoyaleResult({ br }: { br: RoyaleSnapshot }) {
  const win = br.placement === 1;
  return (
    <>
      <span className="arena-eyebrow">SINH TỒN · {br.total} NGƯỜI CHƠI</span>
      <h1>{win ? 'Chiến thắng! Tối nay ăn gà!' : 'Chúc may mắn lần sau'}</h1>
      <div className="br-rank">
        <strong>#{br.placement}</strong>
        <span>/ {br.total}</span>
      </div>
      <p>{br.kills} hạ gục</p>
    </>
  );
}
