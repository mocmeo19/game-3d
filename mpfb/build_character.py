"""
Builds the base character of one race and gender with MPFB and exports it for the web app.

  blender -b --python mpfb/build_character.py -- --race gon --gender male
  -> public/models/<race>_<gender>.glb          skinned body + eyes + brows + lashes + teeth + tongue (morph targets per slider)
  -> public/models/<race>_<gender>_extra.json   morph names, per-bone joint offsets for every morph, UV landmarks for make-up
  -> public/models/<race>_<gender>.delta.bin    per basemesh vertex, how far this body is from the default (jin) body

Every race shares the basemesh topology and the game_engine rig, so sliders, hidden-skin lists and clothing work on all of
them. Clothing is fitted once to the jin body (build_assets.py); the app moves each clothing vertex by the delta of the
nearest jin body vertex to fit it onto another race.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from mathutils import Vector
from mathutils.interpolate import poly_3d_calc
from array import array

GENDER = arg('--gender', 'female')
RACE = arg('--race', 'jin')
KEY = f'{RACE}_{GENDER}'
# MPFB macro overrides per race (defaults: age 0.5, weight 0.35, muscle 0.4, everything else 0.5). Overall height is set by
# the app (RACE_SCALE), so `height` here only changes proportions within the body.
RACE_BODY = {
    'jin': {'female': {}, 'male': {}},
    'gon': {
        'female': dict(age=0.55, weight=0.5, muscle=0.75, proportions=0.7, height=0.7, cupsize=0.62,
                       race={'african': 0.3, 'asian': 0.5, 'caucasian': 0.2}),
        'male': dict(age=0.58, weight=0.55, muscle=0.92, proportions=0.75, height=0.8,
                     race={'african': 0.35, 'asian': 0.45, 'caucasian': 0.2}),
    },
    'lyn': {
        'female': dict(age=0.35, weight=0.38, muscle=0.35, proportions=0.4, height=0.2, cupsize=0.35,
                       race={'african': 0.0, 'asian': 0.8, 'caucasian': 0.2}),
        'male': dict(age=0.35, weight=0.38, muscle=0.4, proportions=0.4, height=0.2,
                     race={'african': 0.0, 'asian': 0.8, 'caucasian': 0.2}),
    },
    'yun': {
        'female': dict(age=0.47, weight=0.28, muscle=0.35, proportions=0.9, height=0.7, cupsize=0.62, firmness=0.7,
                       race={'african': 0.0, 'asian': 0.6, 'caucasian': 0.4}),
    },
}
if GENDER not in RACE_BODY.get(RACE, {}):
    raise SystemExit(f'no {GENDER} body for race {RACE}')
SKIN = arg('--skin', 'young_asian_' + GENDER)
EYES = arg('--eyes', 'brown')
OUT_DIR = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)

# how far this race's rest body is from the default one, per basemesh vertex, in glTF axes (x, z, -y)
default_co = human_coords(human_macro(GENDER))
body, rig = new_human(GENDER, skin=SKIN, **RACE_BODY[RACE][GENDER])
delta = array('f')
for v, d in zip(body.data.vertices, default_co):
    delta.extend((v.co.x - d.x, v.co.z - d.z, -(v.co.y - d.y)))
print('max delta from the default body', max(abs(x) for x in delta))
print('rig bones', len(rig.data.bones))
made = add_slider_morphs(body)
print('morph targets', len(made))
bones_delta = joint_deltas(body, made)
print('bones with joint offsets', len(bones_delta))

# ---------------------------------------------------------------- face parts
PARTS = [
    ('eyes', 'eyes/high-poly/high-poly.mhclo', 'Eyes'),
    ('eyebrows', 'eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows'),
    ('eyelashes', 'eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes'),
    ('teeth', 'teeth/teeth_base/teeth_base.mhclo', 'Teeth'),
    ('tongue', 'tongue/tongue01/tongue01.mhclo', 'Tongue'),
]
parts = []
for name, rel, atype in PARTS:
    obj, path = add_asset(body, rel, atype)
    obj.name = name
    parts.append((obj, path))
    if name == 'eyes':
        MaterialService.delete_all_materials(obj)
        mat = MaterialService.create_empty_material('eyes', obj)
        mh = MhMaterial()
        mh.populate_from_mhmat(os.path.join(ASSETS, 'eyes', 'materials', EYES + '.mhmat'))
        NodeWrapperGameEngine.create_instance(mat.node_tree, mhmat=mh)

for obj, path in parts:
    fit_morphs(obj, path, body, made)

# the high-poly eyes have an outer "glass" shell sampling the lavender dot in the iris atlas: drop it
eyes_obj = next(o for o, _ in parts if o.name == 'eyes')
uvl = eyes_obj.data.uv_layers.active.data
glass = set()
for poly in eyes_obj.data.polygons:
    if all(uvl[li].uv.x > 0.85 and uvl[li].uv.y < 0.16 for li in poly.loop_indices):
        glass.update(poly.vertices)
delete_vertices(eyes_obj, glass)

# ---------------------------------------------------------------- UV landmarks for make-up / face markings
for m in list(body.modifiers):
    if m.type == 'MASK':
        body.modifiers.remove(m)
bpy.context.view_layer.update()


def group_center(name):
    gi = body.vertex_groups[name].index
    pts = [v.co for v in body.data.vertices if any(g.group == gi and g.weight > 0.01 for g in v.groups)]
    s = Vector((0, 0, 0))
    for p in pts:
        s += p
    return s / len(pts)


me = body.data
me.calc_loop_triangles()
tris_of_poly = {}
for t in me.loop_triangles:
    tris_of_poly.setdefault(t.polygon_index, []).append(t)
uv_data = me.uv_layers.active.data


def uv_at(x, z):
    hit, loc, nrm, idx = body.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    if not hit:
        return None
    best = None
    for t in tris_of_poly[idx]:
        vs = [me.vertices[i].co for i in t.vertices]
        w = poly_3d_calc(vs, loc)
        score = min(w)
        if best is None or score > best[0]:
            best = (score, w, t)
    _, w, t = best
    u = sum(w[i] * uv_data[t.loops[i]].uv.x for i in range(3))
    v = sum(w[i] * uv_data[t.loops[i]].uv.y for i in range(3))
    return (u, v)


def landmark(x, z):
    p = uv_at(x, z)
    px = uv_at(x + 0.01, z)
    pz = uv_at(x, z + 0.01)
    if not (p and px and pz):
        return None
    # the face island may be rotated in UV space: keep the full 2x2 Jacobian (UV change per metre of x and z)
    return {'uv': [round(p[0], 5), round(p[1], 5)],
            'jac': [round((px[0] - p[0]) / 0.01, 3), round((px[1] - p[1]) / 0.01, 3),
                    round((pz[0] - p[0]) / 0.01, 3), round((pz[1] - p[1]) / 0.01, 3)],
            'pos': [round(x, 4), round(z, 4)]}


eye_l = group_center('joint-l-eye')
teeth_obj = next(o for o, _ in parts if o.name == 'teeth')
tz = [v.co.z for v in teeth_obj.data.vertices]
mouth_z = (min(tz) + max(tz)) / 2
print('mouth z from teeth', mouth_z, 'joint', group_center('joint-mouth').z)
# the teeth sit lower than the lip line: use the groove between the lips (deepest point of the front profile at x = 0)
_prof = []
for _k in range(-6, 31):
    _z = mouth_z + _k * 0.001
    _hit, _loc, _n, _i = body.ray_cast(Vector((0, -1.0, _z)), Vector((0, 1, 0)))
    if _hit:
        _prof.append((_loc.y, _z))
if _prof:
    mouth_z = max(_prof)[1]
print('mouth z from lip groove', mouth_z)
ex = abs(eye_l.x)
ez = eye_l.z
landmarks = {
    'eye_l': landmark(ex, ez), 'eye_r': landmark(-ex, ez),
    'lid_l': landmark(ex, ez + 0.008), 'lid_r': landmark(-ex, ez + 0.008),
    'cheek_l': landmark(ex * 1.1, ez - 0.036), 'cheek_r': landmark(-ex * 1.1, ez - 0.036),
    'temple_l': landmark(ex * 1.7, ez - 0.012), 'temple_r': landmark(-ex * 1.7, ez - 0.012),
    'forehead': landmark(0, ez + 0.055),
    'mouth': landmark(0, mouth_z),
}
landmarks = {k: v for k, v in landmarks.items() if v}

def visible_from_front(poly):
    c = poly.center
    hit, loc, nrm, idx = body.ray_cast(Vector((c.x, -1.0, c.z)), Vector((0, 1, 0)))
    return hit and abs(loc.y - c.y) < 0.004


# lips: every face whose vertices all lie inside an ellipse around the mouth, as UV triangles
lip_tris = []
cz = mouth_z + 0.0005
for poly in me.polygons:
    vs = [me.vertices[i].co for i in poly.vertices]
    if all(((v.x / 0.0275) ** 2 + ((v.z - cz) / 0.0115) ** 2) < 1.0 for v in vs) and poly.normal.y < -0.2 and visible_from_front(poly):
        loops = [uv_data[li].uv for li in poly.loop_indices]
        for i in range(1, len(loops) - 1):
            for l in (loops[0], loops[i], loops[i + 1]):
                lip_tris += [round(l.x, 5), round(l.y, 5)]
print('landmarks', list(landmarks), 'lip triangles', len(lip_tris) // 6)

tag_original_indices(body)

# how far every morph moves the skin around each landmark (x, up), so the make-up follows the face
shift = {}
kb = body.data.shape_keys.key_blocks
basis = kb['Basis']
for lname, lm in landmarks.items():
    lx, lz = lm['pos']
    idx = [v.index for v in me.vertices if abs(v.co.x - lx) < 0.014 and abs(v.co.z - lz) < 0.012 and v.normal.y < -0.15 and v.co.y < 0.0]
    if not idx:
        continue
    shift[lname] = {}
    for blk in kb:
        if blk.name == 'Basis' or blk.name not in made:
            continue
        dx = sum(blk.data[i].co.x - basis.data[i].co.x for i in idx) / len(idx)
        dz = sum(blk.data[i].co.z - basis.data[i].co.z for i in idx) / len(idx)
        if abs(dx) > 5e-5 or abs(dz) > 5e-5:
            shift[lname][blk.name] = [round(dx, 5), round(dz, 5)]
print('landmark shifts', {k: len(v) for k, v in shift.items()})

# ---------------------------------------------------------------- strip helper geometry from the body
vg = body.vertex_groups['body']
keep = {v.index for v in me.vertices if any(g.group == vg.index and g.weight > 0.01 for g in v.groups)}
delete_vertices(body, [v.index for v in me.vertices if v.index not in keep])
body.name = 'Body'
rig.name = 'Armature'

# ---------------------------------------------------------------- export
shrink_images(2048)
export_glb([body, rig] + [o for o, _ in parts], os.path.join(OUT_DIR, KEY + '.glb'))
with open(os.path.join(OUT_DIR, KEY + '.delta.bin'), 'wb') as fh:
    delta.tofile(fh)  # little-endian float32, 3 per basemesh vertex
json.dump({'gender': GENDER, 'race': RACE, 'morphs': made, 'bones': bones_delta, 'landmarks': landmarks, 'shift': shift, 'lips': lip_tris,
           'boneNames': [b.name for b in rig.data.bones]},
          open(os.path.join(OUT_DIR, KEY + '_extra.json'), 'w'))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'out', KEY + '.blend'))

# ---------------------------------------------------------------- previews
cam, cam_data = setup_preview_scene((600, 900))
zmax = max(v.co.z for v in body.data.vertices)
render(cam, cam_data, os.path.join(HERE, 'out', KEY + '_preview.png'), zmax / 2, max(2.0, zmax * 1.15))
scene = bpy.context.scene
scene.render.resolution_x = scene.render.resolution_y = 700
render(cam, cam_data, os.path.join(HERE, 'out', KEY + '_face.png'), zmax - 0.1, 0.42)
print('DONE', KEY)
