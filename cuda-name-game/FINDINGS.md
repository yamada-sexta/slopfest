# Testing lowercase `cutlass` names against CUDA assembler flags

The lowercase `cutlass_` prefix changes ptxas code generation and produces
repeatable gains for selected kernels. The outcome depends on the kernel,
shape, GPU, and timing method; there are repeatable regressions too.

The strongest results on the **RTX 3060 Ti with CUDA 13.2.86** are:

- **FP32 register-tiled GEMM, N=256/1024/2048:** roughly 8–10% speedup,
  reproduced in all ten graph processes and all five direct processes, across
  all three tested O3 policies.
- **INT4 WMMA GEMM, N=4096:** roughly 5–7% speedup across those same O3 policies
  and both methods. N=1024/2048 also pass the default-O3 primary/confirmation
  criterion, but equivalent-policy module pairs occasionally reverse direction.
- **INT4 WMMA, N=128:** consistently slower, about 14% more latency in graph
  replay and 10% more under direct submission. The small FP32 FMA-chain case
  also slows in every default-O3 process, with a smaller direct-method effect.
- **N=512 INT4:** positive average, but one direct process loses; it is not
  consistently faster across the two methods.

The **RTX 2060** has no comparably robust useful win across the O3 policies and
both methods. Tiled FP32 N=1024 is positive in all 15 default-O3 point estimates,
but its independent direct-confirmation interval is wide and crosses 1. Tiled
N=256 is positive in all ten graph processes and does not reproduce consistently
under direct submission. These small effects are reported rather than treated
as either a general speedup or proof of no effect.

The flags in the supplied discussion are **not an equivalent name-enabling
switch in this experiment**: expensive=true/false preserves the code within O3;
O2 removes the observed name-dependent path. FP16, BF16, and INT8 WMMA have
identical code across names/policies here and no replicated useful naming gain.

Evidence: **60 fresh timing processes, 61 GPU/task/size/precision cases, 366,000
timed batches, and 132,912,000 timed logical kernel executions**. Replication
units are the ten primary or five confirmation **processes**, not those launches.
All selected runs, CPU/guard checks, actual graph-output checks, and memory checks
pass. No timing outliers are removed. The [independent review](REVIEW.md) agrees
that the empirical investigation goal is achieved within the stated scope.

## Exactly what is being compared

This is a test of **raw CUDA kernel symbol names**, not a comparison of the
CUTLASS library against handwritten CUDA. No CUTLASS library is linked. Four
prefixes of equal length—`neutral_`, `cutlass_`, `control_`, `CUTLASS_`—decorate the
same kernels. Normalizing only that prefix makes the four compiler-emitted PTX
files byte-identical. Cubins are assembled ahead of time for the exact GPU target;
the timing harness loads these cubins rather than asking the driver to JIT PTX.

For a naming test, precision, accumulator, mathematical operation, input bytes,
logical/padded dimensions, launch shape, buffers, assembler flags, and timing
method stay fixed. For a flag test, the name and computation stay fixed. Ordinary
renaming and uppercase controls help distinguish lowercase-specific code changes
from code placement and measurement noise.

Each PTX is crossed with O3/default, O3/expensive=true, O3/expensive=false,
O2/expensive=true, and O2/expensive=false: **20 variants per GPU target**. These
are ptxas device-assembler policies. `nvcc -O3` alone is a host optimization setting.
Build commands and source/binary hashes are retained in ignored local evidence.

| System | Device target | Device compiler | Driver | Host harness compiler |
| --- | --- | --- | --- | --- |
| RTX 3060 Ti, 8 GiB | Ampere `sm_86` | CUDA/ptxas 13.2.86 | 615.78.08 | Homebrew GCC 14.4 |
| RTX 2060 (user-described mobile), 6 GiB | Turing `sm_75` | Same CUDA/ptxas 13.2.86, compiled on toolkit host | 610.43.02 | GCC 14.3 on test host |

