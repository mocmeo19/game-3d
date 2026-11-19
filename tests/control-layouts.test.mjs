import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const load = async (entry) => {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const layouts = await load('src/games/core/input/controlLayouts.ts');
const { CITY_CONTROLS, CITY_RULES } = await load('src/games/city/cityRules.ts');
const city = (code) => layouts.actionForKey(CITY_CONTROLS, code);

test('the open world aims guns with the right button', () => {
  assert.equal(CITY_RULES.rightButtonAimsGuns, true);
});

test('the shared actions are known to the core; game actions are not', () => {
  assert.ok(['forward', 'reload', 'slot4', 'freeLook'].every(layouts.isCoreAction));
  assert.ok(!['buy', 'scoreboard', 'inventory', 'interact'].some(layouts.isCoreAction));
});

test('city layout: F gets in and out of cars, Tab switches protagonist, M opens the map, Space is the handbrake', () => {
  assert.deepEqual(['ShiftLeft', 'ControlLeft', 'KeyF', 'Tab', 'KeyM', 'Space', 'KeyH', 'Enter'].map(city),
    ['sprint', 'walk', 'interact', 'switchHero', 'map', 'jump', 'horn', 'skip']);
});

test('each layout has its own controls help', () => {
  for (const layout of [CITY_CONTROLS]) {
    const help = layouts.controlHelp(layout);
    assert.ok(help.length > 10);
    assert.deepEqual(help.slice(-2).map(([key]) => key), ['Esc', 'Ctrl + Alt']);
  }
});
