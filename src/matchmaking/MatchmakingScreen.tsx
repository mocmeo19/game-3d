import { useEffect } from 'react';
import { sound } from '../audio/soundManager';
import type { GameKind } from '../components/UI/home/homeGames';
import { GAME_LOADING_CONTENT } from '../loading/gameLoadingContent';
import { LobbyModeCard } from './LobbyModeCard';
import { LobbyReadyButton } from './LobbyReadyButton';
import type { MatchmakingContent } from './matchmakingContent';
import { SquadChatBar } from './SquadChatBar';
import { useMatchmaking } from './useMatchmaking';

interface MatchmakingScreenProps {
  gameKind: GameKind;
  content: MatchmakingContent;
  onMatched: () => void;
  onCancel: () => void;
}

/**
 * The lobby while a match is searched for, laid over the character stage (where the squad stands): the search button with
 * its clock in the corner, the mode card under it, and the squad channel along the bottom. Escape cancels.
 */
export function MatchmakingScreen({ gameKind, content, onMatched, onCancel }: MatchmakingScreenProps) {
  const { elapsedMs, joined, found } = useMatchmaking(content.capacity, onMatched, onCancel);

  useEffect(() => {
    if (found) sound.playCue('start');
  }, [found]);

  const message = found ? 'Đã tìm thấy trận! Chuẩn bị vào game…' : `Đang tìm trận… đã có ${joined}/${content.capacity} người chơi.`;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 font-sans text-white animate-fade-in">
      <div aria-hidden className="absolute inset-y-0 left-0 w-[420px] max-w-full bg-linear-to-r from-black/45 to-transparent" />
      <div className="pointer-events-auto absolute top-4 left-4 flex flex-col gap-2 sm:top-6 sm:left-6">
        <LobbyReadyButton elapsedMs={elapsedMs} found={found} onCancel={onCancel} />
        <LobbyModeCard gameTitle={GAME_LOADING_CONTENT[gameKind].title} content={content} joined={joined} />
      </div>
      <div className="pointer-events-auto absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
        <SquadChatBar message={message} />
      </div>
    </div>
  );
}
