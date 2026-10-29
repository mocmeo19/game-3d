import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { configurationTestStore } from './configuration-test-store.mjs';

async function loadModule(path) {
  const bundle = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [configurationTestStore] });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const storage = globalThis.__configurationTestValues ??= new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const models = await loadModule('src/settings/modelSettings.ts');
const render = await loadModule('src/settings/renderSettings.ts');

test('model settings reject unavailable files, cross-gender mappings, and nonfinite scale', () => {
  const settings = models.normalizeModelSettings({
    bodies: { lyn_female: 'jin_male', gon_male: '../../bad', jin_female: 'lyn_female' },
    raceScale: { lyn: Infinity, gon: 99 }, lynFluffyTail: 'missing-file',
  });
  assert.equal(settings.bodies.lyn_female, 'lyn_female');
  assert.equal(settings.bodies.gon_male, 'gon_male');
  assert.equal(settings.bodies.jin_female, 'lyn_female');
  assert.equal(settings.raceScale.lyn, 0.76);
  assert.equal(settings.raceScale.gon, 1.5);
  assert.equal(settings.lynFluffyTail, models.DEFAULT_MODEL_SETTINGS.lynFluffyTail);
});

test('saved model choices are consumed by the model resolver and survive reload', async () => {
  const settings = models.normalizeModelSettings({ bodies: { lyn_female: 'jin_female' }, raceScale: { lyn: 0.8 } });
  await models.saveModelSettings(settings);
  assert.equal(models.baseModelKey('lyn', 'female'), 'jin_female');
  assert.equal(models.baseModelKey('yun', 'male'), 'jin_male');
  assert.equal(models.raceScale('lyn'), 0.8);
  assert.deepEqual(models.loadModelSettings(), settings);
  await models.saveModelSettings(models.DEFAULT_MODEL_SETTINGS);
});

test('render settings control shadows and preserve both device and scene resolution limits', async () => {
  globalThis.devicePixelRatio = 3;
  await render.saveRenderSettings({ pixelRatio: 1, shadows: false, antialias: false });
  const renderer = { shadowMap: {}, setPixelRatio: (value) => { renderer.ratio = value; } };
  render.configureRenderer(renderer, 1.5);
  assert.equal(renderer.ratio, 1);
  assert.equal(renderer.shadowMap.enabled, false);
  assert.equal(render.getRenderSettings().antialias, false);
  assert.equal(render.rendererPixelRatio(0.8), 0.8);
  assert.equal(render.loadRenderSettings().pixelRatio, 1);
});

test('corrupt preferences fall back to valid defaults', () => {
  storage.set('bns.model-settings.v1', '{invalid');
  storage.set('bns.render-settings.v1', 'null');
  assert.deepEqual(models.loadModelSettings(), models.DEFAULT_MODEL_SETTINGS);
  assert.deepEqual(render.loadRenderSettings(), render.DEFAULT_RENDER_SETTINGS);
});
