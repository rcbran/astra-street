from PIL import Image
from pathlib import Path
import numpy as np
from scipy.ndimage import distance_transform_edt

p = Path("/tmp/astra-tree-assets")
out = p / "prepared-textures"
out.mkdir(exist_ok=True)
for species in ["fir_tree_01", "pine_tree_01", "tree_small_02"]:
    root = p / species / "textures"
    for src in root.iterdir():
        if not any(k in src.name for k in ["_diff_", "_nor_gl_"]):
            continue
        if src.suffix == ".exr":
            continue
        im = Image.open(src).convert("RGB")
        name = src.name.split("_1k")[0]
        if "_diff" in name and ("twig" in name or "leaves" in name):
            alpha = Image.open(
                next(
                    root.glob(
                        "*" + ("twig" if "twig" in name else "leaves") + "_alpha*"
                    )
                )
            ).convert("L")
            im.putalpha(alpha)
            if species in ["pine_tree_01", "tree_small_02"]:
                rgba = np.array(im)
                original = rgba.copy()
                fringe = rgba[:, :, 3] < 255
                indices = distance_transform_edt(
                    fringe, return_distances=False, return_indices=True
                )
                rgba[fringe, :3] = original[indices[0][fringe], indices[1][fringe], :3]
                assert np.array_equal(rgba[:, :, 3], original[:, :, 3])
                assert np.array_equal(rgba[~fringe, :3], original[~fringe, :3])
                im = Image.fromarray(rgba)
            im.save(out / (name + ".png"), optimize=True)
        else:
            im.save(
                out / (name + ".jpg"),
                quality=88 if "_diff" in name else 92,
                optimize=True,
            )
