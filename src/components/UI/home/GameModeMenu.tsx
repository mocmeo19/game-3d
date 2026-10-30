import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { HOME_GAMES, type GameKind } from './homeGames';
import { sound } from '../../../audio/soundManager';

export const GAME_MODE_MENU_ID = 'profile-game-menu';

interface GameModeMenuProps {
  selectedGame: GameKind;
  onPick: (game: GameKind) => void;
}

/** Pop-up list of the games, opened from the mode card; arrow keys move between them. */
export function GameModeMenu({ selectedGame, onPick }: GameModeMenuProps) {
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    options.current[HOME_GAMES.findIndex((game) => game.id === selectedGame)]?.focus();
  }, [selectedGame]);

  return (
    <div
      id={GAME_MODE_MENU_ID}
      role="menu"
      aria-label="Đổi game"
      className="absolute bottom-full left-0 mb-2 w-[320px] max-w-[calc(100vw-2.5rem)] max-h-[55vh] overflow-y-auto rounded-lg border border-white/20 bg-[#0b1420]/95 p-2 shadow-[0_16px_60px_rgba(0,0,0,0.65)] backdrop-blur-sm animate-fade-in"
    >
      <p className="px-2 pt-1 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffd34d]">Chọn chế độ</p>
      {HOME_GAMES.map((game, index) => {
        const isSelected = game.id === selectedGame;
        return (
          <button
            key={game.id}
            ref={(element) => { options.current[index] = element; }}
            type="button"
            role="menuitemradio"
            aria-checked={isSelected}
            tabIndex={-1}
            onKeyDown={(event) => {
              const last = HOME_GAMES.length - 1;
              const next = event.key === 'ArrowDown' ? (index + 1) % HOME_GAMES.length
                : event.key === 'ArrowUp' ? (index + last) % HOME_GAMES.length
                  : event.key === 'Home' ? 0
                    : event.key === 'End' ? last
                      : undefined;
              if (next === undefined) return;
              event.preventDefault();
              options.current[next]?.focus();
            }}
            onClick={() => { sound.playClick(); onPick(game.id); }}
            className={`my-1 flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-[#ffd34d] ${isSelected ? 'border-[#ffd34d]/50 bg-[#ffd34d]/10' : 'border-transparent hover:border-white/10 hover:bg-white/5'}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${game.badgeClassName}`}><game.Icon size={19} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">{game.name}</span>
              <span className="mt-0.5 block text-xs text-white/55">{game.description}</span>
            </span>
            {isSelected && <Check size={17} className="shrink-0 text-[#ffd34d]" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
