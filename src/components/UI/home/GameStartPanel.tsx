import { useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { homeGame, type GameKind } from './homeGames';
import { GameModeMenu, GAME_MODE_MENU_ID } from './GameModeMenu';
import { saveLastPlayedGame } from '../../../loading/lastPlayedGame';
import { sound } from '../../../audio/soundManager';

interface GameStartPanelProps {
  selectedGame: GameKind;
  onSelectGame: (game: GameKind) => void;
  onStart: (game: GameKind) => void;
}

/** Bottom-left launcher: the chosen mode (tap to change it) above a large start button. */
export function GameStartPanel({ selectedGame, onSelectGame, onStart }: GameStartPanelProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const modeButton = useRef<HTMLButtonElement>(null);
  const game = homeGame(selectedGame);

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [isMenuOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    modeButton.current?.focus();
  };

  const start = () => {
    sound.playCue('start');
    saveLastPlayedGame(selectedGame);
    onStart(selectedGame);
  };

  return (
    <section
      ref={root}
      aria-label="Chọn game"
      className="pointer-events-auto relative w-[290px] max-w-[calc(100vw-2.5rem)]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsMenuOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !isMenuOpen) return;
        event.preventDefault();
        closeMenu();
      }}
    >
      {isMenuOpen && (
        <GameModeMenu
          selectedGame={selectedGame}
          onPick={(next) => {
            onSelectGame(next);
            closeMenu();
          }}
        />
      )}
      <button
        ref={modeButton}
        type="button"
        aria-label="Đổi game"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls={GAME_MODE_MENU_ID}
        onClick={() => { sound.playClick(); setIsMenuOpen((open) => !open); }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setIsMenuOpen(true);
        }}
        className="group flex w-full items-center gap-3 rounded-t-md border border-b-0 border-white/20 bg-linear-to-r from-black/70 to-black/40 p-2 text-left text-white backdrop-blur-[2px] transition hover:from-black/80 focus-visible:outline-2 focus-visible:outline-[#ffd34d]"
      >
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded border ${game.badgeClassName}`}><game.Icon size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{game.mode}</span>
          <span className="block truncate text-[11px] text-white/65">{game.name}</span>
        </span>
        <span className="flex flex-col items-center text-[10px] text-white/70 group-hover:text-[#ffd34d]">
          <ChevronUp size={16} aria-hidden className={`transition-transform ${isMenuOpen ? '' : 'rotate-180'}`} />
          Đổi
        </span>
      </button>
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
