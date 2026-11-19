import type { ComponentProps, PointerEvent, ReactNode } from 'react';
import { LogOut, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useAudioSettings } from '../../../audio/useAudioSettings';
import { sound } from '../../../audio/soundManager';
import type { GameKind } from '../../../components/UI/home/homeGames';
import { GameLoadingScreen } from '../../../loading/GameLoadingScreen';
import { formatAmount } from '../../../wallet/walletStore';
import type { CoreAction } from '../input/controlLayouts';
import { CrosshairView } from './CrosshairView';
import { DeathInfo } from './DeathInfo';
import { HitMarker } from './HitMarker';
import { HurtIndicator } from './HurtIndicator';
import { PauseMenu } from './PauseMenu';
import { Radar, type RadarLine, type RadarRing } from './radar/Radar';
import type { RadarMap } from './radar/radarMap';
import { ScopeOverlay } from './ScopeOverlay';
import type { ShooterMatch } from './useShooterMatch';
import { WeaponPanel } from './WeaponPanel';
import './game.css';

/** The game's own parts of the screen, placed between the shared ones in this order. */
export interface ShooterScreenParts {
  /** Score / zone bar at the top, and any badge under it. */
  top: ReactNode;
  killFeed: ReactNode;
  /** Health and armour, shown while the player is alive. */
  vitals: ReactNode;
  /** Above the weapon panel: banners, prompts, the inventory and the map. */
  overlays: ReactNode;
  /** After the message line: the buy menu, the scoreboard. */
  menus?: ReactNode;
  /** The map under the radar's blips, with its zoom and place names. */
  radarMap?: RadarMap;
  /** Roads drawn on the radar. */
  radarLines?: readonly RadarLine[];
  radarRings?: readonly RadarRing[];
  /** The game's own minimap in place of the radar (the open world's city map). */
  radar?: ReactNode;
  /** A banner of the game is showing, which takes the place of the message line. */
  isMessageHidden?: boolean;
  /** The game has no use for the crosshair right now (the open world's player at the wheel). */
  isCrosshairHidden?: boolean;
  /** Extra stance buttons on the touch pad. */
  touchStance?: ReactNode;
  /** The game's buttons on the touch action bar. */
  touchActions: ReactNode;
  /** What the match-end dialog says (the result and the scoreboard). */
  result: ReactNode;
}

interface ShooterScreenProps extends ShooterScreenParts {
  match: ShooterMatch;
  loadingKind: GameKind;
  controls: [string, string][];
  pauseRounds?: ComponentProps<typeof PauseMenu>['rounds'];
  /** Gold earned for the finished match, once it has been paid. */
  earnedGold: number | null;
  onExit: () => void;
}

/** The frame every shooter game is played in: the 3D view, the shared HUD, touch controls, the pause menu and the result. */
export function ShooterScreen(props: ShooterScreenProps) {
  const { match, loadingKind, controls, pauseRounds, earnedGold, onExit } = props;
  const { host, engine, state, error, isLoading, replay, press, start, touch, gameplay } = match;
  const { muted } = useAudioSettings();

  const hold = (action: CoreAction) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      engine.current?.control(action, true);
    },
    onPointerUp: () => engine.current?.control(action, false),
    onPointerCancel: () => engine.current?.control(action, false),
    onLostPointerCapture: () => engine.current?.control(action, false),
  });
  const holdFire = (alt: boolean) => {
    const set = (down: boolean) => (alt ? engine.current?.secondary(down) : engine.current?.trigger(down));
    return {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      },
      onPointerUp: () => set(false),
      onPointerCancel: () => set(false),
      onLostPointerCapture: () => set(false),
    };
  };

  const inGame = state.phase !== 'menu' && state.phase !== 'matchEnd';
  const playing = inGame && !state.paused;
  const isMatchOver = state.phase === 'matchEnd';

  return (
    <div className="arena-screen">
      <div ref={host} className="arena-canvas" />
      {isLoading && <GameLoadingScreen gameKind={loadingKind} message="Đang tải màn chơi…" />}
      <div className="cs-smoke" aria-hidden />
      <div className="cs-flash" aria-hidden />
      {inGame && (
        <>
          <ScopeOverlay s={state} />
          {!props.isCrosshairHidden && <CrosshairView s={state} />}
          <HitMarker marker={state.hitMarker} />
          <HurtIndicator s={state} />
          {props.top}
          {props.radar ?? (
            <aside className="cs-radar-box">
              <Radar radar={state.radar} map={props.radarMap} lines={props.radarLines} rings={props.radarRings} />
            </aside>
          )}
          {props.killFeed}
          {state.alive && props.vitals}
          {state.alive && <WeaponPanel s={state} />}
          {props.overlays}
          <DeathInfo s={state} />
          {state.message && !props.isMessageHidden && (
            <div className="cs-message" role="status">
              {state.message}
            </div>
          )}
          {props.menus}
          <div className="arena-tools">
            <button aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} onClick={() => sound.setMuted(!muted)}>
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
              {props.touchStance}
            </div>
          </div>
          <div className="arena-actions">
            {props.touchActions}
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
          rounds={pauseRounds}
          sensitivity={gameplay.value.cameraSensitivity}
          muted={muted}
          touch={touch}
          controls={controls}
          onResume={start}
          onRestart={() => engine.current?.restart()}
          onExit={onExit}
          onSensitivity={(cameraSensitivity) => gameplay.patch({ cameraSensitivity })}
          isSensitivitySaveFailed={gameplay.status === 'error'}
          onToggleMute={() => sound.setMuted(!muted)}
        />
      )}

      {(isMatchOver || error) && (
        <div className="arena-overlay">
          <section className={`arena-dialog ${isMatchOver ? 'wide' : ''}`}>
            {isMatchOver && props.result}
            {isMatchOver && earnedGold !== null && (
              <p className="font-bold text-[#ffd34d]" role="status">+{formatAmount(earnedGold)} Vàng</p>
            )}
            {error ? (
              <div role="alert">
                <p>{error}</p>
                <button className="arena-primary" onClick={replay}>Thử lại</button>
                <button className="arena-secondary" onClick={onExit}>Thoát</button>
              </div>
            ) : (
              <>
                <button className="arena-primary" onClick={replay}>
                  <RotateCcw size={18} /> Chơi trận mới
                </button>
                <button className="arena-secondary" onClick={onExit}>
                  <LogOut size={18} /> Thoát
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
