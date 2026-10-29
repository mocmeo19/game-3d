import { MixamoSource } from '../../renderer/character/mixamo';

const FILE_PATTERN = /^[a-z0-9-]+\.fbx$/i;
/** Pause between two preloaded files, so parsing one FBX after another does not stall the frames in between. */
const PRELOAD_GAP_MS = 40;

/**
 * Animation files of public/animations, each parsed once into its own MixamoSource (one player, so one mixer per file). A file is
 * fetched the first time it is asked for; until it is in, callers keep the built-in motion. The library owns every source it made.
 */
export class CombatClipLibrary {
  private readonly sources = new Map<string, MixamoSource>();
  private readonly pending = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly abort = new AbortController();

  /** The parsed file, or null while it loads (the first call starts loading it). */
  get(file: string): MixamoSource | null {
    const source = this.sources.get(file);
    if (source) return source;
    void this.load(file);
    return null;
  }

  async load(file: string): Promise<void> {
    if (this.sources.has(file) || this.pending.has(file) || this.failed.has(file) || this.abort.signal.aborted) return;
    if (!FILE_PATTERN.test(file)) {
      this.failed.add(file);
      return;
    }
    this.pending.add(file);
    try {
      const response = await fetch(`/animations/${file}`, { signal: this.abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const source = await MixamoSource.load(new File([await response.arrayBuffer()], file));
      if (this.abort.signal.aborted) source.dispose();
      else this.sources.set(file, source);
    } catch (error) {
      if (!this.abort.signal.aborted) {
        // a broken or missing file must not be fetched again every frame: its slots stay on the built-in motion
        this.failed.add(file);
        console.warn(`combat animation ${file} not loaded`, error);
      }
    } finally {
      this.pending.delete(file);
    }
  }

  /** Load files one after another in the background (the ones the first seconds of play need). */
  async preload(files: Iterable<string>) {
    for (const file of new Set(files)) {
      if (this.abort.signal.aborted) return;
      await this.load(file);
      await new Promise((resolve) => setTimeout(resolve, PRELOAD_GAP_MS));
    }
  }

  dispose() {
    this.abort.abort();
    this.sources.forEach((source) => source.dispose());
    this.sources.clear();
  }
}
