import { ChevronLeft } from 'lucide-react';
import { sound } from '../../../audio/soundManager';

interface ChooseCharacterButtonProps {
  onChooseCharacter: () => void;
}

/** Top-left back arrow of the lobby: returns to the character list. */
export function ChooseCharacterButton({ onChooseCharacter }: ChooseCharacterButtonProps) {
  return (
    <button
      type="button"
      onClick={() => { sound.playClick(); onChooseCharacter(); }}
      aria-label="Chọn nhân vật"
      title="Chọn nhân vật"
      className="pointer-events-auto grid h-10 w-8 place-items-center rounded-md bg-black/35 text-white/85 hover:bg-black/55 hover:text-white"
    >
      <ChevronLeft size={22} />
    </button>
  );
}
