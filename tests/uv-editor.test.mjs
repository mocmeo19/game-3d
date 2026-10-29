import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const load = async (entry) => {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const uv = await load('src/uvEditor/uvLayout.ts');
const skin = await load('src/uvEditor/skinCompositor.ts');

test('uv layout: the exported body layout loads with every triangle', async () => {
  const data = JSON.parse(await readFile('test/uv.json', 'utf8'));
  const layout = uv.parseUvLayout(data, 'uv.json');
  assert.equal(layout.label, 'Body');
  assert.equal(layout.sourceModel, 'public/models/jin_female.glb');
  assert.deepEqual(uv.layoutStats(layout), { vertices: data.primitives[0].vertexCount, triangles: data.primitives[0].triangleCount });
});

test('uv layout: broken files are refused with a reason', () => {
  assert.throws(() => uv.parseUvLayout([]), /đối tượng JSON/);
  assert.throws(() => uv.parseUvLayout({ coordinateSystem: { origin: 'bottom-left' }, uv: [[0, 0]], triangles: [[0, 0, 0]] }), /top-left/);
  assert.throws(() => uv.parseUvLayout({ uv: [[0, 0], [1, 0]], triangles: [[0, 1, 2]] }), /không tồn tại/);
  assert.throws(() => uv.parseUvLayout({ uv: [[0, 'x']], triangles: [] }), /không hợp lệ/);
  const bare = uv.parseUvLayout({ uv: [[0, 0], [1, 0], [0, 1]], triangles: [[0, 1, 2]] }, 'bare.json');
  assert.equal(bare.label, 'bare.json');
  assert.deepEqual([...bare.triangles], [0, 1, 2]);
});

test('skin layers: the pointer finds the topmost layer, also when it is turned', () => {
  const image = {};
  const bottom = { ...skin.newLayer('a', image, 100, 100), x: 0.5, y: 0.5, scale: 0.4 };
  const top = { ...skin.newLayer('b', image, 200, 50), x: 0.5, y: 0.5, scale: 0.4, rotation: 90 };
  assert.equal(skin.hitLayer([bottom, top], 0.5, 0.5).name, 'b');
  // turned upright, the wide layer covers (0.5, 0.65) but no longer (0.65, 0.5)
  assert.equal(skin.hitLayer([bottom, top], 0.5, 0.65).name, 'b');
  assert.equal(skin.hitLayer([bottom, top], 0.65, 0.5).name, 'a');
  assert.equal(skin.hitLayer([bottom, { ...top, visible: false }], 0.5, 0.5).name, 'a');
  assert.equal(skin.hitLayer([bottom], 0.9, 0.9), null);
  const corners = skin.layerCorners({ ...bottom, rotation: 0 });
  assert.deepEqual(corners.map(([u, v]) => [+u.toFixed(3), +v.toFixed(3)]), [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]]);
});

test('skin layers: edited values stay within range', () => {
  const layer = skin.clampLayer({ ...skin.newLayer('a', {}, 10, 10), scale: 9, opacity: -1, feather: 3, rotation: 270, x: 4 });
  assert.equal(layer.scale, skin.LAYER_LIMITS.scale.max);
  assert.equal(layer.opacity, 0);
  assert.equal(layer.feather, 1);
  assert.equal(layer.rotation, -90);
  assert.equal(layer.x, 1.5);
});
