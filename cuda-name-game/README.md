# CUDA name game

Does naming a raw CUDA kernel `cutlass_...` change its generated code or speed?
This experiment builds the same CUDA C++ twice, with equal-length `neutral_` and
`cutlass_` prefixes, and compares both machine code and paired GPU timings.
No CUTLASS library, Triton, PyTorch, or BLAS is used.

The name comes from a [firsthand Triton report](https://github.com/triton-lang/triton/pull/7298)
of faster FP8 attention after renaming a kernel. A
[separate investigation](https://maknee.github.io/blog/2025/Maybe-Consider-Putting-Cutlass-In-Your-CUDA-Kernels/)
reported name-dependent `ptxas` instruction selection, scheduling, and register
usage. This is a compiler heuristic to measure, rather than a general promise of
speed. Both builds here retain the same source bounds checks and synchronization.

## Build

Requires Linux, an NVIDIA GPU/driver, a CUDA toolkit with `nvcc`, `ptxas`, and
`cuobjdump`, Python 3, and a CUDA-supported GCC host compiler. GPU 0 is used.
The first GPU's compute capability supplies the default architecture.

From the repository root, with Homebrew GCC 14 installed:

```sh
python3 cuda-name-game/build.py \
  --cuda "$CUDA_HOME" \
  --cxx "$(brew --prefix gcc@14)/bin/g++-14"
```

Set `CUDA_HOME` to the installed toolkit directory first. Or omit `--cuda` to use
`CUDA_HOME`, `nvcc` on PATH, or the standard `/usr/local/cuda` toolkit location.
`--arch sm_86` is an example override; choose the architecture of your GPU.
The host compiler is passed to both `nvcc -ccbin` and the C++ benchmark harness.
No unsupported-compiler override is used. Check the toolkit's own
`include/crt/host_config.h` and [NVIDIA's host compiler documentation](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/index.html#host-compiler-support-policy)
when choosing a compiler; a newer system GCC is not automatically compatible.

Outputs default to ignored `.local/cuda-name-game/`: the executable, PTX, cubins,
SASS, register/resource reports, and compiler metadata. `--output` overrides it.
Do not add build outputs or machine-specific benchmark data to source control.

The builder verifies byte-for-byte identical PTX after normalizing the prefix,
and refuses to benchmark if anything else differs. It then assembles both PTX
files with `ptxas -O3`. The raw device source is [kernels.cu](kernels.cu).

## Verify and benchmark

```sh
.local/cuda-name-game/bench .local/cuda-name-game --verify-only
"$CUDA_HOME/bin/compute-sanitizer" --tool memcheck --error-exitcode 1 \
  .local/cuda-name-game/bench .local/cuda-name-game --verify-only

.local/cuda-name-game/bench .local/cuda-name-game --rounds 24 --batch-ms 20 \
  > .local/cuda-name-game/run-1.csv 2> .local/cuda-name-game/run-1.log
```

Repeat the last command with `run-2` and `run-3`, then summarize:

```sh
python3 cuda-name-game/analyze.py --modules .local/cuda-name-game \
  .local/cuda-name-game/run-1.csv \
  .local/cuda-name-game/run-2.csv \
  .local/cuda-name-game/run-3.csv
```

CUDA errors and validation failures produce a nonzero exit code. Compiler/GPU
metadata and validation progress go to build files or stderr; timing CSV goes
to stdout. Defaults are 12 rounds and a target 15 ms batch. For balanced AB/BA
summary statistics choose an even round count. The analyzer rejects unbalanced
or nonfinite input, recalculates ratios from timings, and includes encoded SASS
control words in its comparison.

## What is measured

- **SAXPY:** `out = 1.25*x + y`, 1,048,576 and 8,388,608 floats. This is a
  memory-oriented control; its generated machine code may be identical.
- **Tiled GEMM:** a 16 × 16 shared-memory tile, one output per thread;
  square matrices of 256 and 1,024.
- **Register GEMM:** a 128 × 128 output tile, 8 × 8 outputs per thread, K tiles
  of 8, and 256 threads per block; square matrices of 256, 1,024, and 2,048.

These are handwritten FP32 kernels, not reproductions of Hopper FP8 attention.
The 256-square register case has just four blocks and intentionally shows a
small-grid case as well as the larger matrices.

Every output from both names is checked against an independent CPU oracle, before
and after timing. Small random matrices at sizes 1, 17, 67, and 129 test ragged
edges; a double-precision CPU dot product checks every cell. Timed matrices use
small periodic integer/8 inputs, allowing a full CPU reference table indexed by
row modulo 7 and column modulo 11. Products and sums are exactly representable
in FP32 at these sizes, so equality is exact. NaN initialization catches unwritten
outputs, and 64 sentinel floats catch writes beyond the output. Vector edge tests
cover lengths 1, 257, and 4,099. Memcheck adds independent memory validation.

Both modules launch on the same stream with the same buffers, dimensions, and
block shapes. Each case warms both names, calibrates a shared batch size, then
alternates neutral-first and cutlass-first rounds. CUDA events measure average
kernel time over each batch; allocation, copies, validation, and module loading
are outside timing. Host submission gaps can remain in event measurements,
especially for tiny kernels. No clocks, power limits, or machine settings change.

The report gives median latency and median **paired** `neutral / cutlass` speedup.
They need not equal the ratio of the two latency medians. The range of process-run
medians indicates variation; it is not a confidence interval. Display activity,
boost clocks, background work, and code placement can affect timings. Small
changes in an identical-SASS control help gauge that noise. Inspect register
usage and SASS too: code generation can change without improving runtime, and
some kernels can slow down. A result applies to the tested kernels/toolchain/GPU.

## Host-tool tests

```sh
python3 -m unittest discover -s cuda-name-game/test -v
```

These tests need no GPU or CUDA installation. The repository's `npm test` remains
the browser/language test suite; GPU verification is an explicit separate command.
