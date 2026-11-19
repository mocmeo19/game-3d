import { useEffect, useState, type DragEvent } from 'react';
import { ArrowLeft, Grid3x3, Settings2 } from 'lucide-react';
import { LayerInspector } from './LayerInspector';
import { LayerPanel } from './LayerPanel';
import { SkinPreview3D } from './SkinPreview3D';
import { UvCanvas } from './UvCanvas';
import { UvEditorToolbar } from './UvEditorToolbar';
import { UvEditorStore } from './uvEditorStore';
import { ViewOptionsPanel } from './ViewOptionsPanel';

const isLayoutFile = (file: File) => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

/**
 * UV Map Editor: load a mesh's UV layout (JSON) as a guide, lay pictures over it as layers, check the result on the body in 3D
 * and export the skin texture.
 */
export function UvEditorPage() {
  // made in an effect (not during render) so React's dev double-mount gets a fresh store instead of a disposed one
  const [store, setStore] = useState<UvEditorStore | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const next = new UvEditorStore();
    setStore(next);
    const previousTitle = document.title;
    document.title = 'UV Map Editor · Nam’s Battle Royal';
    return () => {
      next.dispose();
      document.title = previousTitle;
    };
  }, []);

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!store) return;
    const files = [...event.dataTransfer.files];
    const layout = files.find(isLayoutFile);
    if (layout) void store.loadLayoutFile(layout);
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length) void store.addImages(images);
  };

  return (
    <div className="flex h-dvh flex-col bg-[#09131e] text-slate-200"
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={drop}>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#0b1825] px-5 py-3">
        <a href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <ArrowLeft size={16} /><span className="hidden sm:inline">Về ứng dụng</span>
        </a>
        <h1 className="flex items-center gap-2 text-sm font-semibold text-white"><Grid3x3 size={17} className="text-sky-200" />UV Map Editor</h1>
        <a href="/settings" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <Settings2 size={15} /><span className="hidden sm:inline">Cài đặt</span>
        </a>
      </header>
      {store ? (
        <>
          <div className="shrink-0 border-b border-white/10 px-5 py-3"><UvEditorToolbar store={store} /></div>
          <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:overflow-hidden">
            <div className="flex min-h-0 flex-col gap-4">
              <LayerPanel store={store} />
              <ViewOptionsPanel store={store} />
            </div>
            <div className="min-h-[420px] lg:min-h-0"><UvCanvas store={store} /></div>
            <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
              <LayerInspector store={store} />
              <SkinPreview3D store={store} />
            </div>
          </main>
        </>
      ) : (
        <p className="grid flex-1 place-items-center text-sm text-slate-400">Đang mở trình chỉnh…</p>
      )}
      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-2xl border-2 border-dashed border-sky-300/60 bg-sky-300/10 text-sm text-sky-100">
          Thả file UV (.json) hoặc ảnh vào đây
        </div>
      )}
    </div>
  );
}
