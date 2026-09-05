"""Original Astra AF-27 formula car. Blender 5.x; no third-party mesh/texture assets.
Run: blender -b --python scripts/build_car.py -- [--preview] [--output-dir PATH]
Blender construction: Z-up, nose -Y; glTF export: Y-up, nose +Z.
"""

import bpy, math, os, json, argparse, sys
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi

parser = argparse.ArgumentParser(description="Build the original Astra AF-27 car")
parser.add_argument(
    "--output-dir",
    type=Path,
    default=Path(__file__).resolve().parents[1] / "artifacts" / "car",
)
parser.add_argument(
    "--preview",
    action="store_true",
    help="Also render studio and cockpit verification images",
)
args = parser.parse_args(
    sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
)
args.output_dir.mkdir(parents=True, exist_ok=True)
OUT = str(args.output_dir)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for mat in list(bpy.data.materials):
    bpy.data.materials.remove(mat)
static = []
wheelgroups = {}


def material(name, color, metal=0, rough=0.4):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    return m


red = material("Livery", (0.61, 0.030, 0.012), 0.52, 0.27)
cream = material("Warm porcelain accents", (0.94, 0.84, 0.62), 0.15, 0.32)
carbon = material("Carbon composite", (0.019, 0.024, 0.028), 0.35, 0.39)
metal = material("Forged titanium", (0.22, 0.26, 0.28), 0.88, 0.25)
visor = material("Smoked iridium visor", (0.025, 0.085, 0.11), 0.88, 0.16)
rubber = material("Slick rubber and sidewall print", (0.032, 0.035, 0.037), 0, 0.78)
for m in (red, metal, visor, rubber):
    m.use_backface_culling = True
vertex_node = rubber.node_tree.nodes.new("ShaderNodeVertexColor")
vertex_node.layer_name = "Color"
rubber.node_tree.links.new(
    vertex_node.outputs["Color"],
    rubber.node_tree.nodes.get("Principled BSDF").inputs["Base Color"],
)
fontpath = "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf"
font = bpy.data.fonts.load(fontpath) if os.path.exists(fontpath) else None


def register(o, mat, group=None, smooth=True):
    o.data.materials.append(mat)
    if smooth and o.type == "MESH":
        for p in o.data.polygons:
            p.use_smooth = True
    (static if group is None else wheelgroups[group]).append(o)
    return o


def mesh(name, verts, faces, mat, group=None, smooth=True):
    d = bpy.data.meshes.new(name)
    d.from_pydata(verts, [], faces)
    d.update()
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    return register(o, mat, group, smooth)


def bevel(o, width=0.02, segments=2):
    m = o.modifiers.new("Soft machined edges", "BEVEL")
    m.width = width
    m.segments = segments
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def box(name, loc, scale, mat, edge=0.01, group=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    register(o, mat, group)
    if edge:
        bevel(o, edge, 2)
    return o


def uvball(name, loc, scale, mat, group=None, seg=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=rings, radius=1, location=loc
    )
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return register(o, mat, group)


def bar(name, a, b, r, mat, group=None, vertices=8):
    vec = Vector(b) - Vector(a)
    mid = (Vector(a) + Vector(b)) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=r, depth=vec.length, location=mid
    )
    o = bpy.context.object
    o.name = name
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = vec.to_track_quat("Z", "Y")
    return register(o, mat, group)


def tube(name, points, r, mat, group=None, segments=8):
    v = []
    f = []
    for i, p in enumerate(points):
        t = (
            Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])
        ).normalized()
        a = t.cross(Vector((0, 0, 1))).normalized()
        if a.length < 0.1:
            a = t.cross(Vector((0, 1, 0))).normalized()
        b = t.cross(a).normalized()
        for j in range(segments):
            v.append(
                Vector(p)
                + r * (cos(j * 2 * pi / segments) * a + sin(j * 2 * pi / segments) * b)
            )
    for i in range(len(points) - 1):
        for j in range(segments):
            n = i * segments + j
            nn = i * segments + (j + 1) % segments
            f.append((n, nn, nn + segments, n + segments))
    f += [
        tuple(reversed(range(segments))),
        tuple(range((len(points) - 1) * segments, len(points) * segments)),
    ]
    return mesh(name, v, f, mat, group)


def loft(name, sections, mat, n=24, power=0.7):
    # y, center-x, half-width, bottom-z, top-z
    v = []
    f = []
    for y, cx, w, zb, zt in sections:
        for j in range(n):
            a = 2 * pi * j / n
            cxr = math.copysign(abs(cos(a)) ** power, cos(a))
            zr = math.copysign(abs(sin(a)) ** power, sin(a))
            v.append((cx + w * cxr, y, (zb + zt) * 0.5 + (zt - zb) * 0.5 * zr))
    for i in range(len(sections) - 1):
        for j in range(n):
            f.append(
                (
                    i * n + j,
                    i * n + (j + 1) % n,
                    (i + 1) * n + (j + 1) % n,
                    (i + 1) * n + j,
                )
            )
    f.extend(
        [
            tuple(reversed(range(n))),
            tuple(range((len(sections) - 1) * n, len(sections) * n)),
        ]
    )
    return mesh(name, v, f, mat)


