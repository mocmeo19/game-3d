import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { configurationTestStore } from './configuration-test-store.mjs';

async function loadModule(path) {
  const bundle = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [configurationTestStore] });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const storage = globalThis.__configurationTestValues ??= new Map();
const legacyStorage = new Map([['clothes.arena.sens', '1.75']]);
globalThis.localStorage = { getItem: (key) => legacyStorage.get(key) ?? null, setItem: (key, value) => legacyStorage.set(key, value) };

const gameplay = await loadModule('src/settings/gameplaySettings.ts');
const render = await loadModule('src/settings/renderSettings.ts');
const { FrameRateLimiter } = await loadModule('src/games/core/engine/frameRateLimiter.ts');

test('the pause menu sensitivity saved before gameplay settings existed is kept', () => {
  assert.equal(gameplay.getGameplaySettings().cameraSensitivity, 1.75);
});

test('gameplay settings clamp numbers and reject unknown choices', () => {
  const settings = gameplay.normalizeGameplaySettings({
    cameraSensitivity: 99, aimSensitivity: Number.NaN, invertY: 'yes', firstPersonFovDeg: 70.6, startPerspective: 'top', aimStyle: 'hold',
  });
  assert.deepEqual(settings, {
    cameraSensitivity: 3, aimSensitivity: 1, invertY: false, firstPersonFovDeg: 71, startPerspective: 'tpp', aimStyle: 'hold',
  });
});

test('saved gameplay settings are what the next match reads', async () => {
  await gameplay.saveGameplaySettings({ ...gameplay.DEFAULT_GAMEPLAY_SETTINGS, startPerspective: 'fpp', invertY: true });
  assert.equal(gameplay.getGameplaySettings().startPerspective, 'fpp');
  assert.equal(storage.get('bns.gameplay.v1').invertY, true);
});

test('render settings keep a valid frame-rate cap', () => {
  assert.equal(render.normalizeRenderSettings({ frameRateCap: 60 }).frameRateCap, 60);
  assert.equal(render.normalizeRenderSettings({ frameRateCap: 45 }).frameRateCap, 'unlimited');
});

test('a 60 FPS cap draws about 60 of 144 Hz frames and every frame of a 60 Hz screen', () => {
  const countDrawn = (cap, hz, seconds) => {
    const limiter = new FrameRateLimiter(cap);
    let drawn = 0;
    for (let frame = 0; frame < hz * seconds; frame++) if (limiter.shouldDraw(frame * (1000 / hz))) drawn++;
    return drawn;
  };
  assert.ok(Math.abs(countDrawn(60, 144, 2) - 120) <= 2);
  assert.equal(countDrawn(60, 60, 2), 120);
  assert.ok(Math.abs(countDrawn(30, 60, 2) - 60) <= 1);
  assert.equal(countDrawn('unlimited', 144, 1), 144);
});
