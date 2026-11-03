"""Pack two CC0 Poly Haven PBR models for the browser, retaining editable Blender source."""
import bpy
import gzip
import shutil
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
work_tmp=ROOT/'.tmp-blender';work_tmp.mkdir(exist_ok=True)
tempfile.tempdir=str(work_tmp)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for i,(asset,name) in enumerate([('portable_generator','detail_generator'),('utility_box_02','detail_utility')]):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets-source'/'polyhaven'/asset/(asset+'.gltf')))
    imported=[obj for obj in bpy.data.objects if obj not in before]
    roots=[obj for obj in imported if obj.parent is None]
    bpy.ops.object.empty_add(type='PLAIN_AXES');root=bpy.context.object;root.name=name
    for obj in roots:obj.parent=root
    root.location.x=i*4
    print('DETAIL_MODEL',name,'objects',len(imported), 'root children',len(roots))
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file:
        try:image.pack()
        except RuntimeError:pass
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source'/'polyhaven_details.blend'))
output=ROOT/'public'/'models'/'polyhaven_details.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
with open(output,'rb') as src,gzip.open(str(output)+'.gz','wb',compresslevel=9) as dst:shutil.copyfileobj(src,dst)
print('POLYHAVEN_READY',output)
