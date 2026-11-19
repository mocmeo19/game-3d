"""Cuts the city into square tiles with their own textures, for streaming only the area around the player.

The source atlases scatter each street over the whole 8192px picture, so a tile cannot simply crop them: every tile is
unwrapped again and its colour baked from the source textures at the resolution the source gives it (no quality lost).

Run from the repository root (about 10-20 minutes on an Apple GPU):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/city/bake_city_tiles.py

Writes to public/maps/city/tiles/:
  tiles.json        tile size and, per tile, its files, texture sizes and bounds in three.js axes (x, z = -blender y)
  <id>.glb          the tile's mesh (Draco), one UV map, no material
  <id>.jpg          the tile's colour at source quality
  <id>_lo.jpg       the same at a quarter of the size, for tiles further away
"""
import json
import math
import os
import shutil
import sys

import bpy

ROOT = os.getcwd()
SOURCE_DIR = os.path.join(ROOT, os.environ.get('CITY_SOURCE_DIR', 'public/maps/city-2'))
SOURCE_FBX = os.path.join(SOURCE_DIR, 'Dallas_City.fbx')
OUT_DIR = os.path.join(ROOT, 'public/maps/city/tiles')
TILE_M = 256.0
SOURCE_SIZE = 8192
# share of a baked texture the unwrapped islands fill (the rest is margins)
PACKING = 0.72
MIN_SIZE = 256
MAX_SIZE = 4096
LO_DIVISOR = 4
JPEG_QUALITY = 85
BAKE_MARGIN_PX = 4
BAKE_UV = 'bake'
# bake only the first N tiles (0 = all), for trying changes quickly
TILE_LIMIT = int(os.environ.get('CITY_TILE_LIMIT', '0'))


def pow2_at_least(value):
    return 2 ** math.ceil(math.log2(max(1.0, value)))


def setup_cycles():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = 'GPU'
    except TypeError:
        scene.cycles.device = 'CPU'
    scene.render.bake.margin = BAKE_MARGIN_PX
    scene.render.bake.use_clear = True


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def load_city():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=SOURCE_FBX)
    parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not parts:
        sys.exit('No meshes in ' + SOURCE_FBX)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def prepare_materials(source_uv):
    """Every source texture is read through the source UV map, whatever UV map the bake writes into."""
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        for node in list(nodes):
            if node.type != 'TEX_IMAGE' or not node.image:
                continue
            node.image.filepath = os.path.join(SOURCE_DIR, os.path.basename(node.image.filepath))
            node.image.reload()
            uv = nodes.new('ShaderNodeUVMap')
            uv.uv_map = source_uv
            links.new(uv.outputs['UV'], node.inputs['Vector'])


def split_into_tiles(city):
    """One object per tile, by face centre (blender axes). Tile ids are worked out once; each tile is one selection."""
    polys = city.data.polygons
    centres = [0.0] * (len(polys) * 3)
    polys.foreach_get('center', centres)
    keys = [(math.floor(centres[k * 3] / TILE_M), math.floor(centres[k * 3 + 1] / TILE_M)) for k in range(len(polys))]
    tiles = {}
    for key in sorted(set(keys)):
        # the remaining mesh shrinks with every split, so its faces are looked up again
        polys = city.data.polygons
        centres = [0.0] * (len(polys) * 3)
        polys.foreach_get('center', centres)
        flags = [(math.floor(centres[k * 3] / TILE_M), math.floor(centres[k * 3 + 1] / TILE_M)) == key for k in range(len(polys))]
        if not any(flags):
            continue
        select_only(city)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='DESELECT')
        bpy.ops.object.mode_set(mode='OBJECT')
        polys.foreach_set('select', flags)
        before = set(bpy.context.scene.objects)
        bpy.ops.object.mode_set(mode='EDIT')
        if all(flags):
            bpy.ops.object.mode_set(mode='OBJECT')
            tiles[key] = city
            break
        bpy.ops.mesh.separate(type='SELECTED')
        bpy.ops.object.mode_set(mode='OBJECT')
        new = [o for o in bpy.context.scene.objects if o not in before]
        if new:
            tiles[key] = new[0]
    return tiles


