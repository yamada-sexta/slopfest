# Riffraff

A small perfect-shuffle deck lab. Interleave two halves, follow an original card,
find a shortest route to a chosen position, and inspect the cycles of a whole
shuffle word. SVGs show the card's path through every deck.

Use Node.js 20 or newer, with no dependencies, from the repository root:

```sh
node riffraff/cli.mjs
node riffraff/cli.mjs O --cards 52
node riffraff/cli.mjs I --cards 52
node riffraff/cli.mjs '' --cards 8 --card 1 --to 8 --trace
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
```

Columns read from left to right in time, beginning with the fresh deck. Each
column reads top to bottom in deck order. Row labels are positions; numbers
inside cards are original IDs. Orange marks the followed card and the blue line
connects its positions. Long words produce wide SVGs; large decks produce tall
ones. SVG stays sharp when zoomed. Generated diagrams should stay out of Git.

`--trace` prints the deck after every shuffle. `--json` emits `initialWord`, the
applied `word`, `size`, all `frames`, the followed `card`, `analysis`, and the
optional `route` (otherwise null). Analysis contains one-based `destinations`,
`cycles`, and the exact `order` string. Frames contain the deck size and a
top-to-bottom `cards` array.

SVG writes refuse to replace files. Syntax, size, card, target, and combined-word
errors are checked before any export. Success exits zero; invalid input or
failed I/O exits one. There are no implicit file writes, packages, random seeds,
or network services. `--help` lists every option.

## The small engine

`core.mjs` exports `deck`, `shuffle`, `run`, `analyze`, `route`, and `toSVG`.
States, journeys, analyses, and routes are frozen. Use engine-created objects;
replay serialized journeys with `run(word, size)`. `shuffle` returns a new deck
without changing its input. `analyze` accepts a journey from a fresh deck;
`route` accepts any engine-created deck state.

The engine maps each old position arithmetically to its new interleaved position.
Cycle decomposition follows that position map. Routing explores the same two
position transitions and reconstructs the first shortest path.

## Verify

```sh
node --test riffraff/test/*.test.mjs
npm test
npm run build
```

Eight tests compare all 4,064 words through six shuffles across all supported
deck sizes with an independent cut-and-zip model. Physical repetitions verify
cycle periods, including the 52-card cases. Separate word enumeration checks
shortest routes on 492 shuffled-card cases. All 45,760 card-to-position pairs
across every supported deck also reach their goals. Tests cover immutable
state, limits, complete SVG traces, real CLI JSON/text, and exclusive exports.

This is a terminal experiment. The Pages bundle excludes the CLI, tests, and
generated diagrams; use the source checkout to run it.
