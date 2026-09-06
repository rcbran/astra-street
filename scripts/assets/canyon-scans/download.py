"""Download only pinned CC0 model files; verify cached files on every run."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
from paths import work_paths

base, _ = work_paths()
jobs = []
for name in ['namaqualand_cliff_01', 'namaqualand_cliff_02']:
    manifest = Path(__file__).with_name(name + '-files.json')
    entry = json.loads(manifest.read_text())['gltf']['2k']['gltf']
    jobs.append((base / name / (name + '_2k.gltf'), entry))
    jobs.extend((base / name / path, item) for path, item in entry['include'].items())


def fetch(job):
    path, item = job
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        partial = path.with_suffix(path.suffix + '.part')
        subprocess.run(['curl', '--retry', '2', '-fsSL', '-A',
                        'AstraStreetAssetResearch/1.0 (personal project)',
                        item['url'], '-o', str(partial)], check=True)
        data = partial.read_bytes()
        assert hashlib.md5(data).hexdigest() == item['md5'].zfill(32)
        assert len(data) == item['size']
        partial.replace(path)
    data = path.read_bytes()
    assert hashlib.md5(data).hexdigest() == item['md5'].zfill(32), path
    assert len(data) == item['size'], path
    return dict(path=str(path.relative_to(base)), url=item['url'],
                bytes=len(data), publishedMd5=item['md5'],
                sha256=hashlib.sha256(data).hexdigest())


with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(fetch, jobs))
(base / 'download-manifest.json').write_text(json.dumps(results, indent=2) + '\n')
print('Verified', len(results), 'files,', sum(r['bytes'] for r in results), 'bytes')