def extrude_outline(name, xy, z0, z1, mat):
    n = len(xy)
    v = [(x, y, z) for z in (z0, z1) for x, y in xy]
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    for j in range(n):
        f.append((j, (j + 1) % n, (j + 1) % n + n, j + n))
    return bevel(mesh(name, v, f, mat, smooth=False), 0.006, 2)


def text(name, body, loc, size, mat, rotation=(0, 0, 0), group=None):
    c = bpy.data.curves.new(name, "FONT")
    c.body = body
    c.size = size
    c.align_x = "CENTER"
    c.align_y = "CENTER"
    c.extrude = 0
    c.resolution_u = 3
    c.space_character = 1.08
    if font:
        c.font = font
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rotation
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.object
    o.select_set(False)
    return register(o, mat, group, smooth=False)


def wing(name, y, z, halfspan, chord, mat, upsweep=0):
    xs = [-1, -0.94, -0.76, -0.5, -0.22, 0, 0.22, 0.5, 0.76, 0.94, 1]
    v = []
    f = []
    # An actual rounded aerofoil cross-section, taper/sweep varying over span.
    prof = [
        (0, 0),
        (0.06, 0.010),
        (0.26, 0.018),
        (0.60, 0.013),
        (1, 0),
        (0.60, -0.008),
        (0.24, -0.012),
        (0.055, -0.007),
    ]
    for t in xs:
        yy = y + 0.11 * abs(t) ** 1.7
        zz = z + upsweep * abs(t) ** 2
        cc = chord * (1 - 0.15 * abs(t))
        for u, h in prof:
            v.append((t * halfspan, yy + (u - 0.5) * cc, zz + h + u * 0.048))
    for i in range(len(xs) - 1):
        for j in range(len(prof)):
            f.append(
                (
                    i * 8 + j,
                    i * 8 + (j + 1) % 8,
                    (i + 1) * 8 + (j + 1) % 8,
                    (i + 1) * 8 + j,
                )
            )
    f += [tuple(reversed(range(8))), tuple(range((len(xs) - 1) * 8, len(xs) * 8))]
    return mesh(name, v, f, mat)


# Continuous lower survival cell and characteristic tapered nose.
loft(
    "Lower survival cell",
    [
        (-1.55, 0, 0.13, 0.19, 0.40),
        (-0.9, 0, 0.255, 0.19, 0.56),
        (-0.38, 0, 0.34, 0.18, 0.64),
        (0.5, 0, 0.34, 0.17, 0.59),
        (1.18, 0, 0.25, 0.17, 0.56),
        (1.85, 0, 0.17, 0.20, 0.41),
    ],
    red,
)
loft(
    "Slender tapered nose",
    [
        (-2.72, 0, 0.065, 0.23, 0.29),
        (-2.58, 0, 0.10, 0.24, 0.34),
        (-2.18, 0, 0.115, 0.25, 0.41),
        (-1.65, 0, 0.145, 0.29, 0.49),
        (-1.12, 0, 0.22, 0.34, 0.60),
        (-0.62, 0, 0.30, 0.38, 0.68),
        (-0.34, 0, 0.33, 0.42, 0.695),
    ],
    red,
)
# Nose graphic ribbon follows the upper ridge.
v = []
for y, w, z in [
    (-2.69, 0.024, 0.301),
    (-2.57, 0.025, 0.349),
    (-2.18, 0.032, 0.419),
    (-1.65, 0.039, 0.499),
    (-1.12, 0.052, 0.609),
    (-0.62, 0.062, 0.689),
    (-0.36, 0.065, 0.704),
]:
    v.extend([(-w, y, z), (w, y, z)])
mesh(
    "Cream nose spear",
    v,
    [(i, i + 1, i + 3, i + 2) for i in range(0, len(v) - 2, 2)],
    cream,
    smooth=False,
)
text("Nose number", "27", (0, -1.29, 0.597), 0.21, carbon, (0.17, 0, 0))
text("Nose ASTRA", "A S T R A", (0, -0.76, 0.685), 0.075, carbon, (0.10, 0, 0))

# Actual cockpit opening, rim, headrest and safety halo.
loft(
    "Cockpit tub",
    [
        (-0.40, 0, 0.32, 0.38, 0.49),
        (-0.21, 0, 0.35, 0.37, 0.49),
        (0.50, 0, 0.35, 0.37, 0.49),
        (0.76, 0, 0.29, 0.39, 0.53),
    ],
    carbon,
    power=0.35,
)
for s in (-1, 1):
    loft(
        "Cockpit coaming",
        [
            (-0.35, s * 0.285, 0.071, 0.47, 0.697),
            (-0.13, s * 0.332, 0.065, 0.47, 0.698),
            (0.36, s * 0.338, 0.07, 0.48, 0.726),
            (0.62, s * 0.295, 0.078, 0.47, 0.756),
            (0.82, s * 0.22, 0.09, 0.46, 0.77),
        ],
        red,
        n=16,
        power=0.65,
    )
    uvball(
        "Padded cockpit head support",
        (s * 0.239, 0.44, 0.645),
        (0.072, 0.18, 0.07),
        carbon,
        seg=16,
        rings=8,
    )
