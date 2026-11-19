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
const render = await loadModule('src/settings/renderSettings.ts');

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
  storage.set('bns.render-settings.v1', 'null');
  assert.deepEqual(render.loadRenderSettings(), render.DEFAULT_RENDER_SETTINGS);
});
