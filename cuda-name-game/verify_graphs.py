#!/usr/bin/env python3
"""Run existing correctness oracles through real graph replay; never benchmark."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('modules', type=Path)
    parser.add_argument('--library', type=Path, required=True, help='compiled test/graph_replay.cpp shared library')
    args = parser.parse_args()
    if not args.library.is_file():
        parser.error('Missing graph replay library')
    environment = os.environ.copy()
    existing = environment.get('LD_PRELOAD', '')
    environment['LD_PRELOAD'] = str(args.library.resolve()) + (':' + existing if existing else '')
    result = subprocess.run([str((args.modules/'bench').resolve()),str(args.modules.resolve()),'--verify-only'],
                            env=environment,capture_output=True,text=True)
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    wrapped = re.search(r'Graph replay verification: (\d+) launches',result.stderr)
    variants = sum(bool(line.strip()) for line in (args.modules/'variants.tsv').read_text().splitlines())
    cases = sum(line.startswith('Verified ') for line in result.stderr.splitlines())
    expected = variants * cases
    if result.returncode or not wrapped or not expected or int(wrapped[1]) != expected:
        raise SystemExit(result.returncode or 1)
    print('Actual graph outputs passed the harness CPU oracles; host parameter storage was clobbered before replay.')

if __name__ == '__main__':
    main()
