import { useEffect, useRef } from 'react';
import { Maximize } from 'lucide-react';
import { hitLayer, layerCorners } from './skinCompositor';
import { renderIslandMask, renderWireframe } from './uvWireframe';
import { useUvEditorState } from './useUvEditorState';
import type { UvEditorStore } from './uvEditorStore';
import type { UvLayout } from './uvLayout';

/** Where the texture square sits on the canvas, in CSS pixels. */
interface ViewRect {
  x: number;
  y: number;
  size: number;
}

type Drag = { kind: 'layer'; id: string; du: number; dv: number } | { kind: 'pan'; px: number; py: number; x: number; y: number };

const GUIDE_SIZE = 2048;
const FIT_MARGIN = 0.94;
const MIN_VIEW = 64;
const MAX_VIEW = 40000;
/** One texel of a 2048 texture: an arrow key moves the layer this far (ten times with Shift). */
const NUDGE = 1 / 2048;
const OUTSIDE_SHADE = 'rgba(6, 10, 16, 0.6)';

/** Guide pictures for a layout: the wireframe, and a shade covering everything outside the islands. */
function guidesFor(layout: UvLayout, color: string) {
  const wire = renderWireframe(layout, GUIDE_SIZE, color);
  const shade = document.createElement('canvas');
  shade.width = shade.height = GUIDE_SIZE;
  const ctx = shade.getContext('2d')!;
  ctx.fillStyle = OUTSIDE_SHADE;
  ctx.fillRect(0, 0, GUIDE_SIZE, GUIDE_SIZE);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(renderIslandMask(layout, GUIDE_SIZE), 0, 0);
  return { wire, shade };
}

