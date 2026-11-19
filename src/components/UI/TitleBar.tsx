import React from 'react';

/** Plain white screen title in the top-left, exactly where the client puts it. */
export const TitleBar: React.FC = () => (
  <div className="absolute top-3 left-4 z-10 pointer-events-none select-none">
    <h1 className="text-[26px] leading-none font-medium text-white text-shadow">Chọn ngoại hình</h1>
  </div>
);
