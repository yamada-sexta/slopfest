#!/usr/bin/env python3
"""Validate balanced repeated CUDA runs and report process-level uncertainty."""
import argparse
from collections import defaultdict
import csv
import hashlib
import json
import math
from pathlib import Path
import random
import re
from statistics import mean, median, stdev


def sass_words(text):
    result = {}
    for section in re.split(r'Function\s*:\s*', text)[1:]:
        name = re.sub(r'^(neutral|cutlass|control|CUTLASS)_', '', section.splitlines()[0].strip())
        words = re.findall(r'/\*\s*(0x[0-9a-fA-F]{16})\s*\*/', section)
        if not words or name in result:
            raise ValueError('Missing or duplicate SASS function: ' + name)
        result[name] = words
    if not result:
        raise ValueError('No SASS functions found')
    return result


def read_run(path):
    cases = defaultdict(dict)
    positions = defaultdict(set)
    batches = defaultdict(set)
    with Path(path).open(newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != ['workload', 'size', 'round', 'position', 'batch', 'variant', 'us']:
            raise ValueError('Unexpected timing schema')
        for row in reader:
            case = (row['workload'], int(row['size']))
            r, pos, batch = (int(row[x]) for x in ['round', 'position', 'batch'])
            us = float(row['us'])
            if case[1] < 1 or r < 0 or pos < 0 or batch < 1 or not math.isfinite(us) or us <= 0:
                raise ValueError('Invalid timing, dimension, round, position, or batch')
            key = (r, row['variant'])
            if key in cases[case] or pos in positions[(case, r)]:
                raise ValueError('Duplicate variant or position within round')
            cases[case][key] = (us, pos)
            positions[(case, r)].add(pos)
            batches[case].add(batch)
    if not cases:
        raise ValueError('Empty timing file')
    expected = None
    for case, rows in cases.items():
        variants = {v for _, v in rows}
        rounds = {r for r, _ in rows}
        n = len(variants)
        if len(rounds) < n or len(rounds) % n or rounds != set(range(len(rounds))):
            raise ValueError('Need contiguous complete balanced cycles')
        if len(rows) != len(rounds) * n or len(batches[case]) != 1:
            raise ValueError('Missing variants or inconsistent batch')
        if any(positions[(case, r)] != set(range(n)) for r in rounds):
            raise ValueError('Missing or invalid positions')
        for start in range(0, len(rounds), n):
            for v in variants:
                if {rows[(r, v)][1] for r in range(start, start+n)} != set(range(n)):
                    raise ValueError('Timing positions are not balanced')
        shape = (frozenset(variants), len(rounds))
        if expected is not None and shape != expected:
            raise ValueError('Case variant sets/round counts differ')
        expected = shape
    return dict(cases)


def bootstrap_interval(logs, draws=20000):
    rng = random.Random(90317)
    estimates = sorted(sum(rng.choices(logs, k=len(logs))) / len(logs) for _ in range(draws))
    return [math.exp(estimates[int((draws-1)*q)]) for q in [.025, .975]]


def simultaneous_intervals(series, draws=20000, families=1):
    """Joint process-cluster max-standardized-deviation bootstrap, fixed SEs.

    Resample entire processes jointly across all contrasts. Approximate 95%
    familywise coverage; few-process bootstrap and independence are limitations.
    """
    if families < 1:
        raise ValueError('Need a positive number of analysis families')
    count = len(series[0])
    if count < 3 or any(len(x) != count for x in series):
        raise ValueError('Need at least three aligned process replicates')
    centers = [mean(x) for x in series]
    errors = [stdev(x) / math.sqrt(count) for x in series]
    rng = random.Random(61741)
    maxima = []
    # Multinomial counts avoid recomputing every resampled vector.
    for _ in range(draws):
        weights = [0] * count
        for i in rng.choices(range(count), k=count):
            weights[i] += 1
        maxima.append(max((abs(sum(w*x for w, x in zip(weights, values))/count - center) / se
                           if se > 1e-15 else 0)
                          for values, center, se in zip(series, centers, errors)))
    critical = sorted(maxima)[int((draws-1)*(1-.05/families))]
    return [[math.exp(center-critical*se), math.exp(center+critical*se)] for center, se in zip(centers, errors)], critical


def contrasts():
    result = []
    for policy in ['o3', 'o3_explicit', 'o3_noexp', 'o2_explicit', 'o2_noexp']:
        result.append((policy + ': name', policy + '__neutral', policy + '__cutlass'))
    for prefix in ['control', 'CUTLASS']:
        result.append(('o3: sham ' + prefix, 'o3__neutral', 'o3__' + prefix))
    for prefix in ['neutral', 'cutlass']:
        for policy in ['o3_explicit', 'o3_noexp', 'o2_explicit', 'o2_noexp']:
            result.append((prefix + ': flag ' + policy, 'o3__' + prefix, policy + '__' + prefix))
    return result


def summarize(runs, modules, draws=20000, families=1):
    if len(runs) < 3 or any(run.keys() != runs[0].keys() for run in runs):
        raise ValueError('Need at least three runs with identical workloads')
    shapes = [{(case, r, v) for case, rows in run.items() for r, v in rows} for run in runs]
    if any(s != shapes[0] for s in shapes):
        raise ValueError('Run shapes differ')
    sass = {p.stem: sass_words(p.read_text()) for p in modules.glob('*.sass')}
    records, series = [], []
    for case in sorted(runs[0]):
        for label, baseline, treatment in contrasts():
            logs, orders = [], [[], []]
            for run in runs:
                rows = run[case]
                rounds = sorted({r for r, _ in rows})
                ratios = []
                for r in rounds:
                    a, pa = rows[(r, baseline)]
                    b, pb = rows[(r, treatment)]
                    log = math.log(a / b)
                    ratios.append(log)
                    orders[int(pa > pb)].append(log)
                logs.append(median(ratios))
            identical = sass[baseline][case[0]] == sass[treatment][case[0]]
            records.append({'workload': case[0], 'size': case[1], 'contrast': label,
                            'baseline': baseline, 'treatment': treatment,
                            'baseline_us': median(x[(r, baseline)][0] for run in runs for x in [run[case]] for r, v in x if v == baseline),
                            'treatment_us': median(x[(r, treatment)][0] for run in runs for x in [run[case]] for r, v in x if v == treatment),
                            'speedup': math.exp(mean(logs)), 'process_speedups': [math.exp(x) for x in logs],
                            'pointwise_95': bootstrap_interval(logs, draws),
                            'order_speedups': [math.exp(median(x)) if x else None for x in orders],
                            'sass_identical': identical})
            series.append(logs)
    intervals, critical = simultaneous_intervals(series, draws, families)
    for row, bounds in zip(records, intervals):
        row['simultaneous_95'] = bounds
        row['all_processes_over_1pct'] = min(row['process_speedups']) > 1.01
        row['consistent_win'] = bounds[0] > 1.01 and row['all_processes_over_1pct']
        row['consistent_loss'] = bounds[1] < 1/1.01 and max(row['process_speedups']) < 1/1.01
    return {'runs': len(runs), 'family_count': families, 'family_alpha': .05/families, 'family_size': len(records), 'bootstrap_draws': draws, 'critical': critical, 'records': records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('runs', nargs='+', type=Path)
    parser.add_argument('--modules', type=Path, required=True)
    parser.add_argument('--json', type=Path)
    parser.add_argument('--draws', type=int, default=20000)
    parser.add_argument('--families', type=int, default=1, help='Bonferroni allocation across separately analyzed cohorts')
    args = parser.parse_args()
    if args.draws < 1000 or args.families < 1:
        parser.error('Use at least 1000 bootstrap draws and a positive family count')
    paths = [p.resolve() for p in args.runs]
    if len(set(paths)) != len(paths):
        parser.error('Duplicate run paths')
    # Reusing the same bytes is not an independent process replicate.
    hashes = [hashlib.sha256(p.read_bytes()).hexdigest() for p in paths]
    if len(set(hashes)) != len(hashes):
        parser.error('Duplicate timing contents')
    build = json.loads((args.modules / 'build.json').read_text())
    settings = None
    gpu = None
    benchmark_hash = hashlib.sha256((args.modules / 'bench').read_bytes()).hexdigest()
    for path in paths:
        metadata = json.loads(path.with_suffix('.json').read_text())
        if metadata.get('exit_code') != 0 or metadata.get('telemetry_errors') or metadata['build'] != build or metadata.get('benchmark_sha256') != benchmark_hash:
            parser.error('Failed run, missing telemetry, or build mismatch: ' + path.name)
        if not metadata.get('gpu') or (gpu is not None and metadata['gpu'] != gpu):
            parser.error('GPU/driver profiles differ between process runs')
        gpu = metadata['gpu']
        shape = {k: metadata['settings'][k] for k in ['rounds', 'batch_ms', 'direct']}
        if settings is not None and shape != settings:
            parser.error('Timing policies differ between process runs')
        settings = shape
    report = summarize([read_run(p) for p in paths], args.modules, args.draws, args.families)
    report['settings'] = settings
    report['gpu'] = gpu
    report['analysis_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    report['input_sha256'] = dict(zip([p.name for p in paths], hashes))
    if args.json:
        args.json.write_text(json.dumps(report, indent=2) + '\n')
    print(f"{report['runs']} processes; {report['family_size']} contrasts; approximate 95% simultaneous process-bootstrap intervals allocated across {report['family_count']} cohort families.\n")
    print('| Workload | Size | Comparison | Baseline µs | Treatment µs | Speedup | Simultaneous 95% | Process range | SASS same | Result |')
    print('| --- | ---: | --- | ---: | ---: | ---: | --- | --- | --- | --- |')
    for row in report['records']:
        low, high = row['simultaneous_95']
        values = row['process_speedups']
        result = 'win >1%' if row['consistent_win'] else ('loss >1%' if row['consistent_loss'] else 'inconclusive at 1%')
        print(f"| {row['workload']} | {row['size']} | {row['contrast']} | {row['baseline_us']:.3f} | {row['treatment_us']:.3f} | {row['speedup']:.4f}× | {low:.4f}–{high:.4f} | {min(values):.4f}–{max(values):.4f} | {'yes' if row['sass_identical'] else 'no'} | {result} |")
    print('\nSpeedup = baseline / treatment. Estimate = geometric mean of process median paired ratios.\n'
          'Processes, not launches, are replication units. Intervals use a joint process-cluster max-deviation bootstrap.\n'
          'Coverage is approximate, particularly with few processes or correlated background load.\n'
          'A win requires all process medians >1.01 and simultaneous lower bound >1.01; causal interpretation also requires controls and code inspection.\n'
          'An inconclusive result does not prove equivalence. No outliers are dropped.')

if __name__ == '__main__':
    main()
