import { useCallback, useEffect, useState } from 'react';
import { activeGameEvents, GAME_EVENTS } from './homeEvents';
import { loadSeenEvents, saveSeenEvents } from './eventPreferences';

const CLOCK_REFRESH_MS = 60_000;

export function useHomeEvents() {
  const [now, setNow] = useState(() => new Date());
  const [seenIds, setSeenIds] = useState(loadSeenEvents);

  useEffect(() => {
    const refresh = () => { if (!document.hidden) setNow(new Date()); };
    const interval = window.setInterval(refresh, CLOCK_REFRESH_MS);
    const syncPreferences = () => setSeenIds(loadSeenEvents());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', syncPreferences);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', syncPreferences);
    };
  }, []);

  const markSeen = useCallback((eventId: string) => {
    if (!GAME_EVENTS.some((event) => event.id === eventId)) return;
    setSeenIds((ids) => ids.includes(eventId) ? ids : [...ids, eventId]);
  }, []);

  useEffect(() => saveSeenEvents(seenIds), [seenIds]);

  const events = activeGameEvents(now);
  return { now, events, seenIds, markSeen, unreadCount: events.filter((event) => !seenIds.includes(event.id)).length };
}
