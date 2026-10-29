import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/controlLayouts.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const layouts = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const pubg = (code) => layouts.actionForKey('pubg', code);
const crossfire = (code) => layouts.actionForKey('crossfire', code);

test('battle royale uses PUBG keys, 5v5 uses CrossFire keys', () => {
  assert.equal(layouts.layoutForMode('br'), 'pubg');
  assert.equal(layouts.layoutForMode('cs'), 'crossfire');
});

test('PUBG layout: Shift sprints, Ctrl walks, C / Z toggle stances, Q / E lean, F picks up', () => {
  assert.deepEqual(['ShiftLeft', 'ControlLeft', 'KeyC', 'KeyZ', 'KeyQ', 'KeyE', 'KeyF', 'Tab', 'AltLeft'].map(pubg),
    ['sprint', 'walk', 'crouchToggle', 'prone', 'leanLeft', 'leanRight', 'interact', 'inventory', 'freeLook']);
});

test('CrossFire layout: Shift walks, Ctrl holds a crouch, Q swaps weapons, E picks up, no prone or lean', () => {
  assert.deepEqual(['ShiftLeft', 'ControlRight', 'KeyQ', 'KeyE', 'KeyF', 'KeyB', 'Tab'].map(crossfire),
    ['walk', 'crouchHold', 'lastWeapon', 'interact', 'inspect', 'buy', 'scoreboard']);
  assert.deepEqual(['KeyZ', 'KeyC', 'AltLeft'].map(crossfire), [null, null, null]);
});

test('each layout has its own controls help', () => {
  for (const id of ['pubg', 'crossfire']) assert.ok(layouts.controlHelp(id).length > 10);
});
