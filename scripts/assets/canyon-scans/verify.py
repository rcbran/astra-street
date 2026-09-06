import json,struct,hashlib,math
from pathlib import Path
from paths import work_paths
base, out = work_paths()
report=[]
for name in ['namaqualand_cliff_01','namaqualand_cliff_02']:
 p=out/(name+'.glb');data=p.read_bytes();length=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+length]);binary=data[28+length:]
 hashes={hashlib.sha256(p.read_bytes()).hexdigest():p.name for p in (base/name/'textures').glob('*.jpg')}
 images=[]
 for image in j['images']:
  v=j['bufferViews'][image['bufferView']];blob=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];sha=hashlib.sha256(blob).hexdigest()
  assert sha in hashes,(name,image,sha)
  images.append({'name':image['name'],'sourceFile':hashes[sha],'bytes':len(blob),'sha256':sha,'byteIdenticalToSource':True})
 def accessor(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];size=struct.calcsize(fmt)*n
  start=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from('<'+fmt*n,binary,start+k*v.get('byteStride',size)) for k in range(a['count'])]
 assert len(j['meshes'])==1 and len(j['meshes'][0]['primitives'])==1 and len(j['materials'])==1
 primitive=j['meshes'][0]['primitives'][0]
 for key in ['POSITION','NORMAL','TEXCOORD_0','TANGENT']:assert key in primitive['attributes']
 attrs={k:accessor(a) for k,a in primitive['attributes'].items()}
 for attr in attrs.values():assert all(math.isfinite(c) for v in attr for c in v)
 pos=attrs['POSITION'];indices=[v[0] for v in accessor(primitive['indices'])];assert max(indices)<len(pos)
 low=[min(v[a] for v in pos) for a in range(3)];high=[max(v[a] for v in pos) for a in range(3)]
 m=j['materials'][0];assert 'normalTexture' in m and 'baseColorTexture' in m['pbrMetallicRoughness'] and 'metallicRoughnessTexture' in m['pbrMetallicRoughness']
 report.append({'id':name,'glbBytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'vertices':len(pos),'triangles':len(indices)//3,'boundsMinYUp':low,'boundsMaxYUp':high,'horizontalRadius':max(math.hypot(v[0],v[2]) for v in pos),'images':images,'material':m,'checks':['finite position/normal/tangent/UV','indices in bounds','one primitive and material','all original 2K image bytes preserved','normal/baseColor/metallicRoughness bindings present']})
(out/'verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
