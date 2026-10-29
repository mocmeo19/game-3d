import { useEffect, useRef, useState } from 'react';
import { SkinPreviewScene } from './skinPreviewScene';
import type { UvEditorStore } from './uvEditorStore';

/** The body wearing the skin as it is being made; drag sideways to turn it, up and down to move along it, scroll to come closer. */
export function SkinPreview3D({ store }: { store: UvEditorStore }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scene = new SkinPreviewScene(host.current!, store.composite, setError);
    const unsubscribe = store.subscribeRender(() => scene.textureChanged());
    scene.textureChanged();
    return () => {
      unsubscribe();
      scene.dispose();
    };
  }, [store]);

  return (
    <section aria-label="Xem trước trên cơ thể" className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/3">
      <h2 className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
        Xem trước 3D
        <span className="text-[10px] font-normal text-slate-500">kéo ngang: xoay · kéo dọc: lên xuống · cuộn: phóng</span>
      </h2>
      <div ref={host} className="relative min-h-[280px] flex-1 cursor-grab active:cursor-grabbing">
        {error && <p role="alert" className="absolute inset-x-3 top-3 text-xs text-rose-300">{error}</p>}
      </div>
    </section>
  );
}
