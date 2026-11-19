import React, { useEffect, useState } from 'react';
import type { CharacterState } from '../../types/character';
import { resolveVoice } from '../../constants/voices';
import { sound } from '../../audio/soundManager';
import { useSuppressPerformanceOverlay } from '../../performance/performanceOverlaySuppression';
import type { GameKind } from './home/homeGames';
import { ChooseCharacterButton } from './home/ChooseCharacterButton';
import { WalletBadge } from './home/WalletBadge';
import { HomeSettingsButton } from './home/HomeSettingsButton';
import { GameSettingsScreen } from './home/settings/GameSettingsScreen';
import { HomeStageControls } from './home/HomeStageControls';
import { GameStartPanel } from './home/GameStartPanel';
import { HomeNavBar } from './home/HomeNavBar';
import { HomeEventTiles } from './home/HomeEventTiles';
import { TopUpDialog } from './home/TopUpDialog';
import { InventoryScreen } from './home/inventory/InventoryScreen';
import { wornItemKeys } from './home/inventory/inventoryItems';
import { ShopScreen } from './home/shop/ShopScreen';
import { seedOwnedItems } from '../../shop/ownedItemsStore';
import type { GameEventAction } from './home/homeEvents';
import { EventCenterDialog } from './home/EventCenterDialog';
import { useHomeEvents } from './home/useHomeEvents';

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
  /** Lets the stage reframe the character while the full-screen locker covers the left side. */
  onInventoryOpenChange: (isOpen: boolean) => void;
  /** Shows a look being tried on in the shop on the stage (null: the character as it is). */
  onPreviewState: (state: CharacterState | null) => void;
  onNotify: (message: string) => void;
  turntableOn: boolean;
  onToggleTurntable: () => void;
  onTryPlay: (game: GameKind) => void;
}

/** Character profile laid out like a game lobby: identity top-left, actions top-right, launcher bottom-left, menu bottom-right. */
export const HomeScreen: React.FC<HomeScreenProps> = (props) => {
  const { characterState, selectedGame } = props;
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const eventCatalog = useHomeEvents();
  const voiceId = resolveVoice(characterState.voice, characterState.gender).id;

  useEffect(() => () => sound.stopVoice(), [voiceId]);
  useSuppressPerformanceOverlay();

  const openEvents = (eventId: string | null) => {
    setHighlightedEventId(eventId);
    setIsEventsOpen(true);
  };

  const runEventAction = (action: GameEventAction) => {
    if (action.kind === 'top-up') {
      setIsEventsOpen(false);
      setIsTopUpOpen(true);
      return;
    }
    if (action.kind === 'open-outfit') {
      // outfits are tried on and bought in the shop
      openLocker('shop');
      return;
    }
    props.onSelectGame(action.game);
    setIsEventsOpen(false);
  };

  /** The locker and the shop cover the lobby; the first time either opens, what the character wears becomes theirs. */
  const openLocker = (screen: 'inventory' | 'shop') => {
    seedOwnedItems(wornItemKeys(characterState));
    setIsEventsOpen(false);
    setIsInventoryOpen(screen === 'inventory');
    setIsShopOpen(screen === 'shop');
    props.onInventoryOpenChange(true);
  };

  const closeLocker = () => {
    setIsInventoryOpen(false);
    setIsShopOpen(false);
    props.onInventoryOpenChange(false);
  };

  if (isSettingsOpen) {
    return (
      <div className="absolute inset-0 z-20 select-none">
        <GameSettingsScreen onClose={() => setIsSettingsOpen(false)} />
      </div>
    );
  }

  if (isShopOpen) {
    return (
      <div className="absolute inset-0 z-20 select-none">
        <ShopScreen
          characterState={characterState}
          onUpdateState={props.onUpdateState}
          onPreview={props.onPreviewState}
          onOpenTopUp={() => setIsTopUpOpen(true)}
          onNotify={props.onNotify}
          onClose={closeLocker}
        />
        {isTopUpOpen && <TopUpDialog onClose={() => setIsTopUpOpen(false)} onNotify={props.onNotify} />}
      </div>
    );
  }

  if (isInventoryOpen) {
    return (
      <div className="absolute inset-0 z-20 select-none">
        <InventoryScreen
          characterState={characterState}
          onUpdateState={props.onUpdateState}
          onSaveOutfit={props.onSaveOutfit}
          savingOutfit={props.savingOutfit}
          onSaveWeapon={props.onSaveWeapon}
          savingWeapon={props.savingWeapon}
          onClose={closeLocker}
          onOpenShop={() => openLocker('shop')}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none animate-fade-in">
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/50 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/60 to-transparent" />

      <div className="absolute left-5 right-5 top-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col items-center gap-2">
          <ChooseCharacterButton onChooseCharacter={props.onChooseCharacter} />
          <HomeStageControls turntableOn={props.turntableOn} onToggleTurntable={props.onToggleTurntable} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <WalletBadge onOpenTopUp={() => setIsTopUpOpen(true)} />
          <HomeSettingsButton onOpenSettings={() => setIsSettingsOpen(true)} />
        </div>
      </div>

      <div className="absolute bottom-36 right-5 top-20 flex w-[400px] max-w-[42vw] min-w-[280px] flex-col items-end">
        <HomeEventTiles
          events={eventCatalog.events}
          now={eventCatalog.now}
          seenIds={eventCatalog.seenIds}
          unreadCount={eventCatalog.unreadCount}
          onOpenEvents={openEvents}
          onOpenTopUp={() => setIsTopUpOpen(true)}
        />
      </div>

      <div className="absolute bottom-5 left-5">
        <GameStartPanel selectedGame={selectedGame} onStart={props.onTryPlay} />
      </div>

      <div className="absolute bottom-3 right-5 flex max-w-[calc(100vw-340px)] flex-col items-end gap-2">
        <HomeNavBar
          onOpenInventory={() => openLocker('inventory')}
          onOpenShop={() => openLocker('shop')}
        />
      </div>

      {isEventsOpen && (
        <EventCenterDialog
          events={eventCatalog.events}
          now={eventCatalog.now}
          seenIds={eventCatalog.seenIds}
          highlightedEventId={highlightedEventId}
          onSeen={eventCatalog.markSeen}
          onEventAction={runEventAction}
          onClose={() => setIsEventsOpen(false)}
        />
      )}
      {isTopUpOpen && <TopUpDialog onClose={() => setIsTopUpOpen(false)} onNotify={props.onNotify} />}
    </div>
  );
};
