import React from 'react';
import { Download } from 'lucide-react';
import { Bi } from './Panels';
import { ModalShell } from './Overlays';
import { sound } from '../../audio/soundManager';

interface PhotoModalProps {
  photoUrl: string | null;
  characterName: string;
  onClose: () => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({ photoUrl, characterName, onClose }) => {
  if (!photoUrl) return null;

  const download = () => {
    sound.playClick();
    const link = document.createElement('a');
    link.download = `${characterName || 'NamsBattleRoyal_Character'}.png`;
    link.href = photoUrl;
    link.click();
  };

  return (
    <ModalShell title={<Bi ko="Chụp ảnh" en="Photo" />} onClose={onClose} wide>
      <div className="bg-black border border-gp-line flex items-center justify-center">
        <img src={photoUrl} alt="Ảnh chụp nhân vật" className="max-h-[60vh] w-auto object-contain" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-gp-mute">{characterName || 'Chưa đặt tên'} · PNG</span>
        <div className="flex gap-1.5">
          <button className="gp-btn" onClick={onClose}>
            Đóng
          </button>
          <button className="gp-btn flex items-center gap-1.5" onClick={download}>
            <Download size={12} /> Lưu
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
