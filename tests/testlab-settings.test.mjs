import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { configurationTestStore } from './configuration-test-store.mjs';

async function loadModule(path) {
  const bundle = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [configurationTestStore] });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}

const game = await loadModule('src/game/testlab/gameSettings.ts');
const animation = await loadModule('src/game/testlab/animationConfig.ts');
const storage = globalThis.__configurationTestValues ??= new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

test('game defaults survive save and reload; movement consumes the saved speeds', async () => {
  const settings = { ...game.DEFAULT_GAME_SETTINGS, runSpeed: 8, gravity: 15, startWeapon: 'ak47', startZone: 'range' };
  await game.saveGameSettings(settings);
  assert.deepEqual(game.loadGameSettings(), settings);
  assert.equal(game.movementSpeed(game.loadGameSettings(), 'stand', true), 8);
  assert.equal(game.movementSpeed(settings, 'crouch', true), settings.crouchSpeed);
  assert.equal(game.movementSpeed(settings, 'sit', true), 0);
});

test('invalid stored settings fall back safely and numeric values stay within limits', () => {
  assert.deepEqual(game.normalizeGameSettings(null), game.DEFAULT_GAME_SETTINGS);
  const normalized = game.normalizeGameSettings({ runSpeed: 200, gravity: -4, cameraFov: NaN, startWeapon: 'bogus' });
  assert.equal(normalized.runSpeed, 20);
  assert.equal(normalized.gravity, 1);
  assert.equal(normalized.cameraFov, 55);
  assert.equal(normalized.startWeapon, 'none');
  storage.set('nams-testlab-game-settings-v1', '{broken');
  assert.deepEqual(game.loadGameSettings(), game.DEFAULT_GAME_SETTINGS);
});

const clips = [
  { id: 1, role: 'walk', ctx: null, file: 'walk.fbx' },
  { id: 2, role: 'walk', ctx: 'rifle', file: 'rifle-walk.fbx' },
  { id: 3, role: 'jump', ctx: null, file: 'jump.fbx' },
];

test('weapon animation overrides and unarmed inheritance match automatic playback', () => {
  const settings = { 'walk|none': 'jump.fbx', 'walk|rifle': 'rifle-walk.fbx' };
  assert.equal(animation.resolveAnimation(clips, settings, 'walk', null).id, 3);
  assert.equal(animation.resolveAnimation(clips, settings, 'walk', 'rifle').id, 2);
  assert.equal(animation.resolveAnimation(clips, settings, 'walk', 'knife').id, 3);
  assert.equal(animation.resolveAnimation(clips, {}, 'walk', 'rifle').id, 2);
});

test('builtin choice blocks clip fallback and absent roles use their fallback action', () => {
  assert.equal(animation.resolveAnimation(clips, { 'walk|rifle': '__builtin__' }, 'walk', 'rifle'), null);
  assert.equal(animation.resolveAnimation(clips, {}, 'runback', 'rifle').id, 2);
  assert.equal(animation.resolveAnimation(clips, {}, 'vault', 'knife').id, 3);
});
