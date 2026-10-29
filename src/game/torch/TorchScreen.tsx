import { useAudioSettings } from '../../audio/useAudioSettings';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { CharacterState } from '../../types/character';
import { sound } from '../../audio/soundManager';
import { TorchEngine, TorchSnapshot } from './TorchEngine';
import { loadNaturePack } from './naturePack';
import {
  BAG_SIZE, ENHANCE_MAX, ESSENCE_NAME, enhanceChance, enhanceCost, formatAffix, Item, itemStat, itemTitle, RARITIES, salvageYield, sellValue, SLOT_ICON, SLOT_NAME, SLOTS
} from './torchRules';
import {
  activeRune, canLearn, canLearnPassive, MAX_RANK, PASSIVE_LIST, PASSIVES, passiveRank, rankOf, RUNE_RANK, RUNE_TEXT, SkillId, skillRuntime, SKILL_LIST, SKILLS, SLOT_KEYS
} from './torchSkills';
import { GameLoadingScreen } from '../../loading/GameLoadingScreen';
import './torch.css';

const initial: TorchSnapshot = {
  phase: 'menu', paused: false, loaded: false, hp: 1, maxHp: 1, mp: 1, maxMp: 1, level: 1, xp: 0, xpNext: 1, gold: 0, essence: 0, kills: 0,
  zone: { id: 'village', name: '', level: 1 }, inTown: true, nearForge: false, nearFountain: false, banner: '', bar: [], basic: { name: '', icon: '' },
  potions: { hp: 0, mp: 0, hpLeft: 0, mpLeft: 0 }, gear: {}, bag: [],
  stats: { maxHp: 1, maxMp: 1, damage: 0, armor: 0, crit: 0, critDmg: 1.75, speed: 0, hpRegen: 0, mpRegen: 0, lifeSteal: 0, cdr: 0, goldFind: 0, xpPct: 0 },
  book: { points: 0, ranks: {}, runes: {}, slots: [null, null, null, null, null], passives: {} }, shield: 0, recall: 0,
  toasts: [], boss: null, hover: null, hurt: 0, panel: null, bigMap: false, save: null
};

const CONTROLS: [string, string][] = [
  ['Chuột trái', 'Đi tới / đánh kẻ địch (giữ để bám theo)'], ['Shift + chuột trái', 'Đứng yên và đánh'], ['Chuột phải · Q · E · R · F', 'Kỹ năng bạn đã gán'],
  ['K', 'Bảng kỹ năng: học, nâng bậc, gắn ngọc, gán phím'], ['I · Tab · C', 'Túi đồ và trang bị'], ['M', 'Bản đồ thế giới'], ['H', 'Trở về làng (đứng yên 3 giây)'],
  ['1 · 2', 'Bình máu · bình năng lượng'], ['W A S D', 'Di chuyển bằng phím'], ['Con lăn', 'Thu phóng'], ['Esc', 'Đóng bảng / tạm dừng']
];

const savedWhen = (ms: number) => (ms ? new Date(ms).toLocaleString('vi-VN') : '');

/** The lines of an item: base stats (after enhancement) then affixes. */
function ItemLines({ item }: { item: Item }) {
  const lines = [
    itemStat(item, 'damage') && `+${itemStat(item, 'damage')} công`,
    itemStat(item, 'armor') && `+${itemStat(item, 'armor')} giáp`,
    itemStat(item, 'health') && `+${itemStat(item, 'health')} máu`,
    itemStat(item, 'crit') && `+${(itemStat(item, 'crit') * 100).toFixed(1)}% chí mạng`
  ].filter(Boolean);
  return (
    <>
      <span className="base">{lines.join(' · ')}</span>
      {item.affixes.map((a) => (
        <span key={a.stat} className="aff">
          {formatAffix(a)}
        </span>
      ))}
    </>
  );
}

