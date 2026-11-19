import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const load = async (entry) => {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const { generateCityLayout } = await load('src/games/city/map/procedural/cityLayout.ts');
const { layoutGround } = await load('src/games/city/map/procedural/layoutGround.ts');
const places = await load('src/games/city/map/cityPlaces.ts');

const SEED = 20261116;
const layout = generateCityLayout(SEED);
const ground = layoutGround(layout);
const count = (mask) => mask.reduce((s, v) => s + v, 0);

test('generated city: the same seed builds the same city, another seed another one', () => {
  const again = generateCityLayout(SEED);
  assert.deepEqual(again.buildings.slice(0, 20), layout.buildings.slice(0, 20));
  assert.notDeepEqual(generateCityLayout(SEED + 1).buildings.slice(0, 20), layout.buildings.slice(0, 20));
});

test('generated city: every district is there, towers downtown are taller than houses', () => {
  const districts = new Set(layout.blocks.map((b) => b.district));
  for (const d of ['downtown', 'midtown', 'residential', 'industrial', 'park', 'plaza']) assert(districts.has(d), `missing ${d}`);
  assert(layout.buildings.length > 300, `a real city, got ${layout.buildings.length} buildings`);
  assert(Math.max(...layout.buildings.map((b) => b.height)) > 120, 'downtown has tall towers');
});

test('generated city: one connected street network with room to drive, buildings are walls, the sea has no ground', () => {
  const walkKm2 = (count(ground.masks.walk) * 6.25) / 1e6;
  const driveKm2 = (count(ground.masks.drive) * 6.25) / 1e6;
  assert(walkKm2 > 1, `walkable ${walkKm2.toFixed(2)} km²`);
  assert(driveKm2 > 0.4, `drivable ${driveKm2.toFixed(2)} km²`);
  const tower = layout.buildings.find((b) => b.height > 60);
  const k = ground.grid.index((tower.x0 + tower.x1) / 2, (tower.z0 + tower.z1) / 2);
  assert.equal(ground.masks.walk[k], 0, 'inside a tower is not street');
  assert.equal(ground.grid.hasGround(ground.grid.index(0, 1000)), false, 'the far south is sea');
});

test('generated city: every mission place is on the street it was put on', () => {
  const snapped = places.snapPlaces(ground, layout.places);
  for (const id of places.PLACE_IDS) {
    const moved = Math.hypot(layout.places[id].x - snapped[id].x, layout.places[id].z - snapped[id].z);
    assert(moved < 8, `${id} moved ${moved.toFixed(1)} m to reach a street`);
    assert.equal(ground.masks.walk[ground.grid.index(snapped[id].x, snapped[id].z)], 1, `${id} is on the street`);
  }
});
