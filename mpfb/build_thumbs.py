"""
Thumbnails for the asset picker, rendered with EEVEE on a transparent background:
  * clothes, shoes, hats, gloves, jewelry ...: only the item (the body is fitted underneath but hidden from the camera)
  * hair: only the hair (head and face hidden), framed on the hair itself
  * eyebrows, eyelashes: a close-up of the left eye (image left) with the item on it
  * beards: a close-up of the mouth and chin, framed on the beard

  blender -b --python mpfb/build_thumbs.py -- --gender female [--only id1,id2] [--slots hair,outfit]
  -> public/models/assets/<id>.<gender>.png   (only the .png; the .glb files and the manifest are left alone)
"""
import sys, os, math, time, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

GENDER = arg('--gender', 'female')
ONLY = [x for x in arg('--only', '').split(',') if x]
SLOTS = [x for x in arg('--slots', '').split(',') if x]
OUT = os.path.join(ROOT, 'public', 'models', 'assets')
W, H = 400, 560
HEAD_SLOTS = {'eyebrows', 'eyelashes', 'beard'}
CLOSEUP_SLOTS = {'eyebrows', 'eyelashes', 'beard', 'nails', 'teeth'}

catalog = json.load(open(os.path.join(HERE, 'catalog.json')))
jobs = [e for e in catalog if GENDER in e['genders'] and (not ONLY or e['id'] in ONLY) and (not SLOTS or e['slot'] in SLOTS)]

body, rig = new_human(GENDER, skin='young_asian_' + GENDER)
# a face for the head shots: eyes (proper material), default brows and lashes
face = []
for rel, atype in (('eyes/high-poly/high-poly.mhclo', 'Eyes'), ('eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows'), ('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes')):
    o, _ = add_asset(body, rel, atype)
    o.name = 'face_' + atype.lower()
    face.append(o)
    if atype == 'Eyes':
        MaterialService.delete_all_materials(o)
        mat = MaterialService.create_empty_material('eyes', o)
        mh = MhMaterial()
        mh.populate_from_mhmat(os.path.join(ASSETS, 'eyes', 'materials', 'brown.mhmat'))
        NodeWrapperGameEngine.create_instance(mat.node_tree, mhmat=mh)

scene = bpy.context.scene
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
try:
    scene.eevee.taa_render_samples = 24
except Exception:
    pass
world = bpy.data.worlds.new('thumbs')
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs[0].default_value = (0.32, 0.33, 0.36, 1)
bg.inputs[1].default_value = 0.9
scene.world = world


def light(name, kind, energy, rot):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = [math.radians(a) for a in rot]
    scene.collection.objects.link(o)
    return o


light('key', 'SUN', 3.2, (55, 0, -35))
light('fill', 'SUN', 1.1, (70, 0, 40))
light('rim', 'SUN', 2.0, (110, 0, 180))

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

top_z = max(v.co.z for v in body.data.vertices)
HEAD = 0.28 * (top_z / 1.7) if top_z > 0 else 0.28


def bbox(objs, left_only=False):
    xs, zs = [], []
    deps = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        for v in me.vertices:
            p = o.matrix_world @ v.co
            if left_only and p.x > 0:
                continue
            xs.append(p.x)
            zs.append(p.z)
        ev.to_mesh_clear()
    return min(xs), max(xs), min(zs), max(zs)


_limbs = {}


