import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, LoaderCircle, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { CharacterState } from '../types/character';
import type { RenderSettings } from './renderSettings';
import type { PreviewStatus, SettingsPreviewScene } from './SettingsPreviewScene';

interface Props {
  title: string;
  state: CharacterState;
  active: boolean;
  render?: RenderSettings;
  camera?: { fov: number; distance: number };
  request?: number;
}

export function SettingsPreview({ title, state, active, render, camera, request = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SettingsPreviewScene | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const [paused, setPaused] = useState(false);
  const [retry, setRetry] = useState(0);
  const options = useMemo(() => ({ state, render, camera }), [state, render, camera]);
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => { if (request > 0) setEnabled(true); }, [request]);
  useEffect(() => {
    if (!active || !enabled || !host.current) return;
    let disposed = false;
    setStatus('loading');
    void import('./SettingsPreviewScene').then(({ SettingsPreviewScene }) => {
      if (disposed || !host.current) return;
      scene.current = new SettingsPreviewScene(host.current, latest.current, (value) => { if (!disposed) setStatus(value); });
    }).catch(() => { if (!disposed) setStatus('error'); });
    return () => { disposed = true; scene.current?.dispose(); scene.current = null; };
  }, [active, enabled, retry]);
  useEffect(() => { scene.current?.update(options); }, [options]);
  useEffect(() => { scene.current?.setPaused(paused); }, [paused, status]);
  return (
    <aside aria-label={`Preview ${title}`} data-preview-status={enabled ? status : 'closed'}
      className="overflow-hidden rounded-2xl border border-sky-200/20 bg-[#102430]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div><p className="text-[10px] uppercase tracking-widest text-sky-300">Xem trước</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3></div>
        {enabled && <button type="button" aria-label="Đóng preview 3D" onClick={() => setEnabled(false)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={15} /></button>}
      </div>
      <div className="relative h-[340px] sm:h-[400px]">
        {enabled && active && <div ref={host} className="absolute inset-0" />}
        {!enabled && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-linear-to-b from-sky-300/5 to-transparent p-6 text-center">
          <Box size={42} strokeWidth={1} className="text-sky-200/50" />
          <p className="max-w-xs text-xs leading-relaxed text-slate-400">Xoay mô hình, xem các góc và thử lựa chọn hiện tại trước khi lưu.</p>
          <button type="button" onClick={() => setEnabled(true)}
            className="flex items-center gap-2 rounded-xl bg-sky-300 px-4 py-2.5 text-xs font-semibold text-slate-950">
            <Play size={14} /> Mở preview 3D
          </button>
        </div>}
        {enabled && status === 'loading' && <div role="status" className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-xl bg-black/65 p-3 text-xs text-white">
          <LoaderCircle size={15} className="animate-spin" />Đang tải preview…
        </div>}
        {enabled && status === 'error' && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#102430]/95 p-5 text-center text-xs">
          <p>Không tải được preview. Kiểm tra kết nối hoặc hỗ trợ 3D của trình duyệt.</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="text-sky-200 underline">Thử lại preview</button>
        </div>}
      </div>
      {enabled && <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 p-3">
        <button type="button" onClick={() => scene.current?.view(0, true)}
          className="rounded-lg border border-white/10 px-3 py-2 text-[11px] text-slate-300 hover:bg-white/10">Mặt</button>
        {[['Trước', 0], ['Bên', Math.PI / 2], ['Sau', Math.PI]].map(([label, angle]) => <button key={label} type="button"
          onClick={() => scene.current?.view(Number(angle))} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] text-slate-300 hover:bg-white/10">{label}</button>)}
        {state.pose.startsWith('mixamo:') && <button type="button" onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Phát animation' : 'Tạm dừng animation'} className="rounded-lg border border-white/10 p-2 text-sky-200">
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>}
        <button type="button" aria-label="Đặt lại góc nhìn" onClick={() => scene.current?.view(0)}
          className="rounded-lg border border-white/10 p-2 text-slate-400"><RotateCcw size={14} /></button>
      </div>}
      <p className="border-t border-white/5 px-4 py-3 text-[10px] leading-relaxed text-slate-500">
        Kéo để xoay · Cuộn để thu phóng. Preview không lưu thay đổi cấu hình.
      </p>
    </aside>
  );
}
