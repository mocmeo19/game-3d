/**
 * Procedural Web Audio Sound Engine for Blade & Soul Character Creator
 * Emulates the iconic wuxia martial audio cues using synthesized oscillators, 
 * noise bursts, filters, and reverberant envelopes.
 */

import { VoiceInfo, VoiceClip, voiceClipUrl } from '../constants/voices';
import { AmbientMusic, MusicScene } from './ambientMusic';

import { AUDIO_KEY, readAudioSettings, type AudioSettings, type AudioSaveState } from './audioSettings';
import { writeConfiguration } from '../settings/configurationStore';
export type { AudioSettings } from './audioSettings';

class SoundManager {
  private ctx: AudioContext | null = null;
  private settings = readAudioSettings();
  private get isMuted() { return this.settings.muted; }
  private effectsOutput: GainNode | null = null;
  private musicOutput: GainNode | null = null;
  private music: AmbientMusic | null = null;
  private musicScene: MusicScene = 'menu';
  private unlocked = false;
  private musicPreview: boolean | null = null;
  public setMusicPreview(active: boolean | null) { this.musicPreview = active; this.syncAudio(); }
  private pageVisible = true;
  private lastUiCue = -Infinity;
  private lastSliderTick = -Infinity;
  private settingsListeners = new Set<() => void>();
  private settingsSave: AudioSaveState = { saving: false, error: '' };
  private settingsWrite = 0;
  public getSettingsSaveState = () => this.settingsSave;
  public getSettings = () => this.settings;
  public subscribeSettings = (listener: () => void) => {
    this.settingsListeners.add(listener);
    return () => { this.settingsListeners.delete(listener); };
  };
  public getEffectsLevel = () => this.isMuted || !this.pageVisible ? 0 : this.settings.effects;
  public setLevels = (levels: Partial<Pick<AudioSettings, 'music' | 'effects'>>) => {
    const next = { ...this.settings };
    for (const key of ['music', 'effects'] as const) {
      const value = levels[key];
      if (typeof value === 'number' && Number.isFinite(value)) next[key] = Math.max(0, Math.min(1, value));
    }
    this.settings = next;
    this.saveSettings();
  };
  private saveSettings() {
    const sequence = ++this.settingsWrite;
    this.settingsSave = { saving: true, error: '' };
    void writeConfiguration(AUDIO_KEY, this.settings).then(() => {
      if (sequence !== this.settingsWrite) return;
      this.settingsSave = { saving: false, error: '' };
      this.settingsListeners.forEach((listener) => listener());
    }).catch(() => {
      if (sequence !== this.settingsWrite) return;
      this.settingsSave = { saving: false, error: 'Không lưu được âm thanh. Thay đổi một thiết lập để thử lại.' };
      this.settingsListeners.forEach((listener) => listener());
    });
    this.syncAudio();
    this.settingsListeners.forEach((listener) => listener());
  }
  public unlock = () => {
    this.unlocked = true;
    this.initContext(false);
    this.syncAudio();
  };
  public setMusicScene = (scene: MusicScene) => {
    this.musicScene = scene;
    this.syncAudio();
  };
  public setPageVisible = (visible: boolean) => {
    this.pageVisible = visible;
    if (!visible) this.stopVoice();
    this.syncAudio();
    this.settingsListeners.forEach((listener) => listener());
  };
  private syncAudio() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duck = this.voiceState.status === 'playing' || this.voiceState.status === 'loading' ? 0.25 : 1;
    this.effectsOutput?.gain.setTargetAtTime(this.getEffectsLevel(), now, 0.025);
    this.musicOutput?.gain.setTargetAtTime(this.isMuted || !this.pageVisible ? 0 : this.settings.music * duck, now, 0.3);
    if (this.unlocked && this.pageVisible && this.musicPreview !== false && !this.isMuted && this.settings.music > 0) this.music?.start(this.musicScene);
    else this.music?.stop();
  }
  /** Fills in silent UI controls without doubling cues already played by their handlers. */
  public playFallbackClick = () => {
    if (performance.now() - this.lastUiCue > 80) this.playClick();
  };
  private voiceAudio: HTMLAudioElement | null = null;
  private voiceListeners = new Set<() => void>();
  private voiceState = { key: '', status: 'idle' as 'idle' | 'loading' | 'playing' | 'error', message: '' };
  public subscribeVoice = (listener: () => void) => {
    this.voiceListeners.add(listener);
    return () => { this.voiceListeners.delete(listener); };
  };
  public getVoiceState = () => this.voiceState;

  private voiceAnalyser: AnalyserNode | null = null;
  private voiceBins: Uint8Array<ArrayBuffer> | null = null;
  /**
   * What the voice line sounds like right now, for lip-sync: `level` is its loudness (0..1), `low` / `mid` / `high` the share of the
   * energy in the vowel bands (0..1 each, summing to 1), `hiss` how much of it is noise-like high frequency (s, f, sh).
   * Silent (all zero) when nothing is playing.
   */
  public getVoiceSpectrum = () => {
    const an = this.voiceAnalyser;
    const out = { level: 0, low: 0, mid: 0, high: 0, hiss: 0 };
    if (!an || !this.voiceBins || this.voiceState.status !== 'playing') return out;
    an.getByteFrequencyData(this.voiceBins);
    const hz = (this.ctx?.sampleRate ?? 44100) / an.fftSize;
    const band = (a: number, b: number) => {
      let e = 0;
      const i0 = Math.max(1, Math.floor(a / hz)), i1 = Math.min(this.voiceBins!.length - 1, Math.ceil(b / hz));
      for (let i = i0; i <= i1; i++) e += (this.voiceBins![i] / 255) ** 2;
      return e / Math.max(1, i1 - i0 + 1);
    };
    const low = band(200, 700), mid = band(700, 1800), high = band(1800, 3800), hiss = band(4500, 9000);
    const sum = low + mid + high + 1e-6;
    out.level = Math.min(1, Math.sqrt(sum) * 1.6);
    out.low = low / sum;
    out.mid = mid / sum;
    out.high = high / sum;
    out.hiss = Math.min(1, hiss / (sum + hiss + 1e-6) * 2);
    return out;
  };
  /** Route a voice element through an analyser (it keeps playing to the speakers). Needs the audio context. */
  private tapVoice(audio: HTMLAudioElement) {
    this.initContext();
    if (!this.ctx) return;
    try {
      const src = this.ctx.createMediaElementSource(audio);
      const an = this.ctx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.55;
      src.connect(an);
      an.connect(this.effectsOutput!);
      this.voiceAnalyser = an;
      this.voiceBins = new Uint8Array(new ArrayBuffer(an.frequencyBinCount));
    } catch {
      this.voiceAnalyser = null;
    }
  }
  private updateVoice(state: typeof this.voiceState) {
    this.voiceState = state;
    this.syncAudio();
    this.voiceListeners.forEach((listener) => listener());
  }
  public stopVoice = () => {
    if (this.voiceAudio) {
      const audio = this.voiceAudio;
      this.voiceAudio = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    this.voiceAnalyser = null;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    this.updateVoice({ key: '', status: 'idle', message: '' });
  };
  public async playVoice(voice: VoiceInfo, clip: VoiceClip = 'line') {
    this.stopVoice();
    const key = `${voice.id}-${clip}`;
    if (this.isMuted) {
      this.updateVoice({ key, status: 'error', message: 'Âm thanh đang tắt. Hãy bật âm thanh để nghe thử.' });
      return;
    }
    const audio = new Audio(voiceClipUrl(voice, clip));
    this.voiceAudio = audio;
    this.tapVoice(audio);
    this.updateVoice({ key, status: 'loading', message: 'Đang tải âm thanh…' });
    audio.onended = () => { if (this.voiceAudio === audio) this.stopVoice(); };
    const failed = () => {
      if (this.voiceAudio !== audio) return;
      this.stopVoice();
      this.updateVoice({ key, status: 'error', message: 'Không phát được âm thanh. Vui lòng thử lại.' });
    };
    audio.onerror = failed;
    try {
      await audio.play();
      if (this.voiceAudio === audio) this.updateVoice({ key, status: 'playing', message: 'Đang phát' });
    } catch { failed(); }
  }

  private initContext(markCue = true) {
    if (markCue) this.lastUiCue = performance.now();
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          this.effectsOutput = this.ctx.createGain();
          this.effectsOutput.gain.value = this.getEffectsLevel();
          this.effectsOutput.connect(this.ctx.destination);
          this.musicOutput = this.ctx.createGain();
          this.musicOutput.gain.value = 0;
          this.musicOutput.connect(this.ctx.destination);
          this.music = new AmbientMusic(this.ctx, this.musicOutput);
        } catch { this.ctx = null; }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.settings = { ...this.settings, muted };
    if (muted) this.stopVoice();
    else this.unlock();
    this.saveSettings();
  }

  public getMuted() {
    return this.isMuted;
  }

  // Soft silk/stone UI button click
  public playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.effectsOutput!);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Guzheng / Koto string pluck when selecting race or class
  public playPluck(frequency: number = 440) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Fundamental
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(frequency, now);
    osc2.frequency.setValueAtTime(frequency * 2.01, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.6);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsOutput!);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
  }

  // Metallic martial blade whoosh when changing weapons or combat poses
  public playBladeWhoosh() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // White noise sweep
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(3500, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.28);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsOutput!);

    // High metal ring harmonic
    const metalRing = this.ctx.createOscillator();
    const metalGain = this.ctx.createGain();
    metalRing.type = 'sine';
    metalRing.frequency.setValueAtTime(2480, now + 0.05);

    metalGain.gain.setValueAtTime(0.001, now);
    metalGain.gain.setValueAtTime(0.12, now + 0.06);
    metalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    metalRing.connect(metalGain);
    metalGain.connect(this.effectsOutput!);

    noise.start(now);
    metalRing.start(now + 0.05);
    noise.stop(now + 0.3);
    metalRing.stop(now + 0.45);
  }

  // Slider adjustment subtle tick
  public playSliderTick() {
    if (performance.now() - this.lastSliderTick < 45) return;
    this.lastSliderTick = performance.now();
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(gain);
    gain.connect(this.effectsOutput!);

    osc.start(now);
    osc.stop(now + 0.02);
  }

  // Camera shutter snap
  public playCameraShutter() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.effectsOutput!);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Celestial Gong / Fanfare for "Enter World" / Character Created
  public playTriumph() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const chords = [220, 277.18, 329.63, 440, 554.37, 659.25]; // A major celestial chord
    const now = this.ctx.currentTime;

    chords.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12 / chords.length * (idx + 1), now + idx * 0.05 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

      osc.connect(gain);
      gain.connect(this.effectsOutput!);

      osc.start(now + idx * 0.05);
      osc.stop(now + 2.5);
    });
  }

  // Randomize dice roll
  public playDiceRoll() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400 + Math.random() * 300, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.effectsOutput!);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  }

  public playCue(kind: 'equip' | 'pose' | 'save' | 'start' | 'error') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const notes = {
      equip: [520, 780], pose: [440, 660], save: [660, 880, 1100], start: [330, 440, 660, 880], error: [260, 195]
    }[kind];
    const ctx = this.ctx;
    notes.forEach((frequency, index) => {
      const time = ctx.currentTime + index * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'error' ? 'triangle' : 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.075, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
      osc.connect(gain).connect(this.effectsOutput!);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start(time);
      osc.stop(time + 0.26);
    });
  }

}

export const sound = new SoundManager();
