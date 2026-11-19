import {
  AIM_SENSITIVITY_RANGE, CAMERA_SENSITIVITY_RANGE, DEFAULT_GAMEPLAY_SETTINGS, type GameplaySettings,
} from '../../../../settings/gameplaySettings';
import type { AutoSavedSettings } from '../../../../settings/useAutoSavedSettings';
import { SettingRow } from './SettingRow';
import { SettingSlider } from './SettingSlider';
import { SettingsGroup } from './SettingsGroup';
import { SettingsTabFooter } from './SettingsTabFooter';
import { ToggleSwitch } from './ToggleSwitch';

const formatMultiplier = (multiplier: number) => `${multiplier.toFixed(2)}×`;

interface SensitivitySettingsTabProps {
  gameplay: AutoSavedSettings<GameplaySettings>;
}

export function SensitivitySettingsTab({ gameplay }: SensitivitySettingsTabProps) {
  const { value, patch } = gameplay;
  const resetSensitivity = () => patch({
    cameraSensitivity: DEFAULT_GAMEPLAY_SETTINGS.cameraSensitivity,
    aimSensitivity: DEFAULT_GAMEPLAY_SETTINGS.aimSensitivity,
    invertY: DEFAULT_GAMEPLAY_SETTINGS.invertY,
  });
  return (
    <>
      <SettingsGroup title="Chuột">
        <SettingRow label="Độ nhạy camera" hint="Tốc độ xoay khi không ngắm. Cũng chỉnh được trong menu tạm dừng.">
          <SettingSlider label="Độ nhạy camera" value={value.cameraSensitivity} {...CAMERA_SENSITIVITY_RANGE}
            formatValue={formatMultiplier} onChange={(cameraSensitivity) => patch({ cameraSensitivity })} />
        </SettingRow>
        <SettingRow label="Độ nhạy khi ngắm" hint="Nhân thêm khi ngắm qua vai, ngắm thẳng hay nhìn qua ống ngắm.">
          <SettingSlider label="Độ nhạy khi ngắm" value={value.aimSensitivity} {...AIM_SENSITIVITY_RANGE}
            formatValue={formatMultiplier} onChange={(aimSensitivity) => patch({ aimSensitivity })} />
        </SettingRow>
        <SettingRow label="Đảo trục dọc" hint="Đẩy chuột lên để nhìn xuống.">
          <ToggleSwitch label="Đảo trục dọc" isOn={value.invertY} onChange={(invertY) => patch({ invertY })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsTabFooter status={gameplay.status} savedMessage="Đã lưu · áp dụng từ trận tiếp theo." onReset={resetSensitivity} />
    </>
  );
}
