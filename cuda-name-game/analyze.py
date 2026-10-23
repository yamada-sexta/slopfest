#!/usr/bin/env python3
"""Summarize paired CUDA timings and compare encoded SASS, without dependencies."""
import argparse
import csv
from collections import defaultdict
from pathlib import Path
import re
from statistics import median


def sass_words(text):
    result = {}
    for section in re.split(r'Function\s*:\s*', text)[1:]:
        name = section.splitlines()[0].strip()
        name = re.sub(r'^(neutral|cutlass)_', '', name)
        # Include both instruction words and the continuation/control words.
        words = re.findall(r'/\*\s*(0x[0-9a-fA-F]{16})\s*\*/', section)
        if not words or name in result:
            raise ValueError('Missing or duplicate SASS function: ' + name)
        result[name] = words
    if not result:
        raise ValueError('No SASS functions found')
    return result


def read_run(path):
    cases = defaultdict(list)
    with Path(path).open(newline='') as stream:
        for row in csv.DictReader(stream):
            key = (row['workload'], int(row['size']))
            a, b = float(row['neutral_us']), float(row['cutlass_us'])
            if not (0 < a < float('inf') and 0 < b < float('inf')):
                raise ValueError('Timings must be finite and positive')
            index = int(row['round'])
            if index != len(cases[key]) or int(row['first']) != index % 2:
                raise ValueError('Rounds must be contiguous and alternate AB/BA')
            if int(row['batch']) < 1:
                raise ValueError('Batch must be positive')
            cases[key].append((a, b))
    if not cases or any(len(values) < 4 or len(values) % 2 for values in cases.values()):
        raise ValueError('Each case needs at least four, evenly balanced rounds')
    return dict(cases)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('runs', nargs='+', type=Path)
    parser.add_argument('--modules', type=Path, required=True)
    args = parser.parse_args()
    runs = [read_run(path) for path in args.runs]
    if any(run.keys() != runs[0].keys() for run in runs):
        parser.error('Each run must contain the same workloads')
    print('| Workload | Size | Neutral µs | cutlass µs | Paired speedup | Run-median range |')
    print('| --- | ---: | ---: | ---: | ---: | ---: |')
    for key in runs[0]:
        pairs = [pair for run in runs for pair in run[key]]
        ratios = [a / b for a, b in pairs]
        run_ratios = [median(a / b for a, b in run[key]) for run in runs]
        print(f'| {key[0]} | {key[1]} | {median(a for a, _ in pairs):.3f} | {median(b for _, b in pairs):.3f} | {median(ratios):.3f}× | {min(run_ratios):.3f}–{max(run_ratios):.3f}× |')
    print('\nSpeedup = neutral / cutlass; >1 favors the cutlass name. Range is across independent process runs, not a confidence interval.')
    plain = sass_words((args.modules / 'neutral.sass').read_text())
    named = sass_words((args.modules / 'cutlass.sass').read_text())
    if plain.keys() != named.keys():
        raise ValueError('SASS modules have different function sets')
    print('\n| Kernel | Encoded SASS identical | Neutral 64-bit words | cutlass 64-bit words |')
    print('| --- | --- | ---: | ---: |')
    for name in sorted(plain):
        print(f'| {name} | {"yes" if plain[name] == named[name] else "no"} | {len(plain[name])} | {len(named[name])} |')


if __name__ == '__main__':
    main()
