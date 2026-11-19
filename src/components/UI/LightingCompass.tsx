import React, { useRef, useState } from 'react';
import { Sun } from 'lucide-react';
import { sound } from '../../audio/soundManager';

interface LightingCompassProps {
  lightAngle: number;
  onAngleChange: (angle: number) => void;
}

/** Drag the sun around the dial to move the key light (0° = north). */
export const LightingCompass: React.FC<LightingCompassProps> = ({ lightAngle, onAngleChange }) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const setFromPointer = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 90;
    if (deg < 0) deg += 360;
    sound.playSliderTick();
    onAngleChange(deg);
  };

  const rad = ((lightAngle - 90) * Math.PI) / 180;
  const sunX = Math.cos(rad) * 32;
  const sunY = Math.sin(rad) * 32;

  return (
    <div className="flex items-center gap-3 select-none">
      <div
        ref={dialRef}
        role="slider"
        aria-label="Light angle"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={lightAngle}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging && setFromPointer(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onAngleChange((lightAngle + 355) % 360);
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onAngleChange((lightAngle + 5) % 360);
        }}
        className="w-[84px] h-[84px] rounded-full relative cursor-pointer border border-gp-line bg-linear-to-br from-[#1d1d1d] to-black flex items-center justify-center"
      >
        <div className="absolute inset-2 rounded-full border border-dashed border-gp-line pointer-events-none" />
        {(['N', 'E', 'S', 'W'] as const).map((c, i) => (
          <span
            key={c}
            className="absolute text-[8px] text-gp-mute pointer-events-none"
            style={{
              top: i === 0 ? 2 : i === 2 ? undefined : '50%',
              bottom: i === 2 ? 2 : undefined,
              left: i === 3 ? 4 : i === 1 ? undefined : '50%',
              right: i === 1 ? 4 : undefined,
              transform: i % 2 === 0 ? 'translateX(-50%)' : 'translateY(-50%)'
            }}
          >
            {c}
          </span>
        ))}
        <div className="w-2 h-2 rounded-full bg-gp-line pointer-events-none" />
        <div
          className="absolute w-5 h-5 rounded-full bg-gp-hot border border-white flex items-center justify-center pointer-events-none shadow-[0_0_8px_rgba(240,198,74,0.8)]"
          style={{ transform: `translate(${sunX}px, ${sunY}px)`, transition: dragging ? 'none' : 'transform 0.12s ease' }}
        >
          <Sun size={11} className="text-black" />
        </div>
      </div>
      <span className="font-mono text-[11px] text-gp-mute">{lightAngle}°</span>
    </div>
  );
};
