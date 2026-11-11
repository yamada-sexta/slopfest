# The hard-coded name predicate inside PTXAS

Confirmed locally on 2026-11-10, using the same installed compiler version as
the performance investigation: Linux x86-64 PTXAS **13.2.86**, CUDA 13.2,
build `cuda_13.2.r13.2/compiler.37953736_0`, built May 8, 2026.
The executable is a stripped, position-independent ELF. SHA-256:

```text
19e72e997567f783361f2b27403689d4254cde5d6ee78757660217126cd1a0e7
```

There is a real case-sensitive substring test against `cutlass`. This is
confirmed by static disassembly **and actual compiler execution under GDB**.
This does not establish a universal speedup or the names of all affected passes.

## Demonstrate it

From the repository root, this prints the compiler identity, string bytes, and
complete predicate disassembly. It rejects other compiler hashes rather than
silently displaying unrelated instructions:

```sh
python3 cuda-name-game/inspect_ptxas.py --ptxas /usr/local/cuda/bin/ptxas
```

The direct GNU binutils commands for this exact binary are:

```sh
sha256sum /usr/local/cuda/bin/ptxas
objdump -s --start-address=0x256b910 --stop-address=0x256b918 /usr/local/cuda/bin/ptxas
objdump -d --start-address=0x8d6790 --stop-address=0x8d67f1 /usr/local/cuda/bin/ptxas
```

The first dump shows `6375746c 61737300`, or `cutlass\0`. The relevant part
of the second dump is:

```asm
8d67be: lea    0x1c9514b(%rip),%rsi  # 256b910
8d67c5: mov    %rax,%rdi
8d67c8: call   248df0 <strstr@plt>
8d67cd: test   %rax,%rax
8d67d0: setne  %al
```

Under the Linux x86-64 calling convention, RDI is the first argument and RSI is
the second. The hard-coded string is the second argument to `strstr`. The
non-null return is converted into a boolean. Addresses above are ELF virtual
addresses, before the runtime load bias; these particular text/rodata offsets
also equal their file offsets. ASLR changes runtime addresses.

To observe the actual arguments and results, rather than relying on the
calling-convention interpretation alone:

```sh
python3 cuda-name-game/inspect_ptxas.py --ptxas /usr/local/cuda/bin/ptxas --observe
```

This launches the compiler under GDB with a generated four-entry PTX input.
It needs Linux `/proc` and GDB with Python. It finds the runtime load bias,
breaks immediately before and after this `strstr` call, and checks all results:

| Actual kernel name | Needle | Match |
| --- | --- | --- |
| `neutral_probe` | `cutlass` | false |
| `cutlass_probe` | `cutlass` | true |
| `CUTLASS_probe` | `cutlass` | false |
| `prefix_cutlass_suffix` | `cutlass` | true |

Output ends with `PTXAS_OBSERVATION_PASS`. Kernel processing order can vary.
The probe compiles temporary device code; it runs no GPU kernels. GDB sets
ordinary breakpoints in its own child process. The installed executable on disk
is unchanged, and the temporary PTX/cubin/debugger script are removed afterward.
This is a logic demonstration, not a new performance measurement.

## What the surrounding code establishes

The predicate starts at `0x8d6790`. Analyst-written pseudocode, with unknown
structure fields named by their offsets, is:

```c
bool name_predicate(Context *ctx) {
    options = ctx->field_680->field_48;
    if (options->byte_8ce8 == 1 && options->int_8cf0 != 0)
        return options->int_8cf0 == 1;
    name = /* string obtained through an indirect method call */;
    return strstr(name, "cutlass") != NULL;
}
```

The string argument is a kernel name in the observed runs. The compiler's
original source, structure types and function name are unavailable. The explicit
override branch is visible, but no supported command-line option for these
fields has been established. Do not equate it with
`--allow-expensive-optimizations`: the earlier 20-variant experiment found that
flag did not reproduce or disable the naming effect for the tested code.

Two direct call sites were found in the executable's disassembly:

- `0x8e8706`: tests AL and chooses control flow at `0x8e8717`.
- `0x8f8642`: retains the result, tests it alongside other context flags, and
  uses it again at `0x8f86a4` before further compiler processing.

These establish that other code consumes the predicate. They do not identify
every downstream transformation. The previous cubin/SASS comparisons establish
which of our kernels' encodings changed, and the timings establish the measured
performance effects separately.

An additional observed string at `0x25669e0`,
`AiBcgSbePhgynffNhgbQrgrpgvbaZbqr`, decodes with ROT13 to
`NvOptForCutlassAutoDetectionMode`. Its presence suggests a related internal
setting; its relationship to those two fields and a usable public flag remain
unverified. Bounded attempts to pass `--omega-knob` were rejected as an unknown
option. No undocumented switch is recommended here.

## Re-find it on a different compiler build

Do not reuse the addresses blindly. Start with:

```sh
ptxas --version
strings -tx /path/to/ptxas | rg 'cutlass'
readelf -WS /path/to/ptxas
objdump -d --no-show-raw-insn /path/to/ptxas | rg -B8 -A14 '256b910'
```

Replace the last search with the string's **virtual address** for that ELF.
`strings -tx` reports file offsets; use the containing section's address and
offset from `readelf` to translate. Locate references, inspect their complete
functions and callers, then observe argument values if needed. Finding the word
alone does not prove a name-dependent decision.

## Sources, tools and retained evidence

The supplied [Triton commit](https://github.com/triton-lang/triton/commit/a5e23d8e7e64b8a11af3edc1705407d91084b01d)
adds a name callback that prepends `cutlass_` for a particular FP8 attention
specialization. It motivates this investigation; it is not the source of the
local addresses or proof about this executable.

The REA reverse-engineering skill was used to identify/open the target. REA
reported its canonical path, ELF architecture and the SHA-256 above. Its
Hopper backend then timed out waiting for bridge readiness. No successful REA
decompilation or cross-reference result is claimed. The session was closed.
The disassembly and runtime findings here come from GNU `objdump`, `readelf`,
`strings`, and GDB, with original analysis and a reproducible probe.

Machine-specific evidence is retained locally under ignored
`.local/cuda-name-game-ptxas/`, including the original six-kernel neutral/cutlass
GDB observations and the four-name demonstration. Raw binaries, debugger logs
and machine-specific state are excluded from Git.
