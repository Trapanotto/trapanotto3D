"""Prepare and pack CC0 machine models into editable Blender and glTF files."""
import bpy
import gzip
import shutil
import tempfile
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
temp = ROOT / '.tmp-blender'
temp.mkdir(exist_ok=True)
tempfile.tempdir = str(temp)
ASSETS = [
    ('old_military_compressor', 'compressor', 2.6),
    ('overhead_crane', 'crane', 4.5),
    ('portable_welding_cart', 'welder', 1.3),
    ('industrial_storage_cart', 'cart', 1.8),
    ('metal_tool_chest', 'toolchest', 1.2),
    ('drill_press_01', 'drill', 1.9),
]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for index, (asset, name, target_size) in enumerate(ASSETS):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets-source' / 'polyhaven' / asset / f'{asset}.gltf'))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    bpy.context.view_layer.update()
    vertices = [obj.matrix_world @ Vector(corner) for obj in imported if obj.type == 'MESH' for corner in obj.bound_box]
    if not vertices:
        raise RuntimeError(f'{asset}: no geometry')
    lower = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    upper = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    size = upper - lower
    scale = target_size / max(size)
    roots = [obj for obj in imported if obj.parent is None]
    bpy.ops.object.empty_add(type='PLAIN_AXES')
    root = bpy.context.object
    root.name = f'industry_{name}'
    # The individual model is centered at ground level in its root's coordinates.
    for obj in roots:
        obj.parent = root
        obj.location.x -= (lower.x + upper.x) / 2
        obj.location.y -= (lower.y + upper.y) / 2
        obj.location.z -= lower.z
    root.scale = (scale, scale, scale)
    root.location.x = index * 6
    print('INDUSTRY_MODEL', name, 'dimensions', tuple(round(n * scale, 2) for n in size), flush=True)

for image in bpy.data.images:
    if image.source == 'FILE' and not image.packed_file:
        try:
            image.pack()
        except RuntimeError:
            pass

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets-source' / 'industry_set.blend'))
output = ROOT / 'public' / 'models' / 'industry_set.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True,
                          export_cameras=False, export_lights=False)
with open(output, 'rb') as source, gzip.open(str(output) + '.gz', 'wb', compresslevel=9) as dest:
    shutil.copyfileobj(source, dest)
output.unlink()
print('INDUSTRY_SET_READY', flush=True)
