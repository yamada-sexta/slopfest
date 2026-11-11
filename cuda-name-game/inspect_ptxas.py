#!/usr/bin/env python3
"""Display a verified PTXAS name predicate; optionally observe it under GDB.

Static inspection is the default. --observe launches the compiler, compiles a
temporary four-kernel PTX input, and observes arguments/results at two addresses.
It does not execute GPU kernels or change the installed executable on disk.
"""
import argparse
import hashlib
from pathlib import Path
import shutil
import subprocess
import tempfile


KNOWN_SHA256 = '19e72e997567f783361f2b27403689d4254cde5d6ee78757660217126cd1a0e7'
EXPECTED = {
    'neutral_probe': False,
    'cutlass_probe': True,
    'CUTLASS_probe': False,
    'prefix_cutlass_suffix': True,
}


def probe_ptx():
    text = '.version 9.2\n.target sm_86\n.address_size 64\n'
    for name in EXPECTED:
        text += '''
.visible .entry NAME(.param .u64 ptr) {
.reg .u64 %rd<2>;
.reg .f32 %f<3>;
ld.param.u64 %rd1, [ptr];
ld.global.f32 %f1, [%rd1];
fma.rn.f32 %f2, %f1, 0f3F800001, %f1;
st.global.f32 [%rd1], %f2;
ret;
}
'''.replace('NAME', name)
    return text


GDB_SCRIPT = '''set pagination off
set confirm off
set debuginfod enabled off
set disable-randomization off
starti
python
import gdb, os
pid = gdb.selected_inferior().pid
target = os.path.realpath(gdb.current_progspace().filename)
with open('/proc/%d/maps' % pid) as stream:
    maps = [line.split(None, 5) for line in stream]
base = int(next(row[0] for row in maps
                if row[2] == '00000000' and len(row) == 6
                and row[5].strip() == target).split('-')[0], 16)
expected = {'neutral_probe': False, 'cutlass_probe': True,
            'CUTLASS_probe': False, 'prefix_cutlass_suffix': True}
observed = {}
pending = None
failed = []
class Check(gdb.Breakpoint):
    def stop(self):
        global pending
        pending = gdb.parse_and_eval('(char*)$rdi').string()
        needle = gdb.parse_and_eval('(char*)$rsi').string()
        print('PTXAS_CHECK name=' + pending + ' needle=' + needle)
        if needle != 'cutlass' or pending not in expected:
            failed.append('Unexpected strstr arguments')
        return False
class Result(gdb.Breakpoint):
    def stop(self):
        matched = int(gdb.parse_and_eval('$rax')) != 0
        print('PTXAS_RESULT name=' + str(pending) + ' matched=' + str(matched))
        if pending in observed and observed[pending] != matched:
            failed.append('Inconsistent result for ' + pending)
        observed[pending] = matched
        return False
Check('*' + hex(base + 0x8d67c8))
Result('*' + hex(base + 0x8d67cd))
end
continue
python
if failed or observed != expected or gdb.selected_inferior().pid != 0 or int(gdb.parse_and_eval('$_exitcode')) != 0:
    print('PTXAS_OBSERVATION_FAILED: ' + repr((failed, observed)))
    gdb.execute('quit 1')
else:
    print('PTXAS_OBSERVATION_PASS: all four names and results verified')
end
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ptxas', type=Path, default=shutil.which('ptxas') or '/usr/local/cuda/bin/ptxas')
    parser.add_argument('--observe', action='store_true', help='also launch PTXAS under GDB; needs Linux /proc and GDB Python')
    args = parser.parse_args()
    target = args.ptxas.resolve(strict=True)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    print('SHA-256:', digest, flush=True)
    if digest != KNOWN_SHA256:
        parser.error('Unrecognized binary: refusing to apply addresses from a different build. See PTXAS.md for discovery commands.')
    subprocess.run([str(target), '--version'], check=True)
    subprocess.run(['objdump', '-s', '--start-address=0x256b910', '--stop-address=0x256b918', str(target)], check=True)
    subprocess.run(['objdump', '-d', '--start-address=0x8d6790', '--stop-address=0x8d67f1', str(target)], check=True)
    if args.observe:
        with tempfile.TemporaryDirectory(prefix='ptxas-name-probe-') as temporary:
            folder = Path(temporary)
            (folder / 'probe.ptx').write_text(probe_ptx())
            (folder / 'observe.gdb').write_text(GDB_SCRIPT)
            subprocess.run(['gdb', '-q', '-nx', '-batch', '-x', str(folder / 'observe.gdb'),
                            '--args', str(target), '-O3', '-arch=sm_86', str(folder / 'probe.ptx'),
                            '-o', str(folder / 'probe.cubin')], check=True)


if __name__ == '__main__':
    main()
