"""Rebuild the shipped CC0 ground maps. Requires Python 3.10+ and Pillow."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request

from PIL import Image, ImageFile

FAMILY = "ground"
ASSETS = ("forrest_ground_01",)
SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY = SCRIPT_DIR.parents[2]
# High-detail, full-chroma normal maps can exceed Pillow's default JPEG buffer.
ImageFile.MAXBLOCK = 16 * 1024 * 1024


def verified(path: Path, item: dict) -> bool:
    if not path.is_file():
        return False
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest() == item["md5"] and (
        "size" not in item or path.stat().st_size == item["size"]
    )


def acquire(item: dict, cache: Path) -> Path:
    source = cache / Path(item["url"]).name
    if source.exists():
        if not verified(source, item):
            raise ValueError(f"Cached source failed manifest checksum: {source}")
        return source
    temporary = source.with_suffix(source.suffix + ".download")
    try:
        request = urllib.request.Request(
            item["url"],
            headers={"User-Agent": "Mozilla/5.0 AstraStreetAssetAuthoring/1.0"},
        )
        with (
            urllib.request.urlopen(request, timeout=90) as response,
            temporary.open("wb") as output,
        ):
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                output.write(chunk)
        if not verified(temporary, item):
            raise ValueError(
                f"Downloaded source failed manifest checksum: {item['url']}"
            )
        temporary.replace(source)
    finally:
        temporary.unlink(missing_ok=True)
    return source


def prepare(job: tuple[str, str, dict], cache: Path, output: Path) -> dict:
    name, kind, item = job
    source = acquire(item, cache)
    with Image.open(source) as original:
        image = original.convert("RGB")
    image.thumbnail(
        (2048, 2048) if kind == "Diffuse" else (1024, 1024), Image.Resampling.LANCZOS
    )
    if kind == "Rough":
        image = image.convert("L")
    suffix = {"Diffuse": "diff", "nor_gl": "normal", "Rough": "roughness"}[kind]
    destination = output / f"{name}-{suffix}.jpg"
    image.save(
        destination,
        quality=92 if kind == "nor_gl" else 88,
        optimize=True,
        subsampling=0 if kind == "nor_gl" else 2,
    )
    return {
        "file": destination.name,
        "dimensions": image.size,
        "bytes": destination.stat().st_size,
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--work-dir",
        type=Path,
        default=REPOSITORY / "artifacts" / "assets" / FAMILY,
        help="Cache/output directory (default: %(default)s)",
    )
    args = parser.parse_args()
    work = args.work_dir.expanduser().resolve()
    cache, output = work / "sources", work / "output"
    cache.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    jobs = []
    for name in ASSETS:
        manifest = json.loads((SCRIPT_DIR / f"{name}-files.json").read_text())
        for kind in ("Diffuse", "nor_gl", "Rough"):
            jobs.append((name, kind, manifest[kind]["2k"]["jpg"]))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda job: prepare(job, cache, output), jobs))
    (output / "SHA256SUMS").write_text(
        "".join(f"{r['sha256']}  {r['file']}\n" for r in results)
    )
    print(json.dumps({"output": str(output), "files": results}, indent=2))


if __name__ == "__main__":
    main()
