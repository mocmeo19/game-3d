"""Bakes the open-world city from the source FBX into what the game loads.

Run from the repository root:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/city/bake_city.py

The buildings themselves are cut into streamed tiles by bake_city_tiles.py.

Writes to public/maps/city/:
  city-height.bin   Int16 little-endian ground height in decimetres per cell, row-major along +x then +z (three.js axes);
                    NO_GROUND where the model has no surface
  city-height.json  the grid's origin, cell size and dimensions
  city-map.jpg      a top-down picture of the whole city for the minimap and the big map
"""
import json
import os
import struct
import sys

import bpy
import mathutils
from mathutils.bvhtree import BVHTree

ROOT = os.getcwd()
# the FBX and its full-size textures side by side (override with CITY_SOURCE_DIR=...)
SOURCE_DIR = os.path.join(ROOT, os.environ.get('CITY_SOURCE_DIR', 'public/maps/city-2'))
SOURCE_FBX = os.path.join(SOURCE_DIR, 'Dallas_City.fbx')
OUT_DIR = os.path.join(ROOT, 'public/maps/city')
CELL_M = 2.5
NO_GROUND = -32768
RAY_TOP_M = 600.0
MAP_IMAGE_WIDTH = 2048


def load_city():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=SOURCE_FBX)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        sys.exit('No meshes in ' + SOURCE_FBX)
    return meshes



def world_bvh(meshes):
    vertices = []
    polygons = []
    for obj in meshes:
        offset = len(vertices)
        matrix = obj.matrix_world
        vertices.extend(matrix @ v.co for v in obj.data.vertices)
        polygons.extend([offset + i for i in p.vertices] for p in obj.data.polygons)
    return BVHTree.FromPolygons(vertices, polygons), vertices


def bake_heights(bvh, vertices):
    xs = [v.x for v in vertices]
    ys = [v.y for v in vertices]
    # three.js axes after the +Y-up export: x = blender x, z = -blender y
    min_x, max_x = min(xs), max(xs)
    min_z, max_z = -max(ys), -min(ys)
    cols = int((max_x - min_x) / CELL_M) + 1
    rows = int((max_z - min_z) / CELL_M) + 1
    down = mathutils.Vector((0, 0, -1))
    cells = bytearray(cols * rows * 2)
    for row in range(rows):
        z = min_z + (row + 0.5) * CELL_M
        for col in range(cols):
            x = min_x + (col + 0.5) * CELL_M
            hit = bvh.ray_cast(mathutils.Vector((x, -z, RAY_TOP_M)), down, RAY_TOP_M * 2)[0]
            value = NO_GROUND if hit is None else max(-32767, min(32767, round(hit.z * 10)))
            struct.pack_into('<h', cells, (row * cols + col) * 2, value)
    with open(os.path.join(OUT_DIR, 'city-height.bin'), 'wb') as f:
        f.write(cells)
    meta = {'originX': min_x, 'originZ': min_z, 'cellM': CELL_M, 'cols': cols, 'rows': rows, 'noGround': NO_GROUND}
    with open(os.path.join(OUT_DIR, 'city-height.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    return meta


def render_map(meta):
    scene = bpy.context.scene
    width_m = meta['cols'] * meta['cellM']
    depth_m = meta['rows'] * meta['cellM']
    camera_data = bpy.data.cameras.new('map')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = max(width_m, depth_m)
    camera_data.clip_end = RAY_TOP_M * 3
    camera = bpy.data.objects.new('map', camera_data)
    scene.collection.objects.link(camera)
    centre_x = meta['originX'] + width_m / 2
    centre_z = meta['originZ'] + depth_m / 2
    camera.location = (centre_x, -centre_z, RAY_TOP_M)
    camera.rotation_euler = (0, 0, 0)
    scene.camera = camera
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'FLAT'
    scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x = MAP_IMAGE_WIDTH
    scene.render.resolution_y = round(MAP_IMAGE_WIDTH * depth_m / width_m)
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 80
    scene.render.filepath = os.path.join(OUT_DIR, 'city-map.jpg')
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    meshes = load_city()
    bvh, vertices = world_bvh(meshes)
    meta = bake_heights(bvh, vertices)
    render_map(meta)
    print('BAKED', json.dumps(meta))


main()
