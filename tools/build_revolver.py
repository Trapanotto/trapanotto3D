"""Import the CC0 Loafbrr revolver, retain the weapon rig, and export a game-ready GLB."""
import bpy
import gzip
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets-source'/'cc0-revolver'/'RevolverExport.gltf'
OUTPUT=ROOT/'public'/'models'/'revolver.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
rig=bpy.data.objects.get('RevolverRig')
if rig is None:raise RuntimeError('Revolver rig not found')
keep={rig,*rig.children_recursive}
for obj in list(bpy.data.objects):
    if obj not in keep or obj.name.startswith('357BulletFired.'):
        bpy.data.objects.remove(obj,do_unlink=True)
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file:
        try:image.pack()
        except RuntimeError:pass
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source'/'revolver.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',export_yup=True,export_animations=True,export_cameras=False,export_lights=False)
with open(OUTPUT,'rb') as src, gzip.open(str(OUTPUT)+'.gz','wb',compresslevel=9) as dst:
    shutil.copyfileobj(src,dst)
print('REVOLVER_READY',OUTPUT)
