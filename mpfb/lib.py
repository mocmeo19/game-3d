"""Shared helpers for the MPFB build scripts (run inside Blender: blender -b --python ...)."""
import bpy, os, sys, json, gzip, math, importlib, addon_utils
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.expanduser('~/Library/Application Support/Blender/5.2/mpfb/data')
SCALE = 0.1  # basemesh scale used by create_human; target files are in MakeHuman units

addon_utils.enable('bl_ext.blender_org.mpfb', default_set=False, persistent=False)
mpfb = importlib.import_module('bl_ext.blender_org.mpfb')
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService
from bl_ext.blender_org.mpfb.services.clothesservice import ClothesService
from bl_ext.blender_org.mpfb.services.materialservice import MaterialService
from bl_ext.blender_org.mpfb.entities.clothes.mhclo import Mhclo
from bl_ext.blender_org.mpfb.entities.material.mhmaterial import MhMaterial
from bl_ext.blender_org.mpfb.entities.nodemodel.v2.materials.nodewrappergameengine import NodeWrapperGameEngine

TARGET_DIR = os.path.join(os.path.dirname(mpfb.__file__), 'data', 'targets')
RIG_JSON = os.path.join(os.path.dirname(mpfb.__file__), 'data', 'rigs', 'standard', 'rig.game_engine.json')


def argv_after_dashes():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    a = argv_after_dashes()
    return a[a.index(name) + 1] if name in a else default


# ---------------------------------------------------------------- targets
_index = {}
USER_TARGETS = os.path.expanduser('~/Library/Application Support/Blender/5.2/mpfb/data/targets')
for _root in (TARGET_DIR, USER_TARGETS):
  for _g in (os.listdir(_root) if os.path.isdir(_root) else []):
    _d = os.path.join(_root, _g)
    if os.path.isdir(_d):
        for _f in os.listdir(_d):
            if _f.endswith('.target.gz'):
                _index[_f[:-len('.target.gz')]] = os.path.join(_d, _f)
            elif _f.endswith('.target'):  # packs from the asset site ship plain-text targets
                _index.setdefault(_f[:-len('.target')], os.path.join(_d, _f))


def files_for(name):
    if name in _index:
        return [_index[name]]
    if '/' in name:  # a path below the targets folder, e.g. expression/units/caucasian/eye-left-closure
        for root in (TARGET_DIR, USER_TARGETS):
            for ext in ('.target.gz', '.target'):
                p = os.path.join(root, name + ext)
                if os.path.isfile(p):
                    return [p]
    out = [_index[p + name] for p in ('l-', 'r-') if p + name in _index]
    if not out:
        print('!! missing target', name)
    return out


def read_target(path):
    deltas = {}
    with (gzip.open(path, 'rt') if path.endswith('.gz') else open(path)) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            p = line.split()
            if len(p) >= 4:
                # target files are in MakeHuman axes (y up, z forward); the Blender mesh is z up with -y forward
                deltas[int(p[0])] = (float(p[1]) * SCALE, -float(p[3]) * SCALE, float(p[2]) * SCALE)
    return deltas


# ---------------------------------------------------------------- human
def human_macro(gender, age=0.5, weight=0.35, muscle=0.4, **over):
    """MPFB macro values: the defaults every asset is fitted to, plus per-race overrides (proportions, height, race mix ...)."""
    macro = TargetService.get_default_macro_info_dict()
    macro['gender'] = 0.0 if gender == 'female' else 1.0
    macro['age'] = age
    macro['weight'] = weight
    macro['muscle'] = muscle
    macro.update(over)
    return macro


def human_coords(macro):
    """Rest vertex positions (full basemesh, Blender axes) of a human built from macro values."""
    h = HumanService.create_human(scale=SCALE, macro_detail_dict=macro)
    bpy.context.view_layer.objects.active = h
    if h.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    co = [v.co.copy() for v in h.data.vertices]
    bpy.data.objects.remove(h, do_unlink=True)
    return co


def new_human(gender, age=0.5, weight=0.35, muscle=0.4, skin=None, **over):
    macro = human_macro(gender, age, weight, muscle, **over)
    # the race mix is only stored when a body overrides it, so macro_coords() keeps MPFB's default mix otherwise
    macro_used = {k: v for k, v in macro.items() if k != 'race' or 'race' in over}
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    body = HumanService.create_human(scale=SCALE, macro_detail_dict=macro)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    if body.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    body['_macro'] = json.dumps(macro_used)
    rig = HumanService.add_builtin_rig(body, 'game_engine', import_weights=True)
    if skin:
        HumanService.set_character_skin(os.path.join(ASSETS, 'skins', skin, skin + '.mhmat'), body, skin_type='GAMEENGINE')
    return body, rig


