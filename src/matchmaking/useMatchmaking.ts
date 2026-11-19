import { useEffect, useRef, useState } from 'react';

/** The search is simulated (the other players are bots): it fills the lobby over a few seconds. */
const SEARCH_MIN_MS = 6000;
const SEARCH_MAX_MS = 10000;
/** How long "match found" stays on screen before the game opens. */
const FOUND_HOLD_MS = 1400;
const TICK_MS = 200;

export interface MatchmakingState {
  elapsedMs: number;
  /** Players in the lobby, the player included. */
  joined: number;
  found: boolean;
}

/** Runs a match search for a lobby of `capacity` players; calls `onMatched` once it is full, and `onCancel` on Escape. */
export function useMatchmaking(capacity: number, onMatched: () => void, onCancel: () => void): MatchmakingState {
  const [startedAt] = useState(() => performance.now());
  const [estimateMs] = useState(() => SEARCH_MIN_MS + Math.random() * (SEARCH_MAX_MS - SEARCH_MIN_MS));
  const [elapsedMs, setElapsedMs] = useState(0);
  const found = elapsedMs >= estimateMs;
  // players arrive quickly at first, the last few slots take longer
  const progress = Math.min(1, elapsedMs / estimateMs);
  const joined = Math.min(capacity, 1 + Math.floor((1 - (1 - progress) ** 2) * (capacity - 1)));

  const onMatchedRef = useRef(onMatched);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onMatchedRef.current = onMatched;
    onCancelRef.current = onCancel;
  }, [onMatched, onCancel]);

  useEffect(() => {
    if (found) return;
    const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), TICK_MS);
    return () => window.clearInterval(timer);
  }, [found, startedAt]);

  useEffect(() => {
    if (!found) return;
    const timer = window.setTimeout(() => onMatchedRef.current(), FOUND_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [found]);

  useEffect(() => {
    if (found) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [found]);

  return { elapsedMs, joined, found };
}
