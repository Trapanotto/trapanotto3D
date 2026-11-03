"""Build Trapanotto 3D's production meshes in Blender 5.x.

Run: blender --background --python tools/generate_assets.py
The .blend is an editable source; the GLB is the compact browser asset bundle.
"""
import bpy
import math
import gzip
import shutil
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'models'
SOURCE = ROOT / 'assets-source'
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for mat in list(bpy.data.materials):
    bpy.data.materials.remove(mat)

def material(name, color, metallic=.0, roughness=.65, emission=None):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Metallic'].default_value=metallic;bsdf.inputs['Roughness'].default_value=roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value=(*emission,1)
        bsdf.inputs['Emission Strength'].default_value=2.0
    return mat

M={
    'armor':material('M_Weathered_Olive_Armor',(.21,.27,.24),.64,.59),
    'rust':material('M_Oxidised_Steel',(.32,.19,.13),.56,.72),
    'steel':material('M_Brushed_Steel',(.36,.40,.38),.8,.43),
    'dark':material('M_Gunmetal',(.075,.09,.085),.68,.58),
    'rubber':material('M_Rubber_And_Fabric',(.065,.071,.066),.06,.91),
    'leather':material('M_Aged_Leather',(.24,.15,.10),.1,.83),
    'hazard':material('M_Industrial_Yellow',(.67,.43,.105),.46,.6),
    'ivory':material('M_Enamel',(.68,.70,.61),.35,.5),
    'red':material('M_Red_Paint',(.48,.085,.055),.55,.59),
    'glow':material('M_Emissive_Amber',(.75,.19,.035),.22,.35,(1,.16,.025)),
    'teal':material('M_Emissive_Teal',(.12,.43,.38),.3,.32,(.08,.65,.48)),
}

current=[]
def register(obj, category, mat):
    obj.data.materials.append(M[mat]);obj['part_group']=category;current.append(obj);return obj