# sliders driven by MPFB's macro sliders (they interpolate many targets at once): slider -> macro overrides at +1 and at -1
RACE = lambda a, c, f: {'race': {'african': a, 'asian': c, 'caucasian': f}}
MACRO_SLIDERS = {
    'chestSize': ({'cupsize': 1.0}, {'cupsize': 0.0}),
    'bodyFat': ({'weight': 1.0}, {'weight': 0.0}),
    'muscleTone': ({'muscle': 1.0}, {'muscle': 0.0}),
    'ageShift': ({'age': 0.9}, {'age': 0.28}),
    'raceAfrican': (RACE(1.0, 0.0, 0.0), RACE(0.0, 0.5, 0.5)),
    'raceAsian': (RACE(0.0, 1.0, 0.0), RACE(0.5, 0.0, 0.5)),
    'raceCaucasian': (RACE(0.0, 0.0, 1.0), RACE(0.5, 0.5, 0.0)),
}


def macro_coords(body, **over):
    """Vertex positions of a fresh human built with the same macro values as `body`, with some of them overridden."""
    macro = TargetService.get_default_macro_info_dict()
    macro.update(json.loads(body['_macro']))
    macro.update(over)
    h = HumanService.create_human(scale=SCALE, macro_detail_dict=macro)
    bpy.context.view_layer.objects.active = h
    if h.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    co = [v.co.copy() for v in h.data.vertices]
    bpy.data.objects.remove(h, do_unlink=True)
    bpy.context.view_layer.objects.active = body
    return co


def add_slider_morphs(body):
    smap = json.load(open(os.path.join(HERE, 'slider_map.json')))
    base = [v.co.copy() for v in body.data.vertices]
    body.shape_key_add(name='Basis', from_mix=False)
    made = []
    macro_base = {k: macro_coords(body) for k in ['_']}['_']
    for slider, sides in list(smap.items()) + [(k, {'pos': [], 'neg': []}) for k in MACRO_SLIDERS if k not in smap]:
        if slider.startswith('_'):
            continue
        for side, suffix in (('pos', '_pos'), ('neg', '_neg')):
            acc = {}
            for tname, weight in sides[side]:
                for path in files_for(tname):
                    for idx, d in read_target(path).items():
                        a = acc.setdefault(idx, [0.0, 0.0, 0.0])
                        a[0] += d[0] * weight
                        a[1] += d[1] * weight
                        a[2] += d[2] * weight
            if slider in MACRO_SLIDERS:
                over = MACRO_SLIDERS[slider][0 if side == 'pos' else 1]
                other = macro_coords(body, **over) if over else None
                for i in range(len(base) if other else 0):
                    d = other[i] - macro_base[i]
                    if d.length > 1e-9:
                        a = acc.setdefault(i, [0.0, 0.0, 0.0])
                        a[0] += d.x
                        a[1] += d.y
                        a[2] += d.z
            if not acc:
                continue
            key = body.shape_key_add(name=slider + suffix, from_mix=False)
            for idx, d in acc.items():
                key.data[idx].co = base[idx] + Vector(d)
            made.append(slider + suffix)
    return made


def joint_deltas(body, made):
    """Per bone, how far its head moves for every morph key (glTF axes: x, z, -y)."""
    rig = json.load(open(RIG_JSON))
    groups = {}
    for bone, d in rig.items():
        cube = d['head'].get('cube_name')
        if cube and cube in body.vertex_groups:
            gi = body.vertex_groups[cube].index
            groups[bone] = [v.index for v in body.data.vertices if any(g.group == gi and g.weight > 0.01 for g in v.groups)]
    kb = body.data.shape_keys.key_blocks
    basis = kb['Basis']

    def mean(block, idxs):
        s = Vector((0, 0, 0))
        for i in idxs:
            s += block.data[i].co
        return s / max(1, len(idxs))

    base_pos = {b: mean(basis, ix) for b, ix in groups.items() if ix}
    out = {}
    for name in made:
        blk = kb[name]
        for b, ix in groups.items():
            if not ix:
                continue
            d = mean(blk, ix) - base_pos[b]
            if d.length > 1e-5:
                out.setdefault(b, {})[name] = [round(d.x, 5), round(d.z, 5), round(-d.y, 5)]
    return out


# ---------------------------------------------------------------- assets (hair, clothes, face parts)
def add_asset(body, rel_path, asset_type, material_type='GAMEENGINE'):
    path = os.path.join(ASSETS, rel_path)
    obj = HumanService.add_mhclo_asset(path, body, asset_type=asset_type, subdiv_levels=0, material_type=material_type)
    return obj, path


_moved_cache = {}


def moved_vertices(body, morph_names):
    """Per morph, the set of body vertices it moves (computed once per body)."""
    kb = body.data.shape_keys.key_blocks
    basis = kb['Basis']
    key = (body.name, len(morph_names))
    if key not in _moved_cache:
        base = [d.co for d in basis.data]
        _moved_cache[key] = {n: {i for i, d in enumerate(kb[n].data) if (d.co - base[i]).length_squared > 1e-12} for n in morph_names}
    return _moved_cache[key]