def limb_of(kind):
    """A copy of the body reduced to the character's right hand (or foot, for toenails): the vertices whose strongest bone is one of its bones."""
    if kind in _limbs:
        return _limbs[kind]
    import bmesh
    names = ('foot_r', 'ball_r') if kind == 'foot' else ('hand_r', 'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'index_01_r', 'index_02_r', 'index_03_r',
            'middle_01_r', 'middle_02_r', 'middle_03_r', 'ring_01_r', 'ring_02_r', 'ring_03_r', 'pinky_01_r', 'pinky_02_r', 'pinky_03_r')
    h = body.copy()
    h.data = body.data.copy()
    h.name = 'limb_' + kind
    scene.collection.objects.link(h)
    for m in list(h.modifiers):
        h.modifiers.remove(m)
    keep = {g.index for g in h.vertex_groups if g.name in names}
    bm = bmesh.new()
    bm.from_mesh(h.data)
    lay = bm.verts.layers.deform.active or bm.verts.layers.deform.verify()
    drop = []
    bones = {b.name for b in rig.data.bones}
    for v in bm.verts:
        w = {i: x for i, x in (v[lay].items() if lay else []) if h.vertex_groups[i].name in bones}
        best = max(w.items(), key=lambda kv: kv[1])[0] if w else -1
        if best not in keep:
            drop.append(v)
    bmesh.ops.delete(bm, geom=drop, context='VERTS')
    bm.to_mesh(h.data)
    bm.free()
    h.hide_render = True
    _limbs[kind] = h
    return h


def shoot(obj, slot, path):
    head_shot = slot in HEAD_SLOTS
    body.hide_render = not head_shot
    for o in face:
        hide = not head_shot or (slot == 'eyebrows' and 'eyebrow' in o.name) or (slot == 'eyelashes' and 'eyelash' in o.name)
        o.hide_render = hide
    rig.hide_render = True
    limb = None
    if slot == 'nails':
        # the nails on a hand (or toenails on a foot), nothing else of the body
        limb = limb_of('foot' if 'toes' in obj.name or 'toe' in path else 'hand')
        limb.hide_render = False
    closeup = slot in CLOSEUP_SLOTS
    x0, x1, z0, z1 = bbox([obj] + ([limb] if limb else []), left_only=slot not in ('beard', 'teeth') and closeup)
    if closeup:
        # brows / lashes: the left eye; beards: the whole beard. The item's own extent with room around it
        pad = max(x1 - x0, z1 - z0) * {'beard': 0.2, 'nails': 0.1, 'teeth': 0.25}.get(slot, 0.45)
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        half = max((x1 - x0) * (H / W if slot == 'nails' else 1), z1 - z0) / 2 + pad  # nails are wider than tall: fit the width into the narrower frame
        x0, x1, z0, z1 = cx - half * W / H * 1.0, cx + half * W / H * 1.0, cz - half, cz + half
    elif head_shot:
        # the head plus whatever hangs below it (long hair, beards), centred on the face
        z1 = max(z1, top_z)
        z0 = max(min(z0, top_z - HEAD), top_z - HEAD * 1.75)  # head and shoulders at most: long hair is cut, the chest stays out
        x0, x1 = min(x0, -HEAD * 0.45), max(x1, HEAD * 0.45)
    w, h = x1 - x0, z1 - z0
    cam_data.ortho_scale = max(h, w * H / W, 0.1) * 1.12
    cam.location = ((x0 + x1) / 2, -6, (z0 + z1) / 2)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if limb:
        limb.hide_render = True


done, failed = 0, {}
MPFB_TYPE = {'hair': 'Hair', 'eyebrows': 'Eyebrows', 'eyelashes': 'Eyelashes', 'teeth': 'Teeth'}
for e in jobs:
    t0 = time.time()
    obj = None
    try:
        mhclo = os.path.join(ASSETS, e['rel'])
        obj = HumanService.add_mhclo_asset(mhclo, body, asset_type=MPFB_TYPE.get(e['dir'], 'Clothes'), subdiv_levels=0, material_type='GAMEENGINE')
        shoot(obj, e['slot'], os.path.join(OUT, f"{e['id']}.{GENDER}.png"))
        done += 1
        print(f"ok {e['id']} {time.time() - t0:.1f}s", flush=True)
    except Exception as ex:
        failed[e['id']] = str(ex)[:200]
        print(f"FAIL {e['id']}: {ex}", flush=True)
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
print('DONE thumbs', GENDER, 'rendered', done, 'failed', len(failed), json.dumps(failed)[:500])
