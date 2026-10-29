import { Crosshair, Expand, FlipHorizontal2 } from 'lucide-react';
import { LAYER_LIMITS, SkinLayer } from './skinCompositor';
import { RangeField } from './RangeField';
import { useUvEditorState } from './useUvEditorState';
import { WORK_SIZE, type UvEditorStore } from './uvEditorStore';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const pixels = (value: number) => `${Math.round(value * WORK_SIZE)}`;
const BUTTON = 'flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10';

export function LayerInspector({ store }: { store: UvEditorStore }) {
  const { doc, selectedId } = useUvEditorState(store);
  const layer = doc.layers.find((l) => l.id === selectedId);
  if (!layer) {
    return (
      <section aria-label="Thuộc tính lớp" className="rounded-xl border border-white/10 bg-white/3 p-4 text-xs text-slate-400">
        Chọn một lớp ảnh (trong danh sách hoặc bấm lên khung) để chỉnh vị trí, cỡ, góc xoay và độ đậm.
      </section>
    );
  }
  const set = (patch: Partial<SkinLayer>) => store.updateLayer(layer.id, patch, true);
  return (
    <section aria-label="Thuộc tính lớp" className="space-y-2.5 rounded-xl border border-white/10 bg-white/3 p-4">
      <h2 className="truncate text-sm font-semibold text-white" title={layer.name}>{layer.name}</h2>
      <p className="text-[11px] text-slate-500">Ảnh {layer.width} × {layer.height} px · vị trí tính theo texture {WORK_SIZE} px</p>
      <RangeField label="Ngang (X)" value={layer.x} min={-0.5} max={1.5} step={1 / WORK_SIZE} format={pixels} onChange={(x) => set({ x })} />
      <RangeField label="Dọc (Y)" value={layer.y} min={-0.5} max={1.5} step={1 / WORK_SIZE} format={pixels} onChange={(y) => set({ y })} />
      <RangeField label="Cỡ (rộng)" value={layer.scale} min={LAYER_LIMITS.scale.min} max={LAYER_LIMITS.scale.max} step={0.001} format={percent}
        onChange={(scale) => set({ scale })} />
      <RangeField label="Xoay" value={layer.rotation} min={LAYER_LIMITS.rotation.min} max={LAYER_LIMITS.rotation.max} step={0.5}
        format={(v) => `${v.toFixed(1)}°`} onChange={(rotation) => set({ rotation })} />
      <RangeField label="Độ đậm" value={layer.opacity} min={0} max={1} step={0.01} format={percent} onChange={(opacity) => set({ opacity })} />
      <RangeField label="Mềm viền" value={layer.feather} min={0} max={1} step={0.01} format={percent} onChange={(feather) => set({ feather })} />
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" aria-pressed={layer.flipX} onClick={() => store.updateLayer(layer.id, { flipX: !layer.flipX })}
          className={`${BUTTON} ${layer.flipX ? 'border-sky-300/50 bg-sky-300/10 text-sky-100' : ''}`}>
          <FlipHorizontal2 size={14} />Lật ngang
        </button>
        <button type="button" onClick={() => store.updateLayer(layer.id, { x: 0.5, y: 0.5 })} className={BUTTON}><Crosshair size={14} />Căn giữa</button>
        <button type="button" onClick={() => store.updateLayer(layer.id, { x: 0.5, y: 0.5, scale: 1, rotation: 0 })} className={BUTTON}>
          <Expand size={14} />Phủ kín texture
        </button>
      </div>
    </section>
  );
}
