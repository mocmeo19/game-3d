import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clapperboard, Crosshair, Gamepad2, Grid3x3, Monitor, Settings2, Swords, Volume2 } from 'lucide-react';
import { AnimationSettingsSection } from './AnimationSettingsSection';
import { CombatAnimationSection } from './CombatAnimationSection';
import { GunModelSection } from './GunModelSection';
import { GameSettingsSection } from './GameSettingsSection';
import { RenderSettingsSection } from './RenderSettingsSection';
import { AudioSettingsSection } from './AudioSettingsSection';

const SECTIONS = [
  { id: 'animations', label: 'Animation', detail: 'Tay không & vũ khí', Icon: Clapperboard },
  { id: 'combat', label: 'Chiến đấu', detail: 'Animation game Battle Royal', Icon: Crosshair },
  { id: 'guns', label: 'Vũ khí', detail: 'Mô hình súng, dao, lựu đạn', Icon: Swords },
  { id: 'game', label: 'Game', detail: 'Thông số mặc định', Icon: Gamepad2 },
  { id: 'display', label: 'Hiển thị & hiệu năng', detail: 'Chất lượng hình ảnh 3D', Icon: Monitor },
  { id: 'audio', label: 'Âm thanh', detail: 'Nhạc, hiệu ứng & giọng nói', Icon: Volume2 },
] as const;
const currentSection = () => SECTIONS.find((section) => section.id === window.location.hash.slice(1))?.id ?? 'animations';

export function SettingsPage() {
  const scroll = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState(currentSection);
  useEffect(() => {
    const change = () => setSection(currentSection());
    window.addEventListener('hashchange', change);
    const previousTitle = document.title;
    document.title = 'Cài đặt · Nam’s Battle Royal';
    return () => { window.removeEventListener('hashchange', change); document.title = previousTitle; };
  }, []);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [section]);
  const label = SECTIONS.find((item) => item.id === section)!.label;
  return (
    <div ref={scroll} className="h-dvh overflow-y-auto bg-[#09131e] text-slate-200 selection:bg-sky-300/30">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1825]">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft size={16} />
            <span className="hidden sm:inline">Về ứng dụng</span></a>
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><Settings2 size={17} className="text-sky-200" />Cài đặt</span>
          <span className="flex items-center gap-3">
            <a href="/uv-editor" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"><Grid3x3 size={15} />UV Map Editor</a>
            <span className="hidden rounded-full border border-sky-200/15 px-2.5 py-1 text-[10px] text-sky-200/75 sm:inline">Trên trình duyệt này</span>
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 sm:py-10">
        <div className="mb-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300/70">Nam’s Battle Royal</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Cấu hình ứng dụng</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Xem trước, so sánh và thử lựa chọn trước khi áp dụng cho nhân vật và game.
          </p>
        </div>
        <div className="grid items-start gap-7 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Danh mục cài đặt" className="flex gap-2 overflow-x-auto pb-2 md:sticky md:top-24 md:flex-col md:overflow-visible">
            {SECTIONS.map(({ id, label: title, detail, Icon }) => <a key={id} href={`#${id}`} onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${section === id
                ? 'border-sky-200/20 bg-sky-300/10 text-sky-100' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={18} className="shrink-0" />
              <span><span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 hidden text-[10px] text-slate-500 md:block">{detail}</span></span>
            </a>)}
          </nav>
          <main aria-label={label} className="min-w-0 pb-10">
            <section hidden={section !== 'animations'}><AnimationSettingsSection active={section === 'animations'} /></section>
            <section hidden={section !== 'combat'}><CombatAnimationSection active={section === 'combat'} /></section>
            <section hidden={section !== 'guns'}><GunModelSection /></section>
            <section hidden={section !== 'game'}><GameSettingsSection /></section>
            <section hidden={section !== 'display'}><RenderSettingsSection active={section === 'display'} /></section>
            <section hidden={section !== 'audio'}><AudioSettingsSection active={section === 'audio'} /></section>
          </main>
        </div>
      </div>
    </div>
  );
}
