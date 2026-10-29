import { clampLayer, drawSkin, newLayer, SkinDocument, SkinLayer } from './skinCompositor';
import { parseUvLayout, UvLayout } from './uvLayout';

/** Size of the working texture shown in the editor and on the 3D preview. */
export const WORK_SIZE = 2048;
export const EXPORT_SIZES = [1024, 2048, 4096] as const;
export type ExportSize = (typeof EXPORT_SIZES)[number];
export type ExportFormat = 'image/png' | 'image/webp';

const MAX_UV_FILE_BYTES = 64 * 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_SIDE = 8192;
/** While something is dragged, the panels follow at this pace; the canvas and the 3D preview follow every frame. */
const UI_THROTTLE_MS = 100;

export type EditorStatus = { kind: 'idle' | 'busy' | 'ok' | 'error'; message: string };

export interface UvEditorState {
  layout: UvLayout | null;
  layoutFile: string | null;
  doc: SkinDocument;
  selectedId: string | null;
  showWire: boolean;
  wireColor: string;
  wireOpacity: number;
  /** Darken what lies outside the UV islands (it will not appear on the body). */
  dimOutside: boolean;
  status: EditorStatus;
}

const INITIAL: UvEditorState = {
  layout: null,
  layoutFile: null,
  doc: { baseColor: '#d7a98c', baseEnabled: true, layers: [] },
  selectedId: null,
  showWire: true,
  wireColor: '#7dd3fc',
  wireOpacity: 0.7,
  dimOutside: true,
  status: { kind: 'idle', message: 'Nạp file UV (.json) và ảnh để bắt đầu.' },
};

export class UvEditorStore {
  /** The skin as it stands, redrawn after every change; the 3D preview uses it as its texture. */
  readonly composite: HTMLCanvasElement;
  private state = INITIAL;
  private readonly uiListeners = new Set<() => void>();
  private readonly renderListeners = new Set<() => void>();
  private compositeDirty = true;
  private renderFrame = 0;
  private uiTimer = 0;
  private layoutRequest = 0;
  private disposed = false;

  constructor() {
    this.composite = document.createElement('canvas');
    this.composite.width = this.composite.height = WORK_SIZE;
    this.scheduleRender();
  }

  getState = () => this.state;

  /** For React (useSyncExternalStore). */
  subscribe = (listener: () => void) => {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  };

  /** For the canvas and the 3D preview: called once per animation frame after a change, with `composite` up to date. */
  subscribeRender(listener: () => void) {
    this.renderListeners.add(listener);
    return () => this.renderListeners.delete(listener);
  }

  async loadLayoutFile(file: File) {
    const request = ++this.layoutRequest;
    if (file.size > MAX_UV_FILE_BYTES) return this.fail('File UV quá lớn (tối đa 64 MB).');
    this.setStatus('busy', `Đang đọc ${file.name}…`);
    try {
      const layout = parseUvLayout(JSON.parse(await file.text()), file.name);
      if (request !== this.layoutRequest || this.disposed) return;
      this.update({ layout, layoutFile: file.name, status: { kind: 'ok', message: `Đã nạp lưới UV từ ${file.name}.` } }, false);
    } catch (error) {
      if (request !== this.layoutRequest || this.disposed) return;
      this.fail(error instanceof SyntaxError ? 'File không phải JSON hợp lệ.' : error instanceof Error ? error.message : 'Không đọc được file UV.');
    }
  }

