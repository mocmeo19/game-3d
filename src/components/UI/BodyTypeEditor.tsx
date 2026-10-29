import { BODY_BASE_KEYS, BODY_SLIDERS } from '../../constants/sliders';
import type { BodySliders } from '../../types/character';
import { SliderRow } from './SliderRow';

const SLIDERS = BODY_SLIDERS.filter((slider) => BODY_BASE_KEYS.includes(slider.key));

export function BodyTypeEditor({ body, onChange }: {
  body: BodySliders; onChange: (key: string, value: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] leading-relaxed text-gp-mute">Biên độ −30…+30 · Nhấp đúp thanh trượt để đặt lại.</p>
      {SLIDERS.map((slider) => <SliderRow key={slider.key} def={slider} value={body[slider.key as keyof BodySliders]}
        onChange={(value) => onChange(slider.key, value)} />)}
    </div>
  );
}