export function TorchScreen({ characterState, onExit }: { characterState: CharacterState; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<TorchEngine | null>(null);
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  const { muted } = useAudioSettings();
  const [run, setRun] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [skillSel, setSkillSel] = useState<SkillId>('bolt');

  useEffect(() => {
    if (!host.current) return;
    setState(initial);
    setError('');
    let cancelled = false;
    // the world is built from the nature pack, so the pack is fetched first (the engine falls back to plain shapes if it fails)
    void loadNaturePack().then(() => {
      if (cancelled || !host.current) return;
      try {
        engine.current = new TorchEngine(host.current, characterState, setState);
        engine.current.setMinimap(mapRef.current);
      } catch (e) {
        setError('Không khởi tạo được màn chơi 3D. Hãy thử tải lại trang.');
        console.error(e);
      }
    });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, [characterState, run]);

  const s = state;
  const playing = s.phase === 'playing';
  const hpK = s.maxHp ? Math.max(0, Math.min(1, s.hp / s.maxHp)) : 0;
  const mpK = s.maxMp ? Math.max(0, Math.min(1, s.mp / s.maxMp)) : 0;
  const eng = engine.current;
  const items: Item[] = [...(SLOTS.map((slot) => s.gear[slot]).filter(Boolean) as Item[]), ...s.bag];
  const chosen = items.find((i) => i.id === sel) ?? null;
  const wornChosen = !!chosen && s.gear[chosen.slot]?.id === chosen.id;

  const tooltip = (it: Item) => {
    const cost = enhanceCost(it);
    const can = s.inTown;
    return (
      <div className="tl-item-card">
        <b style={{ color: RARITIES[it.rarity].color }}>{itemTitle(it)}</b>
        <small>
          {SLOT_NAME[it.slot]} · {RARITIES[it.rarity].name} · cấp {it.level}
        </small>
        <ItemLines item={it} />
        <div className="tl-item-actions">
          {!wornChosen && <button onClick={() => eng?.equip(it.id)}>Mặc</button>}
          {wornChosen && <button onClick={() => eng?.unequip(it.slot)}>Cởi</button>}
          <button disabled={!can || it.enhance >= ENHANCE_MAX} onClick={() => eng?.enhance(it.id)} title={can ? '' : 'Cần ở trong làng'}>
            {it.enhance >= ENHANCE_MAX ? 'Rèn tối đa' : `Rèn +${it.enhance + 1} · ${cost.gold}🪙 ${cost.essence}💎 · ${Math.round(enhanceChance(it.enhance) * 100)}%`}
          </button>
          {!wornChosen && (
            <>
              <button disabled={!can} onClick={() => eng?.salvage(it.id)} title={can ? '' : 'Cần ở trong làng'}>
                Phân rã +{salvageYield(it)}💎
              </button>
              <button disabled={!can} onClick={() => eng?.sell(it.id)} title={can ? '' : 'Cần ở trong làng'}>
                Bán {sellValue(it)}🪙
              </button>
            </>
          )}
        </div>
        {!can && <small className="warn">Rèn, phân rã và bán chỉ làm được trong làng.</small>}
      </div>
    );
  };

  return (
    <div className="tl-screen">
      <div ref={host} className="tl-canvas" />
      {!s.loaded && !error && <GameLoadingScreen gameKind="torch" message="Đang tải nhân vật…" />}
      {playing && s.hurt > 0 && <div key={s.hurt} className="tl-hurt" aria-hidden />}

      <div className={`tl-minimap ${s.bigMap ? 'big' : ''} ${playing ? '' : 'off'}`}>
        <canvas ref={mapRef} width={260} height={260} aria-label="Bản đồ" />
        {playing && (
          <button className="tl-map-btn" onClick={() => eng?.toggleMap()} title="Bản đồ thế giới (M)">
            {s.bigMap ? '−' : '＋'}
          </button>
        )}
      </div>

      {playing && (
        <>
          <div className="tl-top">
            <div className="tl-level">
              <b>{s.level}</b>
              <small>CẤP</small>
            </div>
            <div className="tl-stats">
              <span>🪙 {s.gold}</span>
              <span>💎 {s.essence}</span>
              <span>☠ {s.kills}</span>
              <span className="zone">
                {s.zone.name} {s.zone.id !== 'village' && `· quái cấp ~${s.zone.level}`}
              </span>
            </div>
          </div>

          {s.banner && (
            <div key={s.banner} className="tl-banner" role="status">
              {s.banner}
            </div>
          )}

          {s.boss && (
            <div className="tl-boss">
              <span>{s.boss.name}</span>
              <i>
                <b style={{ width: `${Math.max(0, (s.boss.hp / s.boss.max) * 100)}%` }} />
              </i>
            </div>
          )}
          {!s.boss && s.hover && (
            <div className={`tl-hover ${s.hover.champion ? 'champ' : ''}`}>
              <span>
                {s.hover.name} · cấp {s.hover.level}
              </span>
              <i>
                <b style={{ width: `${Math.max(0, (s.hover.hp / s.hover.max) * 100)}%` }} />
              </i>
            </div>
          )}

          {s.recall > 0 && (
            <div className="tl-recall" role="status">
              Đang trở về làng…
              <i>
                <b style={{ width: `${s.recall * 100}%` }} />
              </i>
            </div>
          )}

          <ul className="tl-toasts">
            {s.toasts.map((t) => (
              <li key={t.id} style={{ color: t.color }}>
                {t.text}
              </li>
            ))}
          </ul>

          <div className="tl-bottom">
            <div className="tl-orb hp" role="meter" aria-label="Máu" aria-valuenow={s.hp} aria-valuemax={s.maxHp}>
              <div className="fill" style={{ height: `${hpK * 100}%` }} />
              <span>
                {s.hp}
                <small>/{s.maxHp}</small>
              </span>
              {s.shield > 0 && <em className="shield">🛡 {s.shield}</em>}
            </div>
            <div className="tl-mid">
              <div className="tl-skills">
                <div className="tl-skill" title={`${s.basic.name} — Chuột trái`}>
                  <span className="ico">{s.basic.icon}</span>
                  <kbd>LMB</kbd>
                </div>
                {s.bar.map((b) => {
                  const lack = !!b.id && s.mp < b.cost;
                  return (
                    <button
                      key={b.slot}
                      className={`tl-skill ${lack ? 'lack' : ''} ${b.id ? '' : 'empty'}`}
                      title={b.id ? `${b.name} (bậc ${b.rank}) — ${SKILLS[b.id].blurb}` : 'Ô trống: mở bảng kỹ năng (K) để gán'}
                      onClick={() => eng?.setPanel('skills')}
                    >
                      <span className="ico">{b.icon || '＋'}</span>
                      {b.left > 0.05 && <span className="cd" style={{ height: `${Math.min(100, (b.left / (b.cd || 1)) * 100)}%` }} />}
                      {b.left > 0.05 && <em>{b.left >= 1 ? Math.ceil(b.left) : b.left.toFixed(1)}</em>}
                      <kbd>{b.key.replace('Chuột phải', 'RMB')}</kbd>
                      {b.id && b.cost > 0 && <small>{b.cost}</small>}
                    </button>
                  );
                })}
                <div className="tl-gap" />
                <button className={`tl-skill pot ${s.potions.hpLeft > 0 || !s.potions.hp ? 'dim' : ''}`} onClick={() => eng?.usePotion('hp')} title="Bình máu (1)">
                  <span className="ico">🧪</span>
                  <em className="n">{s.potions.hp}</em>
                  <kbd>1</kbd>
                  {s.potions.hpLeft > 0 && <span className="cd" style={{ height: `${(s.potions.hpLeft / 8) * 100}%` }} />}
                </button>
                <button className={`tl-skill pot mp ${s.potions.mpLeft > 0 || !s.potions.mp ? 'dim' : ''}`} onClick={() => eng?.usePotion('mp')} title="Bình năng lượng (2)">
                  <span className="ico">💧</span>
                  <em className="n">{s.potions.mp}</em>
                  <kbd>2</kbd>
                  {s.potions.mpLeft > 0 && <span className="cd" style={{ height: `${(s.potions.mpLeft / 8) * 100}%` }} />}
                </button>
              </div>
              <div className="tl-xp" title={`Kinh nghiệm ${s.xp} / ${s.xpNext}`}>
                <b style={{ width: `${Math.min(100, (s.xp / s.xpNext) * 100)}%` }} />
              </div>
            </div>
            <div className="tl-orb mp" role="meter" aria-label="Năng lượng" aria-valuenow={s.mp} aria-valuemax={s.maxMp}>
              <div className="fill" style={{ height: `${mpK * 100}%` }} />
              <span>
                {s.mp}
                <small>/{s.maxMp}</small>
              </span>
            </div>
          </div>

          <div className="tl-tools">
            <button aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} onClick={() => sound.setMuted(!muted)}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button aria-label="Túi đồ" title="Túi đồ (I)" onClick={() => eng?.setPanel('bag')}>
              🎒
            </button>
            <button aria-label="Kỹ năng" title="Kỹ năng (K)" className={s.book.points > 0 ? 'attn' : ''} onClick={() => eng?.setPanel('skills')}>
              ✨{s.book.points > 0 && <i>{s.book.points}</i>}
            </button>
            <button aria-label="Về làng" title="Trở về làng (H)" onClick={() => eng?.recall()}>
              🏠
            </button>
            <button aria-label="Tạm dừng" onClick={() => eng?.pause()}>
              <Pause size={16} />
            </button>
          </div>

          {s.panel === 'bag' && (
            <aside className="tl-panel bag" aria-label="Túi đồ">
              <header>
                <h2>Trang bị &amp; túi đồ</h2>
                <button className="x" aria-label="Đóng" onClick={() => eng?.setPanel(null)}>
                  ✕
                </button>
              </header>
              <div className="tl-wallet">
                <span>🪙 {s.gold}</span>
                <span title={ESSENCE_NAME}>
                  💎 {s.essence} {ESSENCE_NAME}
                </span>
                <span className={s.inTown ? 'ok' : 'no'}>{s.inTown ? '🏘 Trong làng: có thể rèn' : '🌲 Ngoài làng'}</span>
              </div>
              <div className="tl-equip">
                {SLOTS.map((slot) => {
                  const it = s.gear[slot];
                  return (
                    <button
                      key={slot}
                      className={`tl-slot ${it && sel === it.id ? 'sel' : ''}`}
                      style={it ? { borderColor: RARITIES[it.rarity].color } : undefined}
                      title={it ? itemTitle(it) : SLOT_NAME[slot]}
                      onClick={() => it && setSel(it.id)}
                    >
                      <span className="ico">{SLOT_ICON[slot]}</span>
                      <small style={{ color: it ? RARITIES[it.rarity].color : undefined }}>{it ? itemTitle(it) : SLOT_NAME[slot]}</small>
                    </button>
                  );
                })}
              </div>
              <div className="tl-bag" role="list">
                {Array.from({ length: BAG_SIZE }, (_, i) => {
                  const it = s.bag[i];
                  return it ? (
                    <button
                      key={it.id}
                      role="listitem"
                      className={`tl-cell ${sel === it.id ? 'sel' : ''}`}
                      style={{ borderColor: RARITIES[it.rarity].color }}
                      title={itemTitle(it)}
                      onClick={() => setSel(it.id)}
                      onDoubleClick={() => eng?.equip(it.id)}
                    >
                      <span className="ico">{SLOT_ICON[it.slot]}</span>
                      {it.enhance > 0 && <i>+{it.enhance}</i>}
                    </button>
                  ) : (
                    <div key={`e${i}`} role="listitem" className="tl-cell empty" />
                  );
                })}
              </div>
              <div className="tl-bag-tools">
                <small>
                  {s.bag.length}/{BAG_SIZE} · nhấp đúp để mặc
                </small>
                <button disabled={!s.inTown} onClick={() => eng?.sellJunk()} title="Bán mọi đồ Thường và Phép chưa rèn">
                  Bán đồ Thường &amp; Phép
                </button>
              </div>
              {chosen ? tooltip(chosen) : <p className="tl-hint">Chọn một món để xem chi tiết. Đồ có thể rèn tới +{ENHANCE_MAX} ở trong làng.</p>}
              <dl className="tl-statlist">
                <div><dt>Sát thương</dt><dd>{Math.round(s.stats.damage)}</dd></div>
                <div><dt>Giáp</dt><dd>{Math.round(s.stats.armor)}</dd></div>
                <div><dt>Chí mạng</dt><dd>{Math.round(s.stats.crit * 100)}% · x{s.stats.critDmg.toFixed(2)}</dd></div>
                <div><dt>Tốc độ</dt><dd>{s.stats.speed.toFixed(1)}</dd></div>
                <div><dt>Hút máu</dt><dd>{(s.stats.lifeSteal * 100).toFixed(1)}%</dd></div>
                <div><dt>Giảm hồi chiêu</dt><dd>{Math.round(s.stats.cdr * 100)}%</dd></div>
                <div><dt>Vàng rơi</dt><dd>+{Math.round(s.stats.goldFind * 100)}%</dd></div>
                <div><dt>Kinh nghiệm</dt><dd>+{Math.round(s.stats.xpPct * 100)}%</dd></div>
              </dl>
            </aside>
          )}

          {s.panel === 'skills' && (
            <aside className="tl-panel skills" aria-label="Kỹ năng">
              <header>
                <h2>Kỹ năng của {characterState.name}</h2>
                <span className="pts">
                  Điểm kỹ năng: <b>{s.book.points}</b>
                </span>
                <button className="x" aria-label="Đóng" onClick={() => eng?.setPanel(null)}>
                  ✕
                </button>
              </header>
              <div className="tl-slots">
                {s.book.slots.map((id, i) => (
                  <div key={i} className="tl-slotbox">
                    <kbd>{SLOT_KEYS[i]}</kbd>
                    <button className="tl-skill" title={id ? `${SKILLS[id].name} — nhấp để gỡ` : 'Trống'} onClick={() => id && eng?.bindSkill(i, null)}>
                      <span className="ico">{id ? SKILLS[id].icon : '＋'}</span>
                    </button>
                  </div>
                ))}
                <p className="tl-hint">Chọn một kỹ năng bên dưới rồi bấm "Gán" vào một phím.</p>
              </div>
              <div className="tl-skill-grid">
                {SKILL_LIST.map((id) => {
                  const d = SKILLS[id];
                  const rank = rankOf(s.book, id);
                  const locked = s.level < d.reqLevel;
                  return (
                    <button key={id} className={`tl-card ${skillSel === id ? 'sel' : ''} ${rank ? 'known' : ''} ${locked ? 'locked' : ''}`} onClick={() => setSkillSel(id)}>
                      <span className="ico">{d.icon}</span>
                      <b>{d.name}</b>
                      <small>{locked ? `Cấp ${d.reqLevel}` : rank ? `Bậc ${rank}/${MAX_RANK}` : 'Chưa học'}</small>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const d = SKILLS[skillSel];
                const rank = rankOf(s.book, skillSel);
                const run = skillRuntime(s.book, skillSel, s.stats.cdr);
                const rune = activeRune(s.book, skillSel);
                return (
                  <div className="tl-detail">
                    <h3>
                      {d.icon} {d.name}
                      <small> · {rank ? `Bậc ${rank}/${MAX_RANK}` : 'chưa học'}</small>
                    </h3>
                    <p>{d.blurb}</p>
                    <dl className="tl-statlist">
                      <div><dt>Sát thương</dt><dd>{Math.round(run.mult * 100)}% công</dd></div>
                      <div><dt>Năng lượng</dt><dd>{run.cost}</dd></div>
                      <div><dt>Hồi chiêu</dt><dd>{run.cooldown.toFixed(1)} giây</dd></div>
                      <div><dt>Phạm vi</dt><dd>{(d.range ? run.range : run.radius).toFixed(1)} m</dd></div>
                    </dl>
                    <div className="tl-row">
                      <button disabled={!canLearn(s.book, skillSel, s.level)} onClick={() => eng?.learnSkill(skillSel)}>
                        {rank ? 'Nâng bậc' : 'Học'} (1 điểm)
                      </button>
                      {rank > 0 &&
                        SLOT_KEYS.map((k, i) => (
                          <button key={k} className={s.book.slots[i] === skillSel ? 'on' : ''} onClick={() => eng?.bindSkill(i, skillSel)}>
                            Gán {k}
                          </button>
                        ))}
                    </div>
                    <div className="tl-runes">
                      <small>Ngọc kỹ năng (mở từ bậc {RUNE_RANK}):</small>
                      {d.runes.map((r, i) => {
                        const on = rune === r;
                        return (
                          <button key={r} disabled={rank < RUNE_RANK} className={on ? 'on' : ''} onClick={() => eng?.chooseRune(skillSel, on ? -1 : i)} title={RUNE_TEXT[r]}>
                            <b>{d.runeNames[i]}</b>
                            <span>{RUNE_TEXT[r]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div className="tl-passives">
                <h3>Thiên phú</h3>
                {PASSIVE_LIST.map((id) => {
                  const p = PASSIVES[id];
                  const r = passiveRank(s.book, id);
                  return (
                    <div key={id} className="tl-passive">
                      <span className="ico">{p.icon}</span>
                      <div>
                        <b>{p.name}</b>{' '}
                        <small>
                          {r}/{MAX_RANK}
                        </small>
                        <small className="d">{s.level < p.reqLevel ? `Cần cấp ${p.reqLevel}` : p.text}</small>
                      </div>
                      <button disabled={!canLearnPassive(s.book, id, s.level)} onClick={() => eng?.learnTalent(id)}>
                        ＋
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </>
      )}

      {error && (
        <div className="tl-overlay">
          <section className="tl-dialog">
            <p role="alert">{error}</p>
            <button className="tl-primary" onClick={onExit}>
              <LogOut size={18} /> Thoát
            </button>
          </section>
        </div>
      )}

      {!error && s.phase === 'menu' && (
        <div className="tl-overlay">
          <section className="tl-dialog">
            <span className="tl-eyebrow">ACTION RPG · THẾ GIỚI MỞ</span>
            <h1>TORCHLIGHT</h1>
            <p>
              Từ Làng Hỏa Đăng, hãy băng qua bốn vùng đất ngày càng hiểm: đồng cỏ, rừng u ám, đầm lầy độc và núi lửa. Hạ các trại quái để lấy kinh nghiệm, vàng, tinh thạch và trang bị đủ năm độ hiếm; mang đồ
              về làng để rèn lên tới +{ENHANCE_MAX}. Bạn tự học, nâng bậc và gắn ngọc cho từng kỹ năng của nhân vật. Mỗi vùng có một trùm.
            </p>
            <dl className="tl-keys">
              {CONTROLS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {s.save && (
              <button className="tl-primary" disabled={!s.loaded} onClick={() => eng?.start(false)}>
                <Play size={18} /> {s.loaded ? `Tiếp tục hành trình · cấp ${s.save.level}` : 'Đang tải nhân vật…'}
              </button>
            )}
            <button
              className={s.save ? 'tl-secondary' : 'tl-primary'}
              disabled={!s.loaded}
              onClick={() => {
                if (s.save && !window.confirm('Bắt đầu hành trình mới sẽ xoá tiến trình đã lưu của nhân vật này. Tiếp tục?')) return;
                eng?.start(true);
              }}
            >
              <Play size={18} /> {s.loaded ? 'Hành trình mới' : 'Đang tải nhân vật…'}
            </button>
            {s.save && <small className="tl-saved">Lưu lúc {savedWhen(s.save.savedAt)}</small>}
            <button className="tl-secondary" onClick={onExit}>
              <LogOut size={18} /> Thoát
            </button>
          </section>
        </div>
      )}

      {!error && playing && s.paused && (
        <div className="tl-overlay">
          <section className="tl-dialog small">
            <span className="tl-eyebrow">TẠM DỪNG · ĐÃ LƯU</span>
            <h1>Nghỉ một nhịp.</h1>
            <button className="tl-primary" onClick={() => eng?.resume()}>
              <Play size={18} /> Tiếp tục
            </button>
            <button className="tl-secondary" onClick={onExit}>
              <LogOut size={18} /> Thoát
            </button>
          </section>
        </div>
      )}

      {!error && s.phase === 'dead' && (
        <div className="tl-overlay dead">
          <section className="tl-dialog small">
            <span className="tl-eyebrow">KẾT THÚC LƯỢT CHƠI</span>
            <h1>Bạn đã gục ngã</h1>
            <p>
              Cấp {s.level} · {s.kills} quái đã hạ. Trang bị và kỹ năng vẫn còn; bạn mất 10% vàng và tỉnh dậy ở làng.
            </p>
            <button className="tl-primary" onClick={() => eng?.respawn()}>
              <RotateCcw size={18} /> Hồi sinh ở làng
            </button>
            <button className="tl-secondary" onClick={onExit}>
              <LogOut size={18} /> Thoát
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