box("Seat shell", (0, 0.40, 0.51), (0.37, 0.34, 0.18), carbon, 0.045)
uvball("Driver shoulders", (0, 0.31, 0.602), (0.228, 0.165, 0.16), red)
head_start = len(static)
uvball(
    "Driver helmet", (0, 0.275, 0.807), (0.147, 0.155, 0.177), cream, seg=28, rings=14
)
# Helmet red crown/stripe, black/iridium curved visor facing nose.
uvball(
    "Helmet red crown", (0, 0.272, 0.878), (0.141, 0.15, 0.109), red, seg=24, rings=10
)
uvball(
    "Visor surround", (0, 0.158, 0.812), (0.139, 0.063, 0.064), carbon, seg=24, rings=8
)
uvball("Visor glass", (0, 0.139, 0.817), (0.125, 0.047, 0.048), visor, seg=24, rings=8)
for s in (-1, 1):
    uvball(
        "Visor pivot",
        (s * 0.137, 0.215, 0.815),
        (0.008, 0.019, 0.019),
        metal,
        seg=12,
        rings=6,
    )
head_objects = static[head_start:]
del static[head_start:]
bar("Steering wheel shaft", (0, -0.16, 0.46), (0, -0.215, 0.615), 0.017, metal)
box("Steering wheel", (0, -0.227, 0.618), (0.275, 0.055, 0.10), carbon, 0.022)
# Halo swept hoop, front center pillar and rear side mounts.
pts = []
for i in range(33):
    a = -pi / 2 + 2 * pi * i / 32
    pts.append((0.355 * cos(a), 0.12 + 0.49 * sin(a), 0.986 - 0.03 * max(0, sin(a))))
tube("Halo titanium hoop", pts, 0.029, carbon, segments=10)
bar(
    "Halo forward pillar",
    (0, -0.44, 0.678),
    (0, -0.371, 0.977),
    0.027,
    carbon,
    vertices=10,
)
for s in (-1, 1):
    bar(
        "Halo rear pillar",
        (s * 0.283, 0.60, 0.714),
        (s * 0.278, 0.438, 0.962),
        0.034,
        carbon,
        vertices=10,
    )

