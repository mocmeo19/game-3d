import { sound } from '../../../../audio/soundManager';
import { useAudioSaveState, useAudioSettings } from '../../../../audio/useAudioSettings';
import type { AutoSaveStatus } from '../../../../settings/useAutoSavedSettings';
import { SettingRow } from './SettingRow';
import { SettingSlider } from './SettingSlider';
import { SettingsGroup } from './SettingsGroup';
import { SettingsTabFooter } from './SettingsTabFooter';
import { ToggleSwitch } from './ToggleSwitch';

const formatPercent = (level: number) => `${level}%`;

/** The sound manager saves on its own; this tab only edits its levels. */
export function AudioSettingsTab() {
  const settings = useAudioSettings();
  const saveState = useAudioSaveState();
  const status: AutoSaveStatus = saveState.error ? 'error' : saveState.saving ? 'saving' : 'idle';
  const setLevel = (key: 'music' | 'effects', percent: number) => {
    sound.unlock();
    sound.setLevels({ [key]: percent / 100 });
  };
  return (
    <>
      <SettingsGroup title="Âm lượng">
        <SettingRow label="Âm thanh" hint="Tắt toàn bộ nhạc, hiệu ứng và giọng nói.">
          <ToggleSwitch label="Âm thanh" isOn={!settings.muted} onChange={(isOn) => sound.setMuted(!isOn)} />
        </SettingRow>
        <SettingRow label="Nhạc nền">
          <SettingSlider label="Nhạc nền" value={Math.round(settings.music * 100)} min={0} max={100} step={5}
            formatValue={formatPercent} onChange={(percent) => setLevel('music', percent)} />
        </SettingRow>
        <SettingRow label="Hiệu ứng & giọng nói" hint="Tiếng súng, bước chân, giao diện và giọng nhân vật.">
          <SettingSlider label="Hiệu ứng & giọng nói" value={Math.round(settings.effects * 100)} min={0} max={100} step={5}
            formatValue={formatPercent} onChange={(percent) => setLevel('effects', percent)} />
        </SettingRow>
      </SettingsGroup>
      <SettingsTabFooter status={status} savedMessage="" />
    </>
  );
}
