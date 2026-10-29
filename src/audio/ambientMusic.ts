export type MusicScene = 'menu' | 'arena' | 'torch' | 'testlab';

const SCORES: Record<MusicScene, { beat: number; root: number; melody: number[] }> = {
  menu: { beat: 0.94, root: 50, melody: [12, 19, 16, -1, 14, 21, 19, -1, 16, 14, 12, -1, 7, 14, 12, -1] },
  arena: { beat: 0.82, root: 38, melody: [0, -1, 7, -1, 12, -1, 10, -1, 7, -1, 5, -1, 3, -1, 7, -1] },
  torch: { beat: 1.08, root: 45, melody: [12, -1, 19, 15, 10, -1, 17, -1, 15, 12, 7, -1, 10, 7, 12, -1] },
  testlab: { beat: 0.88, root: 55, melody: [12, 14, -1, 19, 16, -1, 14, -1, 12, 7, -1, 14, 16, -1, 12, -1] }
};

/** Original, quiet instrumental loops. Short scheduling windows avoid timer drift and long queued tails. */
export class AmbientMusic {
  private timer: number | null = null;
  private next = 0;
  private step = 0;
  private scene: MusicScene = 'menu';
  private voices = new Set<{ osc: OscillatorNode; gain: GainNode }>();
  private readonly echo: DelayNode;
  private readonly feedback: GainNode;
  private readonly echoFilter: BiquadFilterNode;
  private readonly echoLevel: GainNode;

  constructor(private readonly ctx: AudioContext, private readonly output: GainNode) {
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = 0.42;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.22;
    this.echoFilter = ctx.createBiquadFilter();
    this.echoFilter.type = 'lowpass';
    this.echoFilter.frequency.value = 1900;
    this.echoLevel = ctx.createGain();
    this.echoLevel.gain.value = 0.22;
    this.echo.connect(this.echoFilter).connect(this.feedback).connect(this.echo);
    this.echoFilter.connect(this.echoLevel).connect(output);
  }

  start(scene: MusicScene) {
    if (this.timer !== null && this.scene === scene) return;
    this.stop();
    this.scene = scene;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.08;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const { osc, gain } of this.voices) {
      const now = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.06);
      try { osc.stop(now + 0.3); } catch { /* Already ended. */ }
    }
  }

  private note(midi: number, time: number, duration: number, volume: number, pad = false) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const voice = { osc, gain };
    this.voices.add(voice);
    osc.type = pad ? 'sine' : 'triangle';
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + (pad ? 0.7 : 0.012));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(this.output);
    if (!pad) gain.connect(this.echo);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private schedule() {
    if (this.ctx.state !== 'running') return;
    const score = SCORES[this.scene];
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.05;
    while (this.next < this.ctx.currentTime + 0.2) {
      const phrase = Math.floor(this.step / 8) % 4;
      const root = score.root + [0, -5, -3, -5][phrase];
      if (this.step % 8 === 0) {
        for (const interval of [0, 7, 12]) this.note(root + interval, this.next, score.beat * 7.5, 0.028, true);
      }
      const semitone = score.melody[this.step % score.melody.length];
      if (semitone >= 0) this.note(score.root + semitone, this.next, score.beat * 2.2, this.scene === 'arena' ? 0.045 : 0.065);
      this.step++;
      this.next += score.beat;
    }
  }
}
