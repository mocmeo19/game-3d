import React from 'react';
import { sound } from '../../audio/soundManager';

export { round2, toStep, fromStep } from './sliderValues';
export { SliderRow } from './SliderRow';

/** Label text (now Vietnamese); the original English gloss stays available as a tooltip. */
export const Bi: React.FC<{ ko: string; en?: string }> = ({ ko, en }) => <span title={en}>{ko}</span>;

export const GamePanel: React.FC<{
  title?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, className = '', children }) => (
  <section className={`gp ${className}`}>
    {title && <header className="gp-title">{title}</header>}
    {children}
  </section>
);

/** Accordion row: dark gradient header with a small triangle, body only when open. */
export const Collapsible: React.FC<{
  title: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({ title, open, onToggle, disabled, children }) => (
  <div className="gp-sec">
    <button
      className="gp-sec-head"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => {
        sound.playClick();
        onToggle();
      }}
    >
      <span>{title}</span>
      <span className="text-[9px] text-gp-mute">{open ? '▲' : '▼'}</span>
    </button>
    {open && <div className="gp-sec-body animate-fade-in">{children}</div>}
  </div>
);

/** Preset chips plus a native picker for any custom colour. */
export const ColorPicker: React.FC<{
  colors: { name: string; hex: string }[];
  value: string;
  onPick: (hex: string) => void;
  /** Square tiles (like the other pickers) instead of round dots. */
  tile?: boolean;
}> = ({ colors, value, onPick, tile = false }) => {
  const lower = value.toLowerCase();
  const isCustom = !colors.some((c) => c.hex.toLowerCase() === lower);
  const shape = tile ? 'aspect-square gp-thumb p-0!' : 'h-6 rounded-full gp-swatch';
  return (
    <div className={`grid grid-cols-5 ${tile ? 'gap-1.5' : 'gap-2'} items-center`}>
      {colors.map((c) => (
        <button
          key={c.hex}
          title={c.name}
          aria-label={c.name}
          aria-pressed={lower === c.hex.toLowerCase()}
          onClick={() => {
            sound.playClick();
            onPick(c.hex);
          }}
          className={`${shape} ${lower === c.hex.toLowerCase() ? 'is-sel' : ''}`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
      <label
        title="Màu tùy chọn"
        className={`${shape} relative overflow-hidden cursor-pointer ${isCustom ? 'is-sel' : ''}`}
        style={{ background: isCustom ? value : 'conic-gradient(#f43f5e,#f59e0b,#22c55e,#06b6d4,#6366f1,#f43f5e)' }}
      >
        <input
          type="color"
          value={value}
          aria-label="Màu tùy chọn"
          onChange={(e) => onPick(e.target.value)}
          className="gp-color absolute inset-0 w-full h-full opacity-0"
        />
      </label>
    </div>
  );
};
