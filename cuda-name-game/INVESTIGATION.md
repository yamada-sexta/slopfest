# Investigation record

## Goal and acceptance criteria

Test whether the lowercase `cutlass` substring changes raw CUDA code generation
and produces repeatable speedups, independently of optimization flags. Complete
only after correctness checks, repeated local timing, uncertainty/noise analysis,
and an independent subagent review agree the evidence supports the conclusion.
A negative, mixed, or hardware-limited result is a valid conclusion; invented
measurements and a universal claim from one GPU are not.

## Plan fixed before the new timing runs

- Environment: local Ampere RTX 3060 Ti, CUDA 13.2; use supported Homebrew GCC 14.
  Initial GPU utilization was 87–88% at 88°C. Wait for lighter load before the
  primary experiment; do not terminate other applications or alter clock settings.
- Four equal-length prefixes: `neutral`, `cutlass`, `control`, `CUTLASS`.
- Five assembler policies: default O3, O3 expensive=true, O3 expensive=false,
  O2 expensive=true (the linked discussion's combination), O2 expensive=false.
  Cross all policies and names (20 variants). Verify the normalized PTX matches.
- Six workload families: SAXPY, 1D stencil, block reduction, dependent FMA chains,
  shared-memory tiled GEMM, register-tiled GEMM. Multiple sizes, including a
  small-grid GEMM; independent CPU checks and ragged sizes for every family.
- CUDA event timing of serial CUDA Graph batches to reduce host-submission gaps.
  Warm all variants, calibrate a common batch per case, keep copies and validation
  outside timing. Randomized cyclic schedules balance every variant's position.
- Ten separate benchmark processes, 20 balanced rounds per case, target 15 ms per
  variant/batch. Record seeds, timing order, validation and GPU telemetry. Analyze
  process medians as replication units rather than treating launches as independent.
- Report paired geometric speedups, individual process estimates, cluster bootstrap
  intervals, and a multiplicity-aware threshold. A consistent useful win requires
  >1% in every process and a simultaneous lower confidence bound above 1.01.
  Check order effects and identically encoded control kernels before causal claims.
- Inspect encoded SASS (including control words), register/spill/resource reports,
  and rebuild determinism. Confirm consequential effects using direct launch timing.
- Run compute-sanitizer when installed, host analysis tests, npm test and npm run
  build. Record unavailable checks. Request independent review only after the
  investigation is complete; resolve material review findings before shipping.

## Sources checked

- [NVIDIA discussion 1290](https://github.com/NVIDIA/cutlass/discussions/1290)
  concerns `-O2` and expensive optimizations, and recommends CUTLASS's flags.
  It does not establish that this flag is equivalent to a name-triggered path.
- [NVIDIA nvcc documentation](https://docs.nvidia.com/cuda/cuda-compiler-driver-nvcc/index.html#ptxas-options)
  and the installed `ptxas --help`: assembler O3 is default; expensive
  optimizations default on at O2 and above. These consume compile resources,
  and do not promise faster generated code.
- [Triton PR 7298](https://github.com/triton-lang/triton/pull/7298)
  is a firsthand report motivating the naming test, not evidence for this GPU.
- [CUTLASS issue 3389](https://github.com/NVIDIA/cutlass/issues/3389)
  reports a name-sensitive register-allocation regression on Blackwell. This is
  evidence that universal improvement is an unsafe assumption, not a local result.

## Progress

- Initial worktree clean. Existing name-only benchmark audited; extending it with
  factorial controls, more workload families, graph timing, repeated-run analysis,
  and telemetry. Existing ignored measurements are preserved separately.

- The first pilot was rejected by the full-size CPU check before any timings:
  a pageable host-to-device initialization was not explicitly synchronized with
  the new nonblocking stream. Added completion barriers outside timing, before
  kernel work. This is why timed-size validation is required in addition to edge
  tests. The rejected pilot is retained locally and excluded from analysis.

- Corrected pilot: all 13 timed cases passed before and after graph replay. It
  was a 3 ms calibration experiment and is not part of the primary estimates.
- Final build frozen in ignored `.local/cuda-name-game-final/`. All 20 cubins
  and the host executable match a second clean build byte for byte. Source
  hashes match the final checked-in source candidate. Full-size memcheck reports
  zero errors. All 261 existing Node tests and the 85-asset static build pass.
- Primary ten-process run launched with the predeclared 20 rounds and 15 ms
  target. Idle gate is unchanged (five <=15% samples, <=65°C). Raw CSV,
  telemetry, per-process metadata and validation output remain local.

- Code inspection: the unrelated and uppercase O3 controls match neutral for all
  six kernels. All five policies match neutral O3 for neutral kernels. All three
  O3 policies match one another within each name. Thus expensive=true/false is
  code-identical in this suite; the only changed encodings are lowercase cutlass
  O3 FMA/tiled-GEMM/register-GEMM. Register counts change 12→12, 38→41, 129→182
  respectively; no stack or spills. O2 cutlass matches the neutral encoding.

## Scope additions requested during the experiment

- Add explicit low-precision Tensor Core WMMA GEMM: FP16→FP32, BF16→FP32,
  signed INT8→INT32, packed signed INT4→INT32. Five timed square logical sizes:
  128, 512, 1024, 2048, 4096. Random ragged edge checks: 1, 17, 67, 129, padded
  with zeros to a multiple of 32. These are a separate suite and frozen build,
  preserving the already-running FP32 experiment.
- For each precision, hold input representation, quantization, accumulator type,
  tile/launch shape and flags fixed when comparing names. Floating inputs are
  exact q/8 dyadics; integer inputs use symmetric zero-point-zero codes (INT8
  -128…127, INT4 -8…7). Integer outputs are raw INT32 dot products; interpreting
  both input scales as 1/8 gives output scale 1/64. Packing, quantization,
  transfers and dequantization are outside timing. This is execution performance,
  not a test of model quantization quality or an end-to-end quantization pipeline.
- Four warps/block use aligned shared staging and NVIDIA WMMA operations: 16×16×16
  fragments for FP16/BF16/INT8, 8×8×32 fragments for INT4. Algorithms differ across
  precision paths. Causal naming claims are within a precision, never inferred
  by comparing absolute latency between different arithmetic formats.
- Add the available RTX 2060 (Turing sm_75). SSH access and driver verified; no
  nvcc installed there. Compile device code locally using the same CUDA 13.2
  compiler and sm_75, and compile the Driver API harness with remote GCC 14.3.
  BF16 WMMA is unsupported there and is excluded explicitly. No toolkit install
  or system/GPU configuration changes are needed. Do not record its address or
  account details in source control.
- Repeat the same ten-process graph protocol for each GPU/suite. Confirm
  consequential name effects with separate direct-launch runs. Treat the suites
  as separately labeled comparison families, not pooled GPU/precision estimates.

- All lower-precision cases pass full CPU/guard validation locally (four formats)
  and on Turing (three formats). Host packing checks independently decode every
  signed INT8/INT4 code and every floating dyadic used by the benchmark.
- Turing's 15%-utilization gate produced no timing: it reports 28–40% utilization
  at ~10–12 W and low clocks despite no active display. Before collecting any
  Turing timings, changed its light-load gate to <=60% utilization **and <=15 W**,
  <=65°C, five consecutive samples. The discarded original gate-only attempt is
  retained. Local FP32 gate remains unchanged. GPU cohorts are never pooled.
- Paused only our local runner while it was between processes, for precision
  validation. No FP32 timing process was interrupted. Precision memcheck initially
  tried all 20 variants; after confirming binary identity classes, replaced that
  redundant check with O3 neutral/cutlass representatives of every distinct
  encoded kernel at every size. Full CPU correctness still checks all 20 variants.

- Before any local precision timings, selected a light-load gate <=60% utilization
  **and <=40 W**, <=65°C, five consecutive samples. Low-clock desktop rendering
  otherwise repeatedly resets the utilization-only gate. This change applies
  only to the new precision cohort; local FP32 primary/direct retain the original
  gate. Direct confirmation batches target 5 ms, analyzed separately from the
  15 ms primary graph protocol, to check ordinary submission without graph costs.

- Statistical refinement before final analysis: there are now four primary GPU ×
  suite cohorts. Use `analyze.py --families 4` to allocate alpha=0.0125 to each
  cohort's simultaneous bootstrap interval (Bonferroni across cohorts), retaining
  approximately 95% coverage across the four primary families together. Direct
  confirmation is a separately labeled four-family secondary experiment. This
  is more conservative than the original single-suite interval plan. No process
  or timing outliers will be discarded.

- Checkpoint: eight local and seven Turing FP32 process runs complete, without
  output/guard failures. Local telemetry includes stock power limiting and a
  small number of software-thermal-limit samples at 83–84°C; these are retained,
  not filtered. Their implications will be checked against process ranges,
  code-identical controls, timing order, and direct-launch confirmation.
- The copied NVIDIA sanitizer runtime launches successfully on the toolkit-less
  Turing host. Its unique-code memcheck is queued after timing, never concurrently
  with another benchmark on that GPU.

- Independently recomputed all 390 FP32 contrast estimates and all per-process
  estimates directly from raw sorted ratios (geometric middle pair, then a direct
  product across processes), matching analysis to 1e-12. SHA-256 checks match all
  selected raw inputs. Analyzer now also rejects mixed GPU/driver profiles.
- Whole cubin hashes differ across flag policies despite equal SASS. ELF payload
  inspection explains this: for all 56 expected-equivalent flag pairs across
  both suites/targets, only `.note.nv.tkinfo` differs. Device code, constants,
  symbols, and function-info payloads match. Do not mistake a whole-file hash
  difference in compiler metadata for a new runtime optimization.

- Both full FP32 primary cohorts are complete (ten processes each). With four-cohort
  correction, Ampere register GEMM is a consistent graph-timing win at all three
  sizes (~1.08×), and the small FMA chain consistently loses (~0.923×). Other
  cases, including every Turing FP32 size, do not meet the predeclared 1% criterion.
  These remain primary findings pending ordinary-launch confirmation. Primary
  plots were rendered and visually inspected; all reviewed numbers remain local.

- Literal consistency versus practical threshold: both Turing tiled-GEMM sizes
  are faster in all ten graph process estimates, with ~1.5–1.6% geometric speedup
  and simultaneous intervals above 1. Their lower bounds and individual estimates
  do not all exceed 1.01. Report the all-run directional evidence explicitly,
  rather than describing failure of the stricter useful-win test as no effect.

- Before any direct-launch timings, assigned confirmation a distinct seed base:
  primary seeds 1001–1010; direct seeds 2001–2005. Fresh processes already separate
  the samples, and distinct seeds additionally avoid replaying the same ordering
  and module-loading schedule. Current primary runners retain their frozen seeds.
- Halfway precision checks (not final inference) show the expected code-identical
  controls varying around one, with some individual process deviations of several
  percent. Ampere INT4 has a promising size-dependent signal; retain all ten
  processes and await independent-method confirmation rather than stopping early.

- All ten Ampere precision primary processes completed successfully. Ordinary
  FP32 confirmation has started; its first metadata record confirms seed 2001,
  distinct from primary ordering. Turing precision has nine complete processes.

- Full Ampere precision primary analysis: INT4 speedups are 0.8769× at N=128,
  1.0440× at 512, 1.0634× at 1024, 1.0563× at 2048, and 1.0598× at 4096.
  All ten processes agree on the direction; all pass the practical threshold and
  four-cohort-corrected interval criterion. Thus the same name change can hurt
  the small shape and help larger shapes. Other precision paths have identical
  code and no consistent useful naming win. Ordinary confirmation is still pending.

- All four primary cohorts completed: 40 successful processes, 61 cases, 244,000
  recorded timing batches. Every expected case and row count is present. Local
  FP32 ordinary-launch confirmation is also complete (five processes); remaining
  confirmation and Turing sanitizer jobs continue. The main conclusions will
  distinguish GPU-replay timing from ordinary launch performance.

- Full Turing precision primary analysis: no tested format/size has a consistent
  all-process naming direction; INT4 code changes do not translate into a useful
  repeated gain here. All FP32 direct cohorts are now complete. Ampere register
  GEMM reproduces its gain (~8.5–9.5%) under ordinary submission. Turing tiled
  N=256 does not reproduce its graph-only all-run direction; N=1024 remains
  positive in all five direct point estimates, with a wide interval crossing 1.

- Closed a verification-path gap without touching measured binaries: existing
  before/after checks relaunch directly. Added a verification-only interposer
  that captures three real launches, clobbers its host argument slots before
  graph instantiation/replay, and reuses every CPU oracle on actual replay output.
  The launcher forces verification-only mode and asserts complete interception.
  Local full-manifest FP32 (660 wraps) and precision (720 wraps) pass. Turing
  counterparts are queued after its memory checks. No interposer is used for timing.

- Final collection and verification complete: 60 successful timing processes,
  366,000 batches, 132,912,000 logical timed kernel executions. Independent raw
  recomputation matches every one of 1,830 contrasts and every process estimate.
  Both Turing memory checks report zero errors; actual graph-output verification
  passes all four cohorts (660/720/660/540 wraps, three nodes each).
- Clean rebuilds for the remaining three targets complete the determinism check:
  all 80 cubins and the locally compiled harness for each target match exactly.
  Final six host-tool tests, signed/float packing checks, 261 Node tests, and the
  85-asset build pass. All four final figures were visually inspected with common
  axes, distinct graph/direct marks, and correct hardware/method labels.
- Equivalent-policy robustness narrows the headline beyond default-O3 positives:
  all three O3 policies and both methods consistently favor Ampere register GEMM
  N=256/1024/2048 and INT4 N=4096. INT4 N=128 consistently loses. Individual
  equivalent-code pairs can reverse at N=1024/2048, and N=512 does not reproduce
  across every direct process. These exceptions are retained in the findings.
- Investigation is ready for the requested independent subagent review. Required
  commit/push will follow review and any material repairs; goal remains active.

- Independent review complete: AGREED that the empirical investigation goal is
  achieved, with no material blocker. The reviewer independently reproduced all
  estimates, intervals and critical values, checked displayed tables, actual
  gates/non-overlap, binaries/rebuilds, logs and all four plots. Two small README
  scope/command mismatches were corrected and verified. Review qualifications
  preserve stock-clock/background-load limits, approximate small-process
  inference, exact tested scope, and private-evidence availability.