# Roll hoop, airbox, engine shoulder, dorsal fin and rear bodywork.
loft(
    "Airbox and engine spine",
    [
        (0.56, 0, 0.14, 0.60, 0.91),
        (0.66, 0, 0.16, 0.59, 1.08),
        (0.84, 0, 0.16, 0.53, 1.085),
        (1.08, 0, 0.19, 0.43, 0.91),
        (1.47, 0, 0.20, 0.33, 0.73),
        (1.93, 0, 0.12, 0.27, 0.48),
        (2.10, 0, 0.09, 0.25, 0.37),
    ],
    red,
    n=24,
    power=0.68,
)
loft(
    "Airbox cream rim",
    [(0.630, 0, 0.108, 0.861, 1.055), (0.652, 0, 0.115, 0.85, 1.062)],
    cream,
    n=20,
    power=0.9,
)
loft(
    "Airbox dark intake",
    [(0.619, 0, 0.085, 0.887, 1.032), (0.635, 0, 0.09, 0.88, 1.037)],
    carbon,
    n=20,
    power=0.9,
)
mesh(
    "Dorsal stability fin",
    [
        (-0.014, 0.82, 0.94),
        (-0.014, 1.02, 0.91),
        (-0.014, 1.76, 0.66),
        (-0.014, 2.02, 0.47),
        (-0.014, 1.27, 0.52),
        (0.014, 0.82, 0.94),
        (0.014, 1.02, 0.91),
        (0.014, 1.76, 0.66),
        (0.014, 2.02, 0.47),
        (0.014, 1.27, 0.52),
    ],
    [
        (0, 1, 2, 3, 4),
        (9, 8, 7, 6, 5),
        (0, 5, 6, 1),
        (1, 6, 7, 2),
        (2, 7, 8, 3),
        (3, 8, 9, 4),
        (4, 9, 5, 0),
    ],
    red,
    smooth=False,
)
for s in (-1, 1):
    # Undercut pods sit above a full-width carbon floor, with open black mouths.
    loft(
        "Sculpted sidepod",
        [
            (-0.33, s * 0.48, 0.19, 0.39, 0.63),
            (-0.18, s * 0.52, 0.26, 0.35, 0.70),
            (0.10, s * 0.51, 0.285, 0.32, 0.74),
            (0.53, s * 0.49, 0.30, 0.31, 0.73),
            (0.91, s * 0.435, 0.265, 0.29, 0.66),
            (1.22, s * 0.37, 0.215, 0.25, 0.55),
            (1.62, s * 0.28, 0.15, 0.23, 0.42),
            (1.84, s * 0.235, 0.09, 0.235, 0.33),
        ],
        red,
        n=24,
        power=0.38,
    )
    loft(
        "Sidepod inlet surround",
        [
            (-0.345, s * 0.48, 0.183, 0.43, 0.635),
            (-0.318, s * 0.49, 0.19, 0.415, 0.645),
        ],
        cream,
        n=16,
        power=0.35,
    )
    loft(
        "Deep sidepod inlet",
        [
            (-0.354, s * 0.48, 0.155, 0.45, 0.613),
            (-0.340, s * 0.48, 0.164, 0.44, 0.622),
        ],
        carbon,
        n=16,
        power=0.35,
    )
    # Pod upper shoulder accent sweeps into coke-bottle waist.
    v = []
    for y, xc, z in [
        (-0.10, 0.62, 0.737),
        (0.12, 0.65, 0.758),
        (0.52, 0.63, 0.748),
        (0.9, 0.555, 0.675),
        (1.18, 0.45, 0.571),
        (1.49, 0.345, 0.451),
    ]:
        v += [(s * (xc - 0.026), y, z), (s * (xc + 0.026), y, z)]
    mesh(
        "Sidepod cream shoulder ribbon",
        v,
        [(i, i + 1, i + 3, i + 2) for i in range(0, len(v) - 2, 2)],
        cream,
        smooth=False,
    )
    # Parallel pressure-relief louvres sit on the upper ramp.
    for j in range(7):
        y = 0.74 + j * 0.063
        x = 0.39 - (y - 0.74) * 0.20
        z = 0.705 - (y - 0.74) * 0.34
        o = box(
            "Engine cooling louvre", (s * x, y, z), (0.19, 0.019, 0.008), carbon, 0.003
        )
        o.rotation_euler[1] = s * 0.08
    text(
        "Sidepod ASTRA",
        "ASTRA",
        (s * 0.799, 0.28, 0.522),
        0.158,
        cream,
        (pi / 2, 0, s * pi / 2),
    )
    text(
        "Sidepod racing identity",
        "FORMULA / 27",
        (s * 0.800, 0.29, 0.425),
        0.037,
        cream,
        (pi / 2, 0, s * pi / 2),
    )
    # Rear number follows the engine shoulder plane.
    text(
        "Engine cover number",
        "27",
        (s * 0.203, 1.14, 0.68),
        0.145,
        cream,
        (pi / 2, 0, s * pi / 2),
    )
    # Small mirror stalk and aerodynamic housing.
    bar(
        "Mirror mounting arm",
        (s * 0.32, -0.28, 0.64),
        (s * 0.52, -0.42, 0.76),
        0.012,
        carbon,
    )
    uvball(
        "Mirror housing",
        (s * 0.545, -0.427, 0.765),
        (0.095, 0.040, 0.037),
        red,
        seg=16,
        rings=8,
    )
    box("Mirror glass", (s * 0.544, -0.386, 0.765), (0.132, 0.006, 0.039), visor, 0.012)

floor = [
    (-0.18, -1.56),
    (-0.34, -1.28),
    (-0.77, -0.72),
    (-0.82, -0.10),
    (-0.78, 1.36),
    (-0.55, 2.16),
    (0.55, 2.16),
    (0.78, 1.36),
    (0.82, -0.10),
    (0.77, -0.72),
    (0.34, -1.28),
    (0.18, -1.56),
]
extrude_outline("Ground effect carbon floor", floor, 0.105, 0.140, carbon)
# Outer floor edge flicks and front fences.
for s in (-1, 1):
    tube(
        "Floor edge blade",
        [
            (s * 0.78, -0.63, 0.147),
            (s * 0.818, -0.1, 0.150),
            (s * 0.80, 0.67, 0.155),
            (s * 0.75, 1.32, 0.21),
        ],
        0.016,
        carbon,
    )
    for x in (0.41, 0.55, 0.69):
        mesh(
            "Venturi inlet fence",
            [
                (s * x, -0.93, 0.14),
                (s * x, -0.49, 0.14),
                (s * (x + 0.025), -0.36, 0.30),
                (s * (x + 0.025), -0.72, 0.28),
            ],
            [(0, 1, 2, 3)],
            carbon,
            smooth=False,
        )
    mesh(
        "Floor exit kicker",
        [
            (s * 0.63, 1.27, 0.14),
            (s * 0.66, 1.57, 0.21),
            (s * 0.53, 1.94, 0.28),
            (s * 0.48, 1.81, 0.18),
        ],
        [(0, 1, 2, 3)],
        carbon,
        smooth=False,
    )
