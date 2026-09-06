import bpy, sys, math, pathlib
from mathutils import Vector

species = sys.argv[sys.argv.index("--") + 1]
base = pathlib.Path("/tmp/astra-tree-assets")
bpy.ops.wm.open_mainfile(filepath=str(base / (species + "-prepared.blend")))
short = species.replace("_tree_01", "").replace("tree_small_02", "broadleaf")
group = bpy.data.objects[
    short + "_a_LOD" + (sys.argv[-1] if sys.argv[-1].isdigit() else "0")
]
children = list(group.children)
for o in list(bpy.data.objects):
    if o not in children and o != group:
        bpy.data.objects.remove(o, do_unlink=True)
for o in children:
    o.hide_set(False)
    o.hide_render = False
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.render.resolution_x = 768
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new("Studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (
    0.28,
    0.34,
    0.40,
    1,
)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.65
height = max((o.matrix_world @ Vector(v))[2] for o in children for v in o.bound_box)
bpy.ops.object.light_add(type="SUN", location=(10, -20, 30))
sun = bpy.context.object
sun.rotation_euler = (0.6, -0.5, -0.6)
sun.data.energy = 3
sun.data.angle = 0.12
bpy.ops.mesh.primitive_plane_add(size=height * 30, location=(0, 0, -0.02))
ground = bpy.context.object
m = bpy.data.materials.new("Ground")
m.diffuse_color = (0.14, 0.17, 0.14, 1)
ground.data.materials.append(m)
bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 60
for angle in range(0, 360, 90):
    a = math.radians(angle)
    cam.location = (
        math.sin(a) * height * 1.85,
        -math.cos(a) * height * 1.85,
        height * 0.57,
    )
    cam.rotation_euler = (
        (Vector((0, 0, height * 0.5)) - cam.location)
        .to_track_quat("-Z", "Y")
        .to_euler()
    )
    scene.render.filepath = str(
        base
        / "output"
        / f"{short}-lod{sys.argv[-1] if sys.argv[-1].isdigit() else 0}-{angle}.png"
    )
    bpy.ops.render.render(write_still=True)
