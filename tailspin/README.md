# Tailspin

A tiny queue language about eating your own words. The first letter chooses a
rule, a fixed number of letters disappear from the front, and the rule's word
joins the tail. Short rules can shrink, orbit, or keep the queue growing.

Use Node.js 20 or newer, with no dependencies, from the repository root:

```sh
node tailspin/cli.mjs --trace
node tailspin/cli.mjs orbit --trace
node tailspin/cli.mjs bloom --steps 12 --trace
```

## The whole machine

One rule per lowercase letter, with a word of up to 32 lowercase letters on the
right. `-` means append nothing. Blank lines and `#` comments are allowed:

```text
# The falling specimen
 a -> ab
 b -> a
```

Every letter in a rule's output or the starting queue must have a rule. There
are no implicit rules. With deletion count two and starting queue `aab`:

| Step | Queue | What just happened? |
| --- | --- | --- |
| 0 | `aab` | Start. |
| 1 | `bab` | Read `a`, remove `aa`, append `ab`. |
| 2 | `ba` | Read `b`, remove `ba`, append `a`. |
| 3 | `a` | Read `b`, remove `ba`, append `a`. |

Now fewer than two letters remain, so the machine halts. The removed prefix
includes the first letter. Only that first letter chooses the append rule;
the other removed letters do not execute their own rules. Appending happens
after removal. This is deterministic queue rewriting, without randomness or
external effects.

The three included specimens are:

| Name | Rules | Seed | Outcome |
| --- | --- | --- | --- |
| `fall` (default) | `a -> ab`, `b -> a` | `aab` | Halts after three steps. |
| `orbit` | `a -> bb`, `b -> aa` | `ab` | `ab`, `bb`, `aa`, `bb`: period two after step one. |
| `bloom` | `a -> aaa` | `aa` | Gains one letter per step; the default run reaches its step budget. |

## Write another queue

Custom rules replace the named specimen and require an explicit seed. Put local
scratch programs and generated diagrams in ignored space:

```sh
mkdir -p .local
cat > .local/drain.tag <<'RULES'
a -> -
RULES
node tailspin/cli.mjs --program .local/drain.tag --seed aaaa --delete 1 --trace
node tailspin/cli.mjs --seed '' --json
```

`--delete` accepts 1 through 8, default two. An empty seed is legal and halts
immediately. Source is limited to 4,096 characters, with exactly one rule per
letter. Duplicate definitions, unknown emitted letters, uppercase letters, and
malformed rules are errors; source errors identify their line when applicable.

## Stops are different from answers

`--steps N` sets a budget from 0 to 2,000, default 100. `--limit N` caps the queue
at 1 through 512 letters, default 256; the initial seed must fit too.

Each boundary checks, in order: too short to proceed, exact queue repetition,
step budget, and the next queue's size. Halting or a detected loop at the last
allowed step still counts as a proved answer. When the next queue would exceed
the size limit, the machine retains the current queue and applies none of that
step. With zero budget it does not attempt a size check for a future step.

A repeated **whole queue**, under unchanged rules and deletion count, proves
that all future behavior repeats. `cycle.start` is the first matching step;
`cycle.period` is the difference in step numbers. The final frame includes the
repetition. There are no hash collisions or guesses about eventual behavior.

Exit zero means `halted` or `cycle`. Exit two means `steps` or `size`: the bounded
run stopped, and eventual behavior is unresolved. Exit one means invalid input
or failed I/O. In particular, the growing specimen exiting two is expected:

```sh
node tailspin/cli.mjs bloom --limit 5 --json
```

## Keep the ribbon

```sh
node tailspin/cli.mjs orbit --svg .local/orbit.svg
node tailspin/cli.mjs bloom --steps 40 --svg .local/bloom.svg
```

Each row is the actual queue after a numbered step. Orange marks the prefix that
would be removed next; its first letter selects the append rule. A short halted
queue has no orange prefix. An empty queue is shown as `∅`.

SVG exports show at most 32 frames. Longer runs retain the first 16 and last 16,
with an explicit omitted-frame count between them. They never silently join two
nonadjacent steps. Long queues make wide, zoomable diagrams. `--trace` prints all
frames; `--json` always includes the full receipt. SVG writes refuse to overwrite
files and occur only after all program, seed, and budget validation. A valid
limited run may still export its partial trace, then exit two.

## The small engine

`compile(source, {deleteCount: 2})` returns a frozen program. Pass it to
`run(program, seed, {maxSteps: 100, maxLength: 256})`. The frozen receipt includes
rules, deletion count, seed, budgets, `status`, `cycle`, `blocked`, and `frames`.
Every frame has `step`, `word`, `read`, `removed`, and `appended`; step zero has
`read: null` and empty transition strings. A size stop's `blocked` object gives
the unapplied read, removal, append, and proposed queue length.

`toSVG(receipt, {maxFrames: 32})` accepts a diagram limit from 2 through 64.
Programs and receipts must come from the engine. To replay a JSON receipt,
compile its rule entries and run its seed with the recorded settings. The engine
never mutates its input or evaluates source as JavaScript.

## Verify

```sh
node --test tailspin/test/*.test.mjs
npm test
npm run build
```

Seven tests compare 4,557 small program/seed/deletion cases with an independent
literal token queue. They check transition records, halting, exact cycles,
budget precedence, growth stops, rule validation, immutable receipts, SVG rows
and explicit gaps, real CLI receipts and exit codes, custom files, and exclusive
exports. This terminal project adds no browser assets to the Pages bundle.
