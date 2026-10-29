import { useState } from 'react';
import { assetLoadRatio } from '../loading/assetLoadProgress';
import { LoadingProgressBar } from '../loading/LoadingProgressBar';
import { useAssetLoadProgress } from '../loading/useAssetLoadProgress';
import { useSplashReady } from './useSplashReady';

interface SplashScreenProps {
  /** The code-split page the app is opening; the splash stays until it has arrived. */
  pageModule: Promise<unknown>;
}

const statusText = (isPageModuleReady: boolean, isLoading: boolean, itemsLoaded: number, itemsTotal: number) => {
  if (!isPageModuleReady) return 'Đang khởi động…';
  if (isLoading) return `Đang tải tài nguyên ${itemsLoaded}/${itemsTotal}`;
  return 'Sẵn sàng';
};

export function SplashScreen({ pageModule }: SplashScreenProps) {
  const { isPageModuleReady, isReady } = useSplashReady(pageModule);
  const [isGone, setIsGone] = useState(false);
  const progress = useAssetLoadProgress();
  if (isGone) return null;

  const ratio = isReady ? 1 : assetLoadRatio(progress, 0);
  return (
    <div
      aria-hidden={isReady}
      onTransitionEnd={(event) => { if (isReady && event.target === event.currentTarget) setIsGone(true); }}
      className={`fixed inset-0 z-200 flex flex-col items-center justify-center overflow-hidden bg-[#05080d] text-white transition-opacity duration-500 ${isReady ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 42%, rgba(197, 155, 39, 0.22), transparent 58%)' }}
    >
      <svg viewBox="0 0 32 32" className="h-24 w-24 drop-shadow-[0_0_28px_rgba(229,193,88,0.55)] motion-safe:animate-splash-logo" aria-hidden>
        <path fill="#c59b27" d="M16 2L4 14l12 16 12-16z" />
        <path fill="#e5c158" d="M16 5l-9 9 9 12 9-12z" />
        <path fill="#fff" d="M16 8l-6 6 6 8 6-8z" />
      </svg>

      <h1 className="mt-8 text-center text-3xl font-bold uppercase tracking-[0.3em] text-[#f3dc8f] motion-safe:animate-splash-title sm:text-5xl">
        Nam&apos;s Battle Royal
      </h1>
      <p className="mt-3 text-center text-xs uppercase tracking-[0.5em] text-white/45 motion-safe:animate-splash-title">
        Tạo nhân vật · Vào trận
      </p>

      <div className="absolute inset-x-6 bottom-14 mx-auto max-w-sm space-y-3">
        <LoadingProgressBar ratio={ratio} label="Tiến độ khởi động" accentClassName="bg-[#e5c158]" />
        <p role="status" className="text-center text-[11px] tracking-wide text-white/50">
          {statusText(isPageModuleReady, progress.isLoading, progress.itemsLoaded, progress.itemsTotal)}
        </p>
      </div>
    </div>
  );
}
