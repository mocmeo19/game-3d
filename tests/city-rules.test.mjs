import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const load = async (entry) => {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const wanted = await load('src/games/city/police/wanted.ts');
const physics = await load('src/games/city/vehicles/vehiclePhysics.ts');
const { VEHICLES } = await load('src/games/city/vehicles/vehicleSpecs.ts');
const shop = await load('src/games/city/activities/gunShop.ts');
const rules = await load('src/games/core/rules.ts');
const save = await load('src/games/city/story/citySave.ts');
const story = await load('src/games/city/story/storyMissions.ts');
const { HeightGrid } = await load('src/games/city/map/heightGrid.ts');
const masks = await load('src/games/city/map/walkMask.ts');

test('wanted: crimes set a floor of stars, cop kills escalate, the cap is five', () => {
  const w = wanted.newWanted();
  assert.equal(wanted.reportCrime(w, 'gunfire', { x: 0, z: 0 }), 1);
  assert.equal(wanted.reportCrime(w, 'robbery', { x: 0, z: 0 }), 2);
  assert.equal(wanted.reportCrime(w, 'copKill', { x: 0, z: 0 }), 3);
  assert.equal(wanted.reportCrime(w, 'copKill', { x: 0, z: 0 }), 4);
  for (let i = 0; i < 5; i++) wanted.reportCrime(w, 'copKill', { x: 0, z: 0 });
  assert.equal(w.stars, wanted.MAX_STARS);
});

test('wanted: the stars go only when out of sight long enough and far enough from the last seen spot', () => {
  const w = wanted.newWanted();
  wanted.setStars(w, 2, { x: 0, z: 0 });
  const near = { x: 10, z: 0 };
  const far = { x: wanted.SEARCH_RADIUS_M[2] + 5, z: 0 };
  assert.equal(wanted.tickWanted(w, wanted.ESCAPE_S[2] + 1, false, near), false, 'hiding close by is not enough');
  assert.equal(wanted.tickWanted(w, 0.1, true, far), false, 'seen again: the search starts over');
  assert.equal(w.unseenFor, 0);
  assert.equal(wanted.tickWanted(w, wanted.ESCAPE_S[2] + 1, false, { x: far.x * 2, z: 0 }), true);
  assert.equal(w.stars, 0);
});

const flat = { groundAt: () => 0, blocksAt: () => false };
const controls = (throttle, steer = 0, handbrake = false) => ({ throttle, steer, handbrake });

test('cars: accelerate toward top speed, brake, and steer right with a right turn', () => {
  const spec = VEHICLES.sedan;
  const s = physics.newVehicleState(0, 0, 0, 0);
  for (let i = 0; i < 600; i++) physics.stepVehicle(s, spec, controls(1), 1 / 60, flat);
  assert(s.speed > spec.topSpeed * 0.8 && s.speed <= spec.topSpeed, `near top speed, got ${s.speed}`);
  assert(s.z < -100, 'heading 0 drives toward -z');
  for (let i = 0; i < 300; i++) physics.stepVehicle(s, spec, controls(-1), 1 / 60, flat);
  assert(s.speed <= 0, 'braking stops the car (then reverses)');
  const t = physics.newVehicleState(0, 0, 0, 0);
  t.speed = 10;
  for (let i = 0; i < 30; i++) physics.stepVehicle(t, spec, controls(0.3, 1), 1 / 60, flat);
  assert(t.x > 0, 'steering right turns toward +x');
});

test('cars: a wall ahead stops the car and reports the impact', () => {
  const spec = VEHICLES.sedan;
  const wall = { groundAt: () => 0, blocksAt: (_x, z) => z < -5 };
  const s = physics.newVehicleState(0, 0, 0, 0);
  s.speed = 20;
  let impact = 0;
  for (let i = 0; i < 60; i++) impact = Math.max(impact, physics.stepVehicle(s, spec, controls(1), 1 / 60, wall).impact);
  assert(impact > 10, `a hard hit, got ${impact}`);
  assert(s.z > -5 + spec.length * 0.4, 'the bumper stays out of the wall');
});

test('cars: the footprint test follows the heading', () => {
  const spec = VEHICLES.sedan;
  const s = physics.newVehicleState(0, 0, 0, Math.PI / 2);
  assert(physics.insideFootprint(s, spec, -2, 0), 'facing -x the nose is at -x');
  assert(!physics.insideFootprint(s, spec, 0, -2), 'the side is narrow');
});

test('gun shop: buying takes money, refuses what is owned or too dear, refills ammo', () => {
  const inv = rules.newInventory('CT');
  const ak = shop.GUN_SHOP.find((i) => i.id === 'ak47');
  assert.equal(shop.buy(ak, inv, 100).ok, false);
  const bought = shop.buy(ak, inv, 3000);
  assert(bought.ok);
  assert.equal(bought.money, 3000 - ak.price);
  assert.equal(inv.primary.id, 'ak47');
  assert.equal(shop.buy(ak, inv, 9000).ok, false, 'already carried');
  inv.primary.reserve = 0;
  assert(shop.buy(shop.GUN_SHOP.find((i) => i.id === 'ammo'), inv, 500).ok);
  assert.equal(inv.primary.reserve, rules.WEAPONS.ak47.reserve);
});

test('save: a good save reads back, a broken one is refused', () => {
  const hero = { money: 900, x: -10, z: 20, health: 80, armor: 30, weapons: [{ id: 'glock', ammo: 12, reserve: 60 }, { id: 'nope', ammo: 1, reserve: 1 }], grenades: ['he', 'banana'] };
  const raw = { version: 1, active: 'tu', completed: ['m1-last-ride', 5], heroes: { kha: hero, tu: hero, lam: hero } };
  const parsed = save.parseCitySave(raw);
  assert.equal(parsed.active, 'tu');
  assert.deepEqual(parsed.completed, ['m1-last-ride']);
  assert.deepEqual(parsed.heroes.kha.weapons, [{ id: 'glock', ammo: 12, reserve: 60 }], 'unknown guns are dropped');
  assert.deepEqual(parsed.heroes.kha.grenades, ['he']);
  assert.equal(save.parseCitySave({ ...raw, version: 2 }), null);
  assert.equal(save.parseCitySave({ ...raw, heroes: { kha: hero } }), null);
});

test('story: every mission needs only missions before it, and only the first is open at the start', () => {
  const seen = new Set();
  for (const m of story.STORY) {
    for (const r of m.requires) assert(seen.has(r), `${m.id} needs ${r} first`);
    seen.add(m.id);
  }
  assert.deepEqual(story.availableMissions(new Set()).map((m) => m.id), ['m1-last-ride']);
  assert.deepEqual(story.availableMissions(new Set(['m1-last-ride'])).map((m) => m.id), ['m2-debt']);
});

test('streets: the walkable area is the largest level ground, roofs are cut off, cars need room', () => {
  // 6 x 5 cells: a 2 x 2 roof in the middle of open ground
  const cols = 6;
  const rows = 5;
  const cells = new Int16Array(cols * rows);
  for (const k of [cols * 1 + 2, cols * 1 + 3, cols * 2 + 2, cols * 2 + 3]) cells[k] = 300;
  const grid = new HeightGrid({ originX: 0, originZ: 0, cellM: 2.5, cols, rows, noGround: -32768 }, cells);
  const walk = masks.largestStreetArea(grid);
  assert.equal(walk[cols * 1 + 2], 0, 'the roof is not street');
  assert.equal(walk[0], 1);
  const clearance = masks.clearanceOf(walk, cols, rows);
  assert.equal(clearance[cols * 1 + 1], 1, 'next to the building');
  assert.equal(grid.heightAt(6, 3), 30, 'heights are stored in decimetres');
});

const tiles = await load('src/games/city/map/cityTiles.ts');

test('tiles: the list is checked, distances are to the nearest edge, detail changes with a margin', () => {
  const tile = { id: '0_0', glb: '0_0.glb', tex: '0_0.jpg', texLo: '0_0_lo.jpg', size: 2048, loSize: 512, minX: 0, maxX: 256, minZ: 0, maxZ: 256 };
  assert.deepEqual(tiles.parseTileManifest({ tileM: 256, tiles: [tile] }).tiles[0], tile);
  assert.throws(() => tiles.parseTileManifest({ tileM: 256, tiles: [{ ...tile, glb: '../secret.glb' }] }), /files/);
  assert.equal(tiles.distanceToTile(tile, 100, 100), 0);
  assert.equal(tiles.distanceToTile(tile, 300, 128), 44);
  const radii = { loadM: 500, unloadM: 600, hiM: 150, hiKeepM: 220 };
  assert.equal(tiles.wantedDetail('none', 400, radii), 'lo');
  assert.equal(tiles.wantedDetail('none', 550, radii), 'none', 'too far to start loading');
  assert.equal(tiles.wantedDetail('lo', 550, radii), 'lo', 'a loaded tile stays until the unload distance');
  assert.equal(tiles.wantedDetail('lo', 200, radii), 'lo', 'not yet close enough for the full texture');
  assert.equal(tiles.wantedDetail('hi', 200, radii), 'hi', 'the full texture stays until the keep distance');
  assert.equal(tiles.wantedDetail('lo', 100, radii), 'hi');
});
