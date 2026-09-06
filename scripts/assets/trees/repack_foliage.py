"""Replace embedded foliage PNGs without touching mesh data or retaining old image bytes."""

import pathlib, struct, json, hashlib, shutil

base = pathlib.Path("/tmp/astra-tree-assets")
output = base / "output"
report = {}
for species, image_name in [
    ("pine_tree_01", "pine_tree_01_twig_diff"),
    ("tree_small_02", "tree_small_02_leaves_diff"),
]:
    p = output / (species + ".glb")
    raw = p.read_bytes()
    json_length = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20 : 20 + json_length])
    bin_start = 20 + json_length
    bin_length, bin_type = struct.unpack_from("<II", raw, bin_start)
    old_bin = raw[bin_start + 8 : bin_start + 8 + bin_length]
    match = [img for img in doc["images"] if img["name"] == image_name]
    assert len(match) == 1
    replacement_view = match[0]["bufferView"]
    replacement = (base / "prepared-textures" / (image_name + ".png")).read_bytes()
    new_bin = bytearray()
    original_views = []
    for i, view in enumerate(doc["bufferViews"]):
        start = view.get("byteOffset", 0)
        data = old_bin[start : start + view["byteLength"]]
        original_views.append(data)
        if i == replacement_view:
            data = replacement
        new_bin.extend(b"\0" * ((-len(new_bin)) % 4))
        view["byteOffset"] = len(new_bin)
        view["byteLength"] = len(data)
        new_bin.extend(data)
    doc["buffers"][0]["byteLength"] = len(new_bin)
    new_bin.extend(b"\0" * ((-len(new_bin)) % 4))
    for i, view in enumerate(doc["bufferViews"]):
        if i != replacement_view:
            assert (
                bytes(
                    new_bin[
                        view["byteOffset"] : view["byteOffset"] + view["byteLength"]
                    ]
                )
                == original_views[i]
            )
    payload = json.dumps(doc, separators=(",", ":")).encode()
    payload += b" " * ((-len(payload)) % 4)
    result = (
        struct.pack("<4sII", b"glTF", 2, 28 + len(payload) + len(new_bin))
        + struct.pack("<II", len(payload), 0x4E4F534A)
        + payload
        + struct.pack("<II", len(new_bin), bin_type)
        + new_bin
    )
    p.write_bytes(result)
    report[species] = {
        "oldBytes": len(raw),
        "newBytes": len(result),
        "replacedBufferView": replacement_view,
        "geometryAndOtherImagesByteIdentical": True,
        "sha256": hashlib.sha256(result).hexdigest(),
    }
(output / "foliage-repack-report.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
