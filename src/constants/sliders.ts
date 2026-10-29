import { DEFAULT_BODY, DEFAULT_FACE } from './presets';

export interface SliderDef {
  key: string;
  label: string;
  ko: string;
  min: number;
  max: number;
  step: number;
  def: number;
  uiSpan?: number;
  morphGain?: number;
}

export const DEFAULT_MORPH_GAIN = 0.55;
const BODY_RANGE_MULTIPLIER = 1.5;
const DEMOGRAPHIC_SLIDERS = new Set(['ageShift', 'raceAsian', 'raceCaucasian', 'raceAfrican']);

export interface SliderGroup {
  id: string;
  ko: string;
  en: string;
  sliders: SliderDef[];
}

/** Multiplier-style slider (1.0 = default). */
const mul = (key: string, ko: string, label: string, min: number, max: number, def: number, step = 0.02): SliderDef => ({
  key, ko, label, min, max, step, def
});

/** Offset-style slider (0 = default, −1…+1). */
const off = (key: string, ko: string, label: string, def = 0): SliderDef => ({
  key, ko, label, min: -1, max: 1, step: 0.05, def
});

/** One-sided slider (0 = default, up to +1; MPFB has a single target for it). */
const uni = (key: string, ko: string, label: string, def = 0): SliderDef => ({
  key, ko, label, min: 0, max: 1, step: 0.05, def
});

const F = DEFAULT_FACE;
const B = DEFAULT_BODY;

