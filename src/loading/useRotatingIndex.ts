import { useEffect, useState } from 'react';

/** Cycles 0…count-1 every `intervalMs`, starting at a random item so repeat visits vary. */
export function useRotatingIndex(count: number, intervalMs: number): number {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(1, count)));
  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs]);
  return count > 0 ? index % count : 0;
}
