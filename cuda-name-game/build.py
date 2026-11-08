#!/usr/bin/env python3
"""Build a name × assembler-policy CUDA experiment with identical normalized PTX."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

SOURCE = Path(__file__).resolve().parent
NAMES = ('neutral', 'cutlass', 'control', 'CUTLASS')
POLICIES = {
    'o3': ['-O3'],
    'o3_explicit': ['-O3', '--allow-expensive-optimizations=true'],
    'o3_noexp': ['-O3', '--allow-expensive-optimizations=false'],
    'o2_explicit': ['-O2', '--allow-expensive-optimizations=true'],
    'o2_noexp': ['-O2', '--allow-expensive-optimizations=false'],
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cuda', type=Path, default=os.environ.get('CUDA_HOME'))
    parser.add_argument('--cxx', default=os.environ.get('HOST_CXX', shutil.which('g++-14') or 'g++'))
    parser.add_argument('--arch', help='sm_XX; defaults to GPU 0 compute capability')
    parser.add_argument('--output', type=Path, default=SOURCE.parent / '.local' / 'cuda-name-game-v2')
    args = parser.parse_args()
    nvcc = shutil.which('nvcc')
    cuda = args.cuda or (Path(nvcc).resolve().parent.parent if nvcc else Path('/usr/local/cuda'))
    arch = args.arch
    if arch is None:
        capability = subprocess.check_output(['nvidia-smi', '--query-gpu=compute_cap', '--format=csv,noheader'], text=True).splitlines()[0].strip()
        arch = 'sm_' + capability.replace('.', '')
    if not re.fullmatch(r'sm_\d{2,3}', arch):
        parser.error('Use an architecture such as sm_86.')
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    commands = []
    def run(command, **kwargs):
        commands.append([str(x) for x in command])
        return subprocess.run(commands[-1], check=True, **kwargs)
    original = None
    for prefix in NAMES:
        ptx = out / (prefix + '.ptx')
        run([cuda / 'bin/nvcc', '-std=c++17', '-O3', '-arch=' + arch, '-ccbin', args.cxx,
             '-DPREFIX=' + prefix, '--ptx', SOURCE / 'kernels.cu', '-o', ptx])
        normalized = ptx.read_text().replace(prefix + '_', 'neutral_')
        if original is not None and normalized != original:
            raise RuntimeError('PTX differs beyond names; refusing the experiment.')
        original = normalized
    variants = []
    for policy, flags in POLICIES.items():
        for prefix in NAMES:
            label = policy + '__' + prefix
            cubin = out / (label + '.cubin')
            with (out / (label + '.ptxas.txt')).open('w') as log:
                run([cuda / 'bin/ptxas', *flags, '-arch=' + arch, '-v', out / (prefix + '.ptx'), '-o', cubin], stderr=log)
            for ext, option in [('sass', '--dump-sass'), ('resources', '--dump-resource-usage')]:
                with (out / (label + '.' + ext)).open('w') as stream:
                    run([cuda / 'bin/cuobjdump', option, cubin], stdout=stream)
            variants.append({'label': label, 'prefix': prefix, 'policy': policy,
                             'flags': flags, 'cubin_sha256': digest(cubin)})
    run([args.cxx, '-std=c++17', '-O3', '-Wall', '-Wextra', '-Werror', SOURCE / 'bench.cpp',
         '-I' + str(cuda / 'include'), '-L' + str(cuda / 'lib64/stubs'), '-lcuda', '-o', out / 'bench'])
    (out / 'variants.tsv').write_text(''.join(v['label'] + '\t' + v['prefix'] + '\n' for v in variants))
    metadata = {'arch': arch, 'ptx_name_only': True, 'variants': variants, 'commands': commands,
                'source_sha256': {p: digest(SOURCE / p) for p in ['kernels.cu', 'bench.cpp', 'build.py']},
                'nvcc': subprocess.check_output([str(cuda / 'bin/nvcc'), '--version'], text=True),
                'ptxas': subprocess.check_output([str(cuda / 'bin/ptxas'), '--version'], text=True),
                'host_compiler': subprocess.check_output([args.cxx, '--version'], text=True).splitlines()[0]}
    (out / 'build.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print('Built', len(variants), 'name/policy variants in', out)

if __name__ == '__main__':
    main()
