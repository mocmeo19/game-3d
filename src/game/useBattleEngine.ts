import { useEffect, useRef, useState } from 'react';
import type { CharacterState } from '../types/character';
import type { Difficulty } from './ai';
import type { GameEngine, GameSnapshot, Mode } from './GameEngine';
import { sound } from '../audio/soundManager';

interface MatchRequest {
  mode: Mode;
  difficulty: Difficulty;
  touch: boolean;
}

const initial: GameSnapshot = {
  phase: 'menu', paused: false, loaded: false, round: 0, score: { CT: 0, T: 0 }, timer: 0, buyLeft: 0, canBuy: false, buyOpen: false, shop: [], health: 100, armor: 0,
  helmet: false, money: 800, alive: true, team: 'CT', weapon: null, slots: [], killfeed: [], killConfirm: null, rows: [], message: '', banner: null, matchWinner: null,
  radar: { me: { x: 0, z: 0, yaw: 0 }, allies: [], enemies: [] }, hurt: [], pickup: '', spectating: '', killedBy: '', scoreboard: false, scope: 0, thirdPerson: true, aiming: false, ads: false,
  alive5: { CT: [], T: [] },
  mode: 'cs',
  br: null
};
export function useBattleEngine(characterState: CharacterState, sensitivity: number) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngine | null>(null);
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  const [request, setRequest] = useState<MatchRequest | null>(null);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let instance: GameEngine | null = null;
    setState(initial);
    setError('');
    sound.stopVoice();

    const load = async () => {
      try {
        const { GameEngine } = await import('./GameEngine');
        if (cancelled || !host.current) return;
        instance = new GameEngine(host.current, characterState, (snapshot) => {
          if (!cancelled) setState(snapshot);
        }, sensitivityRef.current);
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
  }, [request, characterState]);

  useEffect(() => {
    engine.current?.setSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    if (request && state.loaded && state.phase === 'menu') {
      engine.current?.start(request.difficulty, request.touch, request.mode);
    }
  }, [request, state.loaded, state.phase]);

  const reset = () => {
    setRequest(null);
    setState(initial);
    setError('');
  };

  return { host, engine, state, error, isLoading: request !== null && !state.loaded && !error, start: setRequest, reset };
}
