#!/usr/bin/env python3
"""Export the reviewed O3 name comparisons as a standalone SVG interval plot."""
import argparse
from html import escape
import json
import math
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('summary', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--confirmation', type=Path)
    parser.add_argument('--x-min', type=float)
    parser.add_argument('--x-max', type=float)
    args = parser.parse_args()
    report = json.loads(args.summary.read_text())
    if report['settings']['direct']:
        raise ValueError('Primary plot input must use graph timing')
    gpu = report.get('gpu', 'GPU unspecified').split(',')[0].replace('NVIDIA GeForce ', '')
    build = json.loads((args.summary.parent/'build.json').read_text()) if (args.summary.parent/'build.json').exists() else {}
    version = re.search(r'release (\d+\.\d+)', build.get('nvcc', ''))
    toolkit = 'CUDA '+version[1] if version else 'toolkit unspecified'
    rows = [r for r in report['records'] if r['contrast'] == 'o3: name']
    direct = {}
    if args.confirmation:
        other = json.loads(args.confirmation.read_text())
        if not other['settings']['direct'] or other.get('gpu') != report.get('gpu'):
            raise ValueError('Confirmation must use direct timing on the same GPU/driver')
        direct = {(r['workload'], r['size']): r for r in other['records'] if r['contrast'] == 'o3: name'}
        if direct.keys() != {(r['workload'], r['size']) for r in rows}:
            raise ValueError('Confirmation workloads differ')
    if not rows:
        raise ValueError('No O3 name comparisons')
    bounds = [b for r in rows for b in r['simultaneous_95']] + [1]
    bounds += [r['speedup'] for r in direct.values()]
    lo = math.floor((min(bounds)-.015)*40)/40
    hi = math.ceil((max(bounds)+.015)*40)/40
    if (args.x_min is None) != (args.x_max is None):
        raise ValueError('Provide both axis limits')
    if args.x_min is not None:
        if not math.isfinite(args.x_min) or not math.isfinite(args.x_max) or args.x_min >= args.x_max or args.x_min > min(bounds) or args.x_max < max(bounds):
            raise ValueError('Axis limits must include all reviewed bounds and estimates')
        lo, hi = args.x_min, args.x_max
    width, height = 1100, 180 + 39*len(rows)
    left, right, top = 260, 850, 112
    x = lambda value: left + (value-lo)/(hi-lo)*(right-left)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
             '<title>O3 kernel-name effects, with process-level uncertainty</title>',
             '<desc>Speedup is neutral latency divided by cutlass latency. Values above one favor cutlass. Dots are graph measurements; optional diamonds are direct launch confirmation.</desc>',
             '<rect width="100%" height="100%" fill="#fff"/>',
             '<g font-family="sans-serif" fill="#20252b">',
             '<text x="24" y="32" font-size="23" font-weight="bold">Does a cutlass name help?</text>',
             f'<text x="24" y="57" font-size="14">{escape(gpu)} · {escape(toolkit)} · {report["runs"]} processes · default O3 · warmed kernels</text>',
             f'<text x="24" y="82" font-size="13">Circles: graph estimate + approximate 95% simultaneous interval ({report.get("family_count",1)}-cohort correction).'+(' Diamonds: direct estimate.' if direct else '')+'</text>']
    bottom = top + 39*len(rows) - 15
    tick = math.ceil(lo*40)/40
    while tick <= hi + 1e-8:
        parts += [f'<line x1="{x(tick):.2f}" y1="{top-18}" x2="{x(tick):.2f}" y2="{bottom}" stroke="#e1e5e9"/>',
                  f'<text x="{x(tick):.2f}" y="{bottom+24}" text-anchor="middle" font-size="12">{tick:.3f}×</text>']
        tick += .025
    parts.append(f'<line x1="{x(1):.2f}" y1="{top-18}" x2="{x(1):.2f}" y2="{bottom}" stroke="#343b43" stroke-dasharray="4 4"/>')
    for i, row in enumerate(rows):
        y = top + i*39
        low, high = row['simultaneous_95']
        fill = '#1f65aa' if row['consistent_win'] or row['consistent_loss'] else '#fff'
        label = f'{row["workload"]}  {row["size"]:,}'
        parts += [f'<text x="{left-15}" y="{y+4}" text-anchor="end" font-size="14">{escape(label)}</text>',
                  f'<line x1="{x(low):.2f}" y1="{y}" x2="{x(high):.2f}" y2="{y}" stroke="#1f65aa" stroke-width="2"/>',
                  f'<circle cx="{x(row["speedup"]):.2f}" cy="{y}" r="4.5" fill="{fill}" stroke="#1f65aa" stroke-width="2"/>',
                  f'<text x="880" y="{y+4}" font-size="13">{row["speedup"]:.3f}× [{low:.3f}, {high:.3f}]</text>']
        if direct:
            dx = x(direct[(row['workload'], row['size'])]['speedup'])
            parts.append(f'<path d="M {dx:.2f},{y+6} l 3.5,3.5 -3.5,3.5 -3.5,-3.5 Z" fill="#565b62"/>')
    parts += [f'<line x1="{left}" y1="{bottom}" x2="{right}" y2="{bottom}" stroke="#343b43"/>',
              f'<text x="{(left+right)/2}" y="{bottom+48}" text-anchor="middle" font-size="14">Speedup = neutral / cutlass (above 1 favors cutlass)</text>',
              f'<text x="24" y="{height-12}" font-size="12">Filled: default-O3 graph criterion (&gt;1% win or loss). Hollow: inconclusive. Stock clocks; background activity recorded.</text>',
              '</g></svg>']
    with args.output.open('x') as stream:
        stream.write('\n'.join(parts) + '\n')

if __name__ == '__main__':
    main()
