import { useAudioSettings } from '../audio/useAudioSettings';
import { useEffect, useState } from 'react';
import { LogOut, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { CharacterState } from '../types/character';
import type { Mode } from './GameEngine';
import { useBattleEngine } from './useBattleEngine';
import type { Difficulty } from './ai';
import { Banner, BuyMenu, CrosshairView, DeathInfo, HurtIndicator, KillFeed, Radar, Scoreboard, ScopeOverlay, TopBar, Vitals, WeaponPanel } from './Hud';
import { ROUND } from './rules';
import { sound } from '../audio/soundManager';
import { PauseMenu } from './PauseMenu';
import { BigMap, HealProgress, InventoryScreen, LootHint, RoyaleResult, RoyaleTop, RoyaleVitals } from './RoyaleHud';
import { controlHelp, layoutForMode, type ControlAction } from './controlLayouts';
import { GameLoadingScreen } from '../loading/GameLoadingScreen';
import './game.css';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'cs', label: 'Đấu đội 5 vs 5', hint: 'Round, kinh tế, mua đồ như CS:GO' },
  { id: 'br', label: 'Sinh tồn · 16 người', hint: 'Nhặt đồ, bo thu hẹp, người cuối cùng thắng' }
];
const DIFFICULTY: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Dễ', hint: 'Bot phản xạ chậm, bắn lệch' },
  { id: 'normal', label: 'Thường', hint: 'Phản xạ ~0,4s, biết ghìm tâm' },
  { id: 'hard', label: 'Khó', hint: 'Phản xạ nhanh, hay nhắm đầu' }
];
/** 5v5 starts on easy bots; battle royale keeps the normal ones. */
const DEFAULT_DIFFICULTY: Record<Mode, Difficulty> = { cs: 'easy', br: 'normal' };
const readNumber = (key: string, fallback: number) => {
  try {
    return Number(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage is optional */
  }
};

export function GameScreen({ characterState, onExit }: { characterState: CharacterState; onExit: () => void }) {
  const { muted } = useAudioSettings();
  const [mode, setMode] = useState<Mode>('cs');
  const [difficultyByMode, setDifficultyByMode] = useState(DEFAULT_DIFFICULTY);
  const difficulty = difficultyByMode[mode];
  const [sens, setSens] = useState(() => readNumber('clothes.arena.sens', 1));
  const [best, setBest] = useState(() => readNumber('clothes.arena.best', 0));
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const { host, engine, state, error, isLoading, start, reset } = useBattleEngine(characterState, sens);

  const me = state.rows.find((r) => r.me);
  const myKills = me?.kills ?? 0;
  useEffect(() => {
    if (state.phase === 'matchEnd' && myKills > best) {
      setBest(myKills);
      save('clothes.arena.best', myKills);
    }
  }, [state.phase, myKills, best]);

  const hold = (action: ControlAction) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      engine.current?.control(action, true);
    },
    onPointerUp: () => engine.current?.control(action, false),
    onPointerCancel: () => engine.current?.control(action, false),
    onLostPointerCapture: () => engine.current?.control(action, false)
  });
  const press = (action: ControlAction) => () => {
    engine.current?.control(action, true);
    engine.current?.control(action, false);
  };
  const holdFire = (alt: boolean) => {
    const set = (down: boolean) => (alt ? engine.current?.secondary(down) : engine.current?.trigger(down));
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      },
      onPointerUp: () => set(false),
      onPointerCancel: () => set(false),
      onLostPointerCapture: () => set(false)
    };
  };

  const inGame = state.phase !== 'menu' && state.phase !== 'matchEnd';
  const playing = inGame && !state.paused;
  const won = state.matchWinner === state.team;
  const br = state.br;
  const controls = controlHelp(layoutForMode(mode));

  return (
    <div className="arena-screen">
      <div ref={host} className="arena-canvas" />
      {isLoading && <GameLoadingScreen gameKind="arena" message="Đang tải màn chơi…" />}
      <div className="cs-smoke" aria-hidden />
      <div className="cs-flash" aria-hidden />
      {inGame && (
        <>
          <ScopeOverlay s={state} />
          <CrosshairView s={state} />
          <HurtIndicator s={state} />
          {br ? <RoyaleTop br={br} /> : <TopBar s={state} />}
          <aside className="cs-radar-box">
            <Radar s={state} />
          </aside>
          <KillFeed s={state} />
          {state.killConfirm && <div key={state.killConfirm.id} className="cs-kill-confirm" aria-live="assertive"><span>✦</span><strong>{state.killConfirm.headshot ? 'HEADSHOT' : 'ELIMINATED'}</strong><span>✦</span></div>}
          {state.alive && (br ? <RoyaleVitals s={state} br={br} /> : <Vitals s={state} />)}
          {state.alive && <WeaponPanel s={state} />}
          {br && state.alive && <HealProgress br={br} />}
          {br && state.alive && <LootHint br={br} onTake={press('interact')} />}
          {br && (
            <InventoryScreen
              br={br}
              s={state}
              onTake={(id) => engine.current?.brTake(id)}
              onDrop={(what) => engine.current?.brDrop(what)}
              onUse={(med) => engine.current?.brUse(med)}
              onClose={() => engine.current?.brToggle('inv', false)}
            />
          )}
          {br && <BigMap br={br} onClose={() => engine.current?.brToggle('map', false)} />}
          <Banner s={state} />
          <DeathInfo s={state} />
          {state.message && !state.banner && (
            <div className="cs-message" role="status">
              {state.message}
            </div>
          )}
          {state.canBuy && !state.buyOpen && (
            <div className="cs-buyhint">
              <kbd>B</kbd> Mua đồ · còn {state.buyLeft}s
            </div>
          )}
          {state.pickup && state.alive && (
            <button className="cs-pickup" onClick={() => engine.current?.interact()}>
              <kbd>E</kbd> Nhặt {state.pickup}
            </button>
          )}
          <BuyMenu s={state} onBuy={(item) => engine.current?.purchase(item)} onClose={() => engine.current?.toggleBuy(false)} />
          <Scoreboard s={state} />
          <div className="arena-tools">
            <button
              aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              onClick={() => {
                sound.setMuted(!muted);
              }}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button aria-label="Tạm dừng" onClick={() => engine.current?.pause()}>
              <Pause size={16} />
            </button>
          </div>
        </>
      )}

      {playing && touch && (
        <div className="arena-touch">
          <div className="arena-pad">
            <button {...hold('forward')}>▲</button>
            <div>
              <button {...hold('left')}>◀</button>
              <button {...hold('back')}>▼</button>
              <button {...hold('right')}>▶</button>
            </div>
            <div>
              <button {...hold('jump')}>NHẢY</button>
              <button onClick={press('crouchToggle')}>NGỒI</button>
              {br && <button onClick={press('prone')}>NẰM</button>}
            </div>
          </div>
          <div className="arena-actions">
            {br ? (
              <>
                <button onClick={press('interact')}>NHẶT</button>
                <button onClick={press('inventory')}>TÚI</button>
                <button onClick={press('heal')}>HỒI</button>
              </>
            ) : (
              <button onClick={press('buy')}>MUA</button>
            )}
            <button onClick={press('lastWeapon')}>ĐỔI</button>
            <button onClick={() => engine.current?.reload()}>NẠP</button>
            <button {...holdFire(true)}>NGẮM</button>
            <button className="arena-fire" {...holdFire(false)}>
              BẮN
            </button>
          </div>
        </div>
      )}

      {state.paused && inGame && !error && (
        <PauseMenu
          state={state}
          sensitivity={sens}
          muted={muted}
          touch={touch}
          controls={controls}
          onResume={() => engine.current?.start(difficulty, touch, mode)}
          onRestart={() => engine.current?.restart()}
          onExit={onExit}
          onSensitivity={(value) => { setSens(value); save('clothes.arena.sens', value); }}
          onToggleMute={() => sound.setMuted(!muted)}
        />
      )}

      {((!playing && !(state.paused && inGame)) || error) && (
        <div className="arena-overlay">
          <section className={`arena-dialog ${state.phase === 'matchEnd' ? 'wide' : ''}`}>
            {state.phase === 'matchEnd' && br ? (
              <RoyaleResult br={br} />
            ) : state.phase === 'matchEnd' ? (
              <>
                <span className="arena-eyebrow">
                  KẾT THÚC TRẬN · CT {state.score.CT} – {state.score.T} T
                </span>
                <h1>{won ? 'Chiến thắng!' : 'Thất bại'}</h1>
                <p>
                  {me && `${me.kills} hạ gục · ${me.assists} hỗ trợ · ${me.deaths} lần bị hạ · ${me.kills ? Math.round((me.hs / me.kills) * 100) : 0}% trúng đầu · `}
                  Kỷ lục: {Math.max(best, myKills)} hạ gục / trận
                </p>
                <Scoreboard s={state} force />
              </>
            ) : (
              <>
                <span className="arena-eyebrow">{mode === 'br' ? 'SINH TỒN · 16 NGƯỜI · MỖI NGƯỜI MỘT PHE' : 'ĐẤU ĐỘI 5 VS 5 · CHƠI VỚI BOT'}</span>
                <h1>{mode === 'br' ? 'Người cuối cùng còn sống chiến thắng.' : 'Phe CT. Hạ gục toàn bộ phe T.'}</h1>
                <div className="arena-difficulty" role="radiogroup" aria-label="Chế độ chơi">
                  {MODES.map((m) => (
                    <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} disabled={isLoading} onClick={() => setMode(m.id)}>
                      <b>{m.label}</b>
                      <small>{m.hint}</small>
                    </button>
                  ))}
                </div>
                {mode === 'br' ? (
                  <p>
                    Bạn xuất hiện ở một góc bản đồ chỉ với con dao. Vào nhà nhặt súng, đạn đúng cỡ, áo giáp, mũ, balo và đồ hồi máu. Bo xanh thu hẹp dần, đứng ngoài bo sẽ mất máu.
                    Hạ đối thủ để nhặt đồ trong hòm của họ.
                  </p>
                ) : (
                  <p>
                    Thắng {ROUND.winRounds} round trước để thắng trận. Mỗi round có {ROUND.freeze}s chuẩn bị để mua đồ bằng tiền thưởng, rồi {Math.floor(ROUND.live / 60)}:
                    {String(ROUND.live % 60).padStart(2, '0')} để chiến đấu. Súng giật theo spray pattern, đứng yên mới bắn chính xác, trúng đầu gây sát thương x4, đạn xuyên
                    được tường mỏng.
                  </p>
                )}
                <div className="arena-difficulty" role="radiogroup" aria-label="Độ khó của bot">
                  {DIFFICULTY.map((d) => (
                    <button key={d.id} role="radio" aria-checked={difficulty === d.id} className={difficulty === d.id ? 'on' : ''} disabled={isLoading} onClick={() => setDifficultyByMode((prev) => ({ ...prev, [mode]: d.id }))}>
                      <b>{d.label}</b>
                      <small>{d.hint}</small>
                    </button>
                  ))}
                </div>
                <dl className="arena-keys">
                  {controls.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            {error ? (
              <div role="alert">
                <p>{error}</p>
                <button className="arena-primary" onClick={reset}>Thử lại</button>
                <button className="arena-secondary" onClick={onExit}>Thoát</button>
              </div>
            ) : state.phase === 'matchEnd' ? (
              <>
                <button className="arena-primary" onClick={reset}>
                  <RotateCcw size={18} /> Chơi trận mới
                </button>
                <button className="arena-secondary" onClick={onExit}>
                  <LogOut size={18} /> Thoát
                </button>
              </>
            ) : (
              <button className="arena-primary" disabled={isLoading} onClick={() => start({ difficulty, touch, mode })}>
                <Play size={18} /> {isLoading ? 'Đang tải màn chơi…' : 'Vào trận'}
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
