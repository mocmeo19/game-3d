import React, { useEffect, useState } from 'react';
import type { CharacterState, PoseType } from '../../types/character';
import { resolveVoice } from '../../constants/voices';
import { sound } from '../../audio/soundManager';
import { useSuppressPerformanceOverlay } from '../../performance/performanceOverlaySuppression';
import type { GameKind } from './home/homeGames';
import type { HomeTab } from './home/homeTabs';
import { HomePlayerCard } from './home/HomePlayerCard';
import { WalletBadge } from './home/WalletBadge';
import { HomeStageControls } from './home/HomeStageControls';
import { GameStartPanel } from './home/GameStartPanel';
import { HomeNavBar } from './home/HomeNavBar';
import { HomeTabPanel } from './home/HomeTabPanel';
import { HomeEventTiles } from './home/HomeEventTiles';
import { TopUpDialog } from './home/TopUpDialog';
import type { GameEventAction } from './home/homeEvents';

export type { GameKind } from './home/homeGames';

interface HomeScreenProps {
  selectedGame: GameKind;
  onSelectGame: (game: GameKind) => void;
  characterState: CharacterState;
  onUpdateState: (s: CharacterState) => void;
  onSaveOutfit: () => Promise<void>;
  savingOutfit: boolean;
  onSaveWeapon: () => Promise<void>;
  savingWeapon: boolean;
  onChooseCharacter: () => void;
  onNotify: (message: string) => void;
  createdAt: string | null;
  turntableOn: boolean;
  onToggleTurntable: () => void;
  onTryPlay: (game: GameKind) => void;
  /** Pose the character is holding right now (`null` = at rest) and the controls of the "Tạo dáng" menu. */
  stancePose: PoseType | null;
  onStanceChoose: (pose: PoseType | null) => void;
  onStanceRandom: () => void;
}

/** Character profile laid out like a game lobby: identity top-left, actions top-right, launcher bottom-left, menu bottom-right. */
export const HomeScreen: React.FC<HomeScreenProps> = (props) => {
  const { characterState, selectedGame } = props;
  const [openTab, setOpenTab] = useState<HomeTab | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const voiceId = resolveVoice(characterState.voice, characterState.gender).id;

  useEffect(() => () => sound.stopVoice(), [voiceId]);
  useSuppressPerformanceOverlay();

  const openEvents = (eventId: string | null) => {
    setHighlightedEventId(eventId);
    setOpenTab('events');
  };

  const runEventAction = (action: GameEventAction) => {
    if (action.kind === 'top-up') {
      setIsTopUpOpen(true);
      return;
    }
    if (action.kind === 'open-outfit') {
      setOpenTab('outfit');
      return;
    }
    props.onSelectGame(action.game);
    setOpenTab(null);
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none animate-fade-in">
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/50 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/60 to-transparent" />

      <div className="absolute left-5 right-5 top-4 flex flex-wrap items-start justify-between gap-3">
        <HomePlayerCard characterState={characterState} onChooseCharacter={props.onChooseCharacter} />
        <div className="pointer-events-auto">
          <WalletBadge onOpenTopUp={() => setIsTopUpOpen(true)} />
        </div>
      </div>

      <div className="absolute bottom-36 right-5 top-20 flex w-[400px] max-w-[42vw] min-w-[280px] flex-col items-end">
        {openTab ? (
          <div className="flex min-h-0 w-full flex-1 flex-col justify-end">
            <HomeTabPanel
              tab={openTab}
              onClose={() => setOpenTab(null)}
              characterState={characterState}
              onUpdateState={props.onUpdateState}
              createdAt={props.createdAt}
              onNotify={props.onNotify}
              onSaveOutfit={props.onSaveOutfit}
              savingOutfit={props.savingOutfit}
              onSaveWeapon={props.onSaveWeapon}
              savingWeapon={props.savingWeapon}
              stancePose={props.stancePose}
              onStanceChoose={props.onStanceChoose}
              onStanceRandom={props.onStanceRandom}
              highlightedEventId={highlightedEventId}
              onEventAction={runEventAction}
            />
          </div>
        ) : (
          <HomeEventTiles onOpenEvents={openEvents} onOpenTopUp={() => setIsTopUpOpen(true)} />
        )}
      </div>

      <div className="absolute bottom-5 left-5">
        <GameStartPanel selectedGame={selectedGame} onSelectGame={props.onSelectGame} onStart={props.onTryPlay} />
      </div>

      <div className="absolute bottom-3 right-5 flex max-w-[calc(100vw-340px)] flex-col items-end gap-2">
        <HomeStageControls turntableOn={props.turntableOn} onToggleTurntable={props.onToggleTurntable} />
        <HomeNavBar openTab={openTab} onToggleTab={(tab) => setOpenTab((current) => (current === tab ? null : tab))} />
      </div>

      {isTopUpOpen && <TopUpDialog onClose={() => setIsTopUpOpen(false)} onNotify={props.onNotify} />}
    </div>
  );
};
