import { HOME_TABS, type HomeTab } from './homeTabs';
import { sound } from '../../../audio/soundManager';

interface HomeNavBarProps {
  openTab: HomeTab | null;
  onToggleTab: (tab: HomeTab) => void;
}

/** Bottom-right menu bar: each entry opens its panel, pressing the open one again closes it. */
export function HomeNavBar({ openTab, onToggleTab }: HomeNavBarProps) {
  return (
    <nav aria-label="Mục hồ sơ" className="pointer-events-auto flex items-end gap-1 overflow-x-auto no-scrollbar">
      {HOME_TABS.map(({ id, label, Icon }) => {
        const isOpen = openTab === id;
        return (
          <button
            key={id}
            type="button"
            aria-expanded={isOpen}
            aria-controls="home-tab-panel"
            onClick={() => { sound.playClick(); onToggleTab(id); }}
            className={`group relative flex min-w-[76px] shrink-0 flex-col items-center gap-1 px-2 pt-1.5 pb-2 text-[12px] font-bold uppercase tracking-wide transition-colors ${isOpen ? 'text-[#ffd34d]' : 'text-white/90 hover:text-white'}`}
          >
            <Icon size={24} className={`drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform group-hover:-translate-y-0.5 ${isOpen ? 'drop-shadow-[0_0_8px_rgba(255,211,77,0.8)]' : ''}`} />
            <span className="text-shadow whitespace-nowrap">{label}</span>
            <span aria-hidden className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity ${isOpen ? 'bg-[#ffd34d] opacity-100' : 'opacity-0'}`} />
          </button>
        );
      })}
    </nav>
  );
}
