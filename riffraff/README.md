# Riffraff

A small perfect-shuffle deck lab. Interleave two halves, follow an original card,
find a shortest route for one or two cards, and inspect the cycles of a whole
shuffle word. SVGs show the chosen cards' paths through every deck.

Use Node.js 20 or newer, with no dependencies, from the repository root:

```sh
node riffraff/cli.mjs
node riffraff/cli.mjs O --cards 52
node riffraff/cli.mjs I --cards 52
node riffraff/cli.mjs '' --cards 8 --card 1 --to 8 --trace
node riffraff/cli.mjs '' --pair 1:3,8:6 --trace
```

## A perfect split

The deck starts as cards 1 through N, from top to bottom. Split it into equal
halves without changing the order within either half, then alternate cards:

| Shuffle | Which half leads? | Eight-card result |
| --- | --- | --- |
| `O` · out | Top half | `1 5 2 6 3 7 4 8` |
| `I` · in | Bottom half | `5 1 6 2 7 3 8 4` |

Words apply left to right. The default is eight cards and `OIO`, leaving
`3 4 1 2 7 8 5 6`. Card 1 finishes in position 3. An explicit empty word
(`''`) leaves the deck untouched. This models exact interleaving; card IDs
are numbered identities rather than suits or ranks.

`--cards` accepts any even size from 2 through 64. `--card` chooses the original
card to follow, defaulting to 1. Card and position numbers are one-based, with
position 1 at the top. All receipts retain the same original card IDs.

## Put a card somewhere

Add `--to N` to append a shortest shuffle word taking the followed card to that
position. The route starts **after the supplied shuffle word**. It is applied
before printing the final deck, computing cycles, or drawing the SVG.

```sh
node riffraff/cli.mjs '' --cards 8 --card 1 --to 8 --trace
node riffraff/cli.mjs OIO --cards 12 --card 5 --to 1 --json
```

On eight fresh cards, `III` moves card 1 to the bottom and reverses the whole
deck. Every route may move the other cards too. If the followed card is already
in its target position, the shortest route is empty.

Routing uses breadth-first search on the card's possible positions, with at
most N vertices. Out-shuffles are tried before in-shuffles to break ties among
equally short routes. `route.discovered` counts visited or queued positions,
including the initial position. The route receipt lists its starting position,
target, extra word, and every position on that path.

The supplied word and appended route together must contain at most 128 uppercase
O/I letters, without spaces. An oversized result is rejected before exporting.

## Plan a double reveal

`--pair A:P,B:Q` places original card A at position P and original card B at
position Q **at the same time**. Use exactly two distinct cards and two distinct
positions. This replaces `--card` and `--to`; combining those options is an error.
Like single-card routing, the search starts after the given word, defaulting to
`OIO`. Pass `''` to start from a fresh deck.

```sh
node riffraff/cli.mjs '' --pair 1:3,8:6 --trace
node riffraff/cli.mjs OIO --pair 2:3,7:6 --json
node riffraff/cli.mjs '' --pair 1:1,8:2
```

The first command finds `IO`, leaving `5 7 1 3 6 8 2 4`. Both cards land where
requested. Two separately planned single-card routes generally cannot be joined:
moving the second card also moves the first.

Some combinations are impossible. In the last command, cards 1 and 8 begin as
mirror partners: their positions add to nine. Every perfect shuffle preserves
this relationship, so positions 1 and 2 cannot be their joint destination.
Other restrictions can occur too. The solver exhausts the reachable pairs rather
than relying on a mirror test, and reports an unreachable request with exit code
**2**. It retains the supplied word and its deck in the receipt, appends nothing,
and writes no SVG. Invalid input still exits one.

Breadth-first search stores the two marked positions, never the full deck order.
There are at most N × (N − 1) ordered pairs: 4,032 at the largest supported size.
An identical pair of positions always has the same future possibilities, so this
smaller search still proves the shortest solution or that none exists. Ties try
O before I. Cards already at both goals need an empty word.

