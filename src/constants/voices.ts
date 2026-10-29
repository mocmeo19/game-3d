import { GenderType } from '../types/character';

export interface VoiceInfo {
  id: string;
  ko: string;
  en: string;
  /** Vietnamese description shown in the voice panel. */
  desc: string;
  descEn: string;
  gender: GenderType;
  /** Speech-synthesis pitch (0–2) and rate for the Thoại (spoken line). */
  pitch: number;
  rate: number;
  /** Fundamental frequency (Hz) of the synthesized tiếng hét (battle cry). */
  kiai: number;
  /** 0–1: how raspy / forceful the cry sounds. */
  power: number;
  line: string;
  lineEn: string;
}

export const VOICES: VoiceInfo[] = [
  {
    id: 'brave_f', ko: 'Dũng khí kiên cường', en: 'Resolute courage', gender: 'female',
    desc: 'Giọng nói táo bạo và ngay thẳng, toát lên nội lực thâm hậu.', descEn: 'A bold, upright voice with a deep reserve of inner strength.',
    pitch: 0.95, rate: 0.92, kiai: 300, power: 0.8,
    line: 'Ta thề trên thanh kiếm này, ta sẽ đi đến cùng.', lineEn: 'I swear on this blade — I will see it through.'
  },
  {
    id: 'wind_f', ko: 'Gió trong lành', en: 'Clear wind', gender: 'female',
    desc: 'Giọng nói trong trẻo và nhẹ nhàng, vang lên sảng khoái như làn gió.', descEn: 'A clear, light voice that rings out as fresh as the wind.',
    pitch: 1.35, rate: 1.05, kiai: 430, power: 0.5,
    line: 'Chúng ta đi về nơi gió thổi nhé?', lineEn: 'Shall we go where the wind blows?'
  },
  {
    id: 'moon_f', ko: 'Trăng tĩnh lặng', en: 'Quiet moon', gender: 'female',
    desc: 'Giọng nói điềm tĩnh và trầm, yên ả như ánh trăng.', descEn: 'A calm, low voice, as still as moonlight.',
    pitch: 0.8, rate: 0.85, kiai: 260, power: 0.6,
    line: 'Đừng vội. Mặt trăng vẫn luôn ở đó.', lineEn: 'No need to hurry. The moon is always right there.'
  },
  {
    id: 'flame_f', ko: 'Ngọn lửa bừng cháy', en: 'Blazing flame', gender: 'female',
    desc: 'Giọng nói mạnh mẽ và đầy lực, nóng bỏng như ngọn lửa.', descEn: 'A spirited, forceful voice that burns like a flame.',
    pitch: 1.15, rate: 1.15, kiai: 380, power: 0.95,
    line: 'Lại đây! Ngọn lửa của ta sẽ tiếp chiêu!', lineEn: 'Come at me! My flame will answer you!'
  },
  {
    id: 'rock_m', ko: 'Tảng đá nặng', en: 'Heavy rock', gender: 'male',
    desc: 'Giọng nói trầm dày và nặng, mang lại niềm tin vững vàng.', descEn: 'A thick, weighty voice that inspires unshakable trust.',
    pitch: 0.45, rate: 0.85, kiai: 130, power: 0.9,
    line: 'Đứng sau lưng ta. Không ai qua được.', lineEn: 'Stand behind me. No one gets past.'
  },
  {
    id: 'blade_m', ko: 'Lưỡi kiếm sắc bén', en: 'Sharp blade', gender: 'male',
    desc: 'Giọng nói thấp và lạnh lùng, sắc bén như lưỡi kiếm.', descEn: 'A low, chilling voice as sharp as a blade.',
    pitch: 0.6, rate: 1.05, kiai: 165, power: 0.85,
    line: 'Kiếm không bao giờ nói dối.', lineEn: 'A sword does not lie.'
  },
  {
    id: 'spring_m', ko: 'Xuân ôn hòa', en: 'Gentle spring', gender: 'male',
    desc: 'Giọng nói dịu dàng và ấm áp, êm ái như gió xuân.', descEn: 'A soft, warm voice, comforting as a spring breeze.',
    pitch: 0.8, rate: 0.95, kiai: 190, power: 0.5,
    line: 'May mà bạn bình an. Mời bạn một chén trà.', lineEn: 'I am glad you are safe. Let us have some tea.'
  }
];

export const voicesFor = (gender: GenderType): VoiceInfo[] => VOICES.filter((v) => v.gender === gender);

export type VoiceClip = 'line' | 'normal' | 'special';
export const voiceClipUrl = (voice: VoiceInfo, clip: VoiceClip) =>
  `/audio/voices/${voice.id}-${clip}.mp3`;

/** Resolve a stored voice id, falling back to the first voice of that gender. */
export const resolveVoice = (id: string, gender: GenderType): VoiceInfo => {
  const list = voicesFor(gender);
  return list.find((v) => v.id === id) ?? list[0];
};
