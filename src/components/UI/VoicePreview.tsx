import { useEffect, useState, useSyncExternalStore } from 'react';
import { sound } from '../../audio/soundManager';
import { VoiceInfo, VoiceClip, voiceClipUrl } from '../../constants/voices';

const clips: { id: VoiceClip; label: string }[] = [
  { id: 'line', label: 'Thoại' },
  { id: 'normal', label: 'Hét thường' },
  { id: 'special', label: 'Hét đặc biệt' }
];

export function VoicePreview({ voice }: { voice: VoiceInfo }) {
  const state = useSyncExternalStore(sound.subscribeVoice, sound.getVoiceState);
  const [clip, setClip] = useState<VoiceClip>('line');
  const own = state.key.startsWith(`${voice.id}-`);
  useEffect(() => () => {
    if (sound.getVoiceState().key.startsWith(`${voice.id}-`)) sound.stopVoice();
  }, [voice.id]);
  return (
    <div className="space-y-2">
      <p className="text-[11px] opacity-75 leading-relaxed">“{voice.line}”</p>
      <div className="grid grid-cols-3 gap-1">
        {clips.map(({ id, label }) => (
          <button key={id} type="button" className="gp-btn px-1!"
            aria-pressed={state.key === `${voice.id}-${id}` && state.status === 'playing'}
            onClick={() => { setClip(id); void sound.playVoice(voice, id); }}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <button type="button" className="gp-btn px-2!" disabled={!own || state.status === 'error'} onClick={sound.stopVoice}>Dừng</button>
        <a className="underline underline-offset-2 hover:text-amber-200" href={voiceClipUrl(voice, clip)} download={`${voice.id}-${clip}.mp3`}>
          Tải MP3 · {clips.find((item) => item.id === clip)?.label}
        </a>
      </div>
      {own && <p role="status" className={`text-[10px] ${state.status === 'error' ? 'text-red-300' : 'opacity-60'}`}>{state.message}</p>}
    </div>
  );
}
