import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: `export * from './src/constants/sliders';
      export { getInitialCharacter } from './src/constants/presets';
      export { sanitizeState } from './src/lib/persistence';
      export * from './src/renderer/character/morphInfluence';
      export * from './src/components/UI/sliderValues';`,
    resolveDir: process.cwd(),
  }, bundle: true, write: false, format: 'esm', platform: 'node',
});
const { BODY_SLIDERS, FACE_SLIDERS, getInitialCharacter, sanitizeState, morphInfluence, fromStep, toStep } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('body sliders reach 30 steps and 1.5 times the original maximum morph strength', () => {
  for (const key of ['bodyFat', 'muscleTone', 'chestSize', 'waistWidth', 'glutes', 'legLength']) {
    const slider = BODY_SLIDERS.find((slider) => slider.key === key);
    const state = getInitialCharacter();
    assert.equal(slider.uiSpan, 30);
    state.body[key] = slider.max;
    close(morphInfluence(state).get(`${key}_pos`), 0.825);
    close(fromStep(slider, 30), slider.max);
    assert.equal(toStep(slider, slider.max), 30);
    close(fromStep(slider, 40), slider.max);
  }
});

test('existing saved values retain their previous shape and displayed integer steps', () => {
  for (const slider of BODY_SLIDERS.filter((slider) => slider.uiSpan === 30)) {
    for (const direction of [-1, 1]) {
      const oldLimit = slider.def + ((direction > 0 ? slider.max : slider.min) - slider.def) / 1.5;
      if (oldLimit === slider.def) continue;
      const state = getInitialCharacter();
      state.body[slider.key] = oldLimit;
      close(morphInfluence(state).get(`${slider.key}_${direction > 0 ? 'pos' : 'neg'}`), 0.55);
      assert.equal(toStep(slider, oldLimit), direction * 20);
    }
  }
});

test('defaults, facial controls, age and race features keep their original strength', () => {
  assert.equal(morphInfluence(getInitialCharacter()).size, 0);
  for (const slider of FACE_SLIDERS) assert.equal(slider.uiSpan, undefined);
  const age = BODY_SLIDERS.find((slider) => slider.key === 'ageShift');
  assert.equal(age.max, 1);
  const state = getInitialCharacter();
  state.body.ageShift = 1;
  close(morphInfluence(state).get('ageShift_pos'), 0.55);
});

test('expanded values survive character serialization and invalid morph values remain finite', () => {
  const state = getInitialCharacter();
  state.body.glutes = 2;
  state.body.height = 1.5;
  const restored = sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.body.glutes, 2);
  assert.equal(restored.body.height, 1.5);
  state.body.glutes = Infinity;
  assert.equal(morphInfluence(state).has('glutes_pos'), false);
});
