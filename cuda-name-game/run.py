#!/usr/bin/env python3
"""Run separate CUDA processes after idle gates; retain local timing and telemetry."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import threading
import time

FIELDS = ['utilization.gpu', 'temperature.gpu', 'clocks.sm', 'clocks.mem', 'power.draw', 'memory.used', 'clocks_event_reasons.active']

def sample():
    values = subprocess.check_output(['nvidia-smi', '--id=0', '--query-gpu=' + ','.join(FIELDS), '--format=csv,noheader,nounits'], text=True).strip().split(', ')
    if len(values) != len(FIELDS):
        raise RuntimeError('Unexpected telemetry shape')
    return dict(zip(FIELDS, values))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('modules', type=Path)
    parser.add_argument('--runs', type=int, default=10)
    parser.add_argument('--rounds', type=int, default=20)
    parser.add_argument('--batch-ms', type=float, default=15)
    parser.add_argument('--prefix', default='primary')
    parser.add_argument('--direct', action='store_true')
    parser.add_argument('--seed-base', type=int, default=None, help='default 1000 for graph, 2000 for direct confirmation')
    parser.add_argument('--idle-timeout', type=float, default=900)
    parser.add_argument('--max-idle-util', type=float, default=15)
    parser.add_argument('--max-idle-temp', type=float, default=65)
    parser.add_argument('--max-idle-power', type=float, default=None, help='optional pre-run power ceiling in watts')
    args = parser.parse_args()
    if args.seed_base is None:
        args.seed_base = 2000 if args.direct else 1000
    if not 0 <= args.seed_base <= 4_000_000_000 or args.seed_base + args.runs >= 2**32:
        parser.error('Seed range must fit unsigned 32-bit values')
    folder = args.modules.resolve()
    if not args.prefix.replace('-', '').isalnum() or args.runs < 1:
        parser.error('Use an alphanumeric prefix and positive run count')
    if list(folder.glob(args.prefix + '-*')):
        parser.error('Prefix already exists; refuse to overwrite evidence')
    build = json.loads((folder / 'build.json').read_text())
    for name, expected in build['source_sha256'].items():
        actual = hashlib.sha256((Path(__file__).parent / name).read_bytes()).hexdigest()
        if actual != expected:
            raise RuntimeError('Build source differs from current source: ' + name)
    for variant in build['variants']:
        if hashlib.sha256((folder / (variant['label'] + '.cubin')).read_bytes()).hexdigest() != variant['cubin_sha256']:
            raise RuntimeError('Cubin differs from build record')
    bench_hash = hashlib.sha256((folder / 'bench').read_bytes()).hexdigest()
    gpu = subprocess.check_output(['nvidia-smi', '--id=0', '--query-gpu=name,driver_version,compute_cap,memory.total', '--format=csv,noheader'], text=True).strip()
    for index in range(1, args.runs + 1):
        stem = folder / f'{args.prefix}-{index:02d}'
        stop = threading.Event()
        with stem.with_suffix('.telemetry.csv').open('x', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=['utc', 'phase', *FIELDS])
            writer.writeheader()
            start = time.monotonic()
            consecutive = 0
            while consecutive < 5:
                data = sample()
                writer.writerow({'utc': datetime.now(timezone.utc).isoformat(), 'phase': 'idle', **data})
                stream.flush()
                quiet = float(data['utilization.gpu']) <= args.max_idle_util and float(data['temperature.gpu']) <= args.max_idle_temp
                if args.max_idle_power is not None:
                    quiet = quiet and float(data['power.draw']) <= args.max_idle_power
                consecutive = consecutive + 1 if quiet else 0
                if time.monotonic() - start > args.idle_timeout:
                    raise RuntimeError('GPU did not meet idle gate; no contaminated fallback run')
                time.sleep(2)
            errors = []
            def monitor():
                while not stop.is_set():
                    try:
                        writer.writerow({'utc': datetime.now(timezone.utc).isoformat(), 'phase': 'benchmark', **sample()})
                        stream.flush()
                    except Exception as error:
                        errors.append(str(error))
                        return
                    stop.wait(1)
            thread = threading.Thread(target=monitor)
            thread.start()
            command = [str(folder / 'bench'), str(folder), '--rounds', str(args.rounds), '--batch-ms', str(args.batch_ms), '--seed', str(args.seed_base + index)]
            if args.direct:
                command.append('--direct')
            metadata = {'command': command, 'settings': vars(args) | {'modules': str(folder)}, 'start_utc': datetime.now(timezone.utc).isoformat(), 'build': build, 'benchmark_sha256': bench_hash, 'gpu': gpu, 'harness_compiler': (folder / 'harness_compiler.txt').read_text().strip() if (folder / 'harness_compiler.txt').exists() else build['host_compiler']}
            print(f'Starting {args.prefix} {index}/{args.runs}', flush=True)
            try:
                with stem.with_suffix('.csv').open('x') as output, stem.with_suffix('.txt').open('x') as log:
                    process = subprocess.run(command, stdout=output, stderr=log)
                metadata['exit_code'] = process.returncode
            finally:
                stop.set()
                thread.join()
            metadata['end_utc'] = datetime.now(timezone.utc).isoformat()
            metadata['telemetry_errors'] = errors
            stem.with_suffix('.json').write_text(json.dumps(metadata, indent=2) + '\n')
            if process.returncode or errors:
                raise RuntimeError('Benchmark or telemetry failed: inspect retained evidence')
            print(f'Finished {args.prefix} {index}/{args.runs}', flush=True)

if __name__ == '__main__':
    main()
