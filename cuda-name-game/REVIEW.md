# Independent review

**Ready within reviewed scope. Complete.** No material correctness, measurement,
or reporting blocker remains. This review added only this file; the author made
and the reviewer verified two small README corrections during review.

**AGREED: empirical investigation goal achieved (pending routine commit/push).**

The evidence supports a conditional result: lowercase `cutlass_` changes ptxas
output for selected kernels, helps several tested Ampere cases repeatedly, hurts
others, and provides no comparably robust useful win on the tested Turing system.
The tested expensive-optimization flags do not reproduce the naming effect.
This agreement does not endorse a general performance rule for CUDA programs.

## Scope and independence

Reviewed [FINDINGS.md](FINDINGS.md), [INVESTIGATION.md](INVESTIGATION.md),
[README.md](README.md), both builders, both CUDA sources, both harnesses,
the runner, analyzer, plotter, graph verifier and tests, plus the root catalog
and journal changes. Read the repository's contribution instructions first.

The review inspected the selected private raw CSVs, adjacent run/build metadata,
telemetry, exact executables, PTX, cubins, disassemblies, resources, clean rebuilds,
and retained memory/graph verification output. It did not accept the author's
summary as a substitute for those inputs. Separate scratch calculations imported
none of the analyzer's functions. No new GPU timings, remote connections,
implementation edits, commits, pushes, or external messages were performed.

The actual comparison is four equal-length prefixes crossed with five assembler
policies, six FP32 workload families at multiple sizes, and WMMA GEMMs in FP16,
BF16 where supported, signed INT8 and packed signed INT4. Naming comparisons keep
the mathematical operation, representation, inputs, dimensions, buffers, launch
shape, assembler policy and timing method fixed. The two GPU environments use
the same device compiler, with separately identified drivers and host compilers.

