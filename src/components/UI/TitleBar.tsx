import React from 'react';
import type { Step } from './RightPanel';

const TITLES: Record<Step, { ko: string; en: string }> = {
  race: { ko: 'Chọn chủng tộc', en: 'Race Selection' },
  class: { ko: 'Chọn lớp nhân vật', en: 'Class Selection' },
  appearance: { ko: 'Chọn ngoại hình', en: 'Appearance' }
};

/** Plain white screen title in the top-left, exactly where the client puts it. */
export const TitleBar: React.FC<{ step: Step }> = ({ step }) => (
  <div className="absolute top-3 left-4 z-10 pointer-events-none select-none">
    <h1 className="text-[26px] leading-none font-medium text-white text-shadow">{TITLES[step].ko}</h1>
  </div>
);
