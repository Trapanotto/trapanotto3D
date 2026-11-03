"""Download the CC0 Poly Haven source assets used by the industrial set."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import md5
from pathlib import Path
from urllib.request import Request, urlopen
import json

ROOT = Path(__file__).resolve().parents[1]
MODELS = ('old_military_compressor', 'overhead_crane', 'portable_welding_cart',
          'industrial_storage_cart', 'metal_tool_chest', 'drill_press_01')
MATERIALS = ('concrete_floor_worn_02', 'concrete_block_wall_02', 'blue_metal_plate')


def get_json(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
        return json.load(response)


def download(item):
    url, path, expected = item
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and md5(path.read_bytes()).hexdigest() == expected:
        return str(path.relative_to(ROOT))
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=90) as response:
        contents = response.read()
    if md5(contents).hexdigest() != expected:
        raise ValueError(f'Checksum mismatch for {url}')
    path.write_bytes(contents)
    return str(path.relative_to(ROOT))


jobs = []
for name in MODELS:
    data = get_json(f'https://api.polyhaven.com/files/{name}')['gltf']['1k']['gltf']
    folder = ROOT / 'assets-source' / 'polyhaven' / name
    jobs.append((data['url'], folder / f'{name}.gltf', data['md5']))
    for filename, part in data['include'].items():
        jobs.append((part['url'], folder / filename, part['md5']))

for name in MATERIALS:
    data = get_json(f'https://api.polyhaven.com/files/{name}')
    for source, suffix in [('Diffuse', 'color'), ('nor_gl', 'normal'), ('Rough', 'roughness')]:
        part = data[source]['1k']['jpg']
        jobs.append((part['url'], ROOT / 'public' / 'textures' / 'pbr' / f'{name}_{suffix}.jpg', part['md5']))

with ThreadPoolExecutor(max_workers=8) as pool:
    for result in pool.map(download, jobs):
        print(result, flush=True)
