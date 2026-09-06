import json, struct, pathlib

for p in pathlib.Path("/tmp/astra-tree-assets/output").glob("*.glb"):
    b = p.read_bytes()
    n, typ = struct.unpack_from("<II", b, 12)
    d = json.loads(b[20 : 20 + n])
    binary = b[20 + n :]
    for m in d["materials"]:
        if "twig" in m["name"] or "leaves" in m["name"]:
            m.update(alphaMode="MASK", alphaCutoff=0.38, doubleSided=True)
        m.pop("extensions", None)
        for slot in ["baseColorTexture", "metallicRoughnessTexture"]:
            if slot in m.get("pbrMetallicRoughness", {}):
                m["pbrMetallicRoughness"][slot]["texCoord"] = 0
        for slot in ["normalTexture", "occlusionTexture", "emissiveTexture"]:
            if slot in m:
                m[slot]["texCoord"] = 0
    payload = json.dumps(d, separators=(",", ":")).encode()
    payload += b" " * ((-len(payload)) % 4)
    result = (
        struct.pack("<4sII", b"glTF", 2, 20 + len(payload) + len(binary))
        + struct.pack("<II", len(payload), typ)
        + payload
        + binary
    )
    p.write_bytes(result)
    print(p.name, len(result))
