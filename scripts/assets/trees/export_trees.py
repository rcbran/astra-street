import bpy, bmesh, sys, pathlib, json, collections, math, random
from mathutils import Vector, Matrix

species = sys.argv[sys.argv.index("--") + 1]
base = pathlib.Path("/tmp/astra-tree-assets")
out = base / "output"
out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(base / species / (species + ".blend")))
for c in bpy.data.collections:
    c.hide_viewport = False
    c.hide_render = False
for o in bpy.data.objects:
    o.hide_set(False)
    o.hide_viewport = False
    o.hide_render = False
    o.select_set(False)
matcache = {}


def material(old):
    if old.name in matcache:
        return matcache[old.name]
    name = old.name
    if name.endswith("dead_branches"):
        name = name.replace("dead_branches", "bark")
    if name.endswith("branches"):
        name = name.replace("branches", "branch")
    if name.endswith("_trunk") and species == "tree_small_02":
        name = species
    m = bpy.data.materials.new(old.name + "_game")
    m.use_nodes = True
    m.node_tree.nodes.clear()
    ns = m.node_tree.nodes
    links = m.node_tree.links
    p = ns.new("ShaderNodeBsdfPrincipled")
    output = ns.new("ShaderNodeOutputMaterial")
    links.new(p.outputs["BSDF"], output.inputs["Surface"])
    p.inputs["Roughness"].default_value = 0.94
    foliage = "twig" in name or "leaves" in name
    diff = (
        base / "prepared-textures" / (name + "_diff" + (".png" if foliage else ".jpg"))
    )
    if not diff.exists():
        raise RuntimeError(str(diff))
    tex = ns.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(diff), check_existing=True)
    links.new(tex.outputs["Color"], p.inputs["Base Color"])
    if foliage:
        links.new(tex.outputs["Alpha"], p.inputs["Alpha"])
        m.surface_render_method = "DITHERED"
        m.use_backface_culling = False
        p.inputs["Subsurface Weight"].default_value = 0
    else:
        m.use_backface_culling = True
    norm = base / "prepared-textures" / (name + "_nor_gl.jpg")
    if norm.exists():
        nt = ns.new("ShaderNodeTexImage")
        nt.image = bpy.data.images.load(str(norm), check_existing=True)
        nt.image.colorspace_settings.name = "Non-Color"
        nn = ns.new("ShaderNodeNormalMap")
        nn.inputs["Strength"].default_value = 0.55 if foliage else 0.75
        links.new(nt.outputs["Color"], nn.inputs["Color"])
        links.new(nn.outputs["Normal"], p.inputs["Normal"])
    m["alphaCutoff"] = 0.38 if foliage else 0
    m["foliage"] = foliage
    matcache[old.name] = m
    return m


