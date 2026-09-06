"""Pad unused broadleaf atlas RGB from UV-verified leaf/branch colors.

Offline only: requires Pillow, NumPy and SciPy. Reads an exported GLB and
writes a review candidate, preserving geometry, other images, alpha coverage,
and colors sampled by every LOD. No Blender installation is needed.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def read_glb(raw):
    magic, version, length = struct.unpack_from('<4sII', raw)
    assert (magic, version, length) == (b'glTF', 2, len(raw))
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(raw[20:20 + size])
    bin_size, bin_kind = struct.unpack_from('<II', raw, 20 + size)
    assert bin_kind == 0x004E4942 and len(doc['buffers']) == 1
    return doc, raw[28 + size:28 + size + bin_size]


def accessor(doc, blob, index):
    a = doc['accessors'][index]
    assert 'sparse' not in a and not a.get('normalized', False)
    view = doc['bufferViews'][a['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']]
    components = {'SCALAR': 1, 'VEC2': 2}[a['type']]
    itemsize = np.dtype(dtype).itemsize
    return np.ndarray(
        (a['count'], components), dtype=dtype, buffer=blob,
        offset=view.get('byteOffset', 0) + a.get('byteOffset', 0),
        strides=(view.get('byteStride', itemsize * components), itemsize),
    )


def include_bilinear_support(mask, triangle):
    """Conservative continuous triangle/texel-support intersection (SAT).

    A base-level bilinear texel centered at (x+.5, y+.5) can contribute
    within a square of half extent 1. Include zero-weight boundary taps too.
    This geometric check is independent of Pillow's polygon rasterization.
    """
    height, width = mask.shape
    lo = np.maximum(0, np.floor(triangle.min(axis=0) - 1.5).astype(int))
    hi = np.minimum([width - 1, height - 1],
                    np.ceil(triangle.max(axis=0) + .5).astype(int))
    yy, xx = np.mgrid[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    cx, cy = xx + .5, yy + .5
    epsilon = 1e-8
    overlap = ((cx + 1 >= triangle[:, 0].min() - epsilon)
               & (cx - 1 <= triangle[:, 0].max() + epsilon)
               & (cy + 1 >= triangle[:, 1].min() - epsilon)
               & (cy - 1 <= triangle[:, 1].max() + epsilon))
    for edge in range(3):
        delta = triangle[(edge + 1) % 3] - triangle[edge]
        axis = np.array([-delta[1], delta[0]])
        projection = triangle @ axis
        center = cx * axis[0] + cy * axis[1]
        extent = abs(axis).sum()
        tolerance = epsilon * max(1., extent)
        overlap &= ((center + extent >= projection.min() - tolerance)
                    & (center - extent <= projection.max() + tolerance))
    mask[yy, xx] |= overlap


def uv_coverage(doc, blob, material_index, size):
    mask = Image.new('L', size)
    draw = ImageDraw.Draw(mask)
    width, height = size
    support = np.zeros((height, width), dtype=bool)
    meshes = []
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            if primitive.get('material') != material_index:
                continue
            assert primitive.get('mode', 4) == 4
            uv = accessor(doc, blob, primitive['attributes']['TEXCOORD_0'])
            assert np.isfinite(uv).all() and uv.min() >= 0 and uv.max() <= 1
            # This bake's islands are interior. The support audit below clips
            # to image bounds; reject a new bake that needs wrapped edge taps.
            pixels = uv.astype(np.float64) * [width, height]
            assert (pixels >= 1).all() and (pixels <= [width - 1, height - 1]).all(), \
                'Atlas-border UVs require wrap-aware support coverage'
            indices = accessor(doc, blob, primitive['indices']).reshape(-1, 3)
            triangles = np.unique(uv[indices], axis=0)
            for triangle in triangles:
                # glTF's image origin is top-left (runtime flipY=false).
                draw.polygon([(float(u * width), float(v * height))
                              for u, v in triangle], fill=255)
                include_bilinear_support(support, triangle.astype(np.float64) * [width, height])
            meshes.append({'name': mesh.get('name'), 'triangles': len(indices),
                           'uniqueUvTriangles': len(triangles)})
    assert len(meshes) == 3, 'Expected foliage in all three broadleaf LODs'
    # Pillow's discrete polygon edges need two texels of padding here.
    # Verify coverage geometrically; do not assume this margin fits a new bake.
    protected = np.array(mask.filter(ImageFilter.MaxFilter(5))) > 0
    assert not (support & ~protected).any(), 'Padding misses bilinear texture taps'
    return protected, meshes, int(support.sum())


def replace_image(doc, blob, view_index, png):
    packed = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        start = view.get('byteOffset', 0)
        data = blob[start:start + view['byteLength']]
        if index == view_index:
            data = png
        packed.extend(b'\0' * (-len(packed) % 4))
        view['byteOffset'] = len(packed)
        view['byteLength'] = len(data)
        packed.extend(data)
    doc['buffers'][0]['byteLength'] = len(packed)
    packed.extend(b'\0' * (-len(packed) % 4))
    payload = json.dumps(doc, separators=(',', ':')).encode()
    payload += b' ' * (-len(payload) % 4)
    return (struct.pack('<4sII', b'glTF', 2, 28 + len(payload) + len(packed))
            + struct.pack('<II', len(payload), 0x4E4F534A) + payload
            + struct.pack('<II', len(packed), 0x004E4942) + packed)


def prepare(source, destination):
    assert source.resolve() != destination.resolve(), 'Write a separate review candidate'
    raw = source.read_bytes()
    doc, blob = read_glb(raw)
    material_index = next(i for i, m in enumerate(doc['materials'])
                          if m['name'] == 'tree_small_02_leaves_game')
    slot = doc['materials'][material_index]['pbrMetallicRoughness']['baseColorTexture']
    assert slot.get('texCoord', 0) == 0 and not slot.get('extensions')
    texture = doc['textures'][slot['index']]
    image = doc['images'][texture['source']]
    assert image['name'] == 'tree_small_02_leaves_diff'
    view_index = image['bufferView']
    original_views = [blob[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
                      for v in doc['bufferViews']]
    rgba = np.array(Image.open(io.BytesIO(original_views[view_index])).convert('RGBA'))
    used, meshes, support_texels = uv_coverage(
        doc, blob, material_index, (rgba.shape[1], rgba.shape[0]))
    # Opaque white bake background also occurs along a few mapped twig edges.
    # Keep those source pixels, but never propagate them into unused space.
    white = (rgba[:, :, :3] > 235).all(axis=2)
    donors = used & (rgba[:, :, 3] == 255) & ~white
    assert donors.any()
    nearest = distance_transform_edt(~donors, return_distances=False, return_indices=True)
    fixed = rgba.copy()
    fixed[~used, :3] = rgba[nearest[0][~used], nearest[1][~used], :3]
    assert np.array_equal(fixed[:, :, 3], rgba[:, :, 3]), 'All alpha values must survive'
    assert np.array_equal(fixed[used], rgba[used]), 'Mapped colors and edge taps must survive'
    assert not (fixed[~used, :3] > 235).all(axis=1).any()
    png_buffer = io.BytesIO()
    Image.fromarray(fixed).save(png_buffer, format='PNG', optimize=True)
    png = png_buffer.getvalue()
    result = replace_image(doc, blob, view_index, png)
    result_doc, result_blob = read_glb(result)
    for index, view in enumerate(result_doc['bufferViews']):
        data = result_blob[view['byteOffset']:view['byteOffset'] + view['byteLength']]
        assert data == (png if index == view_index else original_views[index])
    report = {
        'inputSha256': sha256(raw), 'outputSha256': sha256(result),
        'inputBytes': len(raw), 'outputBytes': len(result),
        'image': image['name'], 'imageSha256': sha256(png),
        'meshes': meshes, 'protectedUvPixels': int(used.sum()), 'bilinearMarginTexels': 2,
        'bilinearSupportTexelsConservative': support_texels,
        'missingBilinearSupportTexels': 0,
        'changedRgbPixels': int((fixed[:, :, :3] != rgba[:, :, :3]).any(axis=2).sum()),
        'unusedWhitePixelsBefore': int((white & ~used).sum()),
        'unusedWhitePixelsAfter': 0,
        'allAlphaBytesPreserved': True, 'allProtectedUvBytesPreserved': True,
        'geometryAndOtherImagesByteIdentical': True,
        'filtering': 'Runtime trilinear mipmaps and anisotropy unchanged',
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(result)
    destination.with_suffix('.atlas.png').write_bytes(png)
    destination.with_suffix('.padding.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    prepare(args.source, args.destination)