# Underbody diffuser with vertical strakes visible in chase camera.
mesh(
    "Upswept diffuser",
    [(-0.52, 1.65, 0.12), (0.52, 1.65, 0.12), (0.56, 2.20, 0.29), (-0.56, 2.20, 0.29)],
    [(0, 1, 2, 3)],
    carbon,
    smooth=False,
)
for x in (-0.45, -0.27, -0.09, 0.09, 0.27, 0.45):
    mesh(
        "Diffuser strake",
        [(x, 1.55, 0.103), (x, 2.20, 0.11), (x, 2.20, 0.30), (x, 1.64, 0.14)],
        [(0, 1, 2, 3)],
        carbon,
        smooth=False,
    )

# Multi-element front wing with swept span, curling endplates and mounts.
wing("Front mainplane", -2.66, 0.12, 0.985, 0.42, carbon, 0.035)
wing("Front second element", -2.46, 0.165, 0.955, 0.24, red, 0.055)
wing("Front third element", -2.30, 0.218, 0.92, 0.21, red, 0.065)
wing("Front upper flap", -2.15, 0.282, 0.86, 0.19, cream, 0.062)
for s in (-1, 1):
    # Plate sides are thickness extruded in X.
    yz = [
        (-2.77, 0.12),
        (-2.71, 0.255),
        (-2.46, 0.32),
        (-2.04, 0.385),
        (-2.00, 0.22),
        (-2.11, 0.10),
    ]
    v = [(s * (0.958 + dx), y, z) for dx in (-0.014, 0.014) for y, z in yz]
    n = len(yz)
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)
    ]
    bevel(mesh("Front curled endplate", v, f, red, smooth=False), 0.012, 2)
    bar(
        "Front wing nose mounting pylon",
        (s * 0.071, -2.43, 0.315),
        (s * 0.071, -2.43, 0.145),
        0.019,
        carbon,
    )
    for x in (0.36, 0.68):
        bar(
            "Front flap adjuster",
            (s * x, -2.46, 0.18),
            (s * x, -2.18, 0.319),
            0.008,
            metal,
        )
    # Floating small cream endplate line.
    tube(
        "Front wing endplate accent",
        [
            (s * 0.974, -2.69, 0.249),
            (s * 0.974, -2.43, 0.311),
            (s * 0.974, -2.10, 0.358),
        ],
        0.009,
        cream,
        segments=6,
    )

# Rear wing: raised endplates, spoon mainplane, slotted DRS flap.
wing("Rear lower beam wing", 2.09, 0.40, 0.60, 0.28, carbon, 0.018)
wing("Rear mainplane", 2.39, 0.841, 0.696, 0.47, red, 0.057)
wing("Rear DRS element", 2.562, 0.980, 0.675, 0.29, cream, 0.023)
for s in (-1, 1):
    yz = [
        (2.12, 0.53),
        (2.37, 0.55),
        (2.704, 0.76),
        (2.712, 1.055),
        (2.48, 1.075),
        (2.18, 0.943),
    ]
    v = [(s * (0.699 + dx), y, z) for dx in (-0.016, 0.016) for y, z in yz]
    n = len(yz)
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)
    ]
    bevel(mesh("Rear endplate", v, f, red, smooth=False), 0.014, 3)
    text(
        "Rear endplate number",
        "27",
        (s * 0.717, 2.465, 0.811),
        0.172,
        cream,
        (pi / 2, 0, s * pi / 2),
    )
    bar(
        "Swan neck rear wing pylon",
        (s * 0.105, 1.97, 0.35),
        (s * 0.105, 2.22, 0.795),
        0.028,
        carbon,
    )
    bar("DRS hinge", (s * 0.54, 2.49, 0.886), (s * 0.54, 2.56, 0.985), 0.012, metal)
decal = text("Rear wing ASTRA", "A S T R A", (0, 2.567, 0), 0.142, carbon, (0, 0, pi))
# Project typography onto the curved flap's actual upper surface.
for vertex in decal.data.vertices:
    x = -vertex.co.x
    y = 2.567 - vertex.co.y
    t = abs(x / 0.675)
    chord = 0.29 * (1 - 0.15 * t)
    u = (y - (2.562 + 0.11 * t**1.7)) / chord + 0.5
    profile = [(0, 0), (0.06, 0.010), (0.26, 0.018), (0.60, 0.013), (1, 0)]
    h = 0
    for (u0, h0), (u1, h1) in zip(profile, profile[1:]):
        if u0 <= u <= u1:
            h = h0 + (h1 - h0) * (u - u0) / (u1 - u0)
            break
    vertex.co.z = 0.980 + 0.023 * t * t + h + u * 0.048 + 0.0015
