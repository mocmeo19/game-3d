import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useUvEditorState } from './useUvEditorState';
import type { UvEditorStore } from './uvEditorStore';

const ICON_BUTTON = 'rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

/** The layers, topmost first (later layers cover earlier ones), and the base colour under them all. */
export function LayerPanel({ store }: { store: UvEditorStore }) {
  const { doc, selectedId } = useUvEditorState(store);
  const topFirst = [...doc.layers].reverse();
  return (
    <section aria-label="Các lớp" className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/3">
      <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Lớp ({doc.layers.length})</h2>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {topFirst.length === 0 && <li className="px-2 py-3 text-xs text-slate-500">Chưa có lớp ảnh. Bấm “Thêm ảnh” hoặc kéo ảnh vào trang.</li>}
        {topFirst.map((layer, i) => {
          const index = doc.layers.length - 1 - i;
          const selected = layer.id === selectedId;
          return (
            <li key={layer.id} className={`mb-1 flex items-center gap-1 rounded-lg border px-1.5 py-1 ${selected ? 'border-sky-300/40 bg-sky-300/10' : 'border-transparent hover:bg-white/5'}`}>
              <button type="button" onClick={() => store.updateLayer(layer.id, { visible: !layer.visible })} className={ICON_BUTTON}
                aria-label={layer.visible ? `Ẩn ${layer.name}` : `Hiện ${layer.name}`} title={layer.visible ? 'Ẩn' : 'Hiện'}>
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button type="button" onClick={() => store.select(layer.id)} aria-pressed={selected} title={layer.name}
                className={`min-w-0 flex-1 truncate text-left text-xs ${selected ? 'text-sky-100' : 'text-slate-300'} ${layer.visible ? '' : 'opacity-50'}`}>
                {layer.name}
              </button>
              <button type="button" onClick={() => store.moveLayer(layer.id, 1)} disabled={index === doc.layers.length - 1} className={ICON_BUTTON}
                aria-label={`Đưa ${layer.name} lên trên`} title="Lên trên"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => store.moveLayer(layer.id, -1)} disabled={index === 0} className={ICON_BUTTON}
                aria-label={`Đưa ${layer.name} xuống dưới`} title="Xuống dưới"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => store.removeLayer(layer.id)} className={`${ICON_BUTTON} hover:text-rose-300`}
                aria-label={`Xoá ${layer.name}`} title="Xoá"><Trash2 size={14} /></button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-xs">
        <label className="flex items-center gap-2 text-slate-300">
          <input type="checkbox" checked={doc.baseEnabled} onChange={(event) => store.setBase({ baseEnabled: event.target.checked })} className="accent-sky-300" />
          Màu da nền
        </label>
        <input type="color" value={doc.baseColor} disabled={!doc.baseEnabled} onChange={(event) => store.setBase({ baseColor: event.target.value })}
          aria-label="Chọn màu da nền" className="h-7 w-10 cursor-pointer rounded-sm border border-white/20 bg-transparent disabled:opacity-40" />
        <span className="font-mono text-slate-500">{doc.baseColor}</span>
      </div>
    </section>
  );
}