def bevel(obj, width=.025):
    modifier=obj.modifiers.new('Machined edge highlights','BEVEL');modifier.width=width;modifier.segments=2
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj
def cube(name, pos, size, mat='armor', cat='body', edge=.015, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rotation:o.rotation_euler=rotation
    if edge:bevel(o,edge)
    return register(o,cat,mat)
def cylinder(name,pos,radius,depth,mat='steel',cat='body',axis='Z',vertices=12):
    rotation={'X':(0,math.pi/2,0),'Y':(math.pi/2,0,0),'Z':(0,0,0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=pos,rotation=rotation)
    o=bpy.context.object;o.name=name;return register(o,cat,mat)
def sphere(name,pos,scale,mat='armor',cat='body',segments=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=pos);o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return register(o,cat,mat)
def torus(name,pos,major,minor,mat='steel',cat='body',rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=6,location=pos,major_radius=major,minor_radius=minor,rotation=rotation or (0,0,0))
    o=bpy.context.object;o.name=name;return register(o,cat,mat)
def finish(name, studio_x):
    """Join by animated part, retain PBR material slots, parent under one named root."""
    global current
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=(studio_x,0,0));root=bpy.context.object;root.name=name
    categories=sorted({o['part_group'] for o in current})
    grouped={category:[o for o in current if o['part_group']==category] for category in categories}
    for category,members in grouped.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in members:o.select_set(True)
        bpy.context.view_layer.objects.active=members[0];bpy.ops.object.join();joined=bpy.context.object;joined.name=category
        # Keep each model's local coordinates and arrange roots in a source-file lineup.
        joined.parent=root;joined.select_set(False)
    current=[]
    return root

def bolt_grid(x,z,front,cols=3,rows=2,spacing=.12,cat='body'):
    for a in range(cols):
        for b in range(rows):
            cylinder('Fastener',(x+(a-(cols-1)/2)*spacing,front,z+(b-(rows-1)/2)*spacing),.018,.026,'steel',cat,'Y',8)

def enemy(name, variant, studio_x):
    runner=variant=='runner';tank=variant in ('tank','boss');scale=1.62 if variant=='boss' else 1.18 if tank else 1
    def v(x,y,z):return(x*scale,y*scale,z*scale)
    def sz(x,y,z):return(x*scale,y*scale,z*scale)
    paint='rust' if runner else 'armor'
    for side,cat in [(-1,'leg_L'),(1,'leg_R')]:
        x=side*.21
        cube('Upper leg',v(x,0,.75),sz(.30,.34,.52),'rubber',cat,.025*scale)
        cube('Thigh plate',v(x,-.18,.79),sz(.29,.10,.36),paint,cat,.02*scale)
        sphere('Knee',v(x,-.03,.51),sz(.17,.17,.15),'dark',cat)
        cube('Shin',v(x,0,.30),sz(.25,.27,.42),paint,cat,.025*scale)
        cube('Boot',v(x,-.11,.10),sz(.32,.46,.18),'dark',cat,.018*scale)
        cube('Boot toe',v(x,-.31,.10),sz(.27,.08,.12),'steel',cat,.008*scale)
    cube('Pelvis',v(0,0,.94),sz(.66,.4,.24),'dark',edge=.03*scale)
    cube('Utility belt',v(0,-.02,1.02),sz(.74,.44,.12),'leather',edge=.015*scale)
    for side in [-1,1]:
        cube('Belt pouch',v(side*.31,-.12,.98),sz(.15,.20,.18),'leather',edge=.015*scale)
    cube('Body undersuit',v(0,0,1.36),sz(.68,.41,.72),'rubber',edge=.04*scale)
    cube('Front chest armor',v(0,-.245,1.38),sz(.68,.16,.58),paint,edge=.035*scale)
    cube('Chest centre',v(0,-.34,1.42),sz(.40,.06,.32),'dark',edge=.012*scale)
    for h in range(4):cube('Breastplate vent',v(0,-.38,1.32+h*.055),sz(.30,.025,.018),'steel',edge=0)
    cube('Backpack',v(0,.28,1.40),sz(.52,.23,.63),'dark',edge=.035*scale)
    for side in [-1,1]:
        cat='arm_L' if side<0 else 'arm_R';x=side*.48
        sphere('Shoulder joint',v(x,0,1.60),sz(.20,.22,.19),paint,cat)
        cube('Upper arm',v(x,0,1.38),sz(.23,.27,.44),'rubber',cat,.025*scale)
        cube('Armour pauldron',v(x,-.01,1.57),sz(.34,.36,.18),paint,cat,.03*scale)
        sphere('Elbow',v(x,-.01,1.15),sz(.12,.13,.12),'steel',cat)
        cube('Forearm',v(x,-.06,.99),sz(.22,.25,.36),paint,cat,.02*scale)
        sphere('Glove',v(x,-.1,.79),sz(.13,.14,.12),'rubber',cat)
    cube('Neck',v(0,0,1.79),sz(.22,.24,.23),'rubber',edge=.01*scale)
    sphere('Helmet',v(0,0,1.97),sz(.29,.27,.30),paint,segments=16,rings=10)
    cube('Face plate',v(0,-.25,1.93),sz(.45,.13,.30),'dark',edge=.025*scale)
    for side in [-1,1]:
        cylinder('Optical lens',v(side*.115,-.327,2.015),.065*scale,.04*scale,'glow',axis='Y',vertices=12)
        torus('Lens ring',v(side*.115,-.348,2.015),.067*scale,.012*scale,'steel',rotation=(math.pi/2,0,0))
    cube('Respirator',v(0,-.34,1.84),sz(.27,.15,.17),'rubber',edge=.025*scale)
    for side in [-1,1]:cylinder('Filter',v(side*.18,-.31,1.85),.07*scale,.12*scale,'steel',axis='Y')
    if runner:
        cube('Cutting blade',v(.59,-.23,.79),sz(.10,.11,.68),'steel',cat='arm_R',edge=.008*scale,rotation=(.5,0,0))
    else:
        cube('Enemy rifle receiver',v(.50,-.31,1.16),sz(.18,.58,.19),'dark',cat='arm_R',edge=.015*scale)
        cylinder('Rifle barrel',v(.50,-.67,1.18),.045*scale,.38*scale,'steel','arm_R','Y')
        cube('Weapon magazine',v(.5,-.24,.98),sz(.14,.16,.24),'dark',cat='arm_R',edge=.012*scale)
    if tank:
        for side in [-1,1]:
            cube('Reinforced shoulder',v(side*.49,.02,1.67),sz(.4,.45,.2),'hazard',edge=.025*scale)
            cylinder('Hydraulic cylinder',v(side*.41,.25,1.30),.08*scale,.6*scale,'steel')
        sphere('Core housing',v(0,-.38,1.38),sz(.18,.08,.18),'glow')
        torus('Core bezel',v(0,-.45,1.38),.20*scale,.035*scale,'steel',rotation=(math.pi/2,0,0))
    if variant=='boss':
        for side in [-1,1]:
            cylinder('Boss exhaust',v(side*.29,.30,1.75),.10*scale,.65*scale,'dark')
            for j in range(3):torus('Exhaust collar',v(side*.29,.30,1.48+j*.2),.105*scale,.018*scale,'steel')
        cube('Warning plate',v(0,-.48,.99),sz(.36,.04,.12),'hazard',edge=.01)
    finish('enemy_'+name,studio_x)

enemy('runner','runner',0);enemy('guard','guard',4);enemy('tank','tank',8);enemy('boss','boss',12)

def drone():
    sphere('Hull',(0,0,1.68),(.59,.42,.27),'armor',segments=16,rings=8)
    cube('Front lens bezel',(0,-.40,1.68),(.38,.12,.26),'dark',edge=.03)
    sphere('Eye',(0,-.48,1.68),(.12,.06,.12),'glow')
    for side in [-1,1]:
        cube('Wing',(side*.64,0,1.67),(.55,.14,.1),'steel',edge=.02)
        cylinder('Rotor housing',(side*.93,0,1.71),.27,.13,'dark')
        torus('Rotor guard',(side*.93,0,1.79),.29,.028,'steel')
        for ang in [0,math.pi/2,math.pi,math.pi*1.5]:
            cube('Rotor',(side*.93,0,1.79),(.44,.055,.025),'steel',edge=.005,rotation=(0,0,ang))
        cylinder('Thruster',(side*.65,.10,1.49),.11,.28,'dark')
        cylinder('Thruster glow',(side*.65,.10,1.33),.08,.025,'glow')
    finish('enemy_drone',16)
drone()

def weapon_finish(name,studio_x):
    # Common sleeve and gloved shooting hand are part of the view model.
    cube('Arm sleeve',(.13,-.16,-.20),(.23,.45,.19),'armor',edge=.025)
    cube('Gloved hand',(.11,.03,-.11),(.20,.23,.16),'rubber',edge=.025)
    for j in range(3):cube('Knuckle',(.02+j*.07,-.08,-.02),(.055,.12,.06),'leather',edge=.008)
    finish('weapon_'+name,studio_x)

def pistol():
    cube('Receiver',(0,.20,.02),(.19,.45,.18),'dark',edge=.015)
    cube('Frame',(0,.03,-.02),(.17,.28,.19),'steel',edge=.015)
    cylinder('Cylinder',(0,.18,-.025),.105,.17,'steel',axis='X',vertices=12)
    for i in range(6):
        a=i*math.tau/6;cylinder('Chamber',(math.cos(a)*.075,.275,math.sin(a)*.075-.025),.022,.04,'dark',axis='Y',vertices=8)
    cylinder('Barrel',(0,.52,.015),.055,.38,'steel',axis='Y')
    cylinder('Muzzle',(0,.73,.015),.063,.06,'dark',axis='Y')
    cube('Front sight',(0,.67,.09),(.035,.06,.055),'ivory',edge=.004)
    cube('Rear sight',(0,.04,.13),(.10,.07,.05),'dark',edge=.004)
    cube('Grip',(0,-.08,-.15),(.14,.18,.30),'leather',edge=.025,rotation=(.16,0,0))
    torus('Trigger guard',(0,.03,-.14),.09,.012,'steel',rotation=(0,math.pi/2,0))
    weapon_finish('pistol',20)
pistol()

def shotgun():
    cube('Receiver',(0,.13,.015),(.21,.48,.19),'dark',edge=.02)
    cylinder('Long barrel',(0,.65,.07),.055,1.0,'steel',axis='Y',vertices=16)
    cylinder('Magazine tube',(0,.59,-.035),.048,.86,'dark',axis='Y')
    cube('Pump grip',(0,.48,-.075),(.19,.29,.15),'leather',edge=.025)
    for j in range(5):cube('Grip rib',(0,.38+j*.045,-.155),(.18,.015,.02),'dark',edge=.003)
    cube('Stock',(0,-.28,-.07),(.16,.48,.20),'leather',edge=.03,rotation=(.12,0,0))
    cube('Iron sight',(0,.91,.14),(.03,.06,.08),'steel',edge=.004)
    weapon_finish('shotgun',24)
shotgun()

def nailgun():
    cube('Receiver',(0,.25,.02),(.25,.67,.24),'armor',edge=.03)
    cube('Upper guard',(0,.30,.17),(.22,.48,.09),'dark',edge=.015)
    cylinder('Barrel',(0,.66,.02),.055,.28,'steel',axis='Y')
    cube('Magazine',(0,.35,-.20),(.22,.45,.28),'hazard',edge=.025)
    for j in range(5):cube('Magazine ribs',(0,.18+j*.09,-.35),(.18,.022,.02),'dark',edge=.003)
    cube('Grip',(0,-.02,-.18),(.16,.18,.31),'rubber',edge=.02)
    weapon_finish('nailgun',28)
nailgun()

def launcher():
    cylinder('Launch tube',(0,.34,.05),.19,1.10,'armor',axis='Y',vertices=20)
    for y in [-.15,.15,.60,.87]:torus('Tube collar',(0,y,.05),.196,.022,'steel',rotation=(math.pi/2,0,0))
    cylinder('Muzzle',(0,.91,.05),.20,.08,'dark',axis='Y',vertices=20)
    cylinder('Muzzle bore',(0,.96,.05),.14,.012,'rubber',axis='Y',vertices=20)
    cube('Top rail',(0,.20,.27),(.1,.6,.08),'dark',edge=.01)
    cube('Rear sight',(0,-.02,.34),(.18,.08,.11),'steel',edge=.01)
    cube('Grip',(0,-.05,-.18),(.16,.20,.3),'rubber',edge=.02)
    weapon_finish('launcher',32)
launcher()

def fist():
    cube('Armored glove',(.02,.12,-.03),(.31,.37,.22),'leather',edge=.04)
    cube('Back plate',(.02,.12,.10),(.27,.26,.05),'steel',edge=.018)
    for j in range(4):
        x=-.10+j*.08;cube('Finger', (x,.32,.0),(.072,.18,.13),'leather',edge=.018)
        cube('Knuckle pad',(x,.34,.075),(.065,.12,.025),'steel',edge=.006)
    weapon_finish('fist',36)
fist()

def hand():
    weapon_finish('hand',38)
hand()

def console():
    cube('Console cabinet',(0,0,.63),(1.8,.78,1.25),'armor',edge=.04)
    cube('Console top',(0,-.05,1.26),(1.9,.9,.14),'dark',edge=.025)
    cube('Control monitor',(0,.24,1.67),(1.25,.18,.75),'dark',edge=.03)
    cube('Monitor glass',(0,.132,1.69),(1.06,.03,.53),'teal',edge=.01)
    for i in range(5):cube('Readout line',(-.32+i*.14,.11,1.62+i*.035),(.075,.015,.018),'ivory',edge=.003)
    for x in [-.68,-.4,-.12,.16,.44,.72]:
        for y in [-.30,-.10]:cylinder('Control button',(x,y,1.35),.04,.035,'glow' if x==-.12 else 'ivory',vertices=10)
    for s in [-1,1]:cube('Side reinforcement',(s*.83,0,.62),(.12,.85,1.18),'steel',edge=.02)
    finish('prop_console',40)
console()

def furnace():
    cube('Furnace casing',(0,0,1.6),(2.8,1.35,3.2),'rust',edge=.06)
    cube('Firebox rim',(0,-.70,1.4),(2.2,.16,1.8),'dark',edge=.04)
    cube('Firebox',(0,-.80,1.4),(1.8,.05,1.38),'glow',edge=.02)
    for x in [-.82,-.55,-.27,0,.27,.55,.82]:cube('Firebox grate',(x,-.84,1.4),(.06,.08,1.48),'dark',edge=.012)
    for s in [-1,1]:
        cylinder('Pressure pipe',(s*1.1,.22,2.0),.11,2.4,'steel')
        for z in [1,2,2.8]:torus('Pipe collar',(s*1.1,.22,z),.12,.025,'hazard')
    cube('Top cap',(0,0,3.25),(2.95,1.5,.2),'dark',edge=.025)
    for x in [-1.1,-.55,0,.55,1.1]:cube('Top vent',(x,-.5,2.84),(.3,.08,.1),'dark',edge=.01)
    finish('prop_furnace',44)
furnace()

def reactor():
    cylinder('Reactor base',(0,0,.25),1.55,.5,'dark',vertices=24)
    cylinder('Reactor core',(0,0,2.0),.68,3.2,'glow',vertices=20)
    for z in [.55,1.2,2.0,2.8,3.45]:
        torus('Confinement ring',(0,0,z),.96,.12,'steel')
        for a in range(8):
            angle=a*math.tau/8;cylinder('Ring fastener',(math.cos(angle)*.96,math.sin(angle)*.96,z+.10),.045,.1,'dark',vertices=8)
    for a in range(4):
        angle=a*math.tau/4;x=math.cos(angle)*1.16;y=math.sin(angle)*1.16
        cylinder('Support',(x,y,2),.14,3.4,'armor')
        for z in [.6,2,3.4]:torus('Support collar',(x,y,z),.15,.028,'hazard')
    cylinder('Reactor top',(0,0,3.75),1.28,.36,'dark',vertices=20)
    finish('prop_reactor',48)
reactor()

def crate():
    cube('Crate body',(0,0,.62),(1.25,1.25,1.24),'armor',edge=.035)
    for side in [-1,1]:
        cube('Crate rim',(side*.59,0,.62),(.12,1.3,1.26),'steel',edge=.012)
        cube('Crate rim',(0,side*.59,.62),(1.3,.12,1.26),'steel',edge=.012)
    for z in [.12,1.12]:cube('Crate strap',(0,0,z),(1.32,1.32,.11),'dark',edge=.012)
    cube('Warning label',(0,-.67,.62),(.56,.03,.24),'hazard',edge=.008)
    finish('prop_crate',52)
crate()

def barrel():
    cylinder('Barrel',(0,0,.55),.42,1.1,'armor',vertices=20)
    for z in [.12,.5,1.0]:torus('Barrel ring',(0,0,z),.425,.035,'steel')
    cylinder('Lid',(0,0,1.12),.39,.045,'dark',vertices=20)
    cylinder('Cap',(.15,0,1.15),.07,.035,'hazard',vertices=12)
    finish('prop_barrel',56)
barrel()

def forklift():
    # Functional silhouette of a compact, old electric works vehicle.
    cube('Chassis',(0,0,.58),(1.4,2.15,.65),'hazard',edge=.07)
    cube('Counterweight',(0,.85,.91),(1.5,.5,.88),'hazard',edge=.09)
    cube('Cab floor',(0,.05,.98),(1.3,1.2,.16),'dark',edge=.03)
    cube('Seat base',(0,.30,1.15),(.62,.64,.18),'rubber',edge=.06)
    cube('Seat back',(0,.58,1.47),(.65,.18,.72),'rubber',edge=.08,rotation=(-.08,0,0))
    for x in [-.62,.62]:
        for y in [-.68,.68]:
            cylinder('Tyre',(x,y,.34),.34,.23,'rubber',axis='X',vertices=20)
            cylinder('Hubcap',(x+(-.13 if x<0 else .13),y,.34),.17,.03,'steel',axis='X',vertices=16)
        for y in [-.62,.67]:cube('Cab pillar',(x,y,1.7),(.08,.08,1.5),'dark',edge=.014)
    cube('Cab roof',(0,0,2.48),(1.45,1.5,.12),'dark',edge=.03)
    for x in [-.57,-.29,0,.29,.57]:cube('Roof bar',(x,0,2.52),(.04,1.36,.05),'steel',edge=.008)
    for x in [-.44,.44]:
        cube('Fork mast',(x,-1.14,1.42),(.14,.18,2.2),'steel',edge=.02)
        cube('Hydraulic guide',(x,-1.25,1.42),(.06,.08,2.0),'dark',edge=.008)
        cube('Fork tine',(x,-1.85,.16),(.16,1.5,.12),'steel',edge=.014)
    cube('Fork carriage',(0,-1.27,.45),(1.2,.14,.55),'dark',edge=.02)
    cylinder('Warning beacon',(0,.38,2.63),.12,.19,'glow',vertices=12)
    cube('Instrument panel',(0,-.42,1.42),(.66,.12,.32),'dark',edge=.02,rotation=(.25,0,0))
    finish('prop_forklift',60)
forklift()

def generator():
    cube('Generator frame',(0,0,.65),(2.6,1.4,1.2),'dark',edge=.06)
    cube('Motor casing',(-.52,0,1.28),(1.25,1.2,1.05),'armor',edge=.07)
    cylinder('Motor body',(.55,0,1.28),.52,1.4,'steel',axis='X',vertices=20)
    for x in [-.05,.25,.55,.85,1.15]:torus('Motor cooling collar',(x,0,1.28),.53,.025,'dark',rotation=(0,math.pi/2,0))
    cylinder('Motor endcap',(1.28,0,1.28),.49,.10,'dark',axis='X',vertices=20)
    for side in [-1,1]:
        cylinder('Pipe',(side*.85,.48,2.1),.12,1.4,'steel')
        torus('Pipe flange',(side*.85,.48,1.63),.13,.03,'hazard')
    cube('Status panel',(-.52,-.64,1.3),(.75,.05,.45),'dark',edge=.02)
    for x in [-.74,-.52,-.3]:cylinder('Indicator',(x,-.68,1.33),.045,.03,'teal',axis='Y',vertices=10)
    finish('prop_generator',64)
generator()

def gantry():
    for x in [-3.5,3.5]:
        cube('Gantry pillar',(x,0,2.35),(.26,.38,4.7),'dark',edge=.025)
        cube('Foot plate',(x,0,.08),(.75,.85,.16),'steel',edge=.03)
        for z in [1,2,3,4]:cube('Pillar crossbrace',(x,-.2,z),(.45,.1,.08),'hazard',edge=.01)
    cube('Top girder',(0,0,4.52),(7.4,.58,.42),'steel',edge=.025)
    cube('Girder inset',(0,-.32,4.52),(6.9,.08,.22),'dark',edge=.012)
    cube('Crane trolley',(.8,0,4.18),(.85,.8,.38),'hazard',edge=.03)
    cylinder('Hoist cable',(.8,0,3.45),.035,1.2,'steel',vertices=8)
    torus('Hoist hook',(.8,0,2.80),.19,.045,'steel',rotation=(math.pi/2,0,0))
    finish('prop_gantry',68)
gantry()

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'trapanotto_assets.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'trapanotto_assets.glb'),export_format='GLB',export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
with open(OUTPUT/'trapanotto_assets.glb','rb') as src,gzip.open(OUTPUT/'trapanotto_assets.glb.gz','wb',compresslevel=9) as dst:
    shutil.copyfileobj(src,dst)
print('TRAPANOTTO_ASSETS_READY',OUTPUT / 'trapanotto_assets.glb')
