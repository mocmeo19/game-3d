import type { MixamoSource, RetargetPose } from './mixamo';

export class StageAnimations {
  private clips = new Map<string, MixamoSource | 'loading' | 'failed'>();
  private abort = new AbortController();
  private disposed = false;

  status(file: string): 'loading' | 'failed' | 'ready' {
    const clip = this.clips.get(file);
    return !clip || clip === 'loading' ? 'loading' : clip === 'failed' ? 'failed' : 'ready';
  }

  sample(file: string, dt: number): RetargetPose | null {
    if (this.disposed) return null;
    const clip = this.clips.get(file);
    if (!clip) {
      this.clips.set(file, 'loading');
      void this.load(file);
      return null;
    }
    if (typeof clip === 'string') return null;
    clip.play(clip.clipNames[0]);
    return clip.sample(dt, 'all');
  }

  private async load(file: string) {
    try {
      const [{ MixamoSource }, response] = await Promise.all([
        import('./mixamo'), fetch(`/animations/${file}`, { signal: this.abort.signal }),
      ]);
      if (!response.ok) throw new Error(`Animation ${response.status}`);
      const source = await MixamoSource.load(new File([await response.arrayBuffer()], file));
      if (this.disposed) { source.dispose(); return; }
      this.clips.set(file, source);
    } catch {
      if (!this.disposed) this.clips.set(file, 'failed');
    }
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.clips.forEach((clip) => { if (typeof clip !== 'string') clip.dispose(); });
    this.clips.clear();
  }
}
