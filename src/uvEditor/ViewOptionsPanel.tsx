import { RangeField } from './RangeField';
import { useUvEditorState } from './useUvEditorState';
import { layoutStats } from './uvLayout';
import type { UvEditorStore } from './uvEditorStore';

/** The loaded UV layout and how its guides show over the skin (they never go into the exported picture). */
export function ViewOptionsPanel({ store }: { store: UvEditorStore }) {
  const { layout, layoutFile, showWire, wireColor, wireOpacity, dimOutside } = useUvEditorState(store);
  const stats = layout ? layoutStats(layout) : null;
  return (
    <section aria-label="Lưới UV" className="space-y-3 rounded-xl border border-white/10 bg-white/3 p-4 text-xs">
      <h2 className="text-sm font-semibold text-white">Lưới UV</h2>
      {layout && stats ? (
        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-y-1 text-slate-400">
          <dt>File</dt><dd className="truncate text-slate-200" title={layoutFile ?? ''}>{layoutFile}</dd>
          <dt>Mesh</dt><dd className="truncate text-slate-200">{layout.label}</dd>
          {layout.sourceModel && <><dt>Mô hình</dt><dd className="truncate text-slate-200" title={layout.sourceModel}>{layout.sourceModel}</dd></>}
          <dt>Kích thước</dt>
          <dd className="text-slate-200">{stats.vertices.toLocaleString('vi-VN')} đỉnh · {stats.triangles.toLocaleString('vi-VN')} tam giác</dd>
        </dl>
      ) : (
        <p className="text-slate-500">Chưa nạp. Bấm “Nạp UV JSON” (ví dụ test/uv.json).</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-slate-300">
          <input type="checkbox" checked={showWire} onChange={(event) => store.setView({ showWire: event.target.checked })} className="accent-sky-300" />
          Hiện lưới
        </label>
        <label className="flex items-center gap-2 text-slate-300">
          Màu
          <input type="color" value={wireColor} onChange={(event) => store.setView({ wireColor: event.target.value })}
            className="h-6 w-9 cursor-pointer rounded-sm border border-white/20 bg-transparent" />
        </label>
        <label className="flex items-center gap-2 text-slate-300">
          <input type="checkbox" checked={dimOutside} onChange={(event) => store.setView({ dimOutside: event.target.checked })} className="accent-sky-300" />
          Làm tối ngoài vùng UV
        </label>
      </div>
      <RangeField label="Độ đậm lưới" value={wireOpacity} min={0.05} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
        onChange={(value) => store.setView({ wireOpacity: value })} />
    </section>
  );
}
