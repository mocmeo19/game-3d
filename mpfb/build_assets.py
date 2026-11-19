"""
Exports every asset of mpfb/catalog.json (hair, brows, lashes, clothes, shoes, hats, jewelry ...) as its own GLB
(skinned to the same rig, one morph per app slider) plus a thumbnail, and writes a manifest the app reads.

  python3 mpfb/catalog.py                       # once, after installing asset packs
  blender -b --python mpfb/build_assets.py -- --gender female [--only id1,id2] [--force]
  -> public/models/assets/<id>.<gender>.glb / .png   and  public/models/assets/manifest.<gender>.json

Assets that fail to import are skipped and listed in mpfb/out/failed.<gender>.json. Existing outputs are kept unless --force.
"""
import sys, os, time, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

GENDER = arg('--gender', 'female')
ONLY = [x for x in arg('--only', '').split(',') if x]
FORCE = '--force' in argv_after_dashes()
OUT = os.path.join(ROOT, 'public', 'models', 'assets')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)

catalog = json.load(open(os.path.join(HERE, 'catalog.json')))
jobs = [e for e in catalog if GENDER in e['genders'] and (not ONLY or e['id'] in ONLY)]

body, rig = new_human(GENDER, skin='young_asian_' + GENDER)
made = add_slider_morphs(body)
cam, cam_data = setup_preview_scene((400, 560))

manifest_path = os.path.join(OUT, f'manifest.{GENDER}.json')
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
failed = {}

MPFB_TYPE = {'hair': 'Hair', 'eyebrows': 'Eyebrows', 'eyelashes': 'Eyelashes', 'teeth': 'Teeth'}


def thumbnail(obj, path):
    xs = [v.co.x for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    w, h = max(xs) - min(xs), max(zs) - min(zs)
    size = max(h, w * 560 / 400, 0.12) * 1.18
    cam.location = ((max(xs) + min(xs)) / 2, -6, (max(zs) + min(zs)) / 2)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam_data.ortho_scale = size
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


done = 0
for e in jobs:
    aid = e['id']
    fname = f'{aid}.{GENDER}'
    glb = os.path.join(OUT, fname + '.glb')
    if not FORCE and aid in manifest and os.path.exists(glb):
        continue
    t0 = time.time()
    obj = None
    try:
        mhclo = os.path.join(ASSETS, e['rel'])
        obj = HumanService.add_mhclo_asset(mhclo, body, asset_type=MPFB_TYPE.get(e['dir'], 'Clothes'), subdiv_levels=0, material_type='GAMEENGINE')
        obj.name = aid
        hidden = delete_group_indices(body, mhclo)
        fit_morphs(obj, mhclo, body, made)
        # thumbnails come from build_thumbs.py (item only, transparent background); make one here only if there is none
        if not os.path.exists(os.path.join(OUT, fname + '.png')):
            thumbnail(obj, os.path.join(OUT, fname + '.png'))

        # keep the cloth / hair pattern but make it a neutral luminance map so the app can recolour it
        avg = None
        for slot in obj.material_slots:
            if slot.material and slot.material.use_nodes:
                for n in slot.material.node_tree.nodes:
                    if n.type == 'TEX_IMAGE' and n.image:
                        low = n.image.name.lower()
                        if 'normal' not in low and '_ao' not in low and 'spec' not in low and 'bump' not in low:
                            c = normalize_albedo(n.image)
                            if avg is None:
                                avg = c
        shrink_images(1024)
        export_glb([obj, rig], glb)
        entry = {'id': aid, 'slot': e['slot'], 'name': e['name'], 'category': e['category'], 'author': e['author'],
                 'license': e['license'], 'genders': e['genders'], 'file': fname, 'hide': hidden}
        if avg:
            entry['color'] = '#%02x%02x%02x' % tuple(int(round(max(0.0, min(1.0, x)) * 255)) for x in avg)  # pixels are sRGB already
        manifest[aid] = entry
        done += 1
        print(f'ok {aid} {time.time() - t0:.1f}s', flush=True)
    except Exception as ex:  # one broken asset must not stop the batch
        failed[aid] = str(ex)[:200]
        print(f'FAIL {aid}: {ex}', flush=True)
        traceback.print_exc()
    finally:
        try:
            if obj is not None and obj.name in bpy.data.objects:
                bpy.data.objects.remove(obj, do_unlink=True)
            for g in [g for g in body.vertex_groups if g.name.startswith('Delete.')]:
                body.vertex_groups.remove(g)
            bpy.data.orphans_purge(do_recursive=True)
        except Exception:
            pass
        if done and done % 10 == 0:
            json.dump(manifest, open(manifest_path, 'w'), ensure_ascii=False)

json.dump(manifest, open(manifest_path, 'w'), ensure_ascii=False)
json.dump(failed, open(os.path.join(HERE, 'out', f'failed.{GENDER}.json'), 'w'), indent=1)
print('DONE assets', GENDER, 'built', done, 'failed', len(failed))