def source_pixels(obj, source_uv):
    """Texels of the source textures the tile's faces cover."""
    uv = obj.data.uv_layers[source_uv].data
    total = 0.0
    for p in obj.data.polygons:
        loops = list(p.loop_indices)
        for i in range(1, len(loops) - 1):
            u0, v0 = uv[loops[0]].uv
            u1, v1 = uv[loops[i]].uv
            u2, v2 = uv[loops[i + 1]].uv
            total += abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2
    return total * SOURCE_SIZE * SOURCE_SIZE


def unwrap(obj):
    select_only(obj)
    layer = obj.data.uv_layers.new(name=BAKE_UV)
    obj.data.uv_layers.active = layer
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake(obj, size, name):
    image = bpy.data.images.new(name, size, size, alpha=False)
    targets = []
    for slot in obj.material_slots:
        nodes = slot.material.node_tree.nodes
        node = nodes.new('ShaderNodeTexImage')
        node.image = image
        nodes.active = node
        targets.append((nodes, node))
    select_only(obj)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=BAKE_MARGIN_PX)
    for nodes, node in targets:
        nodes.remove(node)
    return image


def save_jpeg(image, path, size):
    if image.size[0] != size:
        image.scale(size, size)
    image.file_format = 'JPEG'
    image.save(filepath=path, quality=JPEG_QUALITY)


def export_tile(obj, path, source_uv):
    obj.data.uv_layers.remove(obj.data.uv_layers[source_uv])
    obj.data.materials.clear()
    select_only(obj)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_image_format='NONE',
        export_materials='NONE',
        export_normals=False,
        export_tangents=False,
        export_texcoords=True,
        export_animations=False,
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16,
        export_draco_texcoord_quantization=14,
    )


def bounds(obj):
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    # three.js axes: x = blender x, y = blender z, z = -blender y
    return {'minX': min(xs), 'maxX': max(xs), 'minZ': -max(ys), 'maxZ': -min(ys), 'minY': min(zs), 'maxY': max(zs)}


def main():
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR)
    city = load_city()
    source_uv = city.data.uv_layers.active.name
    prepare_materials(source_uv)
    setup_cycles()
    tiles = split_into_tiles(city)
    manifest = {'tileM': TILE_M, 'tiles': []}
    for n, ((i, j), obj) in enumerate(sorted(tiles.items())):
        tile_id = f'{i}_{j}'
        size = int(min(MAX_SIZE, max(MIN_SIZE, pow2_at_least(math.sqrt(source_pixels(obj, source_uv) / PACKING)))))
        lo_size = max(MIN_SIZE // 2, size // LO_DIVISOR)
        unwrap(obj)
        image = bake(obj, size, tile_id)
        save_jpeg(image, os.path.join(OUT_DIR, f'{tile_id}.jpg'), size)
        save_jpeg(image, os.path.join(OUT_DIR, f'{tile_id}_lo.jpg'), lo_size)
        bpy.data.images.remove(image)
        entry = {'id': tile_id, 'glb': f'{tile_id}.glb', 'tex': f'{tile_id}.jpg', 'texLo': f'{tile_id}_lo.jpg', 'size': size, 'loSize': lo_size}
        entry.update(bounds(obj))
        export_tile(obj, os.path.join(OUT_DIR, f'{tile_id}.glb'), source_uv)
        bpy.data.objects.remove(obj)
        manifest['tiles'].append(entry)
        print(f'TILE {n + 1}/{len(tiles)} {tile_id} {size}px', flush=True)
        if TILE_LIMIT and n + 1 >= TILE_LIMIT:
            break
    with open(os.path.join(OUT_DIR, 'tiles.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print('BAKED_TILES', len(manifest['tiles']))


main()
