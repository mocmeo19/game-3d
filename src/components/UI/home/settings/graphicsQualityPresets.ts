import type { RenderSettings } from '../../../../settings/renderSettings';

type QualityLook = Pick<RenderSettings, 'pixelRatio' | 'shadows' | 'antialias'>;

export interface GraphicsQualityPreset extends QualityLook {
  id: 'smooth' | 'balanced' | 'hd' | 'ultra';
  label: string;
  hint: string;
}

export const GRAPHICS_QUALITY_PRESETS: readonly GraphicsQualityPreset[] = [
  { id: 'smooth', label: 'Mượt', hint: 'Độ phân giải thấp, tắt bóng: máy yếu', pixelRatio: 0.75, shadows: false, antialias: false },
  { id: 'balanced', label: 'Cân bằng', hint: 'Độ phân giải 1×, tắt bóng', pixelRatio: 1, shadows: false, antialias: true },
  { id: 'hd', label: 'HD', hint: 'Độ phân giải 1.5×, có bóng', pixelRatio: 1.5, shadows: true, antialias: true },
  { id: 'ultra', label: 'Cực cao', hint: 'Độ phân giải 2×, có bóng', pixelRatio: 2, shadows: true, antialias: true },
];

/** The preset the settings match exactly, or null when the player has mixed their own. */
export const matchingQualityPreset = (settings: RenderSettings): GraphicsQualityPreset['id'] | null =>
  GRAPHICS_QUALITY_PRESETS.find((preset) => preset.pixelRatio === settings.pixelRatio && preset.shadows === settings.shadows
    && preset.antialias === settings.antialias)?.id ?? null;
