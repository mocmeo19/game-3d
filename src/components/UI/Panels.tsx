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

interface AvatarProps {
  skin: string;
  hair: string;
  tip?: string;
  lip?: string;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
}

/** Tiny bust portrait drawn from the preset's own skin / hair / lip colours (stands in for the in-game face icons). */
export const FaceAvatar: React.FC<AvatarProps> = ({ skin, hair, tip, lip = '#be185d', selected, onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    aria-pressed={selected}
    className={`gp-thumb ${selected ? 'is-sel' : ''} aspect-square overflow-hidden`}
  >
    <svg viewBox="0 0 48 48" className="w-full h-full block">
      <defs>
        <linearGradient id="avbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b3f4a" />
          <stop offset="1" stopColor="#15171c" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill="url(#avbg)" />
      <path d="M9 48 C9 38 15 34 24 34 C33 34 39 38 39 48Z" fill={skin} />
      <path d="M11 26 C10 36 12 42 15 44 L17 27Z" fill={hair} />
      <path d="M37 26 C38 36 36 42 33 44 L31 27Z" fill={hair} />
      {tip && <path d="M12 38 C12 41 14 43 15 44 L16 36Z M36 38 C36 41 34 43 33 44 L32 36Z" fill={tip} />}
      <ellipse cx="24" cy="23" rx="10" ry="12" fill={skin} />
      <path d="M13 25 C10 6 38 6 35 25 C33 17 30 14 24 14 C18 14 15 17 13 25Z" fill={hair} />
      <ellipse cx="20" cy="24" rx="1.6" ry="1.1" fill="#1b1212" />
      <ellipse cx="28" cy="24" rx="1.6" ry="1.1" fill="#1b1212" />
      <ellipse cx="24" cy="31" rx="2.4" ry="1.1" fill={lip} />
    </svg>
  </button>
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
