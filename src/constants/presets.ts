import { CharacterState, BodySliders, FaceSliders, CosmeticColors } from '../types/character';
import { DEFAULT_WEAPON_KIND } from './weaponKinds';

export { ENVIRONMENTS, LEGACY_ENVIRONMENTS } from './environments';

export const FACE_MARKINGS = [
  { id: 'none', name: 'Không' },
  { id: 'phoenix_bindi', name: 'Ngọc phượng hoàng' },
  { id: 'dragon_claw', name: 'Vết vuốt rồng' },
  { id: 'hongmoon_rune', name: 'Ấn huyền thuật Hồng Môn' },
  { id: 'shadow_fox', name: 'Ria hồ ly' },
  { id: 'gold_lotus', name: 'Hoa sen vàng' }
];

export const SKIN_TONES = [
  { name: 'Ngọc sứ', hex: '#fdf3ea' },
  { name: 'Kem đào', hex: '#faebd7' },
  { name: 'Ngọc trai nắng', hex: '#f6d5be' },
  { name: 'Mật vàng', hex: '#e9b68d' },
  { name: 'Cát đồng', hex: '#c58b5f' },
  { name: 'Hạt dẻ đậm', hex: '#875133' },
  { name: 'Xám tro Gon', hex: '#7a7d84' },
  { name: 'Hắc diệu thạch', hex: '#3d3434' }
];

export const HAIR_COLORS = [
  { name: 'Đen huyền', hex: '#111116' },
  { name: 'Nâu cà phê', hex: '#2c1e18' },
  { name: 'Vàng hoàng gia', hex: '#d4af37' },
  { name: 'Hồng đỏ thẫm', hex: '#8f1d2c' },
  { name: 'Bạc sương giá', hex: '#e8edf3' },
  { name: 'Tím sương oải hương', hex: '#a78bfa' },
  { name: 'Hồng anh đào', hex: '#f472b6' },
  { name: 'Lam long', hex: '#06b6d4' }
];

export const DEFAULT_BODY: BodySliders = {
  height: 1.0,
  headSize: 1.0,
  neckThickness: 1.0,
  shoulderWidth: 1.0,
  chestSize: 1.15, // Iconic BnS default
  bodyFat: 0,
  muscleTone: 0,
  ageShift: 0,
  raceAfrican: 0,
  raceAsian: 0,
  raceCaucasian: 0,
  waistWidth: 0.95,
  pelvisWidth: 1.1,
  armThickness: 1.0,
  handSize: 1.0,
  thighThickness: 1.1,
  calfThickness: 1.0,
  footSize: 1.0,
  legLength: 1.1, // Elongated runway legs
  neckLength: 0,
  shoulderSlope: 0,
  torsoLength: 0,
  chestHeight: 0,
  chestSpacing: 0,
  abdomen: 0,
  glutes: 0,
  armLength: 0,
  pectoral: 0,
  backMuscle: 0,
  armMuscle: 0,
  armFat: 0,
  shoulderMuscle: 0,
  thighMuscle: 0,
  thighFat: 0,
  calfMuscle: 0,
  bellyTone: 0,
  torsoDepth: 0,
  torsoWidth: 0,
  underbust: 0,
  waistToHip: 0,
  hipDepth: 0,
  navel: 0,
  kneeSize: 0,
  legShape: 0,
  ankleSize: 0,
  wristSize: 0,
  fingerLength: 0,
  fingerThick: 0,
  elbowDimples: 0,
  armLowerShape: 0,
  armUpperShape: 0,
  wristUlna: 0,
  armpit: 0,
  knuckles: 0,
  fingerShape: 0,
  handHypothenar: 0,
  handThenar: 0,
};