  async addImages(files: Iterable<File>) {
    const accepted = [...files].filter((file) => file.type.startsWith('image/'));
    if (!accepted.length) return this.fail('Chưa chọn ảnh nào (PNG, JPG, WebP…).');
    this.setStatus('busy', `Đang mở ${accepted.length} ảnh…`);
    const added: SkinLayer[] = [];
    const problems: string[] = [];
    for (const file of accepted) {
      if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`${file.name}: quá 50 MB`);
        continue;
      }
      try {
        const bitmap = await createImageBitmap(file);
        if (bitmap.width > MAX_IMAGE_SIDE || bitmap.height > MAX_IMAGE_SIDE) {
          bitmap.close();
          problems.push(`${file.name}: lớn hơn ${MAX_IMAGE_SIDE} px`);
          continue;
        }
        added.push(newLayer(file.name, bitmap, bitmap.width, bitmap.height));
      } catch {
        problems.push(`${file.name}: không đọc được ảnh`);
      }
    }
    if (this.disposed) return added.forEach(closeImage);
    const layers = [...this.state.doc.layers, ...added];
    const message = problems.length ? `Bỏ qua: ${problems.join('; ')}.` : `Đã thêm ${added.length} lớp ảnh.`;
    this.update({
      doc: { ...this.state.doc, layers },
      selectedId: added.at(-1)?.id ?? this.state.selectedId,
      status: { kind: problems.length ? 'error' : 'ok', message },
    });
  }

  select(id: string | null) {
    this.update({ selectedId: id }, false);
  }

  /** `live` changes (dragging, the wheel) update the panels at a slower pace than the picture. */
  updateLayer(id: string, patch: Partial<SkinLayer>, live = false) {
    const layers = this.state.doc.layers.map((layer) => (layer.id === id ? clampLayer({ ...layer, ...patch }) : layer));
    this.update({ doc: { ...this.state.doc, layers } }, true, live);
  }

  removeLayer(id: string) {
    const layer = this.state.doc.layers.find((l) => l.id === id);
    if (!layer) return;
    closeImage(layer);
    const layers = this.state.doc.layers.filter((l) => l.id !== id);
    const selectedId = this.state.selectedId === id ? layers.at(-1)?.id ?? null : this.state.selectedId;
    this.update({ doc: { ...this.state.doc, layers }, selectedId });
  }

  /** Moves a layer one step up (drawn later, on top) or down. */
  moveLayer(id: string, step: 1 | -1) {
    const layers = [...this.state.doc.layers];
    const from = layers.findIndex((l) => l.id === id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= layers.length) return;
    [layers[from], layers[to]] = [layers[to], layers[from]];
    this.update({ doc: { ...this.state.doc, layers } });
  }

  setBase(patch: Partial<Pick<SkinDocument, 'baseColor' | 'baseEnabled'>>) {
    this.update({ doc: { ...this.state.doc, ...patch } });
  }

  setView(patch: Partial<Pick<UvEditorState, 'showWire' | 'wireColor' | 'wireOpacity' | 'dimOutside'>>) {
    this.update(patch, false);
  }

  /** The skin at a given size, without the guide lines. */
  async exportSkin(size: ExportSize, format: ExportFormat): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    drawSkin(canvas.getContext('2d')!, size, this.state.doc);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, 0.95));
    if (!blob) throw new Error('Trình duyệt không tạo được ảnh.');
    return blob;
  }

  setStatus(kind: EditorStatus['kind'], message: string) {
    this.update({ status: { kind, message } }, false);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.renderFrame);
    window.clearTimeout(this.uiTimer);
    this.state.doc.layers.forEach(closeImage);
    this.uiListeners.clear();
    this.renderListeners.clear();
  }

  private fail(message: string) {
    this.setStatus('error', message);
  }

  private update(patch: Partial<UvEditorState>, redraw = true, live = false) {
    this.state = { ...this.state, ...patch };
    if (redraw) this.compositeDirty = true;
    this.scheduleRender();
    if (live) this.scheduleUi();
    else this.notifyUi();
  }

  private scheduleRender() {
    if (this.renderFrame || this.disposed) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = 0;
      if (this.compositeDirty) {
        drawSkin(this.composite.getContext('2d')!, WORK_SIZE, this.state.doc);
        this.compositeDirty = false;
      }
      this.renderListeners.forEach((listener) => listener());
    });
  }

  private scheduleUi() {
    if (this.uiTimer) return;
    this.uiTimer = window.setTimeout(() => this.notifyUi(), UI_THROTTLE_MS);
  }

  private notifyUi() {
    window.clearTimeout(this.uiTimer);
    this.uiTimer = 0;
    this.uiListeners.forEach((listener) => listener());
  }
}

function closeImage(layer: SkinLayer) {
  if (typeof ImageBitmap !== 'undefined' && layer.image instanceof ImageBitmap) layer.image.close();
}
