import bpy,math
from pathlib import Path
from mathutils import Vector
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from paths import work_paths
_, out = work_paths()
for name in ['namaqualand_cliff_01','namaqualand_cliff_02']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(out/(name+'.glb')))
 obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
 size=obj.dimensions;center=Vector((0,0,size.z*0.5));width=size.x
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12
 scene.render.threads_mode='FIXED';scene.render.threads=2
 scene.render.resolution_x=768;scene.render.resolution_y=512;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Neutral preview world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.45,0.5,0.6,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.65
 light_data=bpy.data.lights.new('Soft daylight','AREA');light_data.energy=1800*width*width/64;light_data.shape='DISK';light_data.size=width*0.6
 light=bpy.data.objects.new('Soft daylight',light_data);scene.collection.objects.link(light);light.location=(-width*0.5,-width,width*1.4);light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
 camera_data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=width*1.25
 scene.render.film_transparent=True
 for label,side in [('front',0.2),('side',0.85)]:
  camera.location=center+Vector((width*side,-width*1.5,width*0.25));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(out/(name+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