names = (
    [species + "_" + v + "_LOD2" for v in ["a", "b", "c"]]
    if species != "tree_small_02"
    else [species + "_LOD1"]
)
manifest = {"source": species, "variants": []}
export = []
for name in names:
    source = bpy.data.objects[name]
    attr = source.data.attributes.get("UVMap")
    if attr and attr.data_type == "FLOAT_VECTOR" and attr.domain == "CORNER":
        values = [tuple(d.vector)[:2] for d in attr.data]
        source.data.attributes.remove(attr)
        uv = source.data.uv_layers.new(name="UVMap")
        for i, v in enumerate(values):
            uv.data[i].uv = v
    for a in list(source.data.color_attributes):
        source.data.color_attributes.remove(a)
    while len(source.data.uv_layers) > 1:
        source.data.uv_layers.remove(source.data.uv_layers[-1])
    short = (
        species.replace("_tree_01", "").replace("tree_small_02", "broadleaf")
        + "_"
        + (name.split("_")[-2] if species != "tree_small_02" else "a")
    )
    verts = [source.matrix_world @ v.co for v in source.data.vertices]
    offset = Vector(
        (
            source.matrix_world.translation.x,
            source.matrix_world.translation.y,
            min(v.z for v in verts),
        )
    )
    bbox = [min(v[i] - offset[i] for v in verts) for i in range(3)] + [
        max(v[i] - offset[i] for v in verts) for i in range(3)
    ]
    variant = {"id": short, "boundsZUp": bbox, "lods": []}
    manifest["variants"].append(variant)
    parts = []
    for mi, old in enumerate(source.data.materials):
        if not old:
            continue
        mesh = source.data.copy()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.delete(
            bm, geom=[f for f in bm.faces if f.material_index != mi], context="FACES"
        )
        bmesh.ops.delete(
            bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS"
        )
        bm.to_mesh(mesh)
        bm.free()
        mesh.transform(Matrix.Translation(-offset) @ source.matrix_world)
        mesh.materials.clear()
        mesh.materials.append(material(old))
        for poly in mesh.polygons:
            poly.material_index = 0
            poly.use_smooth = True
        parts.append((old.name, mesh))
    for lod in range(3):
        group = bpy.data.objects.new(short + "_LOD" + str(lod), None)
        bpy.context.collection.objects.link(group)
        group["species"] = short
        group["lod"] = lod
        export.append(group)
        lodstats = {"name": group.name, "parts": []}
        variant["lods"].append(lodstats)
        for oldname, mesh in parts:
            obj = bpy.data.objects.new(
                short + "_LOD" + str(lod) + "_" + oldname.split(species + "_")[-1],
                mesh.copy(),
            )
            bpy.context.collection.objects.link(obj)
            obj.parent = group
            export.append(obj)
            foliage = "twig" in oldname or "leaves" in oldname
            target = (
                (
                    [36000, 9500, 2100]
                    if species == "fir_tree_01"
                    else [42000, 9500, 2100]
                )[lod]
                if foliage
                else (
                    [2400, 600, 140][lod]
                    if "trunk" in oldname
                    else ([900, 200, 40] if "dead" in oldname else [10000, 2500, 160])[
                        lod
                    ]
                )
            )
            tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
            if species == "tree_small_02" and not foliage:
                target = (
                    [2400, 1200, 700] if "trunk" in oldname else [10000, 3500, 2000]
                )[lod]
            if foliage and lod == 2:
                target = (
                    6000
                    if species == "tree_small_02"
                    else 7000
                    if species == "pine_tree_01"
                    else 4200
                )
            if tris > target and not foliage:
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                mod = obj.modifiers.new("Branch preserving LOD", "DECIMATE")
                mod.ratio = target / tris
                mod.use_collapse_triangulate = True
                bpy.ops.object.modifier_apply(modifier=mod.name)
                obj.select_set(False)
            # Disconnected leaves / twigs impose a lower bound on collapse simplification.
            # Keep spatially distributed complete components instead of collapsing whole crowns.
            actual = sum(len(p.vertices) - 2 for p in obj.data.polygons)
            if actual > target * 1.1:
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                unseen = set(bm.verts)
                comps = []
                rng = random.Random(1987 + lod)
                while unseen:
                    start = unseen.pop()
                    vs = {start}
                    stack = [start]
                    while stack:
                        v = stack.pop()
                        for edge in v.link_edges:
                            other = edge.other_vert(v)
                            if other in unseen:
                                unseen.remove(other)
                                vs.add(other)
                                stack.append(other)
                    fs = {f for v in vs for f in v.link_faces}
                    nt = sum(len(f.verts) - 2 for f in fs)
                    area = sum(f.calc_area() for f in fs)
                    score = rng.random() ** (1 / max(0.00001, math.sqrt(area)))
                    comps.append((score, vs, fs, nt))
                comps.sort(key=lambda x: x[0], reverse=True)
                kept = set()
                used = 0
                for _, vs, fs, nt in comps:
                    if used + nt <= target or not kept:
                        kept.update(vs)
                        used += nt
                discarded = [v for v in bm.verts if v not in kept]
                bmesh.ops.delete(bm, geom=discarded, context="VERTS")
                if foliage:
                    growth = min(3.8, math.sqrt(actual / max(used, 1)))
                    for _, vs, _, _ in comps:
                        valid = [v for v in vs if v.is_valid]
                        if not valid:
                            continue
                        center = sum((v.co for v in valid), Vector()) / len(valid)
                        for v in valid:
                            v.co = center + (v.co - center) * growth
                bm.to_mesh(obj.data)
                bm.free()
            if "bark" in oldname:
                # Collapse must not turn narrow cylindrical branches into broad fins.
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                bad = [f for f in bm.faces if f.calc_area() > 0.12]
                if bad:
                    bmesh.ops.delete(bm, geom=bad, context="FACES")
                bm.to_mesh(obj.data)
                bm.free()
            obj.data.calc_loop_triangles()
            final = len(obj.data.loop_triangles)
            lodstats["parts"].append(
                {
                    "name": obj.name,
                    "triangles": final,
                    "material": obj.data.materials[0].name,
                }
            )
            print(obj.name, final, flush=True)
    for _, mesh in parts:
        bpy.data.meshes.remove(mesh)
for o in bpy.data.objects:
    o.select_set(False)
for o in export:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(out / (species + ".glb")),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_extras=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
)
(out / (species + ".json")).write_text(json.dumps(manifest, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(base / (species + "-prepared.blend")))
