import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/components/UI/select/selectModel.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const S = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const options = [
  { value: 'stand', label: 'Đứng yên cầm súng', group: 'Di chuyển' },
  { value: 'jump', label: 'Bật nhảy', hint: 'rifle-jump-up.fbx', group: 'Di chuyển' },
  { value: 'off', label: 'Không dùng', disabled: true },
  { value: 'crouch', label: 'Ngồi xổm', group: 'Tư thế' },
];

test('search ignores Vietnamese accents and case, and matches every word anywhere', () => {
  assert.deepEqual(S.filterOptions(options, 'dung').map((o) => o.value), ['stand', 'off']);
  assert.deepEqual(S.filterOptions(options, 'NHAY').map((o) => o.value), ['jump']);
  assert.deepEqual(S.filterOptions(options, 'jump fbx').map((o) => o.value), ['jump'], 'hints are searched too');
  assert.deepEqual(S.filterOptions(options, 'tu the').map((o) => o.value), ['crouch'], 'group names are searched too');
  assert.equal(S.filterOptions(options, '  ').length, options.length);
  assert.equal(S.filterOptions(options, 'zzz').length, 0);
});

test('arrow keys skip disabled options and wrap around', () => {
  assert.equal(S.stepIndex(options, 1, 1), 3, 'skips the disabled option');
  assert.equal(S.stepIndex(options, 3, 1), 0, 'wraps to the start');
  assert.equal(S.stepIndex(options, 0, -1), 3, 'wraps to the end');
  assert.equal(S.stepIndex([{ value: 'x', label: 'x', disabled: true }], 0, 1), -1);
});

test('type-ahead jumps to the next option starting with the typed letters', () => {
  assert.equal(S.typeAheadIndex(options, 'n', -1), 3);
  assert.equal(S.typeAheadIndex(options, 'b', 3), 1, 'searches past the end from the start');
  assert.equal(S.typeAheadIndex(options, 'dun', -1), 0);
  assert.equal(S.typeAheadIndex(options, 'k', -1), -1, 'disabled options are not chosen');
});
