import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { configurationTestStore } from './configuration-test-store.mjs';

const load = async (entry) => {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [configurationTestStore] });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const settings = await load('src/games/core/weapons/gunModelSettings.ts');
const catalog = await load('src/games/core/weapons/gunModelCatalog.ts');
const { fitGunModel } = await load('src/games/core/weapons/gunModelFit.ts');
const THREE = await import('three');

test('gun model settings: defaults cover every weapon, untrusted values are dropped or clamped', async () => {
  const defaults = settings.defaultGunModelSettings();
  assert.equal(defaults.assignments.ak47, 'ak47-realistic');
  assert.equal(defaults.assignments.mp9, null);
  const normalized = settings.normalizeGunModelSettings({
    assignments: { ak47: 'stylized-rifle', awp: 'no-such-model', mp9: null, bogus: 'katana' },
    fits: { 'stylized-rifle': { length: 99, flipBarrel: true, gripAlong: Number.NaN } },
  });
  assert.equal(normalized.assignments.ak47, 'stylized-rifle');
  assert.equal(normalized.assignments.awp, 'sniper-realistic', 'an unknown model keeps the default');
  assert.equal('bogus' in normalized.assignments, false);
  assert.equal(normalized.fits['stylized-rifle'].length, 2.5);
  assert.equal(normalized.fits['stylized-rifle'].flipBarrel, true);
  assert.equal(normalized.fits['stylized-rifle'].gripAlong, catalog.gunModel('stylized-rifle').fit.gripAlong);
  await settings.saveGunModelSettings(normalized);
  assert.deepEqual(settings.loadGunModelSettings(), normalized);
});

const box = (x, y, z) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z));

test('a model lying along any axis is turned barrel-forward, scaled to its real length and held at the grip', () => {
  // 100 units long along x, 20 tall along z, 5 wide along y: an oddly exported rifle
  const fit = { length: 1, flipBarrel: false, flipUp: false, gripAlong: 0.25, gripHeight: 0.5, muzzleHeight: 0.5 };
  const { root, muzzle } = fitGunModel(box(100, 5, 20), 'barrel', fit);
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.z - 1) < 1e-6, 'barrel along z at its real length');
  assert.ok(Math.abs(size.y - 0.2) < 1e-6, 'second longest side is the height');
  assert.ok(Math.abs(size.x - 0.05) < 1e-6);
  assert.ok(Math.abs(muzzle.z - 0.75) < 1e-6, 'muzzle at the front, measured from the grip');
  assert.ok(Math.abs(muzzle.y) < 1e-6);
  const flipped = fitGunModel(box(100, 5, 20), 'barrel', { ...fit, flipBarrel: true });
  assert.ok(Math.abs(flipped.muzzle.z - 0.75) < 1e-6, 'the muzzle stays in front after turning the model round');
});

test('a grenade stands upright with its longest side as the height', () => {
  const fit = { length: 0.12, flipBarrel: false, flipUp: false, gripAlong: 0.5, gripHeight: 0.5, muzzleHeight: 1 };
  const { root, muzzle } = fitGunModel(box(3, 3, 6), 'upright', fit);
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y - 0.12) < 1e-6);
  assert.ok(Math.abs(muzzle.y - 0.06) < 1e-6, 'the top is half the height above the hold');
});

const { ViewArms } = await load('src/games/core/viewArms.ts');

test('first-person hands follow the gun model: right on the grip, left on the support point, re-placed when the model changes', () => {
  const gun = new THREE.Group();
  gun.rotation.y = Math.PI;
  const support = new THREE.Object3D();
  support.position.set(0, -0.02, 0.3);
  gun.add(support);
  gun.userData.support = support;
  gun.userData.fitVersion = 0;
  const arms = new ViewArms(gun, 'rifle', 0x334455);
  arms.update();
  const [rightSleeve, rightGlove, leftSleeve, leftGlove] = arms.group.children;
  assert.ok(rightSleeve && leftSleeve, 'a rifle gets two arms');
  assert.ok(Math.abs(rightGlove.position.x) < 1e-9 && Math.abs(rightGlove.position.z) < 1e-9, 'right hand at the grip');
  assert.ok(Math.abs(leftGlove.position.z + 0.3) < 1e-9, 'left hand on the handguard, in front of the camera (-z)');
  // a loaded model moves the support point and bumps the version
  support.position.set(0, -0.03, 0.45);
  gun.userData.fitVersion = 1;
  arms.update();
  assert.ok(Math.abs(leftGlove.position.z + 0.45) < 1e-9, 'the hand moves to the new model');
  assert.equal(new ViewArms(gun, 'one', 0).group.children.length, 2, 'a knife is held in one hand');
});
