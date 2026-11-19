import { weaponStyleOf } from '../../constants/weaponStyles';
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CharacterState } from '../../types/character';
import { WEAPON_KINDS } from '../../constants/weaponKinds';
import { ASSET_INFO, equipped } from '../../constants/equipment';
import { Bi } from './Panels';
import { ModalShell } from './Overlays';
import { sound } from '../../audio/soundManager';

interface CreationSummaryModalProps {
  isOpen: boolean;
  characterState: CharacterState;
  onClose: () => void;
  onNotify: (message: string) => void;
  /** Called when the player confirms the character; the app then opens the hero home screen. */
  onConfirm: () => void;
}

export const CreationSummaryModal: React.FC<CreationSummaryModalProps> = ({
  isOpen,
  characterState,
  onClose,
  onNotify,
  onConfirm
}) => {
  const weaponColor = WEAPON_KINDS[characterState.weapon].color;

  useEffect(() => {
    if (!isOpen) return;
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#f0c64a', '#ffffff', weaponColor] });
  }, [isOpen, weaponColor]);

  if (!isOpen) return null;

  const weapon = WEAPON_KINDS[characterState.weapon];
  const costume = ASSET_INFO[equipped(characterState, 'outfit') ?? ''];

  const rows: [string, string, string][] = [
    ['Giới tính', 'Gender', characterState.gender === 'female' ? 'Nữ' : 'Nam'],
    ['Vũ khí', 'Weapon', weaponStyleOf(characterState.weapon, characterState.weaponStyle).name],
    ['Trang phục', 'Costume', costume?.name ?? '']
  ];

  return (
    <ModalShell title={<Bi ko="Tạo nhân vật" en="Create character" />} onClose={onClose}>
      <div className="text-center mb-3">
        <div className="text-[22px] font-medium text-white">{characterState.name || 'Chưa đặt tên'}</div>
        <div className="text-[11px] text-gp-hot mt-0.5">{weapon.badge} {weapon.name}</div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border border-gp-line bg-black/30 p-3">
        {rows.map(([ko, en, value]) => (
          <React.Fragment key={en}>
            <dt className="text-gp-mute">
              <Bi ko={ko} en={en} />
            </dt>
            <dd className="text-white">{value}</dd>
          </React.Fragment>
        ))}
      </dl>

      <div className="mt-3 flex justify-end gap-1.5">
        <button
          className="gp-btn"
          onClick={() => {
            sound.playClick();
            onClose();
          }}
        >
          Chỉnh sửa
        </button>
        <button
          className="gp-btn gp-btn-big py-1.5!"
          onClick={() => {
            sound.playBladeWhoosh();
            onNotify(`${characterState.name} bước vào Đại lục!`);
            onConfirm();
          }}
        >
          Tạo nhân vật
        </button>
      </div>
    </ModalShell>
  );
};
