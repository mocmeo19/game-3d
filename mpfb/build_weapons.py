"""
MPFB carried weapons / tools as static props:

  blender -b --python mpfb/build_weapons.py
  -> public/models/weapons/<part>.glb      (no skin: the vertices stay where MPFB modelled them, around the character's hand in the
                                            bind pose; the app places them with the hand bone's bind matrix)
     public/models/weapons/<option>.png    (side view of the whole option, nothing else in the picture)
     src/constants/weaponModels.ts

An option is one or more parts: `hand` is the side whose hand holds it (R when the part lies on the character's right, x < 0).
"""
import sys, os, json, glob, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import bmesh

OUT = os.path.join(ROOT, 'public', 'models', 'weapons')
os.makedirs(OUT, exist_ok=True)

# option id -> (Vietnamese name, [source folder ...], split by side)
OPTIONS = {
    'crude_sword': ('Kiếm thô', ['joepal_crude_sword'], False),
    'war_hammer': ('Chiến chùy', ['culturalibre_war_hammer'], False),
    'forge_hammer': ('Búa rèn', ['maciekg_hammer'], False),
    'wooden_bow': ('Cung gỗ', ['culturalibre_wooden_bow'], False),
    'short_bow': ('Cung ngắn', ['maciekg_short_bow'], False),
    'twin_pistols': ('Súng lục đôi', ['culturalibre_cl_gun', 'culturalibre_cl_gun_left_hand'], False),
    'm1911': ('Súng M1911', ['jaldmic_m1911a1'], False),
    'akm': ('Súng AKM', ['jaldmic_akm_base'], False),
    'l1a1': ('Súng trường L1A1', ['jaldmic_l1a1'], False),
    'sceptre': ('Quyền trượng', ['culturalibre_magic_sceptre'], False),
    'kalistick': ('Gậy Kalistick', ['culturalibre_hero_kalistick'], False),
    'claws': ('Vuốt chiến', ['culturalibre_hand_claws'], True),
    'guitar': ('Guitar điện', ['punkduck_electric_guitar'], False),
    'microphone': ('Micro', ['punkduck_microphone'], False),
    'racket': ('Vợt tennis', ['punkduck_tennis_racket'], False),
    'handbag': ('Túi xách', ['punkduck_handbag01'], False),
    'shopping_bag': ('Túi mua sắm', ['punkduck_shopping_bag01'], False),
    'sling_purse': ('Túi đeo chéo', ['elvs_sling_purse1'], False),
    'suitcase': ('Vali', ['culturalibre_suitcase'], False),
    'ivy_whip': ('Roi dây leo', ['punkduck_p-ivy_weapon'], False),
}

meta = {}
for f in glob.glob(os.path.join(ASSETS, 'packs', '*.json')):
    try:
        meta.update(json.load(open(f)))
    except Exception:
        pass

body, rig = new_human('female', skin='young_asian_female')
cam, cam_data = setup_preview_scene((480, 360))
scene = bpy.context.scene


def prop_of(folder):
    mhclo = glob.glob(os.path.join(ASSETS, 'clothes', folder, '*.mhclo'))[0]
    o = HumanService.add_mhclo_asset(mhclo, body, asset_type='Clothes', subdiv_levels=0, material_type='GAMEENGINE')
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.vertex_groups.clear()
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = o.matrix_world.__class__()
    o.name = folder
    return o


def split(o, keep_right):
    c = o.copy()
    c.data = o.data.copy()
    scene.collection.objects.link(c)
    bm = bmesh.new()
    bm.from_mesh(c.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if (v.co.x > 0) == keep_right], context='VERTS')
    bm.to_mesh(c.data)
    bm.free()
    return c


def side_of(o):
    xs = [v.co.x for v in o.data.vertices]
    return 'R' if (min(xs) + max(xs)) / 2 < 0 else 'L'


def credit(folder):
    i = meta.get(folder, {})
    return i.get('author', 'MakeHuman'), i.get('license', 'CC0')


models = []
for oid, (name, folders, do_split) in OPTIONS.items():
    try:
        objs = [prop_of(f) for f in folders]
        parts = []
        if do_split:
            base = objs[0]
            objs = [split(base, True), split(base, False)]
            bpy.data.objects.remove(base, do_unlink=True)
            for o, side in zip(objs, ('R', 'L')):
                o.name = f'{oid}_{side.lower()}'
                parts.append({'file': o.name, 'hand': side})
        else:
            for o in objs:
                o.name = f'{oid}_{side_of(o).lower()}' if len(objs) > 1 else oid
                parts.append({'file': o.name, 'hand': side_of(o)})
        shrink_images(512)
        for o, p in zip(objs, parts):
            export_glb([o], os.path.join(OUT, p['file'] + '.glb'))
        # side view of the whole option
        for o in body.children:
            pass
        body.hide_render = True
        rig.hide_render = True
        vs = [v.co for o in objs for v in o.data.vertices]
        ys = [v.y for v in vs]
        zs = [v.z for v in vs]
        cy, cz = (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2
        cam_data.ortho_scale = max((max(ys) - min(ys)) * 360 / 480, max(zs) - min(zs)) * 1.3 * 480 / 360 * 0.75 + 0.02
        cam.location = (-6, cy, cz)
        cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
        scene.render.filepath = os.path.join(OUT, oid + '.png')
        bpy.ops.render.render(write_still=True)
        a, l = credit(folders[0])
        models.append({'id': oid, 'name': name, 'parts': parts, 'author': a, 'license': l})
        print('ok', oid, parts)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print('FAILED', oid, e)

lines = ['// Generated by mpfb/build_weapons.py: do not edit.',
         'export interface WeaponModel { id: string; name: string; parts: { file: string; hand: \'R\' | \'L\' }[]; author: string; license: string }', '',
         'export const WEAPON_MODELS: WeaponModel[] = [']
for m in models:
    lines.append('  ' + json.dumps(m, ensure_ascii=False).replace('"', "'").replace("'id'", 'id').replace("'name'", 'name').replace("'parts'", 'parts').replace("'file'", 'file').replace("'hand'", 'hand').replace("'author'", 'author').replace("'license'", 'license') + ',')
lines += ['];', '', "export const weaponModelUrl = (file: string) => `/models/weapons/${file}.glb`;", "export const weaponModelIcon = (id: string) => `/models/weapons/${id}.png`;", '']
open(os.path.join(ROOT, 'src', 'constants', 'weaponModels.ts'), 'w', encoding='utf-8').write('\n'.join(lines))
print('DONE weapons', len(models))