JSON adds `pairRoute` with `reachable`, `cards`, `from`, `target`, `word`,
`positions`, and `discovered`. All numbers are one-based. `positions` lists the
two positions in card order at every extra shuffle, including the starting pair.
An unreachable result has `word: null` and `positions: []`. `discovered` counts
distinct visited or queued ordered pairs, including the initial pair. The usual
single-card `route` field is null for a pair request. The supplied word plus the
extra route must still fit within 128 shuffles.

## When does the deck come home?

The final deck defines a permutation of positions. The report prints its
disjoint cycles, including fixed positions, and the smallest positive number
of repetitions of the **whole applied word** that restores the starting deck.

For the default `OIO`, the cycles are `(1 3) (2 4) (5 7) (6 8)`: the word
exchanges those pairs, so two repetitions restore the deck. An empty word has
order one. On 52 cards, O has order eight and I has order 52.

The cycle `(1 3)` means a card at position 1 moves to position 3 when the word
is applied once, then returns to position 1 on the next repetition. Cycle labels
are positions. The restoration count is their least common multiple, calculated
with BigInt and emitted as a string. Appending a routing word changes the
permutation being analyzed.

## Keep a card trace

Choose an unused filename in ignored scratch space:

```sh
mkdir -p .local
node riffraff/cli.mjs '' --card 1 --to 8 --svg .local/card-route.svg
node riffraff/cli.mjs OIO --card 6 --svg .local/shuffled.svg
node riffraff/cli.mjs '' --pair 1:3,8:6 --svg .local/double-reveal.svg
```

Columns read from left to right in time, beginning with the fresh deck. Each
column reads top to bottom in deck order. Row labels are positions; numbers
inside cards are original IDs. Orange marks the followed card and the blue line
connects its positions. Long words produce wide SVGs; large decks produce tall
ones. SVG stays sharp when zoomed. Generated diagrams should stay out of Git.
Pair exports follow both requested cards: orange solid for the first, teal dashed
for the second. Card IDs also label every frame, so color is not the only cue.

`--trace` prints the deck after every shuffle. `--json` emits `initialWord`, the
applied `word`, `size`, all `frames`, the followed `card`, `analysis`, and the
optional `route` (otherwise null). Analysis contains one-based `destinations`,
`cycles`, and the exact `order` string. Frames contain the deck size and a
top-to-bottom `cards` array.

SVG writes refuse to replace files. Syntax, size, card, target, and combined-word
errors are checked before any export. Success exits zero; an unreachable pair
exits two; invalid input or failed I/O exits one. There are no implicit file
writes, packages, random seeds, or network services. `--help` lists every option.

## The small engine

`core.mjs` exports `deck`, `shuffle`, `run`, `analyze`, `route`, `routePair`, and `toSVG`.
States, journeys, analyses, and routes are frozen. Use engine-created objects;
replay serialized journeys with `run(word, size)`. `shuffle` returns a new deck
without changing its input. `analyze` accepts a journey from a fresh deck;
`route` and `routePair` accept any engine-created deck state. Call
`routePair(state, [{card: 1, target: 3}, {card: 8, target: 6}])` for the joint
search, and `toSVG(journey, {card: 1, partner: 8})` for a two-card trace.

The engine maps each old position arithmetically to its new interleaved position.
Cycle decomposition follows that position map. Routing explores the same two
position transitions and reconstructs the first shortest path.

## Verify

```sh
node --test riffraff/test/*.test.mjs
npm test
npm run build
```

Fourteen tests compare all 4,064 words through six shuffles across all supported
deck sizes with an independent cut-and-zip model. Physical repetitions verify
cycle periods, including the 52-card cases. Separate word enumeration checks
shortest routes on 492 shuffled-card cases. All 45,760 card-to-position pairs
across every supported deck also reach their goals. Tests cover immutable
state, limits, complete SVG traces, real CLI JSON/text, and exclusive exports.
Complete physical deck orbits independently check all 6,142 two-card goals on
sizes 2, 4, 6, 8, and 10, including impossible goals and O-before-I shortest ties.
Mirror partners are checked across every supported size; separate short-word
enumeration checks routes on 62- and 64-card decks. Pair receipts, two-path SVGs,
exit codes, conflicting options, word limits, and failure-safe files are covered.

This is a terminal experiment. The Pages bundle excludes the CLI, tests, and
generated diagrams; use the source checkout to run it.
