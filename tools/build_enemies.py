"""Turn a CC0 fitted figure into a lightweight, animated industrial enemy in Blender."""
import bpy
import gzip
import shutil
import tempfile
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
work_tmp=ROOT/'.tmp-blender';work_tmp.mkdir(exist_ok=True);tempfile.tempdir=str(work_tmp)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets-source'/'firefighter.glb'))
bpy.context.view_layer.update()
for obj in list(bpy.data.objects):
    if obj.type!='MESH' or obj.name in {'eyebrow001','eyelashes01','short03','teeth_base','low-poly'}:
        bpy.data.objects.remove(obj,do_unlink=True)
def part_material(name,color,emission=None):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*color,1);shader.inputs['Roughness'].default_value=.65
    if emission:shader.inputs['Emission Color'].default_value=(*emission,1);shader.inputs['Emission Strength'].default_value=1.8
    return mat
dark=part_material('Enemy | respirator rubber',(.045,.055,.05))
metal=part_material('Enemy | corroded metal',(.18,.19,.16))
glow=part_material('Enemy | amber lenses',(.7,.19,.025),(1,.22,.025))
def add_sphere(name,location,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=location);obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.data.materials.append(mat);return obj
def add_cube(name,location,scale,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location);obj=bpy.context.object;obj.name=name;obj.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.data.materials.append(mat);return obj
add_sphere('Respirator shell',(0,-.172,1.625),(.105,.08,.09),dark)
for sign in [-1,1]:
    add_sphere('Respirator filter',(sign*.104,-.16,1.62),(.05,.065,.05),metal)
    add_sphere('Optical lens',(sign*.055,-.163,1.70),(.03,.026,.025),glow)
add_cube('Chest plate',(0,-.185,1.34),(.30,.07,.30),metal)
add_cube('Chest marking',(0,-.225,1.36),(.16,.012,.03),glow)
meshes=list(bpy.data.objects)
for obj in meshes:
    matrix=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=matrix
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if len(obj.data.vertices)>8000:
        modifier=obj.modifiers.new('Game mesh reduction','DECIMATE');modifier.ratio=.34
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
for image in bpy.data.images:
    if image.size[0]>1024 or image.size[1]>1024:
        ratio=min(1024/image.size[0],1024/image.size[1]);image.scale(max(1,int(image.size[0]*ratio)),max(1,int(image.size[1]*ratio)))
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    shader=mat.node_tree.nodes.get('Principled BSDF')
    if not shader:continue
    if 'top' in mat.name.lower():shader.inputs['Base Color'].default_value=(.16,.19,.15,1)
    if 'bottom' in mat.name.lower():shader.inputs['Base Color'].default_value=(.10,.12,.10,1)
    if 'red' in mat.name.lower():shader.inputs['Base Color'].default_value=(.18,.19,.16,1)

armature=bpy.data.armatures.new('IndustrialEnemyRig');rig=bpy.data.objects.new('enemy_human',armature);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=armature.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=armature.edit_bones[parent]
    return b
bone('pelvis',(0,0,.88),(0,0,1.03));bone('torso',(0,0,1.03),(0,0,1.53),'pelvis');bone('head',(0,0,1.53),(0,0,1.88),'torso')
for side,sign in [('L',-1),('R',1)]:
    bone('leg_'+side,(sign*.15,0,.91),(sign*.16,0,.49),'pelvis')
    bone('shin_'+side,(sign*.16,0,.49),(sign*.16,0,.10),'leg_'+side)
    bone('arm_'+side,(sign*.25,0,1.51),(sign*.31,0,1.12),'torso')
    bone('forearm_'+side,(sign*.31,0,1.12),(sign*.32,0,.91),'arm_'+side)
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)

for obj in meshes:
    obj.parent=rig
    modifier=obj.modifiers.new('Deformation rig','ARMATURE');modifier.object=rig
    groups={name:obj.vertex_groups.new(name=name) for name in ['pelvis','torso','head','leg_L','leg_R','shin_L','shin_R','arm_L','arm_R','forearm_L','forearm_R']}
    batches={name:[] for name in groups}
    for vertex in obj.data.vertices:
        x,y,z=vertex.co;side='L' if x<0 else 'R'
        if z>1.57:group='head'
        elif abs(x)>.245 and z>.92:group=('arm_' if z>1.13 else 'forearm_')+side
        elif z<.91:group=('leg_' if z>.48 else 'shin_')+side
        elif z<1.03:group='pelvis'
        else:group='torso'
        batches[group].append(vertex.index)
    for name,indices in batches.items():
        if indices:groups[name].add(indices,1.0,'REPLACE')

for mat in list(bpy.data.materials):
    if mat.users==0:bpy.data.materials.remove(mat)
for image in list(bpy.data.images):
    if image.users==0:
        bpy.data.images.remove(image);continue
    if image.source=='FILE' and image.size[0] and image.size[1]:
        # Save the resized working pixels instead of repacking the original 4K source.
        target=work_tmp/(bpy.path.clean_name(image.name)+'.png')
        image.filepath_raw=str(target);image.file_format='PNG';image.save()
        if image.packed_file:image.unpack(method='REMOVE')
        image.filepath_raw=str(target);image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source'/'industrial_enemy.blend'))
output=ROOT/'public'/'models'/'industrial_enemy.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
with open(output,'rb') as src,gzip.open(str(output)+'.gz','wb',compresslevel=9) as dst:shutil.copyfileobj(src,dst)
print('INDUSTRIAL_ENEMY_READY',output)
