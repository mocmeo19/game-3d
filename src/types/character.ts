export type RaceType = 'jin' | 'gon' | 'lyn' | 'yun';
export type GenderType = 'female' | 'male';

export type ClassType = 
  | 'blade_master'
  | 'kung_fu_master'
  | 'force_master'
  | 'destroyer'
  | 'assassin'
  | 'summoner'
  | 'gunslinger'
  | 'blade_dancer'
  | 'warlock'
  | 'soul_fighter'
  | 'warden'
  | 'archer'
  | 'astromancer'
  | 'dual_blade'
  | 'musician';

export type BuiltinPose = 
  | 'idle' 
  | 'combat_ready' 
  | 'victory' 
  | 'dance' 
  | 'cute'
  | 'bow'
  | 'walk'
  | 'run'
  | 'meditate'
  | 'jump'
  | 'vault';

/**
 * A built-in animated pose, a still pose from the MPFB pose packs (`mpfb:<id>`, see constants/mpfbPoses.ts), or a looping Mixamo
 * animation (`mixamo:<file>`, see constants/mixamoPoses.ts).
 */
export type PoseType = BuiltinPose | `mpfb:${string}` | `mixamo:${string}`;

/** A facial expression the character holds (the face is neutral when none is chosen). */
export type ExpressionId = 'neutral' | 'smile' | 'sad' | 'angry' | 'surprise' | 'pout' | 'sneer' | 'wink' | 'joy';

export type EnvironmentType =
  | 'lanterns'
  | 'bamboo'
  | 'snow'
  | 'neon'
  | 'lotus'
  | 'crystal'
  | 'demon_slayer'
  | 'japan'
  | 'cultivation'
  | 'celestial'
  | 'demon_realm'
  | 'desert'
  | 'military'
  | 'warzone'
  | 'pubg_aircraft'
  | 'pubg_airbase'
  | 'pubg_containers';

export type CameraViewPreset = 
  | 'face' 
  | 'portrait' 
  | 'waist' 
  | 'full' 
  | 'shoes';

export interface BodySliders {
  height: number;           // 0.8 - 1.2
  headSize: number;         // 0.85 - 1.15
  neckThickness: number;    // 0.8 - 1.2
  shoulderWidth: number;    // 0.8 - 1.3
  chestSize: number;        // 0.6 - 1.5 (bust: cup size + chest girth)
  bodyFat: number;          // -1 - 1 (MPFB weight macro)
  muscleTone: number;       // -1 - 1 (MPFB muscle macro)
  ageShift: number;         // -1 (younger) - 1 (older) (MPFB age macro)
  raceAfrican: number;      // -1 - 1 MPFB race macro: toward (+) / away from (-) African / Asian / Caucasian features
  raceAsian: number;
  raceCaucasian: number;
  waistWidth: number;       // 0.7 - 1.3
  pelvisWidth: number;      // 0.8 - 1.4 (Hip width)
  armThickness: number;     // 0.8 - 1.3
  handSize: number;         // 0.8 - 1.2
  thighThickness: number;   // 0.7 - 1.4
  calfThickness: number;    // 0.8 - 1.3
  footSize: number;         // 0.8 - 1.2
  legLength: number;        // 0.9 - 1.2 (Long runway legs)
  // Offsets (0 = default, -1..1)
  neckLength: number;
  shoulderSlope: number;
  torsoLength: number;
  chestHeight: number;
  chestSpacing: number;
  abdomen: number;
  glutes: number;
  armLength: number;
  pectoral: number;
  backMuscle: number;
  armMuscle: number;
  armFat: number;
  shoulderMuscle: number;
  thighMuscle: number;
  thighFat: number;
  calfMuscle: number;
  bellyTone: number;
  torsoDepth: number;
  torsoWidth: number;
  underbust: number;
  waistToHip: number;
  hipDepth: number;
  navel: number;
  kneeSize: number;
  legShape: number;
  ankleSize: number;
  wristSize: number;
  fingerLength: number;
  fingerThick: number;
  elbowDimples: number;
  armLowerShape: number;
  armUpperShape: number;
  wristUlna: number;
  armpit: number;
  knuckles: number;
  fingerShape: number;
  handHypothenar: number;
  handThenar: number;
}