box("DRS actuator", (0, 2.42, 0.934), (0.055, 0.23, 0.045), carbon, 0.012)
bar("DRS ram", (0, 2.42, 0.953), (0, 2.577, 1.011), 0.010, metal)
# Powertrain, crash structure, exhaust and rain light.
loft(
    "Rear gearbox",
    [
        (1.4, 0, 0.18, 0.19, 0.41),
        (1.94, 0, 0.14, 0.19, 0.37),
        (2.17, 0, 0.10, 0.19, 0.29),
    ],
    carbon,
    n=16,
)
bar("Titanium exhaust", (0, 1.71, 0.445), (0, 2.115, 0.447), 0.039, metal, vertices=16)
bar(
    "Exhaust dark aperture",
    (0, 2.111, 0.447),
    (0, 2.125, 0.447),
    0.028,
    carbon,
    vertices=16,
)
box("Rear crash box", (0, 2.11, 0.221), (0.17, 0.32, 0.115), carbon, 0.015)
box("Rain light lens", (0, 2.278, 0.239), (0.085, 0.014, 0.047), red, 0.005)
for x in (-0.026, 0, 0.026):
    for z in (0.23, 0.248):
        uvball(
            "Rain light diode",
            (x, 2.289, z),
            (0.008, 0.003, 0.005),
            cream,
            seg=8,
            rings=4,
        )

# Suspension: independent carbon wishbones, pullrods, steering links, brake ducts.
for axle, y in [("F", -1.61), ("R", 1.60)]:
    for side, s in [("L", -1), ("R", 1)]:
        # Both wheel groups retain local axle centers for runtime steer/spin.
        name = "wheel_" + axle + side
        wheelgroups[name] = []
        x = s * 0.802
        wheelgroups[name + "_center"] = (x, y, 0.36)
        for z, spread in [(0.265, 0.26), (0.43, 0.21)]:
            for dy in (-spread, spread):
                bar(
                    "Carbon suspension wishbone",
                    (s * (0.14 if axle == "F" else 0.22), y + dy, z + 0.055),
                    (s * 0.78, y, z),
                    0.014,
                    carbon,
                )
        bar(
            "Suspension pull rod",
            (s * (0.145 if axle == "F" else 0.22), y - 0.12, 0.20),
            (s * 0.76, y, 0.475),
            0.013,
            metal,
        )
        bar(
            "Track rod",
            (s * (0.145 if axle == "F" else 0.22), y + 0.135, 0.32),
            (s * 0.78, y + 0.08, 0.325),
            0.012,
            carbon,
        )
        box("Upright", (s * 0.76, y, 0.36), (0.06, 0.13, 0.26), carbon, 0.015)
        uvball(
            "Brake cooling scoop",
            (s * 0.645, y - 0.05, 0.405),
            (0.065, 0.15, 0.095),
            carbon,
            seg=16,
            rings=8,
        )
        # Slick lathe surface with rounded shoulders and deep sidewalls. Axle X.
        half = 0.180 if axle == "F" else 0.198
        profile = [
            (-half * 0.87, 0.235),
            (-half * 0.98, 0.262),
            (-half, 0.302),
            (-half * 0.94, 0.333),
            (-half * 0.78, 0.351),
            (-half * 0.45, 0.36),
            (half * 0.45, 0.36),
            (half * 0.78, 0.351),
            (half * 0.94, 0.333),
            (half, 0.302),
            (half * 0.98, 0.262),
            (half * 0.87, 0.235),
        ]
        v = []
        f = []
        N = 64
        for xx, r in profile:
            for j in range(N):
                a = j * 2 * pi / N
                v.append((x + xx, y + r * sin(a), 0.36 + r * cos(a)))
        for i in range(len(profile) - 1):
            for j in range(N):
                f.append(
                    (
                        i * N + j,
                        i * N + (j + 1) % N,
                        (i + 1) * N + (j + 1) % N,
                        (i + 1) * N + j,
                    )
                )
        o = mesh("Smooth broad slick tire", v, f, rubber, name)
        # Vertex colors also allow baked cream sidewall typography with same draw primitive.
        col = o.data.color_attributes.new(
            name="Color", type="BYTE_COLOR", domain="CORNER"
        )
        for c in col.data:
            c.color = (0.031, 0.034, 0.036, 1)

        # Rim barrel/rings. Axis circles are wound around X.
        def ring(nm, xx, r, t, mat):
            pts = [
                (xx, y + r * sin(j * 2 * pi / 40), 0.36 + r * cos(j * 2 * pi / 40))
                for j in range(41)
            ]
            return tube(nm, pts, t, mat, name, segments=5)

        for face_s in (-1, 1):
            xx = x + face_s * half * 0.91
            ring("Machined wheel rim lip", xx, 0.230, 0.010, metal)
            ring("Wheel barrel dark edge", xx - face_s * 0.012, 0.216, 0.012, carbon)
            # 18-inch aero wheel cover, shallow dishes modeled with cap cylinders.
            bar(
                "Satin aero wheel cover",
                (xx - face_s * 0.025, y, 0.36),
                (xx - face_s * 0.003, y, 0.36),
                0.209,
                carbon,
                name,
                vertices=48,
            )
            ring(
                "Wheel cover concentric detail",
                xx + face_s * 0.001,
                0.172,
                0.0045,
                metal,
            )
            for j in range(10):
                a = j * 2 * pi / 10
                # Slender radial ribs on aero cover, no glowing brake rotors.
                a0 = (xx + face_s * 0.004, y + 0.085 * sin(a), 0.36 + 0.085 * cos(a))
                a1 = (
                    xx + face_s * 0.004,
                    y + 0.196 * sin(a + 0.14),
                    0.36 + 0.196 * cos(a + 0.14),
                )
                bar("Forged aero spoke", a0, a1, 0.009, metal, name, vertices=6)
            bar(
                "Center lock hub",
                (xx - face_s * 0.006, y, 0.36),
                (xx + face_s * 0.016, y, 0.36),
                0.054,
                metal,
                name,
                vertices=12,
            )
            bar(
                "Center lock recess",
                (xx + face_s * 0.016, y, 0.36),
                (xx + face_s * 0.019, y, 0.36),
                0.022,
                carbon,
                name,
                vertices=12,
            )
            # Contrasting sidewall racing marks on the outer visible shoulder.
            if face_s == s:
                for word, zoff in [("ASTRA", 0.284), ("S / 72", -0.282)]:
                    # Original fictional tire marque; use no real tire brand.
                    o = text(
                        "Tire sidewall print",
                        word,
                        (x + s * (half + 0.001), y, 0.36 + zoff),
                        0.046,
                        rubber,
                        (pi / 2, 0, s * pi / 2),
                        name,
                    )
                    col = o.data.color_attributes.new(
                        name="Color", type="BYTE_COLOR", domain="CORNER"
                    )
                    for c in col.data:
                        c.color = (0.82, 0.74, 0.51, 1)
                # Single compound dot and wear witness mark.
                o = uvball(
                    "Compound marker",
                    (x + s * (half + 0.001), y + 0.292, 0.36),
                    (0.002, 0.012, 0.012),
                    rubber,
                    name,
                    seg=10,
                    rings=6,
                )
                col = o.data.color_attributes.new(
                    name="Color", type="BYTE_COLOR", domain="CORNER"
                )
                for c in col.data:
                    c.color = (0.82, 0.74, 0.51, 1)


