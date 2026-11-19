import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, Settings } from 'lucide-react';
import { sound } from '../../../../audio/soundManager';
import { savePerformanceOverlaySettings, usePerformanceOverlaySettings } from '../../../../performance/performanceOverlaySettings';
import { getGameplaySettings, saveGameplaySettings } from '../../../../settings/gameplaySettings';
import { getRenderSettings, saveRenderSettings } from '../../../../settings/renderSettings';
import { useAutoSavedSettings } from '../../../../settings/useAutoSavedSettings';
import { AudioSettingsTab } from './AudioSettingsTab';
import { BasicSettingsTab } from './BasicSettingsTab';
import { GraphicsSettingsTab } from './GraphicsSettingsTab';
import { SensitivitySettingsTab } from './SensitivitySettingsTab';
import { SettingsTabRail } from './SettingsTabRail';
import { SETTINGS_PANEL_DOM_ID, SETTINGS_TABS, settingsTabDomId, type SettingsTabId } from './settingsTabs';

interface GameSettingsScreenProps {
  onClose: () => void;
}

/**
 * Full-screen game settings opened from the lobby. The edited settings live here rather than in the tabs, so switching tab
 * never reloads a store whose last change is still being saved.
 */
export function GameSettingsScreen({ onClose }: GameSettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('basic');
  const backButton = useRef<HTMLButtonElement>(null);
  const gameplay = useAutoSavedSettings(getGameplaySettings, saveGameplaySettings);
  const render = useAutoSavedSettings(getRenderSettings, saveRenderSettings);
  const overlaySettings = usePerformanceOverlaySettings();
  const overlay = useAutoSavedSettings(() => overlaySettings, savePerformanceOverlaySettings);
  const tabLabel = SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? '';

  useEffect(() => { backButton.current?.focus(); }, []);

  const close = () => {
    sound.playClick();
    onClose();
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-settings-title"
      onKeyDown={closeOnEscape}
      className="pointer-events-auto absolute inset-0 flex flex-col bg-[#070b11] bg-[radial-gradient(ellipse_at_top_right,rgba(255,211,77,0.08),transparent_55%)] text-white animate-fade-in"
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-black/40 px-3 sm:px-5">
        <button
          ref={backButton}
          type="button"
          aria-label="Đóng cài đặt"
          title="Đóng cài đặt"
          onClick={close}
          className="grid h-10 w-9 place-items-center rounded-md bg-white/6 text-white/80 hover:bg-white/12 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ffd34d]"
        >
          <ChevronLeft size={22} />
        </button>
        <Settings size={20} className="text-[#ffd34d]" aria-hidden />
        <h2 id="game-settings-title" className="text-lg font-black uppercase tracking-[0.2em]">Cài đặt</h2>
        <span aria-hidden className="text-white/25">/</span>
        <span className="text-sm font-semibold uppercase tracking-wider text-white/60">{tabLabel}</span>
        <span className="ml-auto hidden text-xs text-white/40 sm:block">Tự động lưu · áp dụng từ trận tiếp theo</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SettingsTabRail activeTab={activeTab} onSelect={setActiveTab} />
        <div
          id={SETTINGS_PANEL_DOM_ID}
          role="tabpanel"
          aria-labelledby={settingsTabDomId(activeTab)}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6"
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {activeTab === 'basic' && <BasicSettingsTab gameplay={gameplay} />}
            {activeTab === 'graphics' && <GraphicsSettingsTab render={render} overlay={overlay} />}
            {activeTab === 'sensitivity' && <SensitivitySettingsTab gameplay={gameplay} />}
            {activeTab === 'audio' && <AudioSettingsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
