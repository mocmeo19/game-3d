import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/audio/soundManager.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { sound } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const instances = [];
class FakeAudio {
  constructor(url) { this.url = url; instances.push(this); }
  play() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
  pause() { this.paused = true; }
  removeAttribute() {}
  load() {}
}
globalThis.Audio = FakeAudio;
const voice = { id: 'brave_f' };

test('new preview cancels old playback; stale promises cannot change the active state', async () => {
  const first = sound.playVoice(voice);
  const old = instances.at(-1);
  const second = sound.playVoice(voice, 'normal');
  const current = instances.at(-1);
  assert.equal(old.paused, true);
  old.reject(new Error('Interrupted'));
  await first;
  assert.equal(sound.getVoiceState().key, 'brave_f-normal');
  current.resolve();
  await second;
  assert.equal(sound.getVoiceState().status, 'playing');
  current.onended();
  assert.equal(sound.getVoiceState().status, 'idle');
});

test('mute stops audio and prevents further playback', async () => {
  const playing = sound.playVoice(voice);
  const audio = instances.at(-1);
  audio.resolve();
  await playing;
  sound.setMuted(true);
  assert.equal(audio.paused, true);
  const count = instances.length;
  await sound.playVoice(voice);
  assert.equal(instances.length, count);
  assert.equal(sound.getVoiceState().status, 'error');
  sound.setMuted(false);
});

test('missing or blocked audio reports an error and can be retried', async () => {
  const failed = sound.playVoice(voice);
  instances.at(-1).reject(new Error('Missing file'));
  await failed;
  assert.equal(sound.getVoiceState().status, 'error');
  const retry = sound.playVoice(voice);
  instances.at(-1).resolve();
  await retry;
  assert.equal(sound.getVoiceState().status, 'playing');
  sound.stopVoice();
});
