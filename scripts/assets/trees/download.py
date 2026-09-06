import urllib.request, json, pathlib, concurrent.futures

p = pathlib.Path("/tmp/astra-tree-assets")


def dl(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        with (
            urllib.request.urlopen(
                urllib.request.Request(
                    url, headers={"User-Agent": "AstraStreetAssetResearch/1.0"}
                )
            ) as r,
            dest.open("wb") as f,
        ):
            while b := r.read(1024 * 1024):
                f.write(b)
    print(dest.name, dest.stat().st_size, flush=True)


jobs = []
for name, file in [
    ("pine_tree_01", "pine-files.json"),
    ("fir_tree_01", "fir_tree_01-files.json"),
    ("tree_small_02", "tree_small_02-files.json"),
]:
    d = json.loads((p / file).read_text())["blend"]["1k"]["blend"]
    root = p / name
    jobs.append((d["url"], root / (name + ".blend")))
    for path, item in d["include"].items():
        if any(x in path for x in ["_diff_", "_nor_gl_", "_alpha_"]):
            jobs.append((item["url"], root / path))
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
    list(ex.map(lambda x: dl(*x), jobs))
