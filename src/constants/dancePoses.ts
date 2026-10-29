import { MIXAMO_PREFIX } from './mixamoPoses';
import type { PoseType } from '../types/character';

/** Dance clips from Mixamo (public/animations/dance-*.fbx) offered in the "Tạo dáng" menu, played in a loop on the character. */
export interface DancePose {
  file: string;
  label: string;
}

export const DANCE_POSES: DancePose[] = [
  { file: 'dance-gangnam-style.fbx', label: 'Gangnam Style' },
  { file: 'dance-macarena.fbx', label: 'Macarena' },
  { file: 'dance-ymca.fbx', label: 'YMCA' },
  { file: 'dance-running-man.fbx', label: 'Running Man' },
  { file: 'dance-moonwalk.fbx', label: 'Moonwalk' },
  { file: 'dance-robot.fbx', label: 'Robot' },
  { file: 'dance-wave.fbx', label: 'Sóng tay' },
  { file: 'dance-house.fbx', label: 'House' },
  { file: 'dance-shuffle.fbx', label: 'Shuffle' },
  { file: 'dance-breakdance.fbx', label: 'Breakdance' },
  { file: 'dance-thriller.fbx', label: 'Thriller' },
  { file: 'dance-twist.fbx', label: 'Twist' },
  { file: 'dance-charleston.fbx', label: 'Charleston' },
  { file: 'dance-chicken.fbx', label: 'Điệu gà con' },
  { file: 'dance-samba.fbx', label: 'Samba' },
  { file: 'dance-salsa.fbx', label: 'Salsa' },
  { file: 'dance-belly.fbx', label: 'Múa bụng' },
  { file: 'dance-ballet.fbx', label: 'Ba lê' },
];

export const dancePoseId = (dance: DancePose) => `${MIXAMO_PREFIX}${dance.file}` as PoseType;
