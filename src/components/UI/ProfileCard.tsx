import React from 'react';

/** Frosted dark-blue card used by every right-hand panel. */
export const ProfileCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`pointer-events-auto bg-[#0a2557]/55 backdrop-blur-[3px] border border-white/15 rounded-xs shadow-[0_8px_30px_rgba(0,10,40,0.45)] ${className}`}>{children}</div>
);

