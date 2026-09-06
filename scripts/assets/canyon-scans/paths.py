"""Shared CLI paths for normal Python and Blender's arguments after --."""
import argparse
from pathlib import Path
import sys


def work_paths():
    parser = argparse.ArgumentParser()
    parser.add_argument('--work-dir', type=Path,
                        default=Path(__file__).resolve().parents[3] / 'artifacts/assets/canyon-scan')
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ([] if 'bpy' in sys.modules else sys.argv[1:])
    work = parser.parse_args(args).work_dir.resolve()
    sources, output = work / 'sources', work / 'output'
    sources.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    return sources, output
