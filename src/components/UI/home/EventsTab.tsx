import { useEffect, useState } from 'react';
import { activeGameEvents, type GameEventAction } from './homeEvents';
import { EventCard } from './EventCard';
import { sound } from '../../../audio/soundManager';

interface EventsTabProps {
  highlightedEventId: string | null;
  onEventAction: (action: GameEventAction) => void;
}

export function EventsTab({ highlightedEventId, onEventAction }: EventsTabProps) {
  const [now] = useState(() => new Date());
  const events = activeGameEvents(now);

  useEffect(() => {
    if (highlightedEventId) document.getElementById(`event-${highlightedEventId}`)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedEventId]);

  if (events.length === 0) return <p className="text-xs text-white/60">Hiện chưa có sự kiện nào.</p>;

  return (
    <div className="flex flex-col gap-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          now={now}
          isHighlighted={event.id === highlightedEventId}
          onAction={() => { sound.playClick(); onEventAction(event.action); }}
        />
      ))}
    </div>
  );
}
