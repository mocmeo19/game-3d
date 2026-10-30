import type { CharacterState } from '../../../types/character';
import { VOICES, voicesFor, resolveVoice } from '../../../constants/voices';
import { VoicePreview } from '../VoicePreview';
import { sound } from '../../../audio/soundManager';

interface VoiceTabProps {
  characterState: CharacterState;
  onUpdateState: (state: CharacterState) => void;
}

export function VoiceTab({ characterState, onUpdateState }: VoiceTabProps) {
  const current = resolveVoice(characterState.voice, characterState.gender);
  return (
    <>
      <div className="space-y-2">
        {voicesFor(characterState.gender).map((voice) => {
          const isSelected = voice.id === current.id;
          return (
            <div key={voice.id} className={`rounded-md border p-3 ${isSelected ? 'border-[#ffd34d] bg-[#ffd34d]/10' : 'border-white/15 bg-white/5'}`}>
              <button
                type="button"
                aria-pressed={isSelected}
                className="w-full text-left"
                onClick={() => { sound.stopVoice(); onUpdateState({ ...characterState, voice: voice.id }); }}
              >
                <span className="block text-[14px] font-medium">{voice.ko}</span>
                <span className="block text-[12px] text-white/70">{voice.desc}</span>
              </button>
              <div className="mt-2"><VoicePreview voice={voice} /></div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-white/45">{VOICES.length} giọng nói có sẵn</p>
    </>
  );
}
