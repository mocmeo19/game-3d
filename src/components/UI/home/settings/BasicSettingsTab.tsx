import type { AimStyle, Perspective } from '../../../../games/core/aim/aimModes';
import { DEFAULT_GAMEPLAY_SETTINGS, FIRST_PERSON_FOV_RANGE_DEG, type GameplaySettings } from '../../../../settings/gameplaySettings';
import type { AutoSavedSettings } from '../../../../settings/useAutoSavedSettings';
import { OptionButtons, type OptionChoice } from './OptionButtons';
import { SettingRow } from './SettingRow';
import { SettingSlider } from './SettingSlider';
import { SettingsGroup } from './SettingsGroup';
import { SettingsTabFooter } from './SettingsTabFooter';

const PERSPECTIVE_OPTIONS: readonly OptionChoice<Perspective>[] = [
  { value: 'tpp', label: 'TPP', hint: 'Ngôi thứ ba: thấy nhân vật của bạn' },
  { value: 'fpp', label: 'FPP', hint: 'Ngôi thứ nhất: nhìn qua mắt nhân vật' },
];

const AIM_STYLE_OPTIONS: readonly OptionChoice<AimStyle>[] = [
  { value: 'pubg', label: 'Nhấn & giữ', hint: 'Nhấn nhanh để bật/tắt ngắm qua ống ngắm, giữ để ngắm qua vai' },
  { value: 'hold', label: 'Chỉ giữ', hint: 'Chỉ ngắm khi đang giữ chuột phải' },
];

interface BasicSettingsTabProps {
  gameplay: AutoSavedSettings<GameplaySettings>;
}

export function BasicSettingsTab({ gameplay }: BasicSettingsTabProps) {
  const { value, patch } = gameplay;
  const resetBasics = () => patch({
    startPerspective: DEFAULT_GAMEPLAY_SETTINGS.startPerspective,
    firstPersonFovDeg: DEFAULT_GAMEPLAY_SETTINGS.firstPersonFovDeg,
    aimStyle: DEFAULT_GAMEPLAY_SETTINGS.aimStyle,
  });
  return (
    <>
      <SettingsGroup title="Góc nhìn">
        <SettingRow label="Góc nhìn khi vào trận" hint="Trong trận nhấn V để đổi góc nhìn.">
          <OptionButtons label="Góc nhìn khi vào trận" value={value.startPerspective} options={PERSPECTIVE_OPTIONS}
            onChange={(startPerspective) => patch({ startPerspective })} />
        </SettingRow>
        <SettingRow label="Trường nhìn FPP" hint="Rộng hơn thấy được nhiều xung quanh hơn, vật ở xa trông nhỏ hơn.">
          <SettingSlider label="Trường nhìn FPP" value={value.firstPersonFovDeg} {...FIRST_PERSON_FOV_RANGE_DEG}
            formatValue={(degrees) => `${degrees}°`} onChange={(firstPersonFovDeg) => patch({ firstPersonFovDeg })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Ngắm bắn">
        <SettingRow label="Ngắm bằng chuột phải" hint="Áp dụng cho Battle Royal. CS Lite luôn giữ chuột phải để ngắm.">
          <OptionButtons label="Ngắm bằng chuột phải" value={value.aimStyle} options={AIM_STYLE_OPTIONS}
            onChange={(aimStyle) => patch({ aimStyle })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsTabFooter status={gameplay.status} savedMessage="Đã lưu · áp dụng từ trận tiếp theo." onReset={resetBasics} />
    </>
  );
}
