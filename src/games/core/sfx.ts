import { sound } from '../../audio/soundManager';
import { WeaponId } from './rules';

/** Per-weapon shot recipe: filtered noise crack + low thump. */
const SHOT: Partial<Record<WeaponId, { band: number; decay: number; thump: number; gain: number }>> = {
  glock: { band: 2400, decay: 0.12, thump: 140, gain: 0.5 },
  usp: { band: 900, decay: 0.08, thump: 90, gain: 0.22 },
  deagle: { band: 1300, decay: 0.32, thump: 75, gain: 0.95 },
  mp9: { band: 2100, decay: 0.1, thump: 120, gain: 0.5 },
  ak47: { band: 1400, decay: 0.22, thump: 85, gain: 0.8 },
  m4a4: { band: 1900, decay: 0.17, thump: 95, gain: 0.7 },
  awp: { band: 1000, decay: 0.6, thump: 55, gain: 1.15 },
  ump: { band: 1700, decay: 0.12, thump: 110, gain: 0.55 },
  scar: { band: 1750, decay: 0.18, thump: 92, gain: 0.72 },
  m249: { band: 1500, decay: 0.2, thump: 80, gain: 0.78 },
  sks: { band: 1200, decay: 0.32, thump: 70, gain: 0.9 },
  kar98: { band: 950, decay: 0.55, thump: 58, gain: 1.1 },
  s12k: { band: 700, decay: 0.38, thump: 60, gain: 1.05 }
};

type Pos = { x: number; y: number; z: number };

