import bpy,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from paths import work_paths
base, out = work_paths()
reports=[]
for name in ['namaqualand_cliff_01','namaqualand_cliff_02']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(base/name/(name+'_2k.gltf')))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 assert len(objects)==1
 obj=objects[0];bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 mesh=obj.data;mesh.calc_loop_triangles();before=len(mesh.loop_triangles)
 bounds=[obj.matrix_world@Vector(c) for c in obj.bound_box]
 low=Vector(tuple(min(v[i] for v in bounds) for i in range(3)))
 high=Vector(tuple(max(v[i] for v in bounds) for i in range(3)))
 offset=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
 obj.location-=offset;bpy.ops.object.transform_apply(location=True,rotation=False,scale=False)
 mod=obj.modifiers.new('Bounded scanned rock LOD','DECIMATE');mod.ratio=6000/before;mod.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=mod.name)
 mesh.calc_loop_triangles();after=len(mesh.loop_triangles)
 assert after<=6100 and after>=5800,(name,after)
 # Edge collapse may shift extrema slightly; normalize the final derivative.
 final_low=Vector(tuple(min(v.co[i] for v in mesh.vertices) for i in range(3)))
 final_high=Vector(tuple(max(v.co[i] for v in mesh.vertices) for i in range(3)))
 final_offset=Vector(((final_low.x+final_high.x)/2,(final_low.y+final_high.y)/2,final_low.z))
 for vertex in mesh.vertices:vertex.co-=final_offset
 assert mesh.uv_layers.active is not None
 obj.name=name+'_6000';mesh.name=obj.name+'_mesh'
 # Preserve scan-authored UVs/material maps. Export tangents for its baked
 # OpenGL normal map; no triplanar material or synthesized surface is used.
 bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_tangents=True,export_image_format='AUTO',export_yup=True)
 report={'id':name,'sourceTriangles':before,'triangles':after,'sourceDimensionsMetresZUp':list(high-low),'sourceOriginOffsetZUp':list(offset),'postSimplificationOffsetZUp':list(final_offset),'vertices':len(mesh.vertices),'uvLayers':len(mesh.uv_layers),'materials':len(mesh.materials),'blenderVersion':bpy.app.version_string,'method':'Blender DECIMATE collapse to 6000 triangles; original scan UVs and PBR maps; translated horizontal center and lowest vertex to origin; exported Y-up metres with tangents.'}
 reports.append(report)
(out/'geometry-report.json').write_text(json.dumps(reports,indent=2))
