import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const load = async (entry) => {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const modes = await load('src/games/core/aim/aimModes.ts');
const { FreeLook } = await load('src/games/core/aim/freeLook.ts');
const { ScopeSway } = await load('src/games/core/aim/scopeSway.ts');
const trajectory = await load('src/games/core/aim/aimTrajectory.ts');
const THREE = await import('three');

const frame = (now, pressed, patch = {}) => ({ now, pressed, perspective: 'tpp', canAim: true, style: 'pubg', ...patch });

test('aim: a quick click toggles ADS, a click in ADS leaves it', () => {
  const aim = new modes.AimController();
  assert.equal(aim.update(frame(0, true)), 'TPP_HIP', 'a press is not yet a click or a hold');
  assert.equal(aim.update(frame(0.1, false)), 'ADS');
  assert.equal(aim.update(frame(1, false)), 'ADS', 'ADS stays after the click');
  assert.equal(aim.update(frame(1.1, true)), 'TPP_HIP', 'pressing again leaves ADS at once');
  assert.equal(aim.update(frame(1.6, true)), 'TPP_HIP', 'that press does not turn into a shoulder aim');
  assert.equal(aim.update(frame(1.7, false)), 'TPP_HIP', 'nor toggles ADS back on release');
});

test('aim: holding aims over the shoulder in third person and down the sights in first person, only while held', () => {
  const aim = new modes.AimController();
  aim.update(frame(0, true));
  assert.equal(aim.update(frame(modes.AIM_HOLD_S + 0.01, true)), 'TPP_SHOULDER');
  assert.equal(aim.update(frame(1, false)), 'TPP_HIP');
  const fpp = new modes.AimController();
  fpp.update(frame(0, true, { perspective: 'fpp' }));
  assert.equal(fpp.update(frame(0.5, true, { perspective: 'fpp' })), 'ADS');
  assert.equal(fpp.update(frame(0.6, false, { perspective: 'fpp' })), 'FPP_HIP');
});

test('aim: sprinting, reloading or jumping drops the aim; the 5 vs 5 style only aims while held', () => {
  const aim = new modes.AimController();
  aim.update(frame(0, true));
  aim.update(frame(0.1, false));
  assert.equal(aim.update(frame(0.5, false, { canAim: false })), 'TPP_HIP');
  assert.equal(aim.update(frame(0.6, false)), 'TPP_HIP', 'ADS does not come back by itself');
  const hold = new modes.AimController();
  assert.equal(hold.update(frame(0, true, { style: 'hold' })), 'TPP_SHOULDER', 'aims at once');
  assert.equal(hold.update(frame(0.05, false, { style: 'hold' })), 'TPP_HIP', 'a click never toggles');
  assert.ok(modes.aimSpreadFactor('ADS') < modes.aimSpreadFactor('TPP_SHOULDER'));
  assert.ok(modes.transitionSeconds('ADS', 'sniper') > modes.transitionSeconds('ADS', 'pistol'));
});

test('free look turns the view within limits and swings back on release', () => {
  const look = new FreeLook();
  look.update(0.016, false);
  assert.equal(look.take(0.5, 0), false, 'without the key the body turns');
  look.update(0.016, true);
  assert.equal(look.take(10, 10), true);
  assert.ok(look.yaw < Math.PI && look.pitch < Math.PI / 2, 'clamped');
  for (let i = 0; i < 120; i++) look.update(0.016, false);
  assert.equal(look.yaw, 0);
});

test('scope sway: holding the breath steadies the aim until the breath runs out', () => {
  const sway = new ScopeSway();
  let peak = 0;
  for (let i = 0; i < 300; i++) { sway.update(0.016, true, false, 'stand'); peak = Math.max(peak, Math.abs(sway.yaw)); }
  let held = 0;
  for (let i = 0; i < 120; i++) { sway.update(0.016, true, true, 'stand'); held = Math.max(held, Math.abs(sway.yaw)); }
  assert.ok(held < peak, 'steadier while holding');
  for (let i = 0; i < 300; i++) sway.update(0.016, true, true, 'stand');
  assert.equal(sway.update(0.016, true, true, 'stand'), false, 'out of breath after a few seconds');
});

test('aim point: from the camera to the first wall; a wall between muzzle and target blocks the shot', () => {
  const box = (x0, x1, y0, y1, z0, z1) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });
  const wall = box(-2, 2, 0, 3, -10.2, -10);
  const noBody = () => null;
  const point = trajectory.castAimPoint(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), [wall], noBody, 100);
  assert.ok(Math.abs(point.z + 10) < 1e-6);
  const cover = box(-2, 2, 0, 1.2, -3.2, -3);
  // the camera sees over the low cover to a target behind it, the muzzle (lower) does not
  const target = new THREE.Vector3(0, 1.4, -10);
  const blocked = trajectory.firstObstacle(new THREE.Vector3(0, 1.0, 0), target, [cover]);
  assert.ok(blocked && Math.abs(blocked.z + 3) < 0.05);
  assert.equal(trajectory.firstObstacle(new THREE.Vector3(0, 1.6, 0), target, [cover]), null);
});