export const DEFAULT_FACE: FaceSliders = {
  jawWidth: 1.0,
  chinLength: 1.0,
  chinProtrusion: 1.0,
  cheekbones: 1.0,
  eyeSize: 1.05,
  eyeSpacing: 1.0,
  eyeAngle: 0.05,
  noseHeight: 1.0,
  noseWidth: 0.95,
  mouthWidth: 1.0,
  lipFullness: 1.1,
  lipSmile: 0.05,
  faceWidth: 0, faceLength: 0, foreheadHeight: 0, foreheadWidth: 0, cheekFullness: 0,
  eyeHeight: 0, eyeWidth: 0, eyeOuterCorner: 0, irisSize: 0,
  browHeight: 0, browAngle: 0, browLength: 0, browThickness: 0, browSpacing: 0,
  noseLength: 0, noseBridgeWidth: 0, noseTipWidth: 0, noseVertical: 0, noseProjection: 0,
  mouthHeight: 0, upperLip: 0, lowerLip: 0, mouthProtrusion: 0,
  chinWidth: 0, jawBackWidth: 0, chinAngle: 0,
  headRound: 0,
  headSquare: 0,
  headTriangle: 0,
  headDepth: 0,
  skullBack: 0,
  faceFat: 0,
  earSize: 0,
  earHeight: 0,
  earPointed: 0,
  earWing: 0,
  earLobe: 0,
  earRotation: 0,
  eyeEpicanthus: 0,
  eyeBag: 0,
  eyeFold: 0,
  eyeDepth: 0,
  noseCompression: 0,
  noseCurve: 0,
  noseFlaring: 0,
  nostrilWidth: 0,
  noseTilt: 0,
  noseBase: 0,
  cupidsBow: 0,
  philtrum: 0,
  mouthDimples: 0,
  lowerLipWidth: 0,
  chinCleft: 0,
  cheekHeight: 0,
  cheekHollow: 0,
  foreheadSlope: 0,
  foreheadBulge: 0,
  earFlap1: 0,
  earFlap2: 0,
  earFlap3: 0,
  earFlapBottom: 0,
  earCanal: 0,
  earDetail: 0,
  earIn: 0,
  earFlatten: 0,
  cheekFull: 0,
  cheekChipmunkHigh: 0,
  cheekChipmunkLow: 0,
  jowls: 0,
  noseBulbous: 0,
  noseWidening: 0,
  noseGreek: 0,
  noseColumella: 0,
  alarRounding: 0,
  alarCrease: 0,
  nostrilBean: 0,
  nostrilDeepen: 0,
  nostrilRim: 0,
  nostrilShrink: 0,
  nostrilUp: 0,
  noseHoleCenter: 0,
  noseHoleUp: 0,
  nasolabialSharp: 0,
  nasolabialCrease: 0,
};

export const DEFAULT_COSMETICS: CosmeticColors = {
  skinTone: '#faebd7',
  skinGloss: 0.75, // Signature BnS oil sheen!
  eyeIrisColor: '#8a4b26',
  pupilStyle: 'round',
  eyeshadowColor: '#78350f',
  eyeshadowIntensity: 0.4,
  lipColor: '#be185d',
  lipIntensity: 1,
  lipGloss: 0.8,
  blushColor: '#f43f5e',
  blushIntensity: 0.35,
  faceMarking: 'none',
  faceMarkingColor: '#dc2626',
  hairStyle: 'ponytail',
  hairColorPrimary: '#1a1820',
  hairColorTips: '#b91c1c',
  hairGloss: 0.85
};

export function getInitialCharacter(): CharacterState {
  return {
    name: 'HongmoonDisciple',
    gender: 'female',
    weapon: DEFAULT_WEAPON_KIND,
    costume: 'hongmoon',
    pose: 'idle',
    environment: 'lanterns',
    voice: 'brave_f',
    lightAngle: 45,
    body: { ...DEFAULT_BODY },
    face: { ...DEFAULT_FACE },
    cosmetics: { ...DEFAULT_COSMETICS }
  };
}

const hslToHex = (h: number, s: number, l: number): string => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
};

/** Hair colour palette: neutrals and naturals first, then hue columns from dark to light (like the in-game grid). */
export const HAIR_PALETTE: string[] = (() => {
  const out = [
    '#0b0b0f', '#1a1820', '#2c1e18', '#3d2a1c', '#5a3a22', '#7a5230', '#9a6c3c', '#b98a52', '#d4a96a', '#e8c98c', '#f2e0b4', '#faf3dc',
    '#4a4a52', '#6b6b75', '#8e8e98', '#b0b0ba', '#cfcfd6', '#e8edf3', '#ffffff', '#7a3a2a', '#a04a32', '#c0613a', '#d9824a', '#8f1d2c'
  ];
  const lights = [24, 36, 50, 64, 78];
  lights.forEach((l, row) => {
    for (let i = 0; i < 12; i++) {
      const h = (i * 30 + (row % 2) * 10) % 360;
      out.push(hslToHex(h, (72 - row * 4) / 100, l / 100));
    }
  });
  return out;
})();