These are two complete GPU/driver/platform environments. A difference between
them is not assigned solely to GPU architecture. Absolute speed across these systems
is not the principal comparison; the naming/flag effect is measured within each.
Neither system's clock, power limit, fan policy, or background applications were
changed. The 3060 Ti drives an active desktop. The host CPUs are an Intel Core i5-11400
(12 logical CPUs) and an Intel Core i5-9400 (6 logical CPUs), respectively; both
run x86-64 Linux. These host differences matter particularly for tiny direct
launches that can be limited by submission overhead.

## Tasks, precision, and quantization

The FP32 suite has SAXPY, 1D stencil, 256-element block reduction, 128-iteration
interacting FMA chains, shared-tiled GEMM, and register-tiled GEMM: 13 size cases
per GPU. The [README](README.md#tasks-and-sizes) lists every size and launch shape.
The small register GEMM has four blocks; larger cases test a different regime.

The precision suite uses Tensor Core WMMA GEMM at N=128, 512, 1024, 2048, 4096:

| Input format | Accumulator/output | Input representation | Supported systems |
| --- | --- | --- | --- |
| FP16 | FP32 | Exact q/8 values, q=-7…7 | Both |
| BF16 | FP32 | Same exact dyadic input range | 3060 Ti only; BF16 WMMA unsupported on Turing |
| Signed INT8 | INT32 | Codes -128…127, zero point 0 | Both |
| Signed packed INT4 | INT32 | Codes -8…7, low nibble first, zero point 0 | Both |

Integer outputs are raw integer dot products; choosing input scales 1/8 gives
output scale 1/64. Encoding, quantization, packing, copies, dequantization, and
allocation are excluded. This tests execution of already-encoded matrices, not
model quality, quantization error, or an inference pipeline. FP8 Tensor Core
hardware is unavailable on these GPUs and is not emulated here.

A is row-major, B column-major. Four warps/block use aligned shared staging.
FP16/BF16/INT8 use 16×16×16 WMMA fragments and 32×32 block output; INT4 uses
8×8×32 fragments and 16×16 block output. Kernels differ across formats, so an
absolute FP16/INT4 latency comparison would also change the algorithm. Naming
claims are always within a format. Zero-padding to multiples of 32 is explicit;
ragged random cases 1,17,67,129 check logical output and padded zeros.

Across both GPUs there are **61 workload/size/precision cases**: 33 on Ampere and
28 on Turing. Full CPU correctness checks every variant at every timed size.

## FP32 primary graph results

Ten processes per system; **neutral/cutlass speedup**. Intervals use the four-cohort correction described below. A label describes the default-O3 graph comparison only; confirmation is reported separately below.

| Task | Size | 3060 Ti speedup [interval] | 2060 speedup [interval] | 3060 Ti graph classification |
| --- | ---: | --- | --- | --- |
| fma_chain | 65,536 | 0.9230 [0.9128, 0.9333] | 1.0014 [0.9923, 1.0106] | consistent loss >1% |
| fma_chain | 1,048,576 | 0.9939 [0.9826, 1.0054] | 1.0012 [0.9911, 1.0115] | inconclusive at 1% |
| reduce256 | 1,048,576 | 0.9990 [0.9881, 1.0100] | 0.9953 [0.9851, 1.0055] | inconclusive at 1% |
| reduce256 | 8,388,608 | 0.9986 [0.9769, 1.0208] | 1.0094 [0.9887, 1.0306] | inconclusive at 1% |
| register_gemm | 256 | 1.0875 [1.0772, 1.0980] | 1.0194 [1.0048, 1.0341] | consistent win >1% |
| register_gemm | 1,024 | 1.0801 [1.0615, 1.0992] | 0.9809 [0.9645, 0.9977] | consistent win >1% |
| register_gemm | 2,048 | 1.0799 [1.0739, 1.0859] | 1.0007 [0.9846, 1.0172] | consistent win >1% |
| saxpy | 1,048,576 | 1.0026 [0.9964, 1.0089] | 1.0032 [0.9949, 1.0115] | inconclusive at 1% |
| saxpy | 8,388,608 | 0.9967 [0.9798, 1.0138] | 0.9922 [0.9637, 1.0215] | inconclusive at 1% |
| stencil | 1,048,576 | 0.9973 [0.9881, 1.0065] | 1.0024 [0.9951, 1.0098] | inconclusive at 1% |
| stencil | 8,388,608 | 0.9993 [0.9923, 1.0064] | 1.0005 [0.9794, 1.0220] | inconclusive at 1% |
| tiled_gemm | 256 | 1.0119 [1.0016, 1.0222] | 1.0147 [1.0083, 1.0212] | inconclusive at 1% |
| tiled_gemm | 1,024 | 0.9937 [0.9771, 1.0106] | 1.0163 [1.0031, 1.0298] | inconclusive at 1% |

On Turing, tiled GEMM is faster in **all ten** primary processes: N=256 has
1.0060–1.0215× process estimates, and N=1024 has 1.0030–1.0358× estimates. Their
simultaneous intervals are above 1, supporting a positive direction in this
experiment. They do not meet the stronger predeclared criterion requiring
**more than 1%** in every process and the lower interval bound. Direct confirmation
is reported below. This distinction matters: failure of the practical threshold does
not mean no effect, and the report does not hide these smaller all-run gains.
Other Turing changed-code cases have at least one process in the other direction.

## Precision primary graph results

The same ten-process and four-cohort interval protocol applies. Values are neutral/cutlass speedups; all timed dimensions are square N. BF16 WMMA is unsupported on the 2060.

| Format | N | 3060 Ti speedup [interval] | 2060 speedup [interval] | 3060 Ti graph classification |
| --- | ---: | --- | --- | --- |
| bf16 | 128 | 0.9986 [0.9857, 1.0116] | unsupported | inconclusive at 1% |
| bf16 | 512 | 0.9948 [0.9846, 1.0052] | unsupported | inconclusive at 1% |
| bf16 | 1,024 | 1.0003 [0.9783, 1.0228] | unsupported | inconclusive at 1% |
| bf16 | 2,048 | 0.9915 [0.9816, 1.0015] | unsupported | inconclusive at 1% |
| bf16 | 4,096 | 1.0031 [0.9912, 1.0152] | unsupported | inconclusive at 1% |
| fp16 | 128 | 1.0098 [0.9896, 1.0304] | 0.9988 [0.9887, 1.0090] | inconclusive at 1% |
| fp16 | 512 | 0.9984 [0.9936, 1.0032] | 0.9958 [0.9823, 1.0096] | inconclusive at 1% |
| fp16 | 1,024 | 1.0040 [0.9922, 1.0159] | 0.9926 [0.9636, 1.0225] | inconclusive at 1% |
| fp16 | 2,048 | 0.9874 [0.9669, 1.0083] | 0.9942 [0.9484, 1.0423] | inconclusive at 1% |
| fp16 | 4,096 | 0.9970 [0.9868, 1.0074] | 1.0013 [0.9954, 1.0072] | inconclusive at 1% |
| int4 | 128 | 0.8769 [0.8540, 0.9003] | 1.0012 [0.9790, 1.0240] | consistent loss >1% |
| int4 | 512 | 1.0440 [1.0330, 1.0550] | 1.0021 [0.9969, 1.0074] | consistent win >1% |
| int4 | 1,024 | 1.0634 [1.0488, 1.0783] | 0.9947 [0.9804, 1.0092] | consistent win >1% |
| int4 | 2,048 | 1.0563 [1.0328, 1.0803] | 0.9964 [0.9783, 1.0147] | consistent win >1% |
| int4 | 4,096 | 1.0598 [1.0430, 1.0769] | 1.0029 [0.9967, 1.0091] | consistent win >1% |
| int8 | 128 | 1.0058 [0.9983, 1.0134] | 1.0019 [0.9928, 1.0110] | inconclusive at 1% |
| int8 | 512 | 0.9952 [0.9797, 1.0109] | 1.0015 [0.9844, 1.0188] | inconclusive at 1% |
| int8 | 1,024 | 1.0024 [0.9928, 1.0122] | 0.9992 [0.9397, 1.0626] | inconclusive at 1% |
| int8 | 2,048 | 0.9944 [0.9781, 1.0111] | 0.9966 [0.9741, 1.0196] | inconclusive at 1% |
| int8 | 4,096 | 0.9962 [0.9830, 1.0095] | 0.9985 [0.9916, 1.0055] | inconclusive at 1% |

INT4 on Ampere changes sign with size: the N=128 latency increases by about 14%,
while N=512–4096 have 4–6% speedups. All ten process estimates agree in direction
and pass the practical threshold. Turing INT4 has changed code without a consistent
all-process timing direction at any tested size. FP16/BF16/INT8 have no changed
code and no consistent useful naming gain. Direct confirmation is reported below.

## Ordinary-launch confirmation

Five new processes per GPU/suite, seeds 2001–2005, 5 ms targets, same cubins and balanced 20-variant schedule. The intervals have their own four-cohort correction; estimates are not pooled with graph measurements. Counts below show how many process estimates favor cutlass, out of five. These are default-O3 pairs.

### FP32

| Task | Size/N | 3060 Ti speedup [interval] | 2060 speedup [interval] | Faster processes, 3060 / 2060 |
| --- | ---: | --- | --- | --- |
| fma_chain | 65,536 | 0.9607 [0.9297, 0.9927] | 1.0164 [0.9835, 1.0504] | 0/5 / 4/5 |
| fma_chain | 1,048,576 | 0.9633 [0.9053, 1.0250] | 1.0268 [0.9703, 1.0866] | 1/5 / 4/5 |
| reduce256 | 1,048,576 | 0.9941 [0.9583, 1.0312] | 1.0003 [0.9993, 1.0013] | 1/5 / 3/5 |
| reduce256 | 8,388,608 | 1.0012 [0.9972, 1.0052] | 1.0180 [0.9580, 1.0817] | 2/5 / 2/5 |
| register_gemm | 256 | 1.0953 [1.0797, 1.1112] | 1.0062 [0.9391, 1.0780] | 5/5 / 3/5 |
| register_gemm | 1,024 | 1.0881 [1.0734, 1.1031] | 0.9852 [0.9809, 0.9895] | 5/5 / 0/5 |
| register_gemm | 2,048 | 1.0852 [1.0805, 1.0899] | 1.0036 [0.9760, 1.0321] | 5/5 / 4/5 |
| saxpy | 1,048,576 | 1.0053 [0.9980, 1.0126] | 1.0135 [0.9813, 1.0467] | 5/5 / 3/5 |
| saxpy | 8,388,608 | 1.0132 [0.9675, 1.0611] | 0.9869 [0.9479, 1.0274] | 3/5 / 2/5 |
| stencil | 1,048,576 | 1.0228 [0.9764, 1.0714] | 0.9939 [0.9768, 1.0114] | 3/5 / 2/5 |
| stencil | 8,388,608 | 0.9817 [0.9260, 1.0409] | 1.0015 [0.9965, 1.0065] | 2/5 / 2/5 |
| tiled_gemm | 256 | 1.0053 [0.9732, 1.0385] | 0.9950 [0.9618, 1.0293] | 4/5 / 3/5 |
| tiled_gemm | 1,024 | 0.9826 [0.9505, 1.0159] | 1.0203 [0.9823, 1.0597] | 0/5 / 5/5 |

### Precision

| Format | Size/N | 3060 Ti speedup [interval] | 2060 speedup [interval] | Faster processes, 3060 / 2060 |
| --- | ---: | --- | --- | --- |
| bf16 | 128 | 0.9905 [0.9575, 1.0246] | unsupported | 3/5 / unsupported |
| bf16 | 512 | 1.0092 [0.9906, 1.0281] | unsupported | 4/5 / unsupported |
| bf16 | 1,024 | 1.0023 [0.9989, 1.0057] | unsupported | 3/5 / unsupported |
| bf16 | 2,048 | 0.9992 [0.9837, 1.0150] | unsupported | 3/5 / unsupported |
| bf16 | 4,096 | 0.9924 [0.9698, 1.0154] | unsupported | 1/5 / unsupported |
| fp16 | 128 | 0.9980 [0.9860, 1.0100] | 1.0147 [0.9645, 1.0674] | 4/5 / 3/5 |
| fp16 | 512 | 0.9984 [0.9870, 1.0099] | 0.9913 [0.9655, 1.0179] | 4/5 / 2/5 |
| fp16 | 1,024 | 1.0016 [0.9974, 1.0058] | 0.9983 [0.8828, 1.1290] | 4/5 / 1/5 |
| fp16 | 2,048 | 0.9997 [0.9972, 1.0022] | 1.0188 [0.9933, 1.0451] | 3/5 / 4/5 |
| fp16 | 4,096 | 0.9997 [0.9824, 1.0173] | 1.0047 [0.9868, 1.0228] | 2/5 / 3/5 |
| int4 | 128 | 0.9104 [0.8800, 0.9419] | 0.9947 [0.9513, 1.0400] | 0/5 / 3/5 |
| int4 | 512 | 1.0360 [1.0054, 1.0675] | 0.9880 [0.9618, 1.0148] | 4/5 / 1/5 |
| int4 | 1,024 | 1.0568 [1.0529, 1.0608] | 0.9996 [0.9956, 1.0037] | 5/5 / 4/5 |
| int4 | 2,048 | 1.0611 [1.0530, 1.0692] | 0.9875 [0.9613, 1.0144] | 5/5 / 1/5 |
| int4 | 4,096 | 1.0628 [1.0526, 1.0732] | 1.0051 [0.9991, 1.0111] | 5/5 / 5/5 |
| int8 | 128 | 0.9977 [0.9715, 1.0246] | 1.0095 [0.9808, 1.0391] | 2/5 / 3/5 |
| int8 | 512 | 0.9966 [0.9394, 1.0573] | 1.0009 [0.9969, 1.0048] | 3/5 / 3/5 |
| int8 | 1,024 | 1.0004 [0.9971, 1.0037] | 0.9885 [0.9544, 1.0239] | 3/5 / 1/5 |
| int8 | 2,048 | 0.9849 [0.9392, 1.0328] | 0.9848 [0.9568, 1.0136] | 3/5 / 1/5 |
| int8 | 4,096 | 1.0035 [0.9852, 1.0221] | 0.9980 [0.9892, 1.0069] | 4/5 / 2/5 |

### Robustness across equivalent O3 policies

The classifications in the main tables refer to default O3. As a stricter check, requiring the useful-win/loss criterion in **all three O3 policies and both timing methods** retains the three Ampere register-GEMM sizes and Ampere INT4 N=4096 as wins, and INT4 N=128 as a loss. All these policy variants have identical code within each name.

Other module pairs sometimes reverse despite identical encoded code: Ampere INT4 N=2048 has one losing O3/expensive=true primary process; N=1024 has one losing O3/expensive=true direct process. This is why the strongest conclusion is narrower than listing every positive default-O3 mean. Allocation/layout, background activity, clock drift, and limited process counts remain consequential. Random module-load order does not prove that lazy driver function loading randomizes physical code placement.

### Representative absolute latencies

Microseconds below are descriptive medians over batches. Their ratio need not equal the geometric paired speedup. This table is for the default-O3 pair on the 3060 Ti; input formats/algorithms differ and are not a quantization-quality comparison.

| Task | N/elements | Graph neutral → cutlass µs | Direct neutral → cutlass µs |
| --- | ---: | ---: | ---: |
| register_gemm | 256 | 57.028 → 52.469 | 58.962 → 54.400 |
| register_gemm | 1,024 | 467.067 → 429.508 | 442.368 → 409.286 |
| register_gemm | 2,048 | 3060.220 → 2824.792 | 2931.712 → 2695.168 |
| fma_chain | 65,536 | 6.371 → 6.925 | 7.015 → 7.257 |
| wmma_int4 | 128 | 1.734 → 1.973 | 2.333 → 2.628 |
| wmma_int4 | 512 | 44.125 → 42.175 | 42.690 → 40.999 |
| wmma_int4 | 1,024 | 341.757 → 323.886 | 321.414 → 300.977 |
| wmma_int4 | 2,048 | 2710.822 → 2569.600 | 2575.872 → 2419.200 |
| wmma_int4 | 4,096 | 23882.768 → 22244.352 | 23310.336 → 21878.288 |

For the small FMA chain, all 15 default-O3 process estimates favor neutral. Its direct interval is below 1 but does not fully clear the stricter 1% loss threshold. For INT4 N=512, the direct interval suggests a positive average direction but one process loses. The INT4 N=1024–4096 default pairs reproduce under direct launches; only N=4096 also passes every equivalent O3-policy pair.

## Code-generation results

The following differences occur at O3 with lowercase `cutlass`; unrelated and
uppercase names match neutral. Counts include padded instruction slots/NOPs;
encoded comparisons include scheduling/control words as well as opcodes.

| GPU | Kernel | Registers neutral → cutlass | 128-bit instruction slots neutral → cutlass |
| --- | --- | ---: | ---: |
| 3060 Ti | FMA chain | 12 → 12 | 48 → 48 |
| 3060 Ti | Tiled GEMM | 38 → 41 | 104 → 104 |
| 3060 Ti | Register GEMM | 129 → 182 | 976 → 968 |
| 3060 Ti | INT4 WMMA | 40 → 40 | 144 → 144 |
| 2060 | FMA chain | 10 → 12 | 40 → 40 |
| 2060 | Tiled GEMM | 39 → 48 | 96 → 96 |
| 2060 | Register GEMM | 129 → 170 | 968 → 960 |
| 2060 | INT4 WMMA | 45 → 49 | 128 → 120 |

All tested kernels have zero stack/spills. SAXPY, stencil, block reduction,
FP16 WMMA, INT8 WMMA, and supported BF16 WMMA have identical encoded SASS across
all names and policies. The changed kernels can alter allocation/scheduling even
when the instruction count is unchanged. More registers or fewer instructions
do not by themselves establish a performance gain.

For **every tested kernel on both targets**:

- O3 expensive=true and O3 expensive=false match default O3 within a name.
- O2 with either expensive setting matches the O3 neutral code, including for
  lowercase `cutlass` names.
- Therefore the expensive-optimization flag is not equivalent to this naming
  effect in this suite. O2 suppresses the observed name-dependent code path.

Whole-file cubin hashes still differ across flag policies. Comparing ELF section
payloads in 56 expected-equivalent pairs finds only `.note.nv.tkinfo` changed;
code, constants, symbols and per-function info match. A file-hash difference is
therefore not evidence of a new device optimization.

The supplied [CUTLASS discussion 1290](https://github.com/NVIDIA/cutlass/discussions/1290)
asks about O2/expensive=true and recommends CUTLASS's compiler flags. It does not
establish an equivalent name-enabling flag. The installed ptxas help and
[NVIDIA's compiler documentation](https://docs.nvidia.com/cuda/cuda-compiler-driver-nvcc/index.html#ptxas-options)
say expensive optimizations default on at O2 and higher. There is no documented
promise that this setting improves runtime. These observations identify a
name-sensitive compiler result, not its private internal implementation.

## Timing protocol and interpretation

Primary experiments use ten fresh processes per GPU/suite, 20 rounds per case,
and 20 variants per round. A seeded shuffled cyclic schedule places every
variant at every temporal position once. Module/case orders also vary by seed. Primary processes use seeds 1001–1010;
direct confirmation uses the independent ordering range 2001–2005.
CUDA events time warmed serial CUDA Graph batches with a common calibrated
launch count, targeting 15 ms and capped at 8192 launches. Direct-launch
confirmation uses five separate processes, the same balanced rounds/variants,
and 5 ms targets. Graph construction, first launches, verification, and data
movement are excluded. Buffers are reused: these are warmed steady-state kernel
measurements, not cold-cache or end-to-end application measurements.

Speedup is baseline/treatment, so >1 favors treatment. Within each process take
the median log paired ratio over rounds; exponentiate the mean of these process
estimates for the reported geometric speedup. Median absolute latencies are
provided separately. Individual launches are not independent sample units.

Approximate simultaneous intervals use a joint whole-process bootstrap of the
maximum standardized deviation across all predeclared contrasts. There are 195
FP32 contrasts per GPU, 300 Ampere-precision contrasts, and 225 Turing-precision
contrasts. With `--families 4`, each cohort gets alpha=0.0125, a conservative
Bonferroni allocation across the four primary cohorts. Direct results are a
separate four-cohort confirmation experiment. Coverage remains approximate with
ten (or five) processes, fixed bootstrap SEs, and potentially time-correlated
background activity. These intervals are not a guarantee about all CUDA programs.

A consistent useful win requires **every process estimate >1.01 and the
simultaneous lower bound >1.01**. Losses use the reciprocal threshold. Inspect
identical-code controls, order-conditional estimates, all three O3-policy naming
comparisons, and direct confirmation before assigning a causal optimization gain.
An inconclusive result is not proof of equivalence. No outliers are discarded.

The local FP32 gate waits for five consecutive two-second samples at <=15% GPU
utilization and <=65°C. Before timing its separate precision cohort, a light-load
gate was specified: <=60% utilization **and <=40 W**, <=65°C. Turing's idle-clock
counter reports 28–40% utilization at ~10–12 W; before any Turing timing, its
light-load gate was specified as <=60% **and <=15 W**, <=65°C. Gates do not prove
GPU exclusivity. Stock boost/power limiting and some local thermal limiting are
observed and retained in the evidence. Sub-percent differences need particular
caution on these active systems.

## Correctness and reproducibility

Every output and 64 trailing sentinels are checked in fresh verification launches
before and after timing. These checks relaunch the kernel; they do not inspect
each in-flight timed batch. Actual graph replay is independently checked below.
Outputs begin with NaNs/sentinels, so missed writes fail. Random ragged GEMMs
use full independent CPU dot products; periodic large inputs permit exact
reference tables for every output. Integer references accumulate in INT64;
FP16/BF16 inputs and sums are exactly representable on the chosen data. FMA
references use explicit CPU fma. Signed packing is independently round-tripped
through CPU decoders across every INT8/INT4 code and all floating inputs used.

The initial pilot found a missing completion barrier between pageable copies
and a nonblocking CUDA stream; it was rejected before recording timings. The
corrected barriers are outside timing. The short corrected pilot is excluded
from primary results. For all four GPU/suite builds, all 20 cubins and the locally compiled harness
match a second clean build byte for byte. The remote host recompiles its harness
with its own compiler; that exact executable hash is held constant across its runs. Local FP32 full-manifest memcheck passes. On both GPUs, unique-code memory checks
cover every kernel and size, with zero errors. O3 neutral/cutlass representatives
cover every distinct encoded kernel; all 20 variants still receive full CPU
validation.

Actual graph outputs are checked using a verification-only interposer, without
changing measured executables or cubins. It captures three launches, clears the
host parameter slots, replays, and lets the original CPU oracle check every output.
All four full-manifest checks pass: 660/720 wrapped launches on Ampere FP32/precision
and 660/540 on Turing. No interposer is used in performance measurements.

All 1,830 primary/confirmation contrast estimates and their process estimates were
independently recomputed from sorted raw ratios, matching to 1e-12. Input hashes,
source/build identities, successful exit codes, row/case counts and seed ranges
were audited. Host-tool tests, exhaustive packing round-trips, the 261 existing
Node tests, and the vetted 85-asset build pass.

The [investigation record](INVESTIGATION.md) preserves decisions and scope
changes; the [README](README.md) gives commands. Raw CSV, telemetry, validation
output, tool/source/binary hashes, run seeds, and compiler commands stay in
ignored local evidence. Addresses, account details, and remote host files are
not committed. The [independent review](REVIEW.md) records its agreement and remaining limits.
