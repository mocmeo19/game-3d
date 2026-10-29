import { normalizeGameSettings, type GameSettings } from '../game/testlab/gameSettings';

export function gamePreview(settings: GameSettings) {
  const safe = normalizeGameSettings(settings);
  const flight = 2 * safe.jumpSpeed / safe.gravity;
  const height = safe.jumpSpeed * safe.jumpSpeed / (2 * safe.gravity);
  const distance = safe.runSpeed * flight;
  const horizontalScale = Math.max(8, distance);
  const verticalScale = Math.max(3, height);
  const points = Array.from({ length: 41 }, (_, index) => {
    const time = index / 40 * flight;
    return [24 + safe.runSpeed * time / horizontalScale * 290,
      150 - Math.max(0, safe.jumpSpeed * time - safe.gravity * time * time / 2) / verticalScale * 110];
  });
  return {
    height, flight, distance, seconds: flight / safe.timeScale,
    path: points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
  };
}
