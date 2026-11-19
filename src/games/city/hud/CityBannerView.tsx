import type { CityBanner } from '../citySnapshot';

interface CityBannerViewProps {
  banner: CityBanner | null;
}

const TITLE_COLOR: Record<CityBanner['kind'], string> = {
  mission: 'text-[#f5c542]',
  passed: 'text-[#f5c542]',
  failed: 'text-[#e5483b]',
  wasted: 'text-[#e5483b]',
  busted: 'text-[#4f8dff]',
  info: 'text-white',
};

/** A big title across the middle: a mission starting, passed or failed, the player down or arrested. */
export function CityBannerView({ banner }: CityBannerViewProps) {
  if (!banner) return null;
  const isDown = banner.kind === 'wasted' || banner.kind === 'busted';
  return (
    <div
      key={banner.id}
      className={`pointer-events-none absolute inset-x-0 top-[26%] flex flex-col items-center gap-1 py-4 text-center motion-safe:animate-[pulse_1s_ease-out_1] ${isDown ? 'bg-black/55' : ''}`}
      role="status"
      aria-live="assertive"
    >
      <h2 className={`text-4xl font-black uppercase tracking-wider [text-shadow:0_3px_8px_rgba(0,0,0,0.9)] sm:text-5xl ${TITLE_COLOR[banner.kind]}`}>{banner.title}</h2>
      {banner.subtitle && <p className="max-w-[90vw] text-sm font-semibold text-white/90 [text-shadow:0_2px_4px_rgba(0,0,0,0.9)]">{banner.subtitle}</p>}
    </div>
  );
}
