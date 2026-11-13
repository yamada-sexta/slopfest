# Starling

A small terminal lab for the S, K, and I combinators. Follow a term through
individual rewrites and see how three rules can copy, keep, or pass an argument.

Run from the repository root with Node.js 20 or newer.

```sh
node starling/cli.mjs --trace
node starling/cli.mjs 'K sunshine (S I I (S I I))' --trace
node starling/cli.mjs 'S I I (S I I)' --steps 12 --trace
node starling/cli.mjs 'S x y (z z)' --nodes 9 --json
node starling/cli.mjs --help
```

## Three rules

| Expression | Next expression |
| --- | --- |
| `I x` | `x` |
| `K x y` | `x` |
| `S f g x` | `f x (g x)` |

Application associates to the left. `S K K feather` means
`(((S K) K) feather)`. Parentheses on an argument keep its applications
together. Uppercase S, K, and I are the three combinators. Lowercase names
are inert atoms, from one to 32 characters, beginning with a letter and
continuing with lowercase letters, digits, or underscores. Spaces between
combinators are optional, so `SKK feather` works too.

The default expression rewrites in two steps.

```text
S K K feather
K feather (K feather)
feather
```

Starling chooses the leftmost outermost reducible expression, or redex.
In `K sunshine (S I I (S I I))`, it applies K immediately and reaches
`sunshine` in one step. If you run the discarded argument by itself,
the trace keeps introducing more I wrappers until it meets a limit.
The reducer also works inside partially applied terms. For example,
`K (I feather)` becomes `K feather`.

## Read a trace

`--trace` shows the starting term and every accepted rewrite. Each step
names its rule and location. A location is a path through the application
tree. Follow `f` for a function or `a` for an argument. The empty path is
the root. Thus the first step of `I x y` rewrites `I x` at `f`.

A normal form has no reducible expression anywhere in its tree. The
default step limit is 100 and the default size limit is 1024 nodes.
An atom counts as one node, and an application counts as one plus both
of its subtrees. Duplicated arguments count at every occurrence.

`--steps N` accepts 0–500 and `--nodes N` accepts 1–4096. An input must
fit the size limit. A rewrite that would exceed that limit is reported
before being accepted, leaving the last term in the trace intact. A
step-limited run may still have a normal form beyond the chosen limit.
Source input is limited to 8192 characters.

`--json` emits a receipt with the status, accepted reduction count,
limits, and complete frames. Frames contain the canonical term, node
count, rule, and location. A size stop also includes the rejected rule,
its location, and the required node count.

Exit status is 0 for a normal form, 1 for invalid input, and 2 for a step
or size limit. This lets a shell script distinguish completed reductions
from bounded explorations.

## Use the engine

```js
import { parse, print, step, run } from './starling/core.mjs';

const term = parse('I feather');
print(term);                 // 'I feather'
print(step(term).term);      // 'feather'
step(parse('K feather'));    // null, already in normal form
run('S K K feather').status; // 'normal'
```

Terms, steps, and receipts are immutable. Parsing, printing, and searching
for the next rewrite use explicit stacks so deeply grouped inputs and
long application chains work within the limits.

## Verify

```sh
node --test starling/test/*.test.mjs
npm test
npm run build
```

An independent reducer uses array trees and gathers an application's
left spine before consuming a rule's arguments. Tests compare it with
Starling on all 1,428 trees of up to four leaves over S, K, I, and x.
They also check printer round trips, exact rewrite locations, discarded
arguments, budget boundaries, deep inputs, immutable results, and real
CLI text and JSON.