The supplied [CUTLASS discussion](https://github.com/NVIDIA/cutlass/discussions/1290)
was read independently. Its O2/expensive-optimization question and recommendation
to use CUTLASS's flags do not establish an equivalent name-enabling switch.

## Independently checked evidence

- Recomputed every contrast and every process estimate directly from the selected
  raw ratios, sorting each process's 20 round ratios and taking the geometric
  middle pair before combining processes. All **1,830** estimates agree within
  `1e-12`. Descriptive baseline/treatment latency medians agree as well.
- Counted **60 successful processes, 366,000 timed batches and 132,912,000 timed
  logical kernel executions** directly from the selected files. Verified all
  expected variants, cases, complete rounds, common per-case batches and balanced
  positions. The 61 GPU/workload/size/format cases are represented. Launches and
  batches are not treated as independent replication units.
- Checked selected input hashes, current measured-source hashes, cubin hashes,
  exact measured-executable identities, successful exits, empty telemetry-error
  lists, method settings and seed ranges. Checked actual recorded idle samples
  against each cohort's declared gate. Selected timing-process intervals do not
  overlap on either GPU.
- Independently implemented the simultaneous bootstrap in centered-residual form
  and reproduced all eight cohort/method critical values and all reported
  simultaneous interval endpoints within `1e-10`. This checks implementation,
  not the frequentist coverage of a small-sample bootstrap.
- Verified all **122** displayed default-O3 estimate/interval combinations against
  the independently checked summaries. The strongest Ampere wins and the INT4
  N=128 loss retain their direction under both relative timing-order conditions.
  No identical-code contrast meets the full consistent-useful-win/loss criterion.
- Verified normalized PTX equality for every target/suite; matched all **80 cubins
  and four locally compiled harnesses** against their clean rebuilds. Remote
  measured harnesses are correctly distinguished from toolkit-host builds and
  retain one executable identity throughout their selected runs.
- Independently parsed encoded SASS, including scheduling/control words. Only
  FMA chains, tiled GEMM, register GEMM and INT4 WMMA change with lowercase naming
  under O3. Ordinary and uppercase controls agree with neutral. All three O3
  policies agree within a name; both O2 policies agree with neutral O3 code.
  Register counts and instruction-slot changes match the findings; stack and
  spills are zero. A separate ELF section parser confirms that the **56** stated
  equivalent-policy pairs differ only in compiler-note payloads.
- Inspected memory-check results for both GPUs and actual graph-output results
  for all four full manifests. Zero memory errors and the stated graph wrap
  counts are present. The two representative names cover every distinct encoded
  kernel for deduplicated memory checks. The graph interposer really captures
  kernel nodes and clears host argument storage before replay; it is confined
  to verification and absent from measured executables.
- Ran the six host-tool tests, independently compiled and ran the exhaustive
  signed-code/floating packing test, ran the 261 repository tests, and built the
  vetted 85-asset bundle. All pass. Inspected all four final rendered plots:
  common axes, hardware labels, graph intervals and direct point estimates are
  readable and agree with the summaries.

## Methodological assessment and remaining limits

The comparison is fair within its stated scope. Ahead-of-time cubins isolate
ptxas output from driver PTX JIT decisions. Equal-length ordinary and uppercase
controls, the full naming/policy cross, repeated processes and independent direct
confirmation provide substantially stronger evidence than a single renaming run.
Common calibration counts, warmed buffers, CUDA events and balanced positions
avoid several straightforward timing biases. Direct batches can still include
host-submission gaps, and absolute graph/direct times need not agree.

CPU references check every output and guard at timed sizes, with independent
full dot products on random ragged matrices. Large periodic dyadic inputs permit
exact reference tables; floating products/sums are exactly representable for
these inputs and integer references safely accumulate in INT64. Packing tests
cover every signed INT8/INT4 code and every floating value used. The chosen
periodic timed data are a limitation on input diversity, not a general numerical
accuracy test. Fresh before/after correctness launches do not observe every
timed batch; the separate actual-replay checks close the graph-parameter/output
gap without claiming such exhaustive observation.

The numerical conclusion is appropriately narrower than all positive averages.
Ampere register GEMM N=256/1024/2048 and INT4 N=4096 pass the useful-win criterion
under all three O3 policies and both methods. INT4 N=128 consistently loses.
Equivalent-code policy modules occasionally reverse direction at other INT4
sizes; N=512 has a losing direct process. Turing's tiled-GEMM directional evidence
and its wide direct interval are retained. These exceptions prevent a misleading
universal speedup claim.

Important limits remain and are adequately disclosed:

1. **Stock clocks and background load.** Gates constrain pre-run activity, not
   exclusivity during measurement. Telemetry shows broad clock/temperature
   variation, power limiting and local thermal limiting. Fixed verification and
   lazy function-loading order can leave placement effects despite shuffled
   module loading. The controls and replication support the large conditional
   effects; they do not establish precise sub-percent gains or a unique hardware
   mechanism.
2. **Approximate uncertainty.** Ten primary or five confirmation processes are
   few, and nearby processes can share background conditions. Fixed-SE bootstrap
   coverage is approximate. Four-cohort allocation applies separately to the
   primary and confirmation experiments; it is not one guaranteed 95% statement
   across every reported result. The all-process 1% criterion is a practical
   decision rule, not proof of population-wide replication or equivalence.
3. **Limited external validity.** One device compiler and two complete GPU/
   driver/host environments cannot isolate architecture alone or predict other
   CUDA versions, devices, libraries, arbitrary name positions, algorithms or
   applications. Compiler-output differences establish name sensitivity here,
   not the proprietary compiler's internal implementation.
4. **Precisely limited quantization claim.** Integer matrices are already encoded,
   zero-point-zero values with raw INT32 output. Optional scales define their
   interpretation; packing, calibration, dequantization and model accuracy are
   outside timing. Algorithms differ between formats. No cross-format naming
   inference or end-to-end quantization-performance claim is supported. Unsupported
   BF16 on Turing and unavailable FP8 hardware are explicit exclusions.
5. **Private measurement evidence.** Raw machine evidence was available to this
   reviewer but is intentionally excluded from Git. Public readers receive the
   methods, sources and aggregate findings, not a publicly downloadable raw-data
   replication package. They must collect their own timings to reproduce it.

## Coverage scorecard

Totals below count scoped questions, documents, figures, tables or comparison
groups; categories overlap. `0 / N` means no remaining defect was observed,
not that every possible input or execution was exhaustively verified.

### Report quality

| Category | Observed defects | Assessment |
| --- | --- | --- |
| Usefulness and completeness | 0 / 3 | Naming repeatability, independent flags, and precision/second-GPU questions have usable results. |
| Analytical clarity | 0 / 3 | README, findings and investigation state scope and mixed outcomes; README repairs verified. |
| Visual consistency | 0 / 4 | All final figures inspected; shared scales and distinct graph/direct marks. Direct uncertainty remains in the findings tables. |

### Analytical correctness and robustness

| Category | Observed defects | Assessment |
| --- | --- | --- |
| Source authority and confidence | 0 / 7 | Principal claims traced to actual selected measurements, binaries or the original compiler discussion. |
| Value accuracy | 0 / 6 | Result, absolute-latency and code-generation tables checked against independently verified evidence. |
| Within-chart agreement | 0 / 4 | Final rendered figures agree with their summaries and legends. |
| Complete source details | N/A | Static repository report; no interactive source-detail surfaces. Private raw-data access limit stated above. |
| Cross-artifact consistency | 0 / 1 | Catalog, journal and project documentation agree on scope and conclusions. |
| Data-quality controls | 0 / 8 | All selected GPU/suite/method cohorts audited for completeness, provenance, settings and gates. |
| Conclusion support | 0 / 7 | Major claims retain contrary cases and consequential limitations. |

## Prioritized problems and proposed fixes

No P0/P1 issue remains. Two P2 documentation issues were identified: the README
opening still described only FP32 on one GPU, and its direct command used a
different batch target from final confirmation. **Fixed:** the author updated
the opening to the tested suites/systems and the direct command to 5 ms; both
repairs were inspected. No measurement or analysis source changed for these
repairs. Routine review-status updates, explicit staging, commit and push can
proceed without further empirical work.
