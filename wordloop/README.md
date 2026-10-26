# Wordloop

Every possible short word, exactly once, on one small circular ribbon. Move a
window one bead at a time, look up any word, and inspect the words that cross the
join. Binary symbols, three letters, or compass directions; word lengths 1–5.
The largest ring has 1,024 beads. There is no sound, account, dependency, or storage.

## Run

From the repository root, run `npm start` with Node.js 20 or newer and visit
**http://localhost:4173/wordloop/**. Any static HTTP server works too.

- **Next / Back** moves the window one bead clockwise / counterclockwise. Tap near
  a bead to jump to it. The brighter outlined beads form the current word, read
  clockwise. For large rings, use the enlarged straight ribbon to see each symbol.
- **Find a word** jumps to its unique starting position. Lowercase input is
  converted to uppercase; surrounding spaces are ignored. Bad words report an
  error while preserving the current position and visits.
- **Walk a lap** starts a fresh visit count from the current position, walks
  clockwise, and stops back where it began. A paused walk starts a new lap when
  restarted. Small rings visit four words per second; larger rings take about twelve
  seconds. Some large-ring positions pass between displayed animation frames;
  their visits are still counted. Pause or step to inspect an individual word.
- **Restart walk** returns to position 1 with just that window visited. Changing
  symbols or word length builds a new audited ribbon and resets the walk.
- Focus the ring and use Left/Right to step, Home/End to jump to the first/last
  bead, or Space to walk/pause. The canvas's accessible label reports the word,
  position, and visit count. Hiding the page pauses a walk; nothing catches up in
  the background. Every ring starts paused, including with reduced motion enabled.
- **Save SVG** downloads the current ring, selected word, and its position as a
  vector still. The visit meter stays in the browser. Dense rings omit tiny bead
  labels, but retain every bead and color. Refreshing restores the binary example.

The `↻` mark in the straight ribbon appears **before bead 1**. Context on either
side wraps as often as needed; its position labels can repeat on very small
rings. Only the bright central window is the selected word. Position labels are
one-based in the interface and zero-based in the engine.

Try the default binary ring, `00010111`, with a three-symbol window:

```text
position    1    2    3    4    5    6    7    8
word       000  001  010  101  011  111  110  100
```

The last word borrows its final two zeros from the beginning. Search for `100`,
or press Back from the first bead, to see that join in action.

## How it works

For an alphabet of `k` symbols and word length `n`, there are `k^n` possible words.
Make a graph whose vertices are `(n−1)`-symbol suffixes. Each appended symbol
creates one directed edge: a word, leading to its next suffix. Each vertex has
`k` incoming and `k` outgoing edges, and all vertices are reachable from the
all-first-symbol suffix by appending the desired symbols.

The builder walks unused outgoing edges, then unwinds and joins closed circuits
with an iterative stack. Reading the resulting edge labels makes a circular
ribbon. The graph's edges correspond one-to-one to the words, so a walk using
every edge once includes every word once. With `n=1`, there is one empty suffix
vertex and one self-edge per symbol.

An independent audit then reads **every cyclic window** and counts its distinct
words, missing words, and repeats. It does not trust the graph construction or
just the ribbon length. Only an exact, complete audit permits a generated ring.
Every bead starts one window; consequently, `k^n` beads are the minimum possible
for this kind of circular ribbon. The visit meter is separate: it records which
windows the user has visited, not whether the ring is complete.

The builder uses `O(k^n)` space and time within the supported bounds. The audit
and lookup read up to five symbols per window. There is no source evaluation or
network request beyond loading the static assets. The export contains only
validated uppercase letters/digits, numeric geometry, and fixed colors.

## Verify

```sh
node --test wordloop/test/*.test.mjs
```

Eight tests independently enumerate every word for all three shipped alphabets
and all five lengths, compare lookups and wrapping windows, test known ribbons
and determinism, catch duplicate/missing words, traverse full laps in both
directions, check pointer geometry against every bead through 1,024 positions,
inspect SVG highlights and labels, and reject malformed or oversized inputs.

Use `npm test` for the whole cabinet and `npm run build` for the explicit static
bundle. Browser checks cover stepping, join-crossing words, lookup and errors,
the visit meter, a completed lap, paused walks, settings, keyboard and pointer
selection, large rings, SVG download, and desktop/phone layouts.
