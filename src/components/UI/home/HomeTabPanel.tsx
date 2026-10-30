import { Save, X } from 'lucide-react';
import type { CharacterState, PoseType } from '../../../types/character';
import { homeTabLabel, type HomeTab } from './homeTabs';
import { ProfileInfoTab } from './ProfileInfoTab';
import { VoiceTab } from './VoiceTab';
import { EventsTab } from './EventsTab';
import type { GameEventAction } from './homeEvents';
import { CostumeEditor } from '../CostumeEditor';
import { PosePicker } from '../PosePicker';
import { WeaponPicker } from '../WeaponPicker';
import { sound } from '../../../audio/soundManager';

interface HomeTabPanelProps {
  tab: HomeTab;
  onClose: () => void;
  characterState: CharacterState;
  onUpdateState: (state: CharacterState) => void;
  createdAt: string | null;
  onNotify: (message: string) => void;
  onSaveOutfit: () => Promise<void>;
  savingOutfit: boolean;
  onSaveWeapon: () => Promise<void>;
  savingWeapon: boolean;
  stancePose: PoseType | null;
  onStanceChoose: (pose: PoseType | null) => void;
  onStanceRandom: () => void;
  highlightedEventId: string | null;
  onEventAction: (action: GameEventAction) => void;
}

/** Right-hand sheet showing the content of the open menu entry. */
export function HomeTabPanel(props: HomeTabPanelProps) {
  const { tab, onClose, characterState, onUpdateState } = props;
  return (
    <section
      id="home-tab-panel"
      aria-label={homeTabLabel(tab)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className="pointer-events-auto flex max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/15 bg-linear-to-b from-[#0d1826]/90 to-[#08101a]/90 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm animate-rise-in"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/30 px-4 py-2.5">
        <span aria-hidden className="h-4 w-1 rounded-full bg-[#ffd34d]" />
        <h2 className="flex-1 text-[15px] font-bold uppercase tracking-wider">{homeTabLabel(tab)}</h2>
        {tab === 'outfit' && (
          <button
            type="button"
            disabled={props.savingOutfit}
            onClick={() => { sound.playClick(); void props.onSaveOutfit(); }}
            className="flex items-center gap-1.5 rounded border border-[#ffd34d]/60 bg-[#ffd34d]/10 px-3 py-1 text-xs text-[#ffe9a6] hover:bg-[#ffd34d]/20 disabled:cursor-wait disabled:opacity-50"
          >
            <Save size={14} /> {props.savingOutfit ? 'Đang lưu…' : 'Lưu trang phục'}
          </button>
        )}
        <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'info' && <ProfileInfoTab characterState={characterState} createdAt={props.createdAt} onNotify={props.onNotify} />}
        {tab === 'outfit' && <CostumeEditor characterState={characterState} onUpdateState={onUpdateState} maxHeight={330} />}
        {tab === 'poses' && <PosePicker pose={props.stancePose} onChoose={props.onStanceChoose} onRandom={props.onStanceRandom} />}
        {tab === 'events' && <EventsTab highlightedEventId={props.highlightedEventId} onEventAction={props.onEventAction} />}
        {tab === 'sound' && <VoiceTab characterState={characterState} onUpdateState={onUpdateState} />}
        {tab === 'weapons' && (
          <WeaponPicker
            state={characterState}
            onChange={onUpdateState}
            onPreview={() => props.onStanceChoose('combat_ready')}
            onSave={props.onSaveWeapon}
            saving={props.savingWeapon}
          />
        )}
      </div>
    </section>
  );
}
