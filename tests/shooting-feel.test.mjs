import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

async function loadModule(path) {
  const bundle = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { ViewRecoil } = await loadModule('src/games/core/aim/viewRecoil.ts');
const rules = await loadModule('src/games/core/rules.ts');

test('the view eases into the punch within a few frames instead of jumping', () => {
  const recoil = new ViewRecoil();
  recoil.update(1 / 60, [0, 0.02]);
  assert.ok(recoil.shown[1] > 0 && recoil.shown[1] < 0.02, 'one frame moves part of the way');
  for (let i = 0; i < 6; i++) recoil.update(1 / 60, [0, 0.02]);
  assert.ok(Math.abs(recoil.shown[1] - 0.02) < 0.002, 'about 100 ms later it has caught up');
});

test('shot shake is bounded and dies away', () => {
  const recoil = new ViewRecoil();
  for (let i = 0; i < 20; i++) recoil.kick(() => 0.9);
  assert.ok(Math.abs(recoil.shakeRoll) <= 0.03 + 1e-9);
  recoil.update(0.5, [0, 0]);
  assert.ok(Math.abs(recoil.shakeRoll) < 1e-4);
  recoil.reset();
  assert.deepEqual([...recoil.shown, recoil.shakeRoll], [0, 0, 0]);
});

test('crouching, lying down and the sights cut the recoil (PUBG)', () => {
  const stand = rules.recoilScale({ crouch: 0, prone: 0, ads: false });
  const crouch = rules.recoilScale({ crouch: 1, prone: 0, ads: false });
  const prone = rules.recoilScale({ crouch: 0, prone: 1, ads: false });
  const crouchAds = rules.recoilScale({ crouch: 1, prone: 0, ads: true });
  assert.ok(stand > crouch && crouch > prone);
  assert.ok(crouchAds < crouch);
  const [, full] = rules.aimPunch('ak47', 8);
  const [, half] = rules.aimPunch('ak47', 8, 0.5);
  assert.ok(Math.abs(half - full / 2) < 1e-12);
});