# Merge geometry by material into five static primitives plus four independent wheels.
# Apply all transforms; origins of wheel groups are at axle centers after merging.
def join_objects(objects, name, origin=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    # Remove duplicate material slots generated by joining, preserving assignments.
    old = list(o.data.materials)
    unique = []
    remap = {}
    for i, m in enumerate(old):
        if m not in unique:
            unique.append(m)
        remap[i] = unique.index(m)
    poly_mats = [remap[p.material_index] for p in o.data.polygons]
    o.data.materials.clear()
    for m in unique:
        o.data.materials.append(m)
    for p, i in zip(o.data.polygons, poly_mats):
        p.material_index = i
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if origin:
        bpy.context.scene.cursor.location = origin
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    o.select_set(False)
    return o


body = join_objects(static, "Astra_AF27_body")
head = join_objects(head_objects, "driver_head")
for name in ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"]:
    join_objects(wheelgroups[name], name, wheelgroups[name + "_center"])
carobjects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
# Recalculate normals consistently, preserving the deliberate aero shapes.
for o in carobjects:
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    o.select_set(False)
# Center model longitudinally; wheel local origins stay at their own axles.
all_before = [o.matrix_world @ v.co for o in carobjects for v in o.data.vertices]
y_center = (min(v.y for v in all_before) + max(v.y for v in all_before)) * 0.5
for o in carobjects:
    o.location.y -= y_center
bpy.context.view_layer.update()
# Polygon metadata before export.
verts = [o.matrix_world @ v.co for o in carobjects for v in o.data.vertices]
mins = [min(v[i] for v in verts) for i in range(3)]
maxs = [max(v[i] for v in verts) for i in range(3)]
triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in carobjects)
for o in carobjects:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
export_path = os.path.join(OUT, "astra-formula.glb")
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_extras=True,
)
report = {
    "head_node": "driver_head",
    "version": 2,
    "name": "Astra AF-27",
    "format": "glTF 2.0 binary",
    "coordinate_system": "Y-up; nose +Z; wheel axle local +X; tires touch Y=0",
    "construction_dimensions_m": {
        "width_x": maxs[0] - mins[0],
        "height_y": maxs[2] - mins[2],
        "length_z": maxs[1] - mins[1],
    },
    "construction_bounds": {"min_xyz_blender": mins, "max_xyz_blender": maxs},
    "triangles": triangles,
    "mesh_objects": len(carobjects),
    "expected_draw_primitives": sum(len(o.data.materials) for o in carobjects),
    "materials": [m.name for m in bpy.data.materials],
    "bytes": os.path.getsize(export_path),
    "wheel_nodes": ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"],
    "runtime_tint_material": "Livery",
    "license": "Original procedural asset created for Astra Formula; no third-party geometry or texture. Typeface outlines use system Arial Bold Italic (not redistributed as a font).",
    "features": [
        "Rounded slick tires with sidewall typography",
        "Modern aero wheel covers, centerlocks and radial ribs",
        "Full double-wishbone suspension and pullrods",
        "Four-element front wing and slotted rear DRS wing",
        "Open cockpit with steering wheel, driver, helmet and halo",
        "Sidepod undercuts and cooling louvres",
        "Ground effect floor, diffuser tunnels and strakes",
        "Original cream/vermilion Astra livery and number 27",
    ],
}
with open(os.path.join(OUT, "asset-report-v2.json"), "w") as f:
    json.dump(report, f, indent=2)