export interface FaceSliders {
  jawWidth: number;         // 0.7 - 1.3
  chinLength: number;       // 0.8 - 1.2
  chinProtrusion: number;   // 0.8 - 1.2
  cheekbones: number;       // 0.8 - 1.2
  eyeSize: number;          // 0.7 - 1.4
  eyeSpacing: number;       // 0.8 - 1.2
  eyeAngle: number;         // -0.3 - 0.3 (slant/tilt)
  noseHeight: number;       // 0.8 - 1.2
  noseWidth: number;        // 0.8 - 1.2
  mouthWidth: number;       // 0.8 - 1.2
  lipFullness: number;      // 0.7 - 1.5
  lipSmile: number;         // -0.2 - 0.3
  // Offsets (0 = default, -1..1)
  faceWidth: number;
  faceLength: number;
  foreheadHeight: number;
  foreheadWidth: number;
  cheekFullness: number;
  eyeHeight: number;
  eyeWidth: number;
  eyeOuterCorner: number;
  irisSize: number;
  browHeight: number;
  browAngle: number;
  browLength: number;
  browThickness: number;
  browSpacing: number;
  noseLength: number;
  noseBridgeWidth: number;
  noseTipWidth: number;
  noseVertical: number;
  noseProjection: number;
  mouthHeight: number;
  upperLip: number;
  lowerLip: number;
  mouthProtrusion: number;
  chinWidth: number;
  jawBackWidth: number;
  chinAngle: number;
  headRound: number;
  headSquare: number;
  headTriangle: number;
  headDepth: number;
  skullBack: number;
  faceFat: number;
  earSize: number;
  earHeight: number;
  earPointed: number;
  earWing: number;
  earLobe: number;
  earRotation: number;
  eyeEpicanthus: number;
  eyeBag: number;
  eyeFold: number;
  eyeDepth: number;
  noseCompression: number;
  noseCurve: number;
  noseFlaring: number;
  nostrilWidth: number;
  noseTilt: number;
  noseBase: number;
  cupidsBow: number;
  philtrum: number;
  mouthDimples: number;
  lowerLipWidth: number;
  chinCleft: number;
  cheekHeight: number;
  cheekHollow: number;
  foreheadSlope: number;
  foreheadBulge: number;
  earFlap1: number;
  earFlap2: number;
  earFlap3: number;
  earFlapBottom: number;
  earCanal: number;
  earDetail: number;
  earIn: number;
  earFlatten: number;
  cheekFull: number;
  cheekChipmunkHigh: number;
  cheekChipmunkLow: number;
  jowls: number;
  noseBulbous: number;
  noseWidening: number;
  noseGreek: number;
  noseColumella: number;
  alarRounding: number;
  alarCrease: number;
  nostrilBean: number;
  nostrilDeepen: number;
  nostrilRim: number;
  nostrilShrink: number;
  nostrilUp: number;
  noseHoleCenter: number;
  noseHoleUp: number;
  nasolabialSharp: number;
  nasolabialCrease: number;
}

export interface CosmeticColors {
  skinTone: string;
  skinGloss: number;        // 0 - 1 (BnS signature oily/glossy skin shine)
  eyeIrisColor: string;
  pupilStyle: 'round' | 'cat' | 'flower' | 'dragon';
  /** Ready-made eye texture (constants/eyes.ts); undefined = the built-in eye with the iris colour and pupil above. */
  eyeStyle?: string;
  eyeshadowColor: string;
  eyeshadowIntensity: number;
  lipColor: string;
  /** true = no lipstick (bare lips) */
  lipOff?: boolean;
  /** Lipstick opacity/intensity, 0 = subtle and 1 = full colour. */
  lipIntensity: number;
  lipGloss: number;
  blushColor: string;
  blushIntensity: number;
  faceMarking: 'none' | 'phoenix_bindi' | 'dragon_claw' | 'hongmoon_rune' | 'shadow_fox' | 'gold_lotus';
  faceMarkingColor: string;
  
  // Outfit colour overrides (empty/undefined = the costume's own colours)
  outfitMain?: string;
  outfitAccent?: string;
  /** Colour of each worn piece by slot id (outfit, top, pants, shoes, hat …); wins over outfitMain / outfitAccent. */
  wearColors?: Record<string, string>;

  // Hair
  hairStyle: string;
  hairColorPrimary: string;
  hairColorTips: string;
  hairGloss: number;

  // Lyn Specific
  earType: 'fox' | 'cat' | 'bunny' | 'bear';
  tailType: 'fox_bushy' | 'cat_slender' | 'bunny_fluffy' | 'wolf_spiked';
  furColorPrimary: string;
  furColorSecondary: string;
}

export interface CharacterState {
  name: string;
  race: RaceType;
  gender: GenderType;
  characterClass: ClassType;
  costume: string;
  /** MPFB shoes asset id; undefined = default shoes, 'none' = barefoot. */
  shoes?: string;
  /** MPFB hat asset id; undefined = no hat. */
  hat?: string;
  pose: PoseType;
  environment: EnvironmentType;
  /** Voice id from constants/voices.ts */
  voice: string;
  /** MPFB assets worn in the other equipment slots (top, pants, skirt, jewelry, accessory, beard, eyebrows, eyelashes). */
  gear?: Partial<Record<string, string>>;
  /** Facial expression held on the stage (not part of the look: it is neutral again when the character is opened). */
  expression?: ExpressionId;
  /** Weapon form chosen in the class step (constants/weaponStyles.ts); undefined = standard. */
  weaponStyle?: string;
  /** MPFB skin texture id (public/models/skins); undefined = the default for the gender. */
  skin?: string;
  lightAngle: number; // 0 - 360 degrees
  body: BodySliders;
  face: FaceSliders;
  cosmetics: CosmeticColors;
}

export interface RaceInfo {
  id: RaceType;
  name: string;
  title: string;
  lore: string;
  emblem: string;
  availableGenders: GenderType[];
  availableClasses: ClassType[];
  traits: string[];
}

export interface ClassInfo {
  id: ClassType;
  name: string;
  title: string;
  role: string;
  difficulty: number; // 1 - 5
  weaponName: string;
  description: string;
  primaryElement: string;
  color: string;
  badge: string;
}

export interface MasterPreset {
  id: string;
  name: string;
  characterTitle: string;
  description: string;
  race: RaceType;
  gender: GenderType;
  characterClass: ClassType;
  costume: string;
  body: Partial<BodySliders>;
  face: Partial<FaceSliders>;
  cosmetics: CosmeticColors;
}
