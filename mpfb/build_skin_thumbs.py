"""
Thumbnails for the skin picker: the skin is put on the face of the model and photographed (front view of the head, with the
eyes and default brows and lashes), instead of cropping the texture.

  blender -b --python mpfb/build_skin_thumbs.py -- [--only id1,id2]
  -> public/models/skins/thumbs/<id>.png   (convert to webp afterwards: python3 mpfb/skin_thumbs_webp.py)

A skin for both genders is shot on the female body, a male-only skin on the male body.
"""
import sys, os, math, time, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

ONLY = [x for x in arg('--only', '').split(',') if x]
OUT = os.path.join(ROOT, 'public', 'models', 'skins', 'thumbs')
os.makedirs(OUT, exist_ok=True)
SIZE = 192

skins = json.load(open(os.path.join(ROOT, 'public', 'models', 'skins', 'manifest.json')))
skins = [s for s in skins if not ONLY or s['id'] in ONLY]

scene = bpy.context.scene
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
try:
    scene.eevee.taa_render_samples = 24
except Exception:
    pass
world = bpy.data.worlds.new('skinthumbs')
world.use_nodes = True
bgn = world.node_tree.nodes.get('Background')
bgn.inputs[0].default_value = (0.2, 0.21, 0.24, 1)
bgn.inputs[1].default_value = 0.8
scene.world = world




def light(name, kind, energy, rot):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = [math.radians(a) for a in rot]
    scene.collection.objects.link(o)


done, failed = 0, {}
for gender in ('female', 'male'):
    mine = [s for s in skins if (s['gender'] == gender) or (gender == 'female' and s['gender'] == 'both')]
    if not mine:
        continue
    # new_human() clears the scene, so the lights, the camera and the face parts are made again for each body
    body, rig = new_human(gender, skin='young_asian_' + gender)
    rig.hide_render = True
    for rel, atype in (('eyes/high-poly/high-poly.mhclo', 'Eyes'), ('eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows'), ('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes')):
        o, _ = add_asset(body, rel, atype)
        if atype == 'Eyes':
            MaterialService.delete_all_materials(o)
            mat = MaterialService.create_empty_material('eyes', o)
            mh = MhMaterial()
            mh.populate_from_mhmat(os.path.join(ASSETS, 'eyes', 'materials', 'brown.mhmat'))
            NodeWrapperGameEngine.create_instance(mat.node_tree, mhmat=mh)
    light('key', 'SUN', 3.4, (65, 0, -25))
    light('fill', 'SUN', 1.4, (75, 0, 40))
    light('rim', 'SUN', 1.2, (110, 0, 180))
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    top_z = max(v.co.z for v in body.data.vertices)
    head_h = 0.28 * (top_z / 1.7)
    # the head: from the chin up, a little room around it
    cam_data.ortho_scale = head_h * 1.2
    cam.location = (0, -6, top_z - head_h * 0.52)
    cam.rotation_euler = (math.radians(90), 0, 0)
    for s in mine:
        t0 = time.time()
        try:
            mhmat = os.path.join(ASSETS, 'skins', s['id'], s['id'] + '.mhmat')
            if os.path.exists(mhmat):
                HumanService.set_character_skin(mhmat, body, skin_type='GAMEENGINE')
            else:
                texture = os.path.join(ROOT, 'public', 'models', 'skins', s['id'] + '.webp')
                if not os.path.exists(texture):
                    raise RuntimeError('no skin texture')
                replaced = False
                for material in body.data.materials:
                    if not material.use_nodes:
                        continue
                    for node in material.node_tree.nodes:
                        if node.type == 'TEX_IMAGE' and node.image:
                            if 'diffuse' in node.name.lower() or 'diffuse' in node.image.name.lower():
                                node.image = bpy.data.images.load(texture, check_existing=True)
                                replaced = True
                if not replaced:
                    raise RuntimeError('no diffuse texture node in base material')
            scene.render.filepath = os.path.join(OUT, s['id'] + '.png')
            bpy.ops.render.render(write_still=True)
            scene.render.image_settings.file_format = 'WEBP'
            scene.render.image_settings.quality = 88
            bpy.data.images['Render Result'].save_render(os.path.join(OUT, s['id'] + '.webp'), scene=scene)
            scene.render.image_settings.file_format = 'PNG'
            done += 1
            print(f"ok {s['id']} {time.time() - t0:.1f}s", flush=True)
        except Exception as ex:
            failed[s['id']] = str(ex)[:200]
            print(f"FAIL {s['id']}: {ex}", flush=True)
            traceback.print_exc()
print('DONE skin thumbs rendered', done, 'failed', len(failed), json.dumps(failed)[:600])