# Save editable source scene before adding studio.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "astra-af27-v2.blend"))
if not args.preview:
    print("ASSET_REPORT", json.dumps(report))
    sys.exit(0)

# Studio preview, separate from exported model.
floorMat = material("Studio floor", (0.19, 0.225, 0.25), 0.1, 0.50)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.008))
o = bpy.context.object
o.data.materials.append(floorMat)
world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.18, 0.22, 0.27, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.45


def area(name, loc, energy, size, color, target=(0, 0, 0.4), size_y=None):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.color = color
    d.shape = "RECTANGLE"
    d.size = size
    d.size_y = size_y or size
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()


area("Long soft key", (2, -3, 7), 1550, 5, (1, 0.93, 0.85), size_y=3)
area("Cool flank", (-4, 1, 3), 1150, 4, (0.69, 0.82, 1), size_y=5)
area("Rear rim", (2, 5, 4), 1700, 3, (1, 0.94, 0.85), size_y=4)
area("Front fill", (0, -5, 2), 350, 3, (0.8, 0.88, 1), size_y=3)
camD = bpy.data.cameras.new("Preview camera")
cam = bpy.data.objects.new("Preview camera", camD)
bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam
cam.location = (6.1, -7.6, 4.0)
target = Vector((0, -0.10, 0.48))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
camD.type = "ORTHO"
camD.ortho_scale = 6.6
camD.lens = 50
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(OUT, "preview-front-v2.png")
scene.view_settings.view_transform = "AgX"
bpy.ops.render.render(write_still=True)
cam.location = (-5.7, 7.8, 3.4)
target = Vector((0, 0.1, 0.48))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = os.path.join(OUT, "preview-rear-v2.png")
bpy.ops.render.render(write_still=True)
print("ASSET_REPORT", json.dumps(report))

# Cockpit verification scene. None of this is included in the already-exported car.
road = material("Diagnostic preview asphalt", (0.035, 0.042, 0.05), 0, 0.80)
marking = material("Diagnostic preview road markings", (0.70, 0.70, 0.65), 0, 0.8)
box("Preview road", (0, -45, -0.012), (12, 120, 0.015), road, 0)
for x in (-5.0, 5.0):
    box("Preview road edge", (x, -45, 0.001), (0.12, 120, 0.008), marking, 0)
for y in range(-8, -85, -8):
    box("Preview distance dash", (0, y, 0.002), (0.10, 3, 0.008), marking, 0)
for y in range(-10, -81, -10):
    for x in (-5.7, 5.7):
        box("Preview roadside marker", (x, y, 0.3), (0.18, 0.18, 0.6), marking, 0)
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
camD.type = "PERSP"
camD.sensor_fit = "VERTICAL"
camD.sensor_height = 24
camD.lens = 24 / (2 * math.tan(math.radians(65) / 2))
camD.clip_start = 0.025
camD.clip_end = 400
head.hide_render = True


# Three glTF coordinates (x,y,z) map to Blender (x,-z,y).
def driver_view(filename, eye, aim, hide_head=True):
    head.hide_render = hide_head
    cam.location = (eye[0], -eye[2], eye[1])
    target = Vector((aim[0], -aim[2], aim[1]))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, filename)
    bpy.ops.render.render(write_still=True)


eye = (0, 0.85, -0.20)
aim = (0, 0.79, 10)
driver_view("preview-cockpit-v2.png", eye, aim)
driver_view("preview-tcam-v2.png", (0, 1.18, -0.72), (0, 0.68, 10), False)
cockpit_report = {
    "head_node": "driver_head",
    "head_geometry_triangle_count": sum(
        len(p.vertices) - 2 for p in head.data.polygons
    ),
    "head_material_primitives": len(head.data.materials),
    "eye_camera": {
        "position_xyz": eye,
        "look_at_xyz": aim,
        "vertical_fov_degrees": 65,
        "near_clip_m": 0.025,
        "head_visible": False,
    },
    "tcam": {
        "position_xyz": [0, 1.18, -0.72],
        "look_at_xyz": [0, 0.68, 10],
        "vertical_fov_degrees": 65,
        "near_clip_m": 0.025,
        "head_visible": True,
    },
    "all_coordinates": "Three.js/glTF Y-up, nose +Z, car local space",
    "old_camera": [0, 0.98, -0.42],
    "old_camera_issue": "Height nearly coincides with the 0.96-1.015 m halo ring and the rear of the helmet crown. Aiming forward skims the halo and may show helmet surfaces. Use the lower actual driver eye and hide driver_head; use the raised T-cam for a clear elevated view.",
}
with open(os.path.join(OUT, "cockpit-report-v2.json"), "w") as f:
    json.dump(cockpit_report, f, indent=2)
