import React from 'react';
import { SettingsLink } from '../../settings/SettingsLink';
import { HelpCircle, Trash2 } from 'lucide-react';
import { AudioControls } from './AudioControls';
import { sound } from '../../audio/soundManager';
const HINT = 'Bạn có thể tùy chỉnh ngoại hình nhân vật theo ý muốn.';

interface BottomControlsProps {
  onCancel: () => void;
  onDelete?: () => void;
  onSave: () => void;
  onManage: () => void;
  onShowHelp: () => void;
}

/** Bottom of the screen: system icons (left), Quản lý ngoại hình + hint (centre), Huỷ / Lưu (right). */
export const BottomControls: React.FC<BottomControlsProps> = ({
  onCancel,
  onDelete,
  onSave,
  onManage,
  onShowHelp
}) => (
  <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-3 flex items-end justify-between pointer-events-none select-none">
    <div className="flex gap-2 pointer-events-auto">
      <AudioControls above />
      <SettingsLink compact />
      {[
        { label: 'Phím tắt (?)', icon: <HelpCircle size={16} />, onClick: onShowHelp }
      ].map((b) => (
        <button
          key={b.label}
          title={b.label}
          aria-label={b.label}
          onClick={() => {
            sound.playClick();
            b.onClick();
          }}
          className="w-9 h-9 flex items-center justify-center text-gp-text hover:text-gp-hot bg-black/50 border border-gp-line rounded-full"
        >
          {b.icon}
        </button>
      ))}
    </div>

    <div className="absolute left-1/2 -translate-x-1/2 bottom-16 sm:bottom-3 flex flex-col items-center gap-2 w-max max-w-[calc(100vw-2rem)] pointer-events-auto">
      <p className="text-gp-hot text-[13px] text-shadow text-center max-w-136">{HINT}</p>
      <button
        className="gp-btn gp-btn-big"
        onClick={() => {
          sound.playClick();
          onManage();
        }}
      >
        Quản lý ngoại hình
      </button>
    </div>

    <div className="flex gap-2 pointer-events-auto">
      {onDelete && <button
        className="gp-btn gp-btn-big border-rose-400/50! text-rose-200! hover:bg-rose-950/50! flex items-center gap-1.5"
        onClick={() => { sound.playClick(); onDelete(); }}
      >
        <Trash2 size={14} /> Xoá nhân vật
      </button>}
      <button
        className="gp-btn gp-btn-big"
        onClick={() => {
          sound.playClick();
          onCancel();
        }}
      >
        Huỷ
      </button>
      <button
        className="gp-btn gp-btn-big"
        onClick={() => {
          sound.playClick();
          onSave();
        }}
      >
        Lưu
      </button>
    </div>
  </div>
);
