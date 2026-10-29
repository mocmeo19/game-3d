import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const load = async (entry) => {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const ship = await load('src/game/maps/cargoShipLayout.ts');
const R = await load('src/game/rules.ts');
const { NavGrid } = await load('src/game/nav.ts');

const solids = ship.cargoShipSolids();
const nav = new NavGrid(ship.SHIP_NAV_HALF, R.makeBlocked(solids, 0.5), ship.SHIP_NAV_CELL);
const spots = [...ship.SPAWNS.CT, ...ship.SPAWNS.T, ...ship.POINTS.attack, ...ship.POINTS.hold.CT, ...ship.POINTS.hold.T];

test('cargo ship: spawns and bot points stand on open deck', () => {
  for (const p of spots) assert.ok(!R.blocked(p.x, p.z, solids), `(${p.x}, ${p.z}) is inside a solid`);
});

test('cargo ship: bots can walk from their spawn to every point and to the other spawn', () => {
  for (const from of [ship.SPAWNS.CT[2], ship.SPAWNS.T[2]])
    for (const to of spots) {
      if (Math.hypot(to.x - from.x, to.z - from.z) < 1) continue;
      assert.ok(nav.path(from, to).length > 0, `no path from (${from.x}, ${from.z}) to (${to.x}, ${to.z})`);
    }
});

test('cargo ship: containers and deck props do not overlap', () => {
  const boxes = solids.slice(2 * ship.HULL.length + 2);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.min.x < b.max.x - 1e-3 && b.min.x < a.max.x - 1e-3 && a.min.z < b.max.z - 1e-3 && b.min.z < a.max.z - 1e-3;
      assert.ok(!overlap, `boxes ${i} and ${j} overlap`);
    }
});

test('cargo ship: the deck edge stops players and grenades at the sea', () => {
  assert.ok(R.blocked(15.6, 0, solids), 'the side bulwark blocks');
  assert.ok(R.blocked(0, ship.SHIP_STERN_Z, solids), 'the stern blocks');
  assert.ok(R.blocked(0, ship.SHIP_BOW_Z, solids), 'the bow blocks');
  assert.ok(R.blocked(11, -60, solids), 'the narrow bow blocks outside its sides');
  assert.ok(R.blocked(15.2, 0, solids, 0.36, 20), 'too tall to jump over');
});
