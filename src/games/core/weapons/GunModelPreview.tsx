import { useEffect, useRef, useState } from 'react';
import { gunModel, type GunModelFit } from './gunModelCatalog';
import { fittedGunModel } from './gunModelLibrary';
import { GunModelPreviewScene } from './GunModelPreviewScene';

interface Props {
  modelId: string | null;
  fit: GunModelFit | null;
}

type Status = 'empty' | 'loading' | 'ready' | 'failed';

const STATUS_TEXT: Record<Exclude<Status, 'ready'>, string> = {
  empty: 'Dùng mô hình khối có sẵn của game.',
  loading: 'Đang tải mô hình…',
  failed: 'Không tải được mô hình này.',
};

/** 3D preview of a weapon model with its fit applied: green is where the hand holds it, red is the muzzle and firing direction. */
export function GunModelPreview({ modelId, fit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<GunModelPreviewScene | null>(null);
  const [status, setStatus] = useState<Status>('empty');

  useEffect(() => {
    if (!host.current) return;
    const created = new GunModelPreviewScene(host.current);
    scene.current = created;
    return () => {
      created.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    const def = modelId ? gunModel(modelId) : undefined;
    if (!def || !fit) {
      scene.current?.show(null, null, 1);
      setStatus('empty');
      return;
    }
    let current = true;
    setStatus('loading');
    void fittedGunModel(def, fit).then((model) => {
      // a newer choice may have been made while this one loaded
      if (!current) return;
      if (!model) {
        scene.current?.show(null, null, 1);
        setStatus('failed');
        return;
      }
      scene.current?.show(model.root.clone(true), model.muzzle, fit.length, model.support);
      setStatus('ready');
    });
    return () => {
      current = false;
    };
  }, [modelId, fit]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1f29]">
      <div ref={host} className="relative h-64 w-full cursor-grab active:cursor-grabbing" aria-label="Xem trước mô hình vũ khí, kéo để xoay" role="img" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-[11px] text-white/55">
        <span>{status === 'ready' ? 'Kéo để xoay · cuộn để phóng to' : STATUS_TEXT[status]}</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-[#41d17a]" /> Tay cầm</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-[#4fa8ff]" /> Tay đỡ</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-[#ff5a4f]" /> Đầu nòng</span>
        </span>
      </div>
    </div>
  );
}