export const FACE_GROUPS: SliderGroup[] = [
  {
    id: 'face', ko: 'Khuôn mặt', en: 'Face',
    sliders: [
      off('faceWidth', 'Độ rộng mặt', 'Face width'),
      off('faceLength', 'Chiều dài mặt', 'Face length'),
      off('foreheadHeight', 'Độ cao trán', 'Forehead height'),
      off('foreheadWidth', 'Độ rộng trán', 'Forehead width'),
      mul('cheekbones', 'Hình xương gò má', 'Cheekbones', 0.8, 1.2, F.cheekbones),
      off('cheekFullness', 'Má', 'Cheek fullness')
    ]
  },
  {
    id: 'eyes', ko: 'Mắt', en: 'Eyes',
    sliders: [
      off('eyeHeight', 'Vị trí mắt', 'Eye height'),
      mul('eyeSpacing', 'Khoảng cách mắt', 'Eye distance', 0.85, 1.15, F.eyeSpacing),
      mul('eyeSize', 'Kích thước mắt', 'Eye size', 0.75, 1.4, F.eyeSize),
      off('eyeWidth', 'Độ mở mắt', 'Eye opening'),
      { key: 'eyeAngle', ko: 'Độ xếch mắt', label: 'Eye slant', min: -0.2, max: 0.25, step: 0.01, def: F.eyeAngle },
      off('eyeOuterCorner', 'Đuôi mắt', 'Outer corner'),
      off('irisSize', 'Cỡ mống mắt', 'Iris size'),
      off('eyeEpicanthus', 'Mí lót (nếp gấp góc mắt)', 'Epicanthic fold'),
      off('eyeBag', 'Bọng mắt', 'Eye bags'),
      off('eyeFold', 'Nếp mí mắt', 'Eyelid fold'),
      off('eyeDepth', 'Độ sâu hốc mắt', 'Eye socket depth')
    ]
  },
  {
    id: 'brows', ko: 'Lông mày', en: 'Eyebrows',
    sliders: [
      off('browHeight', 'Vị trí lông mày', 'Brow height'),
      off('browAngle', 'Góc lông mày', 'Brow angle')
    ]
  },
  {
    id: 'nose', ko: 'Mũi', en: 'Nose',
    sliders: [
      off('noseVertical', 'Vị trí mũi', 'Nose position'),
      off('noseLength', 'Chiều dài mũi', 'Nose length'),
      mul('noseHeight', 'Độ cao sống mũi', 'Bridge height', 0.8, 1.25, F.noseHeight),
      off('noseBridgeWidth', 'Độ rộng sống mũi', 'Bridge width'),
      mul('noseWidth', 'Độ rộng mũi', 'Nose width', 0.8, 1.2, F.noseWidth),
      off('noseTipWidth', 'Độ rộng đầu mũi', 'Tip width'),
      off('noseProjection', 'Độ nhô đầu mũi', 'Tip projection'),
      off('noseCompression', 'Mũi dẹt ↔ cao', 'Nose compression'),
      off('noseCurve', 'Sống mũi lồi ↔ lõm', 'Nose curve'),
      off('noseFlaring', 'Cánh mũi', 'Nose flaring'),
      off('nostrilWidth', 'Độ rộng lỗ mũi', 'Nostril width'),
      off('noseTilt', 'Đầu mũi hếch', 'Nose tip tilt'),
      off('noseBase', 'Chân mũi', 'Nose base'),
      uni('noseBulbous', 'Mũi củ tỏi', 'Bulbous nose'),
      uni('noseWidening', 'Mũi bè', 'Nose widening'),
      uni('noseGreek', 'Mũi tượng Hy Lạp', 'Greek statue nose'),
      uni('noseColumella', 'Vách mũi thẳng', 'Straight columella'),
      uni('alarRounding', 'Cánh mũi tròn', 'Alar rounding'),
      uni('alarCrease', 'Nếp cánh mũi', 'Alar crease'),
      uni('nostrilBean', 'Lỗ mũi hạt đậu', 'Bean-shaped nostril'),
      uni('nostrilDeepen', 'Lỗ mũi sâu', 'Nostril depth'),
      uni('nostrilRim', 'Viền lỗ mũi sắc', 'Sharp nostril rim'),
      uni('nostrilShrink', 'Lỗ mũi nhỏ lại', 'Nostril shrink'),
      uni('nostrilUp', 'Lỗ mũi hếch lên', 'Nostril up'),
      uni('noseHoleCenter', 'Lỗ mũi lệch tâm', 'Nostril centre'),
      uni('noseHoleUp', 'Lỗ mũi ngửa', 'Nostril tilt up'),
      uni('nasolabialSharp', 'Góc mũi–môi nhọn', 'Nasolabial sharp angle'),
      uni('nasolabialCrease', 'Rãnh mũi–môi', 'Nasolabial crease')
    ]
  },
  {
    id: 'mouth', ko: 'Miệng', en: 'Mouth',
    sliders: [
      off('mouthHeight', 'Vị trí miệng', 'Mouth position'),
      mul('mouthWidth', 'Độ rộng miệng', 'Mouth width', 0.8, 1.2, F.mouthWidth),
      off('upperLip', 'Môi trên', 'Upper lip'),
      off('lowerLip', 'Môi dưới', 'Lower lip'),
      mul('lipFullness', 'Độ dày môi', 'Lip fullness', 0.7, 1.5, F.lipFullness),
      { key: 'lipSmile', ko: 'Khóe miệng', label: 'Mouth corners', min: -0.2, max: 0.3, step: 0.02, def: F.lipSmile },
      off('mouthProtrusion', 'Độ chu môi', 'Protrusion'),
      off('cupidsBow', 'Cung môi trên', 'Cupid\'s bow'),
      off('philtrum', 'Rãnh nhân trung', 'Philtrum'),
      off('mouthDimples', 'Lúm đồng tiền', 'Dimples'),
      off('lowerLipWidth', 'Độ rộng môi dưới', 'Lower lip width')
    ]
  },
  {
    id: 'chin', ko: 'Cằm', en: 'Chin & jaw',
    sliders: [
      mul('chinLength', 'Chiều dài cằm', 'Chin length', 0.8, 1.25, F.chinLength),
      off('jawBackWidth', 'Độ rộng hàm sau', 'Rear jaw width'),
      mul('jawWidth', 'Độ rộng hàm', 'Jaw width', 0.7, 1.3, F.jawWidth),
      off('chinWidth', 'Độ rộng đầu cằm', 'Chin tip width'),
      mul('chinProtrusion', 'Độ nhô cằm', 'Chin projection', 0.8, 1.2, F.chinProtrusion),
      off('chinAngle', 'Góc cằm', 'Chin angle'),
      off('chinCleft', 'Cằm chẻ', 'Chin cleft'),
      off('cheekHeight', 'Vị trí gò má', 'Cheek height'),
      off('cheekHollow', 'Má hóp ↔ đầy', 'Cheek hollow'),
      off('foreheadSlope', 'Trán dốc ↔ thẳng', 'Forehead slope'),
      off('foreheadBulge', 'Trán nhô', 'Forehead bulge')
    ]
  },
  {
    id: 'headshape', ko: 'Dáng đầu', en: 'Head shape',
    sliders: [
      off('headRound', 'Đầu tròn ↔ oval', 'Head round / oval'),
      off('headSquare', 'Đầu vuông ↔ chữ nhật', 'Head square / rectangular'),
      off('headTriangle', 'Đầu tam giác ↔ ngược', 'Head triangular / inverted'),
      off('headDepth', 'Độ sâu đầu', 'Head depth'),
      off('skullBack', 'Độ nhô sau đầu', 'Back of skull'),
      off('faceFat', 'Độ đầy mặt', 'Face fat')
    ]
  },
  {
    id: 'ears', ko: 'Tai', en: 'Ears',
    sliders: [
      off('earSize', 'Cỡ tai', 'Ear size'),
      off('earHeight', 'Vị trí tai', 'Ear height'),
      off('earPointed', 'Tai nhọn ↔ tròn', 'Ear pointed / round'),
      off('earWing', 'Độ vểnh tai', 'Ear wing'),
      off('earLobe', 'Dái tai', 'Ear lobe'),
      off('earRotation', 'Độ xoay tai', 'Ear rotation'),
      uni('earFlap1', 'Tai vểnh kiểu 1', 'Flap ears 1'),
      uni('earFlap2', 'Tai vểnh kiểu 2', 'Flap ears 2'),
      uni('earFlap3', 'Tai vểnh kiểu 3', 'Flap ears 3'),
      uni('earFlapBottom', 'Dái tai vểnh ra', 'Ear bottom flap'),
      uni('earCanal', 'Ống tai', 'Ear canal'),
      uni('earDetail', 'Chi tiết vành tai', 'Ear detail'),
      uni('earIn', 'Tai áp vào đầu', 'Ear tucked in'),
      uni('earFlatten', 'Tai dẹt', 'Ear flatten')
    ]
  },
  {
    id: 'cheek', ko: 'Má', en: 'Cheeks',
    sliders: [
      off('cheekFull', 'Gò má đầy ↔ hóp', 'Cheekbone full / sunken'),
      uni('cheekChipmunkHigh', 'Má phính trên', 'Chipmunk cheeks (high)'),
      uni('cheekChipmunkLow', 'Má phính dưới', 'Chipmunk cheeks (low)'),
      uni('jowls', 'Má xệ', 'Jowls')
    ]
  }
];

