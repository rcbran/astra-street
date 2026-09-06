"""Original Astra S9 coupe. Blender Z-up/nose -Y -> glTF Y-up/nose +Z.
Run: blender -b --python scripts/build_street_car.py
No downloaded mesh, font, texture, or render is required. Output is ignored.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "artifacts" / "street-car"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
static = []

def material(name, color, metal=0, rough=.4, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Emission Color"].default_value = (*color, 1)
    p.inputs["Emission Strength"].default_value = emission
    return m

paint = material("Livery", (.018, .32, .37), .65, .24)
carbon = material("Carbon trim", (.014, .020, .026), .35, .38)
glass = material("Smoked glass", (.026, .052, .068), .72, .13)
rubber = material("Performance tires", (.016, .019, .022), .05, .8)
alloy = material("Machined alloy", (.36, .41, .43), .92, .24)
red = material("Tail lamps", (.72, .012, .003), .15, .25, 1.3)
light = material("LED headlights", (.68, .9, 1), .2, .18, 2.4)
orange = material("Calipers and accents", (.94, .24, .018), .35, .35)

def register(o, mat, group=static):
    o.data.materials.append(mat)
    group.append(o)
    return o

def bevel(o, width=.02):
    mod = o.modifiers.new("Rounded manufacturing edges", "BEVEL")
    mod.width, mod.segments = width, 3
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name, loc, size, mat, edge=.02, group=static):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name, o.scale = name, size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    register(o, mat, group)
    if edge: bevel(o, edge)
    return o

def mesh(name, verts, faces, mat, edge=0, group=static):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    register(o, mat, group)
    if edge: bevel(o, edge)
    return o

def bar(name, a, b, radius, mat, group=static):
    delta = Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=delta.length, location=(Vector(a)+Vector(b))/2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return register(o, mat, group)

def loft(name, sections, mat):
    # Cross-sections around the perimeter, beveled shoulders and lower sills.
    verts, faces = [], []
    for y, w, top in sections:
        for x,z in [(-w*.84,.28),(-w,.37),(-w,.62),(-w*.83,top),(w*.83,top),(w,.62),(w,.37),(w*.84,.28)]:
            verts.append((x,y,z))
    for i in range(len(sections)-1):
        for j in range(8):
            a=i*8+j; b=i*8+(j+1)%8
            faces.append((a,b,b+8,a+8))
    faces += [tuple(reversed(range(8))), tuple(range((len(sections)-1)*8,len(sections)*8))]
    return mesh(name,verts,faces,mat,.045)

body = loft("S9 sculpted body",[(-2.26,.83,.66),(-2.02,.96,.75),(-1.4,1.01,.84),(-.75,.97,.81),(.35,.96,.80),(1.36,1.03,.83),(2.04,.96,.77),(2.25,.87,.70)],paint)
for x in [-.94,.94]:
    for y in [-1.38,1.37]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.395,depth=.65,location=(x,y,.365),rotation=(0,math.pi/2,0))
        cut=bpy.context.object
        bpy.context.view_layer.objects.active=body
        mod=body.modifiers.new("Wheel arch", "BOOLEAN")
        mod.operation="DIFFERENCE"; mod.object=cut
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cut,do_unlink=True)

# Fastback cabin. Window faces, roof, pillars and seams are separate surfaces.
mesh("Roof",[(-.68,-.33,1.30),(.68,-.33,1.30),(.68,.48,1.31),(-.68,.48,1.31)],[(0,1,2,3)],paint)
mesh("Windshield",[(-.79,-.95,.85),(.79,-.95,.85),(.67,-.33,1.29),(-.67,-.33,1.29)],[(0,1,2,3)],glass)
mesh("Rear window",[(-.67,.50,1.30),(.67,.50,1.30),(.80,1.36,.84),(-.80,1.36,.84)],[(0,1,2,3)],glass)
for s in [-1,1]:
    pts=[(s*.88,-.84,.84),(s*.69,-.29,1.28),(s*.69,.47,1.28),(s*.89,1.21,.84)]
    mesh("Side glazing",pts,[(0,1,2,3)],glass)
    for a,b in zip(pts,pts[1:]+pts[:1]): bar("Cabin frame",a,b,.038,paint)
    bar("B pillar",(s*.76,.42,1.28),(s*.88,.45,.84),.043,carbon)
    box("Lower sill",(s*.96,0,.29),(.10,2.10,.13),carbon)
    box("Door handle",(s*.977,.39,.72),(.02,.15,.033),alloy,.007)
    box("Mirror stalk",(s*1.00,-.72,.87),(.19,.07,.045),carbon,.012)
    box("Mirror",(s*1.09,-.72,.90),(.19,.28,.12),paint,.04)
    box("Mirror glass",(s*1.09,-.57,.90),(.13,.012,.07),glass,.005)
    box("Hood vent",(s*.49,-1.39,.834),(.20,.37,.016),carbon,.02)
    box("LED brow",(s*.56,-2.214,.675),(.49,.025,.055),light,.012)
    box("Front intake",(s*.61,-2.215,.46),(.28,.027,.17),carbon,.018)
    box("Spoiler mount",(s*.62,1.86,.96),(.055,.15,.31),carbon,.01)
    box("Rear exhaust",(s*.60,2.26,.35),(.19,.13,.10),alloy,.03)
    box("Exhaust opening",(s*.60,2.332,.35),(.13,.011,.057),carbon,.018)
box("Front grille",(0,-2.263,.47),(.71,.027,.18),carbon,.015)
box("Front splitter",(0,-2.18,.27),(1.99,.42,.045),carbon,.012)
box("Rear diffuser",(0,2.18,.29),(1.72,.28,.12),carbon,.025)
for x in [-.66,-.33,0,.33,.66]: box("Diffuser fin",(x,2.24,.24),(.025,.37,.14),carbon,.005)
box("Rear tail light strip",(0,2.23,.67),(1.63,.030,.055),red,.012)
box("Rear deck spoiler",(0,1.93,1.135),(2.02,.31,.055),carbon,.014)
box("Rear badge panel",(0,2.265,.50),(.30,.012,.095),alloy,.008)

def join(objects,name,origin=(0,0,0)):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    o=bpy.context.object; o.name=name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.scene.cursor.location=origin
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    # Normals are evaluated from the beveled geometry without extra runtime work.
    return o

join(static,"Astra_S9_body")
for code,x,y in [("FL",-.94,-1.38),("FR",.94,-1.38),("RL",-.94,1.37),("RR",.94,1.37)]:
    group=[]
    center=(x,y,.365)
    bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=12,location=center,rotation=(0,math.pi/2,0),major_radius=.272,minor_radius=.093)
    register(bpy.context.object,rubber,group)
    s=1 if x>0 else -1
    outer=x+s*.075
    bar("Hub",(x-s*.07,y,.365),(outer,y,.365),.105,alloy,group)
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,location=(outer,y,.365),rotation=(0,math.pi/2,0),major_radius=.246,minor_radius=.016)
    register(bpy.context.object,alloy,group)
    for i in range(7):
        a=i*math.pi*2/7
        bar("Forged spoke",(outer,y+.065*math.cos(a),.365+.065*math.sin(a)),(outer,y+.237*math.cos(a+.10),.365+.237*math.sin(a+.10)),.017,alloy,group)
    box("Caliper",(x,y+.16,.41),(.08,.09,.21),orange,.018,group)
    join(group,"wheel_"+code,center)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(OUT/"astra-s9.glb"),export_format="GLB",export_yup=True,export_cameras=False,export_lights=False,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"astra-s9.blend"))
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.data.objects if o.type=="MESH")
print(json.dumps({"triangles":triangles,"glb":str(OUT/"astra-s9.glb"),"bytes":(OUT/"astra-s9.glb").stat().st_size}))
