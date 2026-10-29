import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: `export * from './src/constants/equipment';
      export * from './src/constants/lynAppearance';
      export { getInitialCharacter } from './src/constants/presets';`,
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { equipped, withEquipped, getInitialCharacter, tailColor } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
const character = (race = 'lyn', gender = 'female') => ({ ...getInitialCharacter(), race, gender });

test('Lyn uses fitted tail models available for both genders', async () => {
  for (const gender of ['female', 'male']) {
    const state = character('lyn', gender);
    for (const [type, id] of [
      ['fox_bushy', 'elvs_fluffy_tail_as_clothes_1'],
      ['cat_slender', 'elvs_cat_tail_as_clothes_1'],
    ]) {
      state.cosmetics.tailType = type;
      assert.equal(equipped(state, 'tail'), id);
      await access(`public/models/assets/${id}.${gender}.glb`);
    }
    await access(`public/models/lyn_${gender}.glb`);
  }
});

test('explicit tail equipment replaces the default; removing it stays removed', () => {
  const state = character();
  const custom = withEquipped(state, 'tail', 'culturalibre_tigra_tail');
  assert.equal(equipped(custom, 'tail'), 'culturalibre_tigra_tail');
  assert.equal(equipped(withEquipped(custom, 'tail', null), 'tail'), null);
  assert.equal(equipped(character('jin'), 'tail'), null);
});

test('Lyn fur colour applies to the loaded tail and explicit dye has priority', () => {
  const state = character();
  state.cosmetics.furColorPrimary = '#123456';
  assert.equal(tailColor(state), '#123456');
  state.cosmetics.wearColors = { tail: '#abcdef' };
  assert.equal(tailColor(state), '#abcdef');
});
