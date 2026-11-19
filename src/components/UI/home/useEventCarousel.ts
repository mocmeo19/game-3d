import { useEffect, useState } from 'react';

const ROTATE_INTERVAL_MS = 6000;

export function useEventCarousel(count: number) {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (count < 2 || isHovered || isFocused || isPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % count);
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [count, index, isHovered, isFocused, isPaused]);

  return {
    index: count ? index % count : 0,
    select: setIndex,
    isPaused,
    togglePaused: () => setIsPaused((paused) => !paused),
    setIsHovered,
    setIsFocused
  };
}
