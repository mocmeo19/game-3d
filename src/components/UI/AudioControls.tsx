import { useEffect, useRef, useState } from 'react';
import { Music2, Volume2, VolumeX, X } from 'lucide-react';
import { sound } from '../../audio/soundManager';
import { useAudioSettings, useAudioSaveState } from '../../audio/useAudioSettings';

type AudioPanelPlacement = 'below-left' | 'below-right' | 'above-left' | 'above-right';

const PANEL_PLACEMENT_CLASS: Record<AudioPanelPlacement, string> = {
  'below-left': 'top-full mt-3 left-0',
  'below-right': 'top-full mt-3 right-0',
  'above-left': 'bottom-full mb-3 left-0',
  'above-right': 'bottom-full mb-3 right-0'
};

/** Sound toggle with a volume popover; the bare toggle, or one whose popover opens upwards, shows only its icon. */
export function AudioControls({ placement = 'below-right', isBare = false }: { placement?: AudioPanelPlacement; isBare?: boolean }) {
  const isIconOnly = isBare || placement.startsWith('above');
  const settings = useAudioSettings();
  const saveState = useAudioSaveState();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div ref={root} className="relative pointer-events-auto" data-ui-sound="off" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); toggle.current?.focus(); }
    }}>
      <button ref={toggle} type="button" aria-label="Cài đặt âm thanh" aria-expanded={open} onClick={() => { sound.unlock(); setOpen(!open); sound.playClick(); }} className={`flex items-center justify-center gap-2 h-9 ${isIconOnly ? 'w-9' : 'px-3'} rounded-full text-white/80 hover:text-white ${isBare ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'border border-white/20 bg-black/55 hover:border-sky-200/60'}`}>
        {settings.muted ? <VolumeX size={isBare ? 20 : 16} /> : <Volume2 size={isBare ? 20 : 16} />}
        {!isIconOnly && <span className="text-xs">Âm thanh</span>}
      </button>
      {open && (
        <section aria-label="Cài đặt âm thanh" className={`absolute z-80 w-64 rounded-xl border border-white/20 bg-[#0d192b] p-4 text-white shadow-2xl ${PANEL_PLACEMENT_CLASS[placement]}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Âm thanh</h2>
            <button type="button" aria-label="Đóng cài đặt âm thanh" onClick={() => { setOpen(false); toggle.current?.focus(); }} className="text-white/60 hover:text-white"><X size={15} /></button>
          </div>
          <button type="button" role="switch" aria-checked={!settings.muted} aria-label="Bật âm thanh ứng dụng" onClick={() => { sound.setMuted(!settings.muted); if (settings.muted) sound.playClick(); }} className="w-full flex items-center justify-between text-xs mb-4">
            <span>{settings.muted ? 'Âm thanh đang tắt' : 'Âm thanh đang bật'}</span>
            <span className={`relative w-9 h-5 rounded-full transition-colors ${settings.muted ? 'bg-slate-600' : 'bg-sky-400'}`}><span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.muted ? '' : 'translate-x-4'}`} /></span>
          </button>
          {([{ key: 'music', label: 'Nhạc nền', Icon: Music2 }, { key: 'effects', label: 'Hiệu ứng & giọng nói', Icon: Volume2 }] as const).map(({ key, label, Icon }) => (
            <label key={key} className={`block mt-3 ${settings.muted ? 'opacity-50' : ''}`}>
              <span className="flex items-center justify-between text-xs mb-2"><span className="flex items-center gap-2"><Icon size={14} />{label}</span><span>{Math.round(settings[key] * 100)}%</span></span>
              <input type="range" min="0" max="100" value={Math.round(settings[key] * 100)} disabled={settings.muted} onChange={(event) => { sound.unlock(); sound.setLevels({ [key]: Number(event.target.value) / 100 }); if (key === 'effects') sound.playSliderTick(); }} className="w-full accent-sky-300" />
            </label>
          ))}
          {saveState.saving && <p role="status" className="mt-3 text-xs text-sky-200">Đang lưu…</p>}
          {saveState.error && <p role="alert" className="mt-3 text-xs text-red-200">{saveState.error}</p>}
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">Tự lưu thiết lập. Nhạc nhỏ lại khi nhân vật nói.</p>
        </section>
      )}
    </div>
  );
}
