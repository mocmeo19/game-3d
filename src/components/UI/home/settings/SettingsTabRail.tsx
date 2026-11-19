import { useRef, type KeyboardEvent } from 'react';
import { sound } from '../../../../audio/soundManager';
import { SETTINGS_PANEL_DOM_ID, SETTINGS_TABS, settingsTabDomId, type SettingsTabId } from './settingsTabs';

interface SettingsTabRailProps {
  activeTab: SettingsTabId;
  onSelect: (tab: SettingsTabId) => void;
}

const STEP_BY_KEY: Partial<Record<string, number>> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** Category list of the settings screen: a column on the left, a scrolling row on narrow screens. */
export function SettingsTabRail({ activeTab, onSelect }: SettingsTabRailProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = SETTINGS_TABS.findIndex((tab) => tab.id === activeTab);

  const select = (index: number) => {
    const tab = SETTINGS_TABS[index];
    if (!tab) return;
    tabs.current[index]?.focus();
    if (tab.id === activeTab) return;
    sound.playClick();
    onSelect(tab.id);
  };

  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP_BY_KEY[event.key];
    if (!step) return;
    event.preventDefault();
    select((activeIndex + step + SETTINGS_TABS.length) % SETTINGS_TABS.length);
  };

  return (
    <div
      role="tablist"
      aria-label="Danh mục cài đặt"
      aria-orientation="vertical"
      onKeyDown={moveSelection}
      className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-black/30 p-2 md:w-56 md:flex-col md:overflow-visible md:border-r md:border-b-0 md:p-3"
    >
      {SETTINGS_TABS.map(({ id, label, detail, Icon }, index) => {
        const isActive = id === activeTab;
        return (
          <button
            key={id}
            ref={(element) => { tabs.current[index] = element; }}
            id={settingsTabDomId(id)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={SETTINGS_PANEL_DOM_ID}
            tabIndex={isActive ? 0 : -1}
            onClick={() => select(index)}
            className={`relative flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#ffd34d] md:py-3 ${isActive
              ? 'bg-linear-to-r from-[#ffd34d]/20 to-transparent text-[#ffd34d]'
              : 'text-white/65 hover:bg-white/6 hover:text-white'}`}
          >
            <span aria-hidden className={`absolute inset-y-1.5 left-0 w-1 rounded-full bg-[#ffd34d] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
            <Icon size={20} className="shrink-0" />
            <span>
              <span className="block text-[14px] font-bold uppercase tracking-wider">{label}</span>
              <span className="hidden text-[11px] text-white/40 md:block">{detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
