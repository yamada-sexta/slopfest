# CUDA name game

A local experiment testing whether a lowercase `cutlass` kernel name changes CUDA
machine code and runtime. It compares identical source/PTX across four names and
five assembler policies, with CPU correctness oracles, CUDA Graph timing, balanced
ordering, independent processes, telemetry, and process-level uncertainty.

[PTXAS disassembly and runtime proof](PTXAS.md) identifies the hard-coded
`strstr(name, "cutlass")` predicate in the inspected compiler build. Run
`python3 cuda-name-game/inspect_ptxas.py --observe` from the repository root
to reproduce the four-name debugger demonstration. See the
[findings](FINDINGS.md#raw-data-and-exact-repetition-counts) for raw-data paths
and the distinction between 300 timed batches per variant and 15 fresh processes.

No CUTLASS library, PyTorch, Triton, or BLAS is used.

Read [INVESTIGATION.md](INVESTIGATION.md) for the plan and progress. See
[FINDINGS.md](FINDINGS.md) for measurements, exact scope, and the current review
status. This experiment measures handwritten FP32 kernels and FP16/BF16/INT8/INT4
WMMA GEMMs on the tested Ampere and Turing systems. It cannot establish a
universal rule for all CUDA programs or reproduce Hopper/Blackwell FP8 attention.

## Build locally

Requires an NVIDIA GPU/driver, a CUDA toolkit containing `nvcc`, `ptxas`, and
`cuobjdump`, Python 3.9+, and a CUDA-supported C++ compiler. GPU 0 is used.
From the repository root:

```sh
python3 cuda-name-game/build.py --cuda "$CUDA_HOME" \
  --cxx "$(brew --prefix gcc@14)/bin/g++-14"
```

Omit `--cuda` to discover `CUDA_HOME`, `nvcc` on PATH, or `/usr/local/cuda`.
Omit `--cxx` to discover `HOST_CXX`, `g++-14`, or `g++`. `--arch sm_86` overrides
the GPU's reported compute capability. Do not use unsupported-compiler overrides;
consult the toolkit's `include/crt/host_config.h` and
[NVIDIA's host compiler policy](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/index.html#host-compiler-support-policy).
A recent system GCC is not necessarily supported by nvcc.

The builder compiles [kernels.cu](kernels.cu) with equal-length `neutral`, `cutlass`,
`control`, and `CUTLASS` prefixes. It rejects any PTX difference beyond these names.
Each PTX is assembled under all five policies:

| Policy | ptxas arguments |
| --- | --- |
| `o3` | `-O3` (default assembler optimization level) |
| `o3_explicit` | `-O3 --allow-expensive-optimizations=true` |
| `o3_noexp` | `-O3 --allow-expensive-optimizations=false` |
| `o2_explicit` | `-O2 --allow-expensive-optimizations=true` |
| `o2_noexp` | `-O2 --allow-expensive-optimizations=false` |

[NVIDIA discussion 1290](https://github.com/NVIDIA/cutlass/discussions/1290)
mentions the O2/expensive=true combination. It does not say that this combination
is equivalent to naming a kernel `cutlass`. NVIDIA documents expensive
optimizations as enabled by default at O2 and above. `nvcc -O3` controls host
optimization; these policies explicitly control device assembly via `ptxas`.
Passing the latter options through nvcc uses, for example,
`--ptxas-options=-O2,--allow-expensive-optimizations=true`.

Outputs go to ignored `.local/cuda-name-game-v2/` by default. They include all 20
cubins, PTX, encoded SASS, registers/resources/spill reports, executable, variant
manifest, source/binary hashes, and exact tool versions/commands. `--output`
changes that directory. Keep machine-specific evidence and generated builds out
of Git. Earlier `.local/cuda-name-game/` evidence is not overwritten.

## Verify before measuring

```sh
.local/cuda-name-game-v2/bench .local/cuda-name-game-v2 --verify-only
"$CUDA_HOME/bin/compute-sanitizer" --tool memcheck --error-exitcode 1 \
  .local/cuda-name-game-v2/bench .local/cuda-name-game-v2 --verify-only
python3 -m unittest discover -s cuda-name-game/test -v
```

Verification covers every variant and output, including all timed sizes, plus
matrix edges 1, 17, 67, 129 and vector edges 1, 257, 4099. Outputs start as NaNs,
with 64 trailing sentinels; independent CPU references and memcheck detect errors.
Small GEMMs use random dyadic inputs and a full double-precision CPU dot product.
Large GEMMs use periodic dyadic inputs with an exact CPU reference table indexed
by row/column residue. Reduction and stencil sums are exact on these dyadic inputs.
The FMA oracle uses explicit `std::fma` and separately rounded multiplications.
Copies complete before the nonblocking benchmark stream begins work.

## Repeated experiment

Pause other heavy GPU work; leave the display and other applications as desired,
but interpret small differences in light of that background activity.

```sh
python3 cuda-name-game/run.py .local/cuda-name-game-v2 --runs 10 \
  --rounds 20 --batch-ms 15 --prefix primary
python3 cuda-name-game/analyze.py --modules .local/cuda-name-game-v2 \
  --json .local/cuda-name-game-v2/primary-summary.json \
  .local/cuda-name-game-v2/primary-??.csv \
  > .local/cuda-name-game-v2/primary-report.md
```

The runner refuses existing prefixes. Before each process it waits for five
consecutive two-second samples at <=15% utilization and <=65°C. It fails after
15 minutes rather than silently benchmarking a heavily loaded GPU. Thresholds
and timeout are explicit command options; record changes and their rationale.
It samples temperature, clocks, utilization, power, memory, and clock-event reason
masks throughout execution; these files contain no process inventory. Adjacent
JSON retains success/failure, seeds, settings, timestamps, and the full build
record. Failed pilots are kept locally and excluded from primary analysis.

Each process randomly orders module loading and cases using its recorded seed.
Primary seeds are 1001–1010; direct confirmation defaults to 2001–2005.
`--seed-base` overrides the base explicitly. Within a case, all variants warm up, then calibrate a common launch count from the
slowest pilot, targeting 15 ms. Counts are capped at 8192, so actual batches may
be shorter. Serial CUDA Graphs are captured, instantiated, uploaded/warmed, and
then timed with CUDA events. Allocation, copies, correctness, graph construction,
and first launches are excluded. Repeated launches use the same buffers: these
are warmed steady-state workloads, not cold-cache or end-to-end application timings.

A shuffled cyclic schedule runs every variant at every temporal position once
per 20 rounds. Each block of 20 rounds gets a newly shuffled permutation. Rounds
must be multiples of the number of variants. This balances order without relying
on one always-first baseline. The row records case, round, position, batch, variant,
and per-kernel microseconds. Independent process starts vary ordering and can vary code placement; within-round comparisons share the same buffers and
dimensions. Lazy function loading can limit physical placement randomization.

Confirm consequential findings with ordinary driver launches, excluding graph
replay (keep these runs separate):

```sh
python3 cuda-name-game/run.py .local/cuda-name-game-v2 --runs 5 \
  --rounds 20 --batch-ms 5 --prefix direct --direct
python3 cuda-name-game/analyze.py --modules .local/cuda-name-game-v2 \
  --json .local/cuda-name-game-v2/direct-summary.json \
  .local/cuda-name-game-v2/direct-??.csv \
  > .local/cuda-name-game-v2/direct-report.md
```

Direct event batches can include host submission gaps, particularly for tiny
kernels. Agreement of direct and graph results strengthens interpretation; their
absolute latencies need not match. Neither method changes clocks or power limits.

## Tasks and sizes

| Family | Timed sizes | Character |
| --- | --- | --- |
| SAXPY | 1,048,576; 8,388,608 floats | Read two vectors, write `1.25*x+y` |
| 1D stencil | Same | Three neighboring values, zero boundaries |
| Reduction | Same | Shared-memory reduction of each 256-input block |
| FMA chains | 65,536; 1,048,576 elements | Two interacting chains, 128 iterations |
| Tiled GEMM | Square N=256, 1024 | Shared 16×16 tiles, one output/thread |
| Register GEMM | Square N=256, 1024, 2048 | 128×128 block tiles, 8×8 outputs/thread |

There are 13 workload/size cases. The N=256 register GEMM has only four blocks,
intentionally exposing a small-grid regime. All are bounds-checked FP32 kernels;
none is a claim of state-of-the-art CUDA performance.

## Statistical interpretation

Speedup is **baseline latency / treatment latency** (>1 favors treatment). For
each process, take the median log paired ratio over rounds. The main estimate is
the exponentiated mean across those process estimates. Median absolute latencies
are descriptive and need not have the same ratio as the paired estimate.

The analyzer treats whole processes as replication units. It reports pointwise
percentile bootstrap intervals in JSON and approximate 95% simultaneous intervals
in the table, using a joint process-cluster max-standardized-deviation bootstrap
across all 195 predeclared comparisons (15 contrasts × 13 cases). It jointly
resamples process indices, preserving within-process correlations. The fixed SEs
and only ten processes make coverage approximate, especially under time-correlated
background load; there is no guarantee of a population-wide confidence statement.

A **consistent useful win** requires every process estimate >1.01 and the
simultaneous lower bound >1.01; losses use the reciprocal threshold. A result
inside this threshold is inconclusive, not proof of equivalence. No outliers are
removed. Also inspect conditional timing-order estimates, all per-process ratios,
identical-SASS sham controls, and changes to registers/spills before attributing
a gain to optimization. An identical instruction stream cannot establish that a
new optimization was enabled merely because its measured timing moved.

The analyzer rejects nonfinite/negative timings, duplicate or missing rows,
unbalanced positions, inconsistent batches/shapes/settings/builds, failed runs,
and duplicated process files. It includes encoded instruction **and control**
words in SASS comparisons. Host tests independently enumerate a small bootstrap
distribution and check known speedups, null effects, corruption, and schedule
balance. Use `npm test` and `npm run build` for the rest of the playground.

## Lower precision and quantization

```sh
python3 cuda-name-game/build_precision.py --cuda "$CUDA_HOME" \
  --cxx "$(brew --prefix gcc@14)/bin/g++-14"
.local/cuda-name-game-precision/bench .local/cuda-name-game-precision --verify-only
python3 cuda-name-game/run.py .local/cuda-name-game-precision --runs 10 \
  --rounds 20 --batch-ms 15 --prefix primary
```

Use `analyze.py` in the same way, pointing at this suite's module directory and
process files. This suite is validated on SM75 and SM86; experimental INT4 WMMA support
varies on other architectures. It has FP16→FP32, BF16→FP32, signed INT8→INT32, and packed
signed INT4→INT32 WMMA GEMM at square sizes 128, 512, 1024, 2048, and 4096. Turing
(sm_75) excludes BF16 WMMA; Ampere (sm_80+) includes it. FP8 Tensor Core operations
are not supported by the tested GPUs and are not emulated in this experiment.

A is row-major and B is column-major. Four warps/block stage aligned fragments
in shared memory. FP16/BF16/INT8 use 16×16×16 WMMA fragments (32×32 block output);
INT4 uses 8×8×32 fragments (16×16 block output). Logical dimensions are zero-padded
to multiples of 32. Random edge cases exercise the full logical output, padded
zeros, and sentinels at 1, 17, 67, and 129. Every timed-size output is checked too.

Floating inputs are exactly representable small dyadics q/8, q∈[-7,7]. Integer
inputs span INT8 [-128,127] or INT4 [-8,7], with zero point 0; INT4 stores the first
signed code in the low nibble. Raw INT32 output is checked against an INT64 CPU
oracle without overflow. If interpreted with input scales 1/8, the output scale
is 1/64. The test measures multiplication of already-encoded matrices. Packing,
scales, conversions, copies, and dequantization are outside timing. It does not
measure quantization error, model accuracy, or an entire inference pipeline.

**A naming comparison always keeps precision, accumulator, inputs, tile, size,
and flags unchanged.** Algorithms and input distributions differ across formats;
absolute differences between precisions are not attributed to naming. There are
300 comparisons on Ampere (20 cases × 15 contrasts) and 225 on Turing (15 × 15).
Each GPU/suite/method is analyzed separately. For the four GPU × suite cohorts,
use `analyze.py --families 4`: each cohort gets alpha=0.0125, a Bonferroni allocation
across cohorts on top of the within-cohort maximum-deviation correction. Thus
the four primary families together target approximate 95% simultaneous coverage.
The four direct-launch cohorts form a separate confirmation experiment; estimates
are never pooled across GPUs or different timing methods.

[precision_bench.cpp](precision_bench.cpp) reuses the FP32 harness's Driver API
resource/timing primitives without modifying the frozen FP32 build. The packing
test can be built and run without launching CUDA kernels:

```sh
"$(brew --prefix gcc@14)/bin/g++-14" -std=c++17 -O3 -Wall -Wextra -Werror \
  cuda-name-game/test/precision_host_test.cpp -I"$CUDA_HOME/include" \
  -L"$CUDA_HOME/lib64/stubs" -lcuda -o .local/precision-host-test
.local/precision-host-test
```

For memcheck, byte-identical variants can be deduplicated: create an ignored
module directory with the same `bench`, `o3__neutral.cubin`, `o3__cutlass.cubin`,
and a two-row `variants.tsv`. Run `--verify-only` under compute-sanitizer there.
First prove that these two variants cover **every distinct encoded kernel** in
that build. This reduces redundant instrumentation, while normal verification
continues to check all 20 variants. Sanitizer and timing runs must never overlap
on the same GPU.

## A second GPU without a toolkit

Build on the toolkit host with `--arch sm_75 --output <ignored-directory>`.
Transfer only the cubins, build metadata, `variants.tsv`, required source files,
`cuda.h`, and the CUDA driver link stub to an isolated temporary directory on the
second host. Compile its host harness with its own supported C++ compiler and
link against the installed CUDA driver; do not run the compile-host executable
blindly across different libc/C++ library versions. Record the actual host-harness
compiler in `harness_compiler.txt`. Device compiler version/flags remain those of
the original build. Retrieve raw results privately for analysis, without putting
addresses, account details, paths, or unvetted host files in the repository.

The run gate has optional `--max-idle-power W`, which requires power **in addition
to** utilization and temperature limits. This is useful when high utilization at
very low idle clocks overstates activity. Any threshold change must be recorded
before timing that cohort. A light-load gate does not prove an exclusive GPU;
within-suite controls, telemetry, process variation, and direct confirmation still
limit the claims. The default remains <=15% utilization and <=65°C.

To export an existing summary without another benchmark:

```sh
python3 cuda-name-game/plot.py <summary.json> <new-name-effects.svg> \
  --confirmation <direct-summary.json>
```

The SVG preserves reviewed estimates and approximate simultaneous intervals.
Filled circles meet the predeclared practical threshold; direct estimates use
diamonds. Keep generated figures and raw machine measurements outside Git.

## Check actual graph-replayed output

Timing processes check fresh launches before and after measurement. Also verify
actual graph output, using the same CPU oracles and the frozen executable:

```sh
"$(brew --prefix gcc@14)/bin/g++-14" -std=c++17 -O2 -Wall -Wextra -Werror \
  -fPIC -shared cuda-name-game/test/graph_replay.cpp -I"$CUDA_HOME/include" \
  -L"$CUDA_HOME/lib64/stubs" -lcuda -ldl -o .local/graph-replay.so
python3 cuda-name-game/verify_graphs.py .local/cuda-name-game-v2 \
  --library .local/graph-replay.so
python3 cuda-name-game/verify_graphs.py .local/cuda-name-game-precision \
  --library .local/graph-replay.so
```

This verification-only Linux interposer is specific to these harnesses' ABI
(three device pointers and an integer dimension). It captures three real kernel
launches, clears its host argument slots before instantiation/replay, and lets
the original independent oracle inspect the resulting GPU output. The launcher
forces `--verify-only` and checks the number of wrapped launches against every
verified case and manifest variant, so an inactive interposer cannot pass.
Compile the library with the test host's compiler when using a second host.

Run this **after** performance collection, never as a timing configuration.
It does not replace the measured executable or cubins and is not used in any
performance result. The launcher does not change its parent environment; it sets `LD_PRELOAD` only for its verification child process. On the tested
full manifests, FP32 wraps 660 launches per GPU; precision wraps 720 on Ampere
and 540 on Turing, each replaying three graph nodes.
