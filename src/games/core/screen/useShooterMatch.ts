import { useEffect, useRef, useState } from 'react';
import type { CharacterState } from '../../../types/character';
import { sound } from '../../../audio/soundManager';
import { getGameplaySettings, saveGameplaySettings } from '../../../settings/gameplaySettings';
import { useAutoSavedSettings } from '../../../settings/useAutoSavedSettings';
import type { Difficulty } from '../agents/ai';
import type { GameSnapshot } from '../engine/snapshotTypes';
import type { CoreAction } from '../input/controlLayouts';

/** What the screen drives on a shooter engine (every GameEngine has these). */
export interface ShooterEngineHandle {
  start(difficulty: Difficulty, touch?: boolean): void;
  restart(): void;
  pause(): void;
  setSensitivity(sensitivity: number): void;
  /** A key of the game's layout (the shared ones always exist; the game's engine takes its own too). */
  control(action: CoreAction, down: boolean): void;
  trigger(down: boolean): void;
  secondary(down: boolean): void;
  reload(): void;
  dispose(): void;
}

export type CreateShooterEngine<TEngine, TView> = (
  host: HTMLDivElement,
  state: CharacterState,
  onState: (snapshot: GameSnapshot<TView>) => void,
  sensitivity: number,
) => TEngine;

export interface ShooterMatchOptions<TEngine, TView> {
  /** Fetches the game's engine code, so it stays out of the startup download. */
  loadEngine: () => Promise<CreateShooterEngine<TEngine, TView>>;
  /** The game's HUD view until the engine sends its first snapshot. */
  initialView: TView;
  difficulty: Difficulty;
  /** Runs on each new engine right after it is built (a CS Lite test match passes its options). */
  onEngineCreated?: (engine: TEngine) => void;
}

const initialSnapshot = <TView>(view: TView): GameSnapshot<TView> => ({
  phase: 'menu', paused: false, loaded: false, health: 100, armor: 0, helmet: false, money: 0, alive: true, team: 'CT', weapon: null, slots: [],
  killfeed: [], killConfirm: null, hitMarker: null, rows: [], message: '', radar: { me: { x: 0, y: 0, z: 0, yaw: 0, colorSlot: 0 }, allies: [], enemies: [], lastSeen: [] }, hurt: [],
  spectating: '', killedBy: '', scope: 0, thirdPerson: true, aiming: false, ads: false, alive5: { CT: [], T: [] }, view,
});

const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Loads a shooter game's engine and starts the match as soon as it is ready; `replay` starts a fresh one. Also owns what every
 * shooter screen shares: the saved gameplay settings (mouse sensitivity) and whether the device is played by touch.
 */
export function useShooterMatch<TEngine extends ShooterEngineHandle, TView>(characterState: CharacterState, options: ShooterMatchOptions<TEngine, TView>) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<TEngine | null>(null);
  const gameplay = useAutoSavedSettings(getGameplaySettings, saveGameplaySettings);
  const sensitivity = gameplay.value.cameraSensitivity;
  const [touch] = useState(isTouchDevice);
  const [state, setState] = useState(() => initialSnapshot(options.initialView));
  const [error, setError] = useState('');
  const [matchId, setMatchId] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  useEffect(() => {
    let cancelled = false;
    let instance: TEngine | null = null;
    const { loadEngine, initialView, onEngineCreated } = optionsRef.current;
    setState(initialSnapshot(initialView));
    setError('');
    sound.stopVoice();

    const load = async () => {
      try {
        const createEngine = await loadEngine();
        if (cancelled || !host.current) return;
        instance = createEngine(host.current, characterState, (snapshot) => {
          if (!cancelled) setState(snapshot);
        }, sensitivityRef.current);
        onEngineCreated?.(instance);
        engine.current = instance;
      } catch (cause) {
        if (cancelled) return;
        setError('Không tải được màn chơi 3D. Hãy thử lại.');
        console.error(cause);
      }
    };
    void load();
    return () => {
      cancelled = true;
      instance?.dispose();
      if (engine.current === instance) engine.current = null;
    };
  }, [matchId, characterState]);

  useEffect(() => {
    engine.current?.setSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    if (state.loaded && state.phase === 'menu') engine.current?.start(optionsRef.current.difficulty, touch);
  }, [matchId, touch, state.loaded, state.phase]);

  /** A new engine and a new match with the same settings (after the match ends, or to retry after an error). */
  const replay = () => setMatchId((id) => id + 1);
  /** A tap on a key: down and up at once. */
  const press = (action: Parameters<TEngine['control']>[0]) => () => {
    engine.current?.control(action, true);
    engine.current?.control(action, false);
  };
  const start = () => engine.current?.start(optionsRef.current.difficulty, touch);

  return { host, engine, state, error, isLoading: !state.loaded && !error, replay, press, start, touch, gameplay };
}

export type ShooterMatch<TEngine extends ShooterEngineHandle = ShooterEngineHandle, TView = unknown> = ReturnType<typeof useShooterMatch<TEngine, TView>>;
