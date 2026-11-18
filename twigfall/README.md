# Twigfall

A tiny game of cutting branches. Two players take turns removing one standing
branch and everything growing above it. The last player to cut wins. Equivalently,
the player with no legal move loses.

Twigfall draws the grove, plays a sequence of cuts, and finds every winning move
against perfect play. This is a terminal experiment with Node.js 20 or newer,
no dependencies, and no network service. Run from the repository root:

```sh
node twigfall/cli.mjs
node twigfall/cli.mjs '(()())' --cuts 2 --trace
node twigfall/cli.mjs '()()' --json
```

## Grow a grove

Each parenthesis pair is a branch. Pairs inside it grow from its upper tip.
Adjacent pairs grow independently from the ground. Whitespace is ignored.

```text
()        One branch
(())      Two branches in a chain
()()      Two separate branches
(()())    One stem with two twigs at its tip
```

Each opening parenthesis receives an ID, counting from one from left to right.
The fork `(()())` has this standing grove:

```text
1
  2
  3
```

Cut 2 and twig 3 stays. Cut 1 and the entire fork falls. Branch IDs never
change after cuts; fallen IDs cannot be used again. Text indents a branch under
its parent. SVGs grow upward from a common ground point.

The default grove is `((()())(())) (()())`, with nine branches. Its winning
first cuts are 3, 4, and 6. The suggestion chooses the smallest winning ID.
For `()()` there is no winning first cut: whichever branch you take, the other
player takes the last one.

## Take turns

Pass the original grove and the full sequence of cuts, in order. A comma list
contains actual cuts, not every branch that falls. On your next turn, append
your opponent's move and ask again:

```sh
node twigfall/cli.mjs '(()())(())' --cuts 2,4 --trace
```

Cut 2 removes only branch 2. Cut 4 removes branches 4 and 5. The standing grove
then contains branches 1 and 3, in a chain. Cutting 1 wins immediately.
`--trace` lists the branches removed by each cut.

The report labels the position for **the next player to move**, not the player
who just cut. A winning position has at least one cut to a losing position.
A losing position has no winning cut against a perfect opponent. Its suggested
move is simply the smallest legal ID; that recommendation does not promise a win.
An empty grove is `finished`, with nimber zero and no recommendation.

The game is deterministic. There are no dice, hidden information, or saved
sessions. You can play with a friend using the printed IDs or use the analyzer
to choose one side's replies.

## Save a picture

Choose an unused destination, preferably in ignored scratch space:

```sh
mkdir -p .local
node twigfall/cli.mjs --svg .local/grove.svg
node twigfall/cli.mjs '(()())(())' --cuts 2,4 --svg .local/after-cuts.svg
```

Standing branches are green. Fallen branches keep their original positions as
faint dashed guides. Peach rings identify winning cuts in the current position.
The diagram retains the original IDs and the layout, so a removed twig does not
make its neighbors jump. SVG stays sharp when zoomed. Generated pictures are
not source files and should stay out of Git.

`--json` emits the canonical original source, cut IDs, every frame, and the final
strategy report. Frames have `branches` (the original `{ id, parent }` tree,
with ground numbered zero), `active` IDs, and `source`. The strategy includes
`nimber`, `outcome`, `winningCuts`, and `recommendation`.

Use at most 24 branches and 2048 source characters. An explicit empty string
means an empty grove. The parser rejects other symbols, unmatched parentheses,
and larger groves. Cuts must be positive integer IDs that are still standing.
Invalid moves are checked before any export. SVG writes refuse to replace an
existing file. Exit status is zero for a valid analysis, including losing and
finished positions, or one for invalid input and I/O failures. `--help` lists
the options.

## The strategy in a twig

A junction's value is the bitwise XOR of its outgoing branch values. A branch's
value is one plus the value of the junction at its tip. Work down from the
leaves to the ground. The ground value is the position's **nimber**. Zero means
a losing position under perfect play; nonzero means there is a winning cut.
This is a game value, not a probability or a count of branches to remove.

Why add one for a stem? Its moves either remove the stem, leaving value zero,
or play in the grove above it. Adding a stem shifts the smallest excluded move
value up by one. Independent branches combine by XOR. The analyzer checks each
legal cut and lists exactly those leaving value zero.

The core exports `parse`, `cut`, `analyze`, `run`, and `toSVG`. States, journeys,
and reports are frozen. `cut` returns a new state; it preserves the original
tree and source. Use engine-created states and journeys; serialized data can be
replayed through `run(source, cuts)`.

## Verify

```sh
node --test twigfall/test/*.test.mjs
npm test
npm run build
```

Eight tests enumerate all 2,056 ordered groves with up to eight branches and
every reachable position of each. A separate solver enumerates legal moves and
computes their minimum excluded values, without using the tree XOR formula.
The tests compare exact nimbers, winning cuts, removed descendants, and suggested
moves. The default nine-branch strategy wins against every opponent reply.
Tests also check hand-played fixtures, 24-branch limits, immutable state,
bad input, SVG markings, real CLI receipts, and exclusive exports.

Twigfall is in the root source catalog. The browser-only Pages build excludes
this CLI, its tests, and all generated diagrams.