def mhclo_refs(mhclo_path):
    """Body vertex ids an MHCLO asset is bound to."""
    refs, on = set(), False
    for line in open(mhclo_path, encoding='utf-8', errors='ignore'):
        t = line.split()
        if not t:
            continue
        if t[0] == 'verts':
            on = True
            continue
        if on and t[0] in ('delete_verts', 'delete', 'material', 'zdepth', 'z_depth', 'obj_file', 'x_scale', 'y_scale', 'z_scale', 'scale_data', 'name', 'uuid', 'tag', 'author', 'license', 'description', 'homepage', 'basemesh', 'weights', 'subdivide', 'texture'):
            break
        if on and t[0].lstrip('-').isdigit():
            refs.update(int(x) for x in t[:3] if x.lstrip('-').isdigit()) if len(t) >= 9 else refs.add(int(t[0]))
    return refs


def fit_morphs(obj, mhclo_path, body, morph_names):
    """Give an asset one shape key per body morph by re-fitting it to the body with that morph applied.
    Morphs that do not move any vertex the asset is bound to are skipped (the asset would not change)."""
    kb = body.data.shape_keys.key_blocks
    refs = mhclo_refs(mhclo_path)
    if refs:
        moved = moved_vertices(body, morph_names)
        morph_names = [n for n in morph_names if moved[n] & refs]

    def set_key(active):
        for k in kb:
            if k.name != 'Basis':
                k.value = 1.0 if k.name == active else 0.0

    mh = Mhclo()
    mh.load(mhclo_path)
    mh.clothes = obj
    store = {}
    for name in morph_names:
        set_key(name)
        ClothesService.fit_clothes_to_human(obj, body, mh)
        store[name] = [v.co.copy() for v in obj.data.vertices]
    set_key(None)
    ClothesService.fit_clothes_to_human(obj, body, mh)
    obj.shape_key_add(name='Basis', from_mix=False)
    for name in morph_names:
        k = obj.shape_key_add(name=name, from_mix=False)
        for i, co in enumerate(store[name]):
            k.data[i].co = co


def delete_vertices(obj, indices):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    me = obj.data
    for e in me.edges:
        e.select = False
    for p in me.polygons:
        p.select = False
    s = set(indices)
    for v in me.vertices:
        v.select = v.index in s
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='VERT')
    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------- images
def shrink_images(max_px=2048):
    for img in bpy.data.images:
        if img.size[0] > max_px or img.size[1] > max_px:
            k = max_px / max(img.size[0], img.size[1])
            img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))


def normalize_albedo(img, target=0.8):
    """Turn a coloured texture into a luminance map whose mean is `target`, so the app can tint it by multiplying with any colour."""
    import numpy as np
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    lum = px[:, 0] * 0.2126 + px[:, 1] * 0.7152 + px[:, 2] * 0.0722
    mask = px[:, 3] > 0.5
    mean = float(lum[mask].mean()) if mask.any() else 0.5
    g = np.clip(lum / max(mean, 1e-4) * target, 0.0, 1.0)
    mean_rgb = px[mask][:, :3].mean(axis=0) if mask.any() else np.array([0.5, 0.5, 0.5])
    px[:, 0] = g
    px[:, 1] = g
    px[:, 2] = g
    img.pixels = px.reshape(-1).tolist()
    img.update()
    return [float(x) for x in mean_rgb]


# ---------------------------------------------------------------- export + preview
def export_glb(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_morph=True,
                              export_morph_normal=False, export_skins=True, export_yup=True, export_apply=False,
                              export_animations=False, export_attributes=True, export_image_format='WEBP', export_image_webp_fallback=False,
                              export_image_quality=82)


def setup_preview_scene(resolution=(500, 700)):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('thumb')
    scene.world.color = (0.2, 0.22, 0.27)
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam_data.type = 'ORTHO'
    return cam, cam_data


def render(cam, cam_data, path, center_z, scale):
    scene = bpy.context.scene
    cam_data.ortho_scale = scale
    cam.location = (0, -6, center_z)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def tag_original_indices(body):
    """Store each vertex's index in the full basemesh so the app can map "hidden under clothes" lists onto the stripped mesh."""
    attr = body.data.attributes.new('_orig', 'FLOAT', 'POINT')
    attr.data.foreach_set('value', [float(i) for i in range(len(body.data.vertices))])


def delete_group_indices(body, mhclo_path):
    """Body vertices an asset hides (MPFB 'Delete.<name>' group), as [start, end] ranges of original indices."""
    name = 'Delete.' + os.path.basename(mhclo_path).replace('.mhclo', '').replace('.MHCLO', '').replace(' ', '_')
    vg = body.vertex_groups.get(name)
    if not vg:
        return []
    idx = sorted(v.index for v in body.data.vertices if any(g.group == vg.index and g.weight > 0.5 for g in v.groups))
    body.vertex_groups.remove(vg)
    ranges = []
    for i in idx:
        if ranges and i == ranges[-1][1] + 1:
            ranges[-1][1] = i
        else:
            ranges.append([i, i])
    return ranges
