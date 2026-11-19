import { homeGame, type GameKind } from './homeGames';
import { saveLastPlayedGame } from '../../../loading/lastPlayedGame';
import { sound } from '../../../audio/soundManager';

interface GameStartPanelProps {
  selectedGame: GameKind;
  onStart: (game: GameKind) => void;
}

/** Bottom-left launcher: the game's mode card above a large start button. */
export function GameStartPanel({ selectedGame, onStart }: GameStartPanelProps) {
  const game = homeGame(selectedGame);

  const start = () => {
    sound.playCue('start');
    saveLastPlayedGame(selectedGame);
    onStart(selectedGame);
  };

  return (
    <section aria-label="Chọn game" className="pointer-events-auto relative w-[290px] max-w-[calc(100vw-2.5rem)]">
      <div className="flex w-full items-center gap-3 rounded-t-md border border-b-0 border-white/20 bg-linear-to-r from-black/70 to-black/40 p-2 text-left text-white backdrop-blur-[2px]">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded border ${game.badgeClassName}`}><game.Icon size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{game.mode}</span>
          <span className="block truncate text-[11px] text-white/65">{game.name}</span>
        </span>
      </div>
      <button
        type="button"
        aria-label={`Bắt đầu ${game.name}`}
        onClick={start}
        className="block h-16 w-full rounded-b-md border border-[#fff1a8]/70 bg-linear-to-b from-[#ffe45c] via-[#ffd21f] to-[#f1a90a] text-[30px] font-black uppercase tracking-wide text-[#2b1d00] shadow-[0_6px_22px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:brightness-110 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Bắt đầu
      </button>
    </section>
  );
}