export const BODY_GROUPS: SliderGroup[] = [
  {
    id: 'overall', ko: 'Tổng thể', en: 'Overall',
    sliders: [
      mul('height', 'Chiều cao', 'Height', 0.8, 1.25, B.height),
      mul('headSize', 'Cỡ đầu', 'Head size', 0.85, 1.15, B.headSize),
      off('neckLength', 'Chiều dài cổ', 'Neck length'),
      mul('neckThickness', 'Độ dày cổ', 'Neck thickness', 0.8, 1.2, B.neckThickness),
      off('bodyFat', 'Độ béo / gầy', 'Body fat'),
      off('muscleTone', 'Độ cơ bắp', 'Muscle'),
      off('ageShift', 'Tuổi (trẻ ↔ già)', 'Age'),
      off('raceAsian', 'Nét Châu Á', 'Asian features'),
      off('raceCaucasian', 'Nét Châu Âu', 'Caucasian features'),
      off('raceAfrican', 'Nét Châu Phi', 'African features')
    ]
  },
  {
    id: 'upper', ko: 'Thượng thể', en: 'Upper body',
    sliders: [
      mul('shoulderWidth', 'Độ rộng vai', 'Shoulder width', 0.8, 1.35, B.shoulderWidth),
      off('shoulderSlope', 'Độ dốc vai', 'Shoulder slope'),
      mul('chestSize', 'Cỡ ngực (cup)', 'Bust size', 0.6, 1.5, B.chestSize),
      off('chestHeight', 'Vị trí ngực', 'Chest height'),
      off('chestSpacing', 'Khoảng cách ngực', 'Chest spacing'),
      off('torsoLength', 'Chiều dài thân trên', 'Torso length'),
      mul('waistWidth', 'Độ rộng eo', 'Waist width', 0.7, 1.3, B.waistWidth),
      off('abdomen', 'Bụng', 'Abdomen')
    ]
  },
  {
    id: 'arms', ko: 'Tay', en: 'Arms',
    sliders: [
      off('armLength', 'Chiều dài tay', 'Arm length'),
      mul('armThickness', 'Độ dày tay', 'Arm thickness', 0.8, 1.35, B.armThickness),
      mul('handSize', 'Cỡ bàn tay', 'Hand size', 0.8, 1.2, B.handSize)
    ]
  },
  {
    id: 'lower', ko: 'Hạ thể', en: 'Lower body',
    sliders: [
      mul('pelvisWidth', 'Độ rộng hông', 'Hip width', 0.8, 1.4, B.pelvisWidth),
      off('glutes', 'Kích thước mông', 'Glute size'),
      mul('legLength', 'Chiều dài chân', 'Leg length', 0.9, 1.25, B.legLength),
      mul('thighThickness', 'Độ dày đùi', 'Thigh thickness', 0.7, 1.4, B.thighThickness),
      mul('calfThickness', 'Độ dày bắp chân', 'Calf thickness', 0.8, 1.3, B.calfThickness),
      mul('footSize', 'Cỡ bàn chân', 'Foot size', 0.8, 1.2, B.footSize)
    ]
  },
  {
    id: 'muscle', ko: 'Cơ bắp & mỡ', en: 'Muscle & fat',
    sliders: [
      off('pectoral', 'Cơ ngực', 'Pectoral muscle'),
      off('backMuscle', 'Cơ lưng', 'Back muscle'),
      off('armMuscle', 'Cơ tay', 'Arm muscle'),
      off('armFat', 'Mỡ tay', 'Arm fat'),
      off('shoulderMuscle', 'Cơ vai', 'Shoulder muscle'),
      off('thighMuscle', 'Cơ đùi', 'Thigh muscle'),
      off('thighFat', 'Mỡ đùi', 'Thigh fat'),
      off('calfMuscle', 'Cơ bắp chân', 'Calf muscle'),
      off('bellyTone', 'Cơ bụng săn', 'Abdominal tone')
    ]
  },
  {
    id: 'torso2', ko: 'Thân & hông chi tiết', en: 'Torso detail',
    sliders: [
      off('torsoDepth', 'Độ dày thân (trước–sau)', 'Torso depth'),
      off('torsoWidth', 'Độ rộng thân', 'Torso width'),
      off('underbust', 'Vòng dưới ngực', 'Underbust'),
      off('waistToHip', 'Eo – hông (chiều cao)', 'Waist to hip'),
      off('hipDepth', 'Độ dày hông', 'Hip depth'),
      off('navel', 'Rốn', 'Navel')
    ]
  },
  {
    id: 'limbs2', ko: 'Chi chi tiết', en: 'Limb detail',
    sliders: [
      off('kneeSize', 'Cỡ đầu gối', 'Knee size'),
      off('legShape', 'Chân chữ X ↔ chữ O', 'Leg alignment'),
      off('ankleSize', 'Cỡ cổ chân', 'Ankle size'),
      off('wristSize', 'Cỡ cổ tay', 'Wrist size'),
      off('fingerLength', 'Độ dài ngón tay', 'Finger length'),
      off('fingerThick', 'Độ dày ngón tay', 'Finger thickness')
    ]
  },
  {
    id: 'arms2', ko: 'Tay & bàn tay chi tiết', en: 'Arm & hand detail',
    sliders: [
      uni('elbowDimples', 'Lúm khuỷu tay', 'Elbow dimples'),
      uni('armLowerShape', 'Dáng cẳng tay', 'Forearm shape'),
      uni('armUpperShape', 'Dáng bắp tay', 'Upper-arm shape'),
      uni('wristUlna', 'Xương cổ tay', 'Wrist bone'),
      uni('armpit', 'Nách', 'Armpit'),
      uni('knuckles', 'Khớp ngón nhô', 'Knobby knuckles'),
      uni('fingerShape', 'Chỉnh dáng ngón', 'Finger correction'),
      uni('handHypothenar', 'Gò bàn tay (út)', 'Hypothenar'),
      uni('handThenar', 'Gò bàn tay (cái)', 'Thenar eminence')
    ]
  }
];

for (const group of BODY_GROUPS) {
  group.sliders = group.sliders.map((slider) => DEMOGRAPHIC_SLIDERS.has(slider.key) ? slider : {
    ...slider,
    min: Number((slider.def - (slider.def - slider.min) * BODY_RANGE_MULTIPLIER).toFixed(3)),
    max: Number((slider.def + (slider.max - slider.def) * BODY_RANGE_MULTIPLIER).toFixed(3)),
    uiSpan: 20 * BODY_RANGE_MULTIPLIER,
    morphGain: DEFAULT_MORPH_GAIN * BODY_RANGE_MULTIPLIER,
  });
}

export const FACE_SLIDERS: SliderDef[] = FACE_GROUPS.flatMap((g) => g.sliders);
export const BODY_SLIDERS: SliderDef[] = BODY_GROUPS.flatMap((g) => g.sliders);

/** The handful of sliders shown inline on the Basic tab. */
export const FACE_BASE_KEYS = ['faceWidth', 'jawWidth', 'chinLength', 'eyeSize', 'noseHeight', 'lipFullness'];
export const BODY_BASE_KEYS = [
  'height', 'bodyFat', 'muscleTone', 'chestSize', 'waistWidth', 'glutes', 'legLength'
];
