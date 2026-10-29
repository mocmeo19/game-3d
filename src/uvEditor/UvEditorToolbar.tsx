import { useRef, useState } from 'react';
import { Download, FileJson, ImagePlus } from 'lucide-react';
import { useUvEditorState } from './useUvEditorState';
import { EXPORT_SIZES, ExportFormat, ExportSize, UvEditorStore } from './uvEditorStore';

const FORMATS: { value: ExportFormat; label: string; extension: string }[] = [
  { value: 'image/png', label: 'PNG', extension: 'png' },
  { value: 'image/webp', label: 'WebP', extension: 'webp' },
];
const BUTTON = 'flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10 disabled:opacity-40';
const STATUS_COLOR = { idle: 'text-slate-400', busy: 'text-sky-200', ok: 'text-emerald-300', error: 'text-rose-300' } as const;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // the click starts the download right away; the URL is not needed after this task
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function UvEditorToolbar({ store }: { store: UvEditorStore }) {
  const { status, doc } = useUvEditorState(store);
  const uvInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<ExportSize>(2048);
  const [format, setFormat] = useState<ExportFormat>('image/png');
  const [exporting, setExporting] = useState(false);

  const exportSkin = async () => {
    setExporting(true);
    store.setStatus('busy', `Đang xuất skin ${size} px…`);
    try {
      const blob = await store.exportSkin(size, format);
      const name = `skin-${size}.${FORMATS.find((f) => f.value === format)!.extension}`;
      download(blob, name);
      store.setStatus('ok', `Đã xuất ${name} (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
    } catch (error) {
      store.setStatus('error', error instanceof Error ? error.message : 'Không xuất được skin.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={uvInput} type="file" accept=".json,application/json" hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void store.loadLayoutFile(file);
          event.target.value = '';
        }} />
      <input ref={imageInput} type="file" accept="image/*" multiple hidden
        onChange={(event) => {
          if (event.target.files?.length) void store.addImages(event.target.files);
          event.target.value = '';
        }} />
      <button type="button" onClick={() => uvInput.current?.click()} className={BUTTON}><FileJson size={15} />Nạp UV JSON</button>
      <button type="button" onClick={() => imageInput.current?.click()} className={BUTTON}><ImagePlus size={15} />Thêm ảnh</button>
      <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Cỡ
        <select value={size} onChange={(event) => setSize(Number(event.target.value) as ExportSize)}
          className="rounded-lg border border-white/15 bg-[#0d141d] px-2 py-1.5 text-slate-100">
          {EXPORT_SIZES.map((s) => <option key={s} value={s}>{s} px</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Định dạng
        <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}
          className="rounded-lg border border-white/15 bg-[#0d141d] px-2 py-1.5 text-slate-100">
          {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void exportSkin()} disabled={exporting || (!doc.layers.length && !doc.baseEnabled)}
        className={`${BUTTON} border-sky-300/40 bg-sky-300/15 text-sky-100`}>
        <Download size={15} />{exporting ? 'Đang xuất…' : 'Xuất skin'}
      </button>
      <p role="status" aria-live="polite" title={status.message} className={`ml-auto min-w-0 max-w-full truncate text-xs ${STATUS_COLOR[status.kind]}`}>
        {status.message}
      </p>
    </div>
  );
}