/** Synthesised game sounds. Positional sounds pan and fade with distance from the listener. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ring: OscillatorNode | null = null;
  private unsubscribeAudio = sound.subscribeSettings(() => {
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(0.55 * sound.getEffectsLevel(), this.ctx.currentTime, 0.025);
  });
  listener = { x: 0, y: 0, z: 0, yaw: 0 };

  private ensure() {
    if (sound.getMuted()) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55 * sound.getEffectsLevel();
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        return null; // audio is optional
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  resume() {
    this.ensure();
  }

  /** Gain → lowpass → pan chain for a world position (centred when `pos` is omitted). */
  private out(pos?: Pos, reach = 60) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 18000;
    let vol = 1;
    if (pos) {
      const dx = pos.x - this.listener.x;
      const dz = pos.z - this.listener.z;
      const dist = Math.hypot(dx, dz, pos.y - this.listener.y);
      vol = (1 / (1 + dist / 7)) * Math.max(0, 1 - dist / reach);
      // the listener's right vector is (cos yaw, -sin yaw)
      const right = (dx * Math.cos(this.listener.yaw) - dz * Math.sin(this.listener.yaw)) / (dist || 1);
      pan.pan.value = Math.max(-0.9, Math.min(0.9, right));
      lp.frequency.value = Math.max(900, 18000 - dist * 260);
    }
    gain.connect(lp);
    lp.connect(pan);
    pan.connect(this.master!);
    return { gain, vol };
  }

  private burst(dest: AudioNode, t: number, dur: number, gain: number, type: BiquadFilterType, freq: number, q = 0.8) {
    if (gain <= 0.001) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private tone(dest: AudioNode, t: number, dur: number, gain: number, from: number, to: number, type: OscillatorType = 'sine') {
    if (gain <= 0.001) return;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  shot(id: WeaponId, pos?: Pos) {
    const ctx = this.ensure();
    const r = SHOT[id];
    if (!ctx || !r) return;
    const { gain, vol } = this.out(pos, id === 'usp' ? 25 : 140);
    const t = ctx.currentTime;
    this.burst(gain, t, r.decay, r.gain * vol, 'bandpass', r.band, 0.6);
    this.burst(gain, t, r.decay * 1.8, r.gain * vol * 0.35, 'lowpass', 700);
    this.tone(gain, t, r.decay * 0.9, r.gain * vol * 0.8, r.thump * 1.6, r.thump * 0.5);
  }

  knife(hit: boolean, pos?: Pos) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain, vol } = this.out(pos, 20);
    const t = ctx.currentTime;
    this.burst(gain, t, 0.16, 0.25 * vol, 'highpass', 2500);
    if (hit) this.burst(gain, t + 0.05, 0.12, 0.4 * vol, 'lowpass', 500);
  }

  click(freq = 1800, gain = 0.15) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.tone(this.out().gain, ctx.currentTime, 0.03, gain, freq, freq * 0.7, 'square');
  }

  /** Magazine out / in / bolt clicks spread over the reload. */
  reload(duration: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain } = this.out();
    const t = ctx.currentTime;
    this.tone(gain, t + 0.25, 0.04, 0.12, 900, 600, 'square');
    this.burst(gain, t + 0.3, 0.08, 0.2, 'bandpass', 1500);
    this.tone(gain, t + duration * 0.7, 0.05, 0.14, 1200, 700, 'square');
    this.burst(gain, t + duration * 0.72, 0.08, 0.25, 'bandpass', 1800);
    this.tone(gain, t + duration - 0.12, 0.04, 0.12, 1600, 1100, 'square');
  }

  /** Feedback when the listener's bullet connects. */
  hit(headshot: boolean, helmet: boolean) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain } = this.out();
    const t = ctx.currentTime;
    if (headshot && helmet) this.tone(gain, t, 0.25, 0.25, 2900, 2700, 'triangle');
    else if (headshot) this.burst(gain, t, 0.14, 0.45, 'bandpass', 900, 2);
    else this.burst(gain, t, 0.08, 0.35, 'lowpass', 600);
  }

  hurt() {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain } = this.out();
    const t = ctx.currentTime;
    this.burst(gain, t, 0.15, 0.5, 'lowpass', 380);
    this.tone(gain, t, 0.12, 0.25, 140, 60);
  }

  footstep(pos?: Pos, gainMul = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain, vol } = this.out(pos, 30);
    this.burst(gain, ctx.currentTime, 0.07, 0.35 * vol * gainMul, 'bandpass', 450 + Math.random() * 250, 1.2);
  }

  land(pos?: Pos) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain, vol } = this.out(pos, 30);
    this.burst(gain, ctx.currentTime, 0.12, 0.5 * vol, 'lowpass', 350);
  }

  bounce(pos: Pos) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain, vol } = this.out(pos, 30);
    this.tone(gain, ctx.currentTime, 0.08, 0.2 * vol, 1500, 1100, 'triangle');
  }

  explosion(pos: Pos) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain, vol } = this.out(pos, 160);
    const t = ctx.currentTime;
    this.burst(gain, t, 1.3, 1.3 * vol, 'lowpass', 900);
    this.tone(gain, t, 0.9, 1.0 * vol, 90, 30);
  }

  flashPop(pos: Pos) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain, vol } = this.out(pos, 80);
    this.burst(gain, ctx.currentTime, 0.25, vol, 'highpass', 1200);
  }

  smokeHiss(pos: Pos) {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain, vol } = this.out(pos, 40);
    this.burst(gain, ctx.currentTime, 2.5, 0.25 * vol, 'highpass', 3000);
  }

  /** Ringing ears after being flashed, fading over `seconds`. */
  flashRing(seconds: number) {
    const ctx = this.ensure();
    if (!ctx || seconds <= 0) return;
    try {
      this.ring?.stop();
    } catch {
      /* already stopped */
    }
    const osc = ctx.createOscillator();
    osc.frequency.value = 3300;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.05);
    this.ring = osc;
  }

  /** Short two-tone cue for round start / end and buying. */
  cue(kind: 'start' | 'win' | 'lose' | 'buy' | 'deny') {
    const ctx = this.ensure();
    if (!ctx) return;
    const { gain } = this.out();
    const t = ctx.currentTime;
    const notes = { start: [660, 880], win: [784, 1046], lose: [440, 330], buy: [1200, 1500], deny: [300, 240] }[kind];
    this.tone(gain, t, 0.12, 0.18, notes[0], notes[0], 'triangle');
    this.tone(gain, t + 0.12, kind === 'buy' || kind === 'deny' ? 0.08 : 0.3, 0.18, notes[1], notes[1], 'triangle');
  }

  dispose() {
    this.unsubscribeAudio();
    void this.ctx?.close();
    this.ctx = null;
  }
}
