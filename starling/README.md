# Starling

A small terminal lab for lambda expressions and the S, K, and I combinators.
Compile a function, then follow its individual rewrites.

Run from the repository root with Node.js 20 or newer.

```sh
node starling/cli.mjs --trace
node starling/cli.mjs 'K sunshine (S I I (S I I))' --trace
node starling/cli.mjs 'S I I (S I I)' --steps 12 --trace
node starling/cli.mjs 'S x y (z z)' --nodes 9 --json
node starling/cli.mjs '(\x. x) feather' --lambda --trace
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

## Write lambdas

Add `--lambda` to compile a lambda expression to S, K, and I before
reducing it. The CLI prints the compiled term before the reduction trace.
With no expression, lambda mode compiles `\x. x` to I.

```sh
node starling/cli.mjs '(\x. x) feather' --lambda --trace
node starling/cli.mjs '(\f x. f (f x)) chirp silence' --lambda
node starling/cli.mjs '(\x. \y. x) y z' --lambda --json
```

A backslash or λ introduces a function. Write lowercase binders before a
dot and the body after it. Multiple binders are nested from left to right,
so `\x y. x` means `\x. (\y. x)`. A body extends as far right as possible.
Put a lambda in parentheses when using it as a function or argument.
S, K, and I can appear as constants inside a lambda expression.

The compiler eliminates inner lambdas first. To abstract a name x from a
compiled term, it follows three rules.

| Body | Abstraction over x |
| --- | --- |
| `x` | `I` |
| Any term M with no free x | `K M` |
| `M N` containing a free x | `S ([x]M) ([x]N)` |

`[x]` denotes applying these same rules to a subtree. Shadowed binders and
free names retain their lexical meaning. For example, the third command
above returns the free name y.

The node limit applies to the source tree and each constructed combinator
term. Compilation stops with an input error if either exceeds the limit.
Lambda and parenthesis nesting is limited to 128 levels in lambda mode.
The JSON receipt adds `compilation.source` and `compilation.expression`.

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
import { compileLambda } from './starling/lambda.mjs';

const term = parse('I feather');
print(term);                 // 'I feather'
print(step(term).term);      // 'feather'
step(parse('K feather'));    // null, already in normal form
run('S K K feather').status; // 'normal'
run(compileLambda('(λx. x) feather')).frames.at(-1).term; // 'feather'
```

Terms, steps, and receipts are immutable. The SKI parser, printer, and
reducer use explicit stacks so deeply grouped combinator inputs and
long application chains work within the limits.

`run` accepts a source string or an engine-created term. The
`application(fn, arg, { maxNodes })` helper joins two engine terms with
the same node bounds used by the compiler.

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

Compiler checks compare 1,100 applications with direct substitution and
exercise shadowing, free names, discarded arguments, Church numerals,
construction limits, and CLI compilation receipts.
