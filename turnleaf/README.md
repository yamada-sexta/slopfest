# Turnleaf

A little paper, taking sides. Start with a strip of numbered panels, fold its
left or right half over the other half, and inspect the layer order. Turnleaf
keeps each panel's original identity and records which face points up. It prints
a readable stack, traces every fold, locates a panel, and saves an SVG diagram.

This is a terminal experiment with no dependencies, browser UI, or network
service. Use Node.js 20 or newer from the repository root:

```sh
node turnleaf/cli.mjs
node turnleaf/cli.mjs LRR --panels 16 --find 1
node turnleaf/cli.mjs LR --panels 8 --trace
node turnleaf/cli.mjs LL --panels 4 --json
```

The default uses 16 panels and `LRR`: **two packets, eight layers each**. Panel 1
ends in the first packet, six layers down from the top, with its front facing up.
To save a diagram, choose an unused filename in the ignored scratch directory:

```sh
mkdir -p .local
node turnleaf/cli.mjs LRR --panels 16 --find 1 --svg .local/folded.svg
```

Open the SVG in any SVG viewer or browser. Packet columns read left to right;
each column reads **top to bottom**. Gold `F` layers face front up; mint `B`
layers face back up. `--find` outlines exactly one panel and includes its packet,
layer, and face in the caption. The numbers are annotations: a back-facing panel
still carries its original ID in the diagram.

## A strip with two sides

Imagine a long paper strip lying flat, numbered 1 through N from left to right.
Every printed front starts facing up. Keep the strip in the same left-to-right
orientation throughout; do not rotate or turn over the whole packet between
folds.

- `L` folds the **left half over the right**, landing on top of it.
- `R` folds the **right half over the left**, landing on top of it.
- A moving packet reverses its layer order and flips every face. The receiving
  half stays put. A fold halves the width and doubles the layer count.

For four panels folded `LL`, the final packet reads top to bottom:

```text
3B  2F  1B  4F
```

You can try it with a numbered paper strip. The engine models flat panels and
ignores crease thickness. All packets have the same depth after each complete
half-fold; every original panel appears exactly once.

## Options and bounds

`--panels` accepts 1, 2, 4, 8, 16, 32, or 64. Fold words use uppercase `L`/`R`
without spaces, with at most `log2(N)` folds. An explicit empty word means no
folding:

```sh
node turnleaf/cli.mjs '' --panels 8
```

If the word is omitted, the CLI uses as much of `LRR` as fits: one-panel paper
stays flat, two panels get `L`, four get `LR`, and larger strips get `LRR`.
`--find N` searches the final packets using the original one-based panel ID.
Packet and layer positions are also one-based.

`--trace` prints the starting strip and every actual prefix of the fold word.
`--json` emits a structured final state, and `--trace --json` includes all frames.
The JSON/core stacks use **bottom-to-top** order; text and SVG reverse them for
reading. Each piece is `{ panel, face }`. With `--find`, JSON includes a `found`
object; otherwise it is `null`.

`--svg` can accompany text or JSON. It saves the final diagram and refuses to
replace existing files. Input and lookup errors are checked before writing.
Larger diagrams may be wide or tall; SVG stays sharp when zoomed. `--help` lists
every option. Success exits zero; invalid arguments or I/O failures exit one.
There are no terminal color escapes or implicit file writes.

## The small model

`strip(N)` returns an immutable starting state. `fold(state, side)` creates a new
one, leaving the original untouched. Its `cells` are packets from left to right;
each cell's layers run bottom to top. `run(word, N)` returns a frozen journey
with all frames, while `locate(state, panel)` returns packet, depth from both
ends, and face. `toSVG(journey, { highlight })` serializes its final frame.
States and journeys must be engine-created; repeat a serialized journey using
its panel count and fold word.

The implementation takes the still half's stacks, mirrors the moving cells,
reverses their stacks, flips their faces, and concatenates them on top. The tests
use an independent representation: each panel has an x coordinate, a height z,
and an orientation. Reflections in x and z predict its destination without
constructing or reversing stacks.

```sh
node --test turnleaf/test/*.test.mjs
npm test
npm run build
```

Ten tests cover all **247 valid fold words** across every supported width,
including full 64-layer packets and no-fold strips. They compare coordinates,
face orientation, exact lookup depths, and conserved panel identity; check hand-
folded fixtures, mirror symmetry, every trace prefix, immutability, SVG layer
order and highlights, malformed inputs, real CLI JSON/text, and exclusive exports.

Turnleaf is listed in the root catalog and runs from the source checkout. The
browser-only Pages bundle excludes the CLI, tests, and generated diagrams.
