const SEEN_EVENTS_KEY = 'bns.seen-events.v1';

export function loadSeenEvents(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SEEN_EVENTS_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string').slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function saveSeenEvents(ids: readonly string[]): void {
  try {
    localStorage.setItem(SEEN_EVENTS_KEY, JSON.stringify(ids.slice(-100)));
  } catch {
    // Seen badges still work for this session if optional preference storage is unavailable.
  }
}
