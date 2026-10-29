import { useEffect, useState, useSyncExternalStore } from 'react';
import { VOICES } from '../constants/voices';
import type { MusicScene } from '../audio/ambientMusic';
import { Music2, Volume2 } from 'lucide-react';
import { useAudioSettings, useAudioSaveState } from '../audio/useAudioSettings';
import { sound } from '../audio/soundManager';
import { Select } from '../components/UI/select/Select';
import type { SelectOption } from '../components/UI/select/selectModel';

const MUSIC_SCENES: SelectOption<MusicScene>[] = [
  { value: 'menu', label: 'Màn hình nhân vật' }, { value: 'arena', label: 'Battle Royal' },
  { value: 'torch', label: 'Torchlight' }, { value: 'testlab', label: 'Test Nhân Vật' },
];

export function AudioSettingsSection({ active = true }: { active?: boolean }) {
  const settings = useAudioSettings();
  const saveState = useAudioSaveState();
  const [music, setMusic] = useState(false);
  const [scene, setScene] = useState<MusicScene>('menu');
  const voice = useSyncExternalStore(sound.subscribeVoice, sound.getVoiceState, sound.getVoiceState);
  useEffect(() => {
    if (!active) { setMusic(false); sound.stopVoice(); }
    sound.setMusicPreview(active && music);
    if (active && music) { sound.setMusicScene(scene); sound.unlock(); }
    return () => { sound.setMusicPreview(false); sound.stopVoice(); };
  }, [active, music, scene]);
  useEffect(() => () => sound.setMusicPreview(null), []);
  return (
    <div className="space-y-5" data-ui-sound="off">
      <header><h2 className="text-xl font-semibold text-white">Âm thanh</h2>
        <p className="mt-2 text-sm text-slate-400">Tự động lưu và áp dụng cho toàn ứng dụng.</p></header>
      <section className="space-y-7 rounded-2xl border border-white/10 bg-white/2.5 p-5">
        <label className="flex cursor-pointer items-center justify-between text-sm text-white">Bật âm thanh ứng dụng
          <input type="checkbox" checked={!settings.muted} onChange={() => { sound.unlock(); sound.setMuted(!settings.muted); }}
            className="h-5 w-5 accent-sky-300" />
        </label>
        {([
          { key: 'music', label: 'Nhạc nền', Icon: Music2 },
          { key: 'effects', label: 'Hiệu ứng & giọng nói', Icon: Volume2 },
        ] as const).map(({ key, label, Icon }) => <label key={key} className="block space-y-3 text-sm text-slate-300">
          <span className="flex justify-between gap-3"><span className="flex items-center gap-2"><Icon size={16} />{label}</span>
            <span className="text-sky-200">{Math.round(settings[key] * 100)}%</span></span>
          <input type="range" min="0" max="100" value={Math.round(settings[key] * 100)} className="w-full accent-sky-300"
            onChange={(event) => { sound.unlock(); sound.setLevels({ [key]: Number(event.target.value) / 100 }); }} />
        </label>)}
        <div className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-sky-100">Phòng nghe thử</h3>
          <label className="block text-xs text-slate-400">Nhạc theo màn hình
            <span className="mt-2 block">
              <Select<MusicScene> aria-label="Nhạc theo màn hình" value={scene} onChange={setScene} options={MUSIC_SCENES} />
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={settings.muted || settings.music === 0} onClick={() => setMusic((value) => !value)}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-sky-100 disabled:opacity-40">
              {music ? 'Dừng nhạc' : 'Nghe thử nhạc'}
            </button>
            <button type="button" disabled={settings.muted} onClick={() => { sound.unlock(); void sound.playVoice(VOICES[0]); }}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-sky-100 disabled:opacity-40">Nghe thử giọng nói</button>
            <button type="button" onClick={() => { setMusic(false); sound.stopVoice(); }}
              className="rounded-lg px-3 py-2 text-xs text-slate-400">Dừng nghe thử</button>
          </div>
          {voice.status !== 'idle' && <p role="status" className="mt-3 text-xs text-slate-400">{voice.message}</p>}
        </div>
        <button type="button" disabled={settings.muted} onClick={() => { sound.unlock(); sound.playClick(); }}
          className="rounded-xl border border-white/15 px-4 py-2 text-xs text-sky-100 hover:bg-white/5 disabled:opacity-40">
          Nghe thử hiệu ứng
        </button>
        {saveState.saving && <p role="status" className="text-xs text-sky-200">Đang lưu âm thanh…</p>}
        {saveState.error && <p role="alert" className="text-xs text-red-200">{saveState.error}</p>}
      </section>
    </div>
  );
}
