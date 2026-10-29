"""
Converts the MPFB skin textures to web-sized WebP files and writes public/models/skins/manifest.json.

  blender -b --python mpfb/build_skins.py
  -> public/models/skins/<id>.webp   and   manifest.json  [{id, name, gender, color}]

All MPFB skins share the body UV layout, so the app only has to swap the diffuse map.
"""
import bpy, os, json, re
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.expanduser('~/Library/Application Support/Blender/5.2/mpfb/data/skins')
OUT = os.path.join(ROOT, 'public', 'models', 'skins')
os.makedirs(OUT, exist_ok=True)

AGE = {'young': 'Trẻ', 'middleage': 'Trung niên', 'old': 'Già'}
ETH = {'african': 'Châu Phi', 'asian': 'Châu Á', 'caucasian': 'Châu Âu'}

manifest = []
for sid in sorted(os.listdir(DATA)):
    folder = os.path.join(DATA, sid)
    mat = os.path.join(folder, sid + '.mhmat')
    if not os.path.exists(mat):
        continue
    tex = None
    for line in open(mat, encoding='utf-8', errors='ignore'):
        if line.startswith('diffuseTexture'):
            tex = line.split(None, 1)[1].strip()
            break
    if not tex or not os.path.exists(os.path.join(folder, tex)):
        print('skip', sid)
        continue
    img = bpy.data.images.load(os.path.join(folder, tex))
    if img.size[0] > 2048:
        img.scale(2048, 2048)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    step = max(1, len(px) // 40000)
    mean = px[::step, :3].mean(axis=0)
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 85
    scene.render.image_settings.color_mode = 'RGB'
    img.save_render(os.path.join(OUT, sid + '.webp'), scene=scene)
    m = re.match(r'(young|middleage|old)_(african|asian|caucasian)_(female|male)', sid)
    gender = m.group(3) if m else 'both'
    if m:
        name = f'{AGE[m.group(1)]} · {ETH[m.group(2)]}' + (' ' + sid[-1] if sid[-1].isdigit() else '')
    else:
        name = 'Hoạt hình'
    if 'special_suit' in sid:
        name += ' (đồ bó)'
    manifest.append({'id': sid, 'name': name, 'gender': gender, 'color': '#%02x%02x%02x' % tuple(int(round(float(c) * 255)) for c in mean)})
    bpy.data.images.remove(img)
    print('ok', sid, manifest[-1]['color'])
custom_path = os.path.join(OUT, 'custom.json')
if os.path.exists(custom_path):
    custom = json.load(open(custom_path))
    for skin in custom:
        if os.path.exists(os.path.join(OUT, skin['id'] + '.webp')):
            manifest = [entry for entry in manifest if entry['id'] != skin['id']]
            manifest.append(skin)
manifest.sort(key=lambda skin: skin['id'])
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
print('DONE skins', len(manifest))
