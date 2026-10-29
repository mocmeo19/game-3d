import { CharacterState } from '../../types/character';
import { DESIGNER_PRESETS, DesignerPreset } from '../../constants/designerPresets';
import { withThumbRig } from './markingThumbs';

/**
 * "Mẫu thiết kế" thumbnails: each designer preset (face sliders, skin tone, hair and lip colour) applied to the real avatar of
 * the current gender / skin and photographed head-on. The shipped images in public/designer/jin_<gender>/ were made with
 * this function (one call per gender with the default skin, each image saved as a 200px WebP); the panel only loads those files.
 * To regenerate them, call this from a dev hook for each gender and save the results.
 */

const cache = new Map<string, Promise<Record<string, string>>>();

const withPreset = (state: CharacterState, p: DesignerPreset): CharacterState => ({
  ...state,
  face: { ...p.face },
  costume: 'none',
  pose: 'idle',
  gear: {},
  hat: undefined,
  cosmetics: {
    ...state.cosmetics,
    skinTone: p.skinTone,
    hairStyle: p.hairStyle,
    hairColorPrimary: p.hairColorPrimary,
    hairColorTips: p.hairColorTips,
    lipColor: p.lipColor,
    lipOff: false,
    faceMarking: 'none'
  }
});

export const designerThumbs = (state: CharacterState): Promise<Record<string, string>> => {
  const key = [state.gender, state.skin ?? '', state.body.height].join('|');
  let p = cache.get(key);
  if (!p) {
    p = withThumbRig(state.gender, async (s) => {
      const out: Record<string, string> = {};
      // first pass loads every hair style once, so the shots below do not wait on the network
      for (const preset of DESIGNER_PRESETS) {
        s.avatar.apply(withPreset(state, preset));
        await s.avatar.settled();
      }
      await new Promise((r) => setTimeout(r, 400));
      for (const preset of DESIGNER_PRESETS) {
        s.avatar.apply(withPreset(state, preset));
        await s.avatar.settled();
        s.avatar.group.visible = true;
        s.scene.updateMatrixWorld(true);
        const a = s.avatar.anchors();
        const y = a.headY - 0.06 * a.scale;
        s.camera.position.set(0, y, 1.35 * a.scale + 0.15);
        s.camera.lookAt(0, y, 0);
        s.renderer.render(s.scene, s.camera);
        out[preset.id] = s.renderer.domElement.toDataURL('image/png');
      }
      return out;
    });
    cache.set(key, p);
    if (cache.size > 8) cache.delete(cache.keys().next().value as string);
  }
  return p;
};
