import {
  PERFORMANCE_OVERLAY_CORNERS, type PerformanceOverlayCorner, type PerformanceOverlaySettings,
} from '../../../../performance/performanceOverlaySettings';
import { DEFAULT_RENDER_SETTINGS, type FrameRateCap, type RenderSettings } from '../../../../settings/renderSettings';
import { combineSaveStatus, type AutoSavedSettings } from '../../../../settings/useAutoSavedSettings';
import { GRAPHICS_QUALITY_PRESETS, matchingQualityPreset, type GraphicsQualityPreset } from './graphicsQualityPresets';
import { OptionButtons, type OptionChoice } from './OptionButtons';
import { SettingRow } from './SettingRow';
import { SettingsGroup } from './SettingsGroup';
import { SettingsTabFooter } from './SettingsTabFooter';
import { ToggleSwitch } from './ToggleSwitch';

const QUALITY_OPTIONS: readonly OptionChoice<GraphicsQualityPreset['id']>[] = GRAPHICS_QUALITY_PRESETS
  .map(({ id, label, hint }) => ({ value: id, label, hint }));

const FRAME_RATE_OPTIONS: readonly OptionChoice<FrameRateCap>[] = [
  { value: 30, label: '30 FPS', hint: 'Tiết kiệm pin, máy mát hơn' },
  { value: 60, label: '60 FPS', hint: 'Mượt cho hầu hết màn hình' },
  { value: 'unlimited', label: 'Tối đa', hint: 'Theo tần số quét của màn hình' },
];

const PIXEL_RATIO_OPTIONS: readonly OptionChoice<number>[] = [
  { value: 0.75, label: '0.75×' }, { value: 1, label: '1×' }, { value: 1.5, label: '1.5×' }, { value: 2, label: '2×' },
];

const CORNER_LABELS: Record<PerformanceOverlayCorner, string> = {
  'top-left': 'Trên trái', 'top-right': 'Trên phải', 'bottom-left': 'Dưới trái', 'bottom-right': 'Dưới phải',
};
const CORNER_OPTIONS: readonly OptionChoice<PerformanceOverlayCorner>[] = PERFORMANCE_OVERLAY_CORNERS
  .map((corner) => ({ value: corner, label: CORNER_LABELS[corner] }));

interface GraphicsSettingsTabProps {
  render: AutoSavedSettings<RenderSettings>;
  overlay: AutoSavedSettings<PerformanceOverlaySettings>;
}

export function GraphicsSettingsTab({ render, overlay }: GraphicsSettingsTabProps) {
  const { value, patch } = render;
  const applyQuality = (id: GraphicsQualityPreset['id']) => {
    const preset = GRAPHICS_QUALITY_PRESETS.find((item) => item.id === id);
    if (preset) patch({ pixelRatio: preset.pixelRatio, shadows: preset.shadows, antialias: preset.antialias });
  };
  const resetGraphics = () => patch(DEFAULT_RENDER_SETTINGS);
  const qualityPreset = matchingQualityPreset(value);
  return (
    <>
      <SettingsGroup title="Chất lượng">
        <SettingRow label="Chất lượng đồ họa" hint={qualityPreset ? 'Chọn thấp hơn nếu game bị giật.' : 'Đang dùng tùy chỉnh riêng bên dưới.'}>
          <OptionButtons label="Chất lượng đồ họa" value={qualityPreset} options={QUALITY_OPTIONS} onChange={applyQuality} />
        </SettingRow>
        <SettingRow label="Giới hạn khung hình" hint="Khung hình tối đa mỗi giây trong trận.">
          <OptionButtons label="Giới hạn khung hình" value={value.frameRateCap} options={FRAME_RATE_OPTIONS}
            onChange={(frameRateCap) => patch({ frameRateCap })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Tùy chỉnh">
        <SettingRow label="Độ phân giải tối đa" hint="Game tự hạ xuống khi khung hình chậm để giữ độ mượt.">
          <OptionButtons label="Độ phân giải tối đa" value={value.pixelRatio} options={PIXEL_RATIO_OPTIONS}
            onChange={(pixelRatio) => patch({ pixelRatio })} />
        </SettingRow>
        <SettingRow label="Đổ bóng" hint="Tắt để giảm tải GPU khi có nhiều vật thể.">
          <ToggleSwitch label="Đổ bóng" isOn={value.shadows} onChange={(shadows) => patch({ shadows })} />
        </SettingRow>
        <SettingRow label="Khử răng cưa" hint="Làm mịn cạnh mô hình và vật thể.">
          <ToggleSwitch label="Khử răng cưa" isOn={value.antialias} onChange={(antialias) => patch({ antialias })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Hiệu năng">
        <SettingRow label="Hiện FPS & RAM" hint="Bảng nhỏ ở góc màn hình (ẩn ở trang chủ).">
          <ToggleSwitch label="Hiện FPS & RAM" isOn={overlay.value.isVisible} onChange={(isVisible) => overlay.patch({ isVisible })} />
        </SettingRow>
        {overlay.value.isVisible && (
          <SettingRow label="Vị trí bảng FPS">
            <OptionButtons label="Vị trí bảng FPS" value={overlay.value.corner} options={CORNER_OPTIONS}
              onChange={(corner) => overlay.patch({ corner })} />
          </SettingRow>
        )}
      </SettingsGroup>
      <SettingsTabFooter
        status={combineSaveStatus(render.status, overlay.status)}
        savedMessage="Đã lưu · đồ họa áp dụng khi vào trận hoặc mở lại màn hình 3D."
        onReset={resetGraphics}
      />
    </>
  );
}
