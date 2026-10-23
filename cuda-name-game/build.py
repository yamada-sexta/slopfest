#!/usr/bin/env python3
"""Build two raw-CUDA modules and reject any PTX difference beyond the name."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

SOURCE = Path(__file__).resolve().parent

def command(args):
    subprocess.run([str(arg) for arg in args], check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cuda', type=Path, default=os.environ.get('CUDA_HOME'))
    parser.add_argument('--cxx', default=os.environ.get('HOST_CXX', shutil.which('g++-14') or 'g++'))
    parser.add_argument('--arch', help='sm_XX; defaults to the first GPU compute capability')
    parser.add_argument('--output', type=Path, default=SOURCE.parent / '.local' / 'cuda-name-game')
    args = parser.parse_args()
    cuda = args.cuda
    if cuda is None:
        nvcc = shutil.which('nvcc')
        cuda = Path(nvcc).resolve().parent.parent if nvcc else Path('/usr/local/cuda')
    arch = args.arch
    if arch is None:
        capability = subprocess.check_output(['nvidia-smi', '--query-gpu=compute_cap', '--format=csv,noheader'], text=True).splitlines()[0].strip()
        arch = 'sm_' + capability.replace('.', '')
    if not re.fullmatch(r'sm_\d{2,3}', arch):
        parser.error('Use an architecture such as sm_86.')
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    for prefix in ['neutral', 'cutlass']:
        command([cuda / 'bin/nvcc', '-std=c++17', '-O3', '-arch=' + arch, '-ccbin', args.cxx,
                 '-DPREFIX=' + prefix, '--ptx', SOURCE / 'kernels.cu', '-o', out / (prefix + '.ptx')])
    original = (out / 'neutral.ptx').read_text()
    renamed = (out / 'cutlass.ptx').read_text().replace('cutlass_', 'neutral_')
    if original != renamed:
        raise RuntimeError('PTX differs beyond the kernel names; refusing a name-only comparison.')
    for prefix in ['neutral', 'cutlass']:
        command([cuda / 'bin/ptxas', '-O3', '-arch=' + arch, '-v', out / (prefix + '.ptx'), '-o', out / (prefix + '.cubin')])
        with (out / (prefix + '.sass')).open('w') as stream:
            subprocess.run([str(cuda / 'bin/cuobjdump'), '--dump-sass', str(out / (prefix + '.cubin'))], stdout=stream, check=True)
        with (out / (prefix + '.resources')).open('w') as stream:
            subprocess.run([str(cuda / 'bin/cuobjdump'), '--dump-resource-usage', str(out / (prefix + '.cubin'))], stdout=stream, check=True)
    command([args.cxx, '-std=c++17', '-O3', '-Wall', '-Wextra', '-Werror', SOURCE / 'bench.cpp',
             '-I' + str(cuda / 'include'), '-L' + str(cuda / 'lib64/stubs'), '-lcuda', '-o', out / 'bench'])
    metadata = {'arch': arch, 'ptx_name_only': True,
                'nvcc': subprocess.check_output([str(cuda / 'bin/nvcc'), '--version'], text=True),
                'host_compiler': subprocess.check_output([args.cxx, '--version'], text=True).splitlines()[0]}
    (out / 'build.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print('Built name-only PTX pair and benchmark in', out)

if __name__ == '__main__':
    main()