export function UvCanvas({ store }: { store: UvEditorStore }) {
  const { layout, wireColor } = useUvEditorState(store);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const view = useRef<ViewRect | null>(null);
  const guides = useRef<{ layout: UvLayout; color: string; wire: HTMLCanvasElement; shade: HTMLCanvasElement } | null>(null);
  const frame = useRef(0);
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    if (!layout) guides.current = null;
    else if (guides.current?.layout !== layout || guides.current.color !== wireColor) guides.current = { layout, color: wireColor, ...guidesFor(layout, wireColor) };
    redraw.current();
  }, [layout, wireColor]);

  useEffect(() => {
    const el = canvas.current!;
    const host = box.current!;
    const ctx = el.getContext('2d')!;
    const fit = () => {
      const size = Math.min(host.clientWidth, host.clientHeight) * FIT_MARGIN;
      view.current = { x: (host.clientWidth - size) / 2, y: (host.clientHeight - size) / 2, size };
    };
    const paint = () => {
      frame.current = 0;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      if (!view.current) fit();
      const v = view.current!;
      const s = store.getState();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#1b2430';
      ctx.fillRect(v.x, v.y, v.size, v.size);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(store.composite, v.x, v.y, v.size, v.size);
      const g = guides.current;
      if (g && s.dimOutside) ctx.drawImage(g.shade, v.x, v.y, v.size, v.size);
      if (g && s.showWire) {
        ctx.globalAlpha = s.wireOpacity;
        ctx.drawImage(g.wire, v.x, v.y, v.size, v.size);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(v.x + 0.5, v.y + 0.5, v.size - 1, v.size - 1);
      const selected = s.doc.layers.find((layer) => layer.id === s.selectedId);
      if (!selected?.visible) return;
      const corners = layerCorners(selected).map(([u, vv]) => [v.x + u * v.size, v.y + vv * v.size]);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(v.x + selected.x * v.size, v.y + selected.y * v.size, 3.5, 0, Math.PI * 2);
      ctx.fill();
    };
    redraw.current = () => {
      if (!frame.current) frame.current = requestAnimationFrame(paint);
    };
    const unsubscribe = store.subscribeRender(() => redraw.current());
    const resize = new ResizeObserver(() => redraw.current());
    resize.observe(host);
    redraw.current();
    return () => {
      unsubscribe();
      resize.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [store]);

  useEffect(() => {
    const el = canvas.current!;
    const pointOf = (event: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      const v = view.current!;
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      return { u: (px - v.x) / v.size, v: (py - v.y) / v.size, px, py };
    };
    let drag: Drag | null = null;
    const down = (event: PointerEvent) => {
      if (!view.current) return;
      el.focus();
      const p = pointOf(event);
      const hit = event.button === 0 ? hitLayer(store.getState().doc.layers, p.u, p.v) : null;
      if (hit) store.select(hit.id);
      drag = hit ? { kind: 'layer', id: hit.id, du: p.u - hit.x, dv: p.v - hit.y } : { kind: 'pan', px: p.px, py: p.py, x: view.current.x, y: view.current.y };
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!view.current) return;
      const p = pointOf(event);
      const inside = p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1;
      if (readout.current) readout.current.textContent = inside ? `u ${p.u.toFixed(4)} · v ${p.v.toFixed(4)}` : '';
      if (!drag) return;
      if (drag.kind === 'layer') {
        store.updateLayer(drag.id, { x: p.u - drag.du, y: p.v - drag.dv }, true);
        return;
      }
      view.current = { ...view.current, x: drag.x + p.px - drag.px, y: drag.y + p.py - drag.py };
      redraw.current();
    };
    const up = () => {
      // a drag ends: bring the panels up to date at once
      if (drag?.kind === 'layer') store.updateLayer(drag.id, {});
      drag = null;
    };
    const wheel = (event: WheelEvent) => {
      if (!view.current) return;
      event.preventDefault();
      const { selectedId, doc } = store.getState();
      const layer = doc.layers.find((l) => l.id === selectedId);
      if (layer && event.shiftKey) {
        store.updateLayer(layer.id, { scale: layer.scale * Math.exp(-(event.deltaY || event.deltaX) * 0.0015) }, true);
        return;
      }
      if (layer && event.altKey) {
        store.updateLayer(layer.id, { rotation: layer.rotation + Math.sign(event.deltaY) * 2 }, true);
        return;
      }
      const p = pointOf(event);
      const v = view.current;
      const size = Math.min(MAX_VIEW, Math.max(MIN_VIEW, v.size * Math.exp(-event.deltaY * 0.0015)));
      const k = size / v.size;
      view.current = { x: p.px - (p.px - v.x) * k, y: p.py - (p.py - v.y) * k, size };
      redraw.current();
    };
    const key = (event: KeyboardEvent) => {
      const { selectedId, doc } = store.getState();
      const layer = doc.layers.find((l) => l.id === selectedId);
      if (!layer) return;
      const step = NUDGE * (event.shiftKey ? 10 : 1);
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const by = moves[event.key];
      if (by) {
        event.preventDefault();
        store.updateLayer(layer.id, { x: layer.x + by[0], y: layer.y + by[1] });
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        store.removeLayer(layer.id);
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('keydown', key);
    };
  }, [store]);

  const fitView = () => {
    view.current = null;
    redraw.current();
  };

  return (
    <div ref={box} className="relative h-full min-h-[360px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d141d]">
      <canvas ref={canvas} tabIndex={0}
        aria-label="Khung ghép skin: kéo lớp để di chuyển, kéo chỗ trống để dời khung, cuộn để phóng to, Shift + cuộn đổi cỡ lớp, Alt + cuộn xoay lớp, phím mũi tên dịch lớp, Delete xoá lớp"
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none outline-hidden focus-visible:ring-2 focus-visible:ring-sky-300/60" />
      <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-3 text-[11px] text-slate-400">
        <span ref={readout} className="font-mono" />
        {!layout && <span>Chưa có lưới UV: vẫn ghép ảnh được trên khung vuông.</span>}
      </div>
      <button type="button" onClick={fitView} title="Vừa khung" aria-label="Vừa khung"
        className="absolute right-2 top-2 rounded-lg border border-white/15 bg-black/50 p-2 text-slate-300 hover:text-white">
        <Maximize size={15} />
      </button>
    </div>
  );
}
