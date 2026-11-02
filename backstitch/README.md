# Backstitch

A small machine for coming home, in the browser or terminal. Weave a row of bits
into a tapestry, then run the machine backward until every stitch returns. The
row's ends meet on a ring. The terminal export pairs mint outward and amber
homeward panels, both showing the current row, with time descending on the right.

## The browser loom

Run `npm start` at the repository root and open **http://localhost:4173/backstitch/**,
or choose Backstitch in the gallery. Four specimens start 32 stitches out so there
is already something to bring home. Try **Forget the trail**, then **Weave home**:
the erased drawing grows back while the machine reverses from its live pair.

Use one-step buttons in either direction, animate outward or homeward, or pause.
Time is bounded between zero and the chosen cloth depth. The amber frame marks
the present; mint marks are recorded rows. Lavender and amber strips below the
cloth show the two live rows. Open **Inspect the two live rows** for readable bits.
A separate starting pair is retained for the homecoming comparison; it is never
used by the inverse rule. The drawing stores only current rows, not state pairs.

**Make your own starting pair** accepts equal-width binary rows, any rule from
0–255, and a depth from 1–256. Applying starts at time zero. Editing pauses the
loom and disables transport/export until the draft is applied or discarded. A
failed load preserves the current pair, cloth, and time. Presets replace the
draft immediately. Reset returns to the loaded seed; it does not load a specimen.
Native buttons work with keyboard focus and Enter/Space. Animation runs only on
request and pauses when the page becomes hidden.

**Save visible cloth SVG** records exactly the cloth on screen and both live
rows. Forgotten and unvisited gaps stay blank. This is a different export from
the terminal's complete two-panel journey. Browser downloads use the browser's
normal filename handling. There is no persistence, account, or network service.

## The terminal tapestry

No packages, browser, GPU, or network access are needed. Use Node.js 20 or newer
from the repository root:

```sh
node backstitch/cli.mjs
node backstitch/cli.mjs --rule 110 --width 79 --steps 64
node backstitch/cli.mjs --seed 0010100 --past 1000001 --steps 16
```

Plain text uses `#` for a stitch and `.` for an empty cell, with no color escapes.
For a picture, save an SVG and open it in any SVG viewer or browser. The ignored
scratch directory keeps generated exports out of Git:

```sh
mkdir -p .local
node backstitch/cli.mjs --rule 110 --width 79 --steps 64 --svg .local/backstitch.svg
```

Exports refuse to replace any existing file. Choose a new filename for another
run. `--json` emits the complete initial, outward, and homeward pairs; it can be
combined with `--svg` without mixing prose into JSON. No files are written unless
`--svg` is supplied. `--help` lists every option. Exit status is zero for success,
one for invalid arguments or an I/O failure.

## Two rows make a memory

This is a **second-order** cellular automaton. It changes the ordinary elementary
rule by keeping two rows: `past` and `current`. The ordinary rule `F` looks at the
left, center, and right bit of each cell. Neighborhood `000` selects rule bit zero;
`111` selects bit seven. Rule 90, for example, XORs the two neighbors.

The machine itself uses:

```text
forward:   (past, current) → (current, past XOR F(current))
backward:  (past, current) → (current XOR F(past), past)
```

XOR twice cancels. Every rule from 0 through 255 therefore has an exact inverse
on **pairs**, even if its ordinary one-row evolution loses information. Rule zero
simply swaps the two rows. A single visible row is insufficient to reverse the
machine: the second row is part of its state, not a saved execution log.

Backstitch starts with an all-zero past and one centered stitch by default.
`--seed` supplies the current row as binary digits and infers its width unless
`--width` is explicit. `--past` supplies the other row, which must have the same
width. Even widths put the seed immediately right of center. Width is bounded to
1–160 cells, and each leg to 0–256 steps. Defaults are rule 90, width 65, 48 steps.

Both starting rows are compared with the final homeward pair before reporting
recovery. The return journey uses only the endpoint pair and the same rule. The
display keeps snapshots to draw its two tapestries; the inverse needs none of
that history. Editing either row, changing the rule, or changing the ring width
starts a different journey.

The engine can also walk backward directly from a pair copied from JSON:

```sh
node --input-type=module <<'JS'
import { pair, walk } from './backstitch/core.mjs';
const start = pair('1000001', '0010100');
const outward = walk(start, { rule: 110, steps: 16 });
const endpoint = JSON.parse(JSON.stringify(outward.at(-1)));
const home = walk(endpoint, { rule: 110, steps: 16, direction: -1 });
console.log(home.at(-1)); // { past: '1000001', current: '0010100' }
JS
```

## Verify

```sh
node --test backstitch/test/*.test.mjs
npm test
npm run build
```

The tests compare all rules with an independent neighborhood lookup; exhaust
every two-row state up to four cells to check both inverse laws and bijectivity;
and reconstruct longer journeys from serialized endpoints without their logs.
They cover nonzero past rows, one-cell rings, wrapping, maximum bounds, immutable
snapshots, SVG row order and ink geometry, real CLI runs, JSON, malformed arguments,
and exclusive file writes. No timing benchmark or random search is needed to
establish reversibility.

Seven browser-loom engine tests additionally reconstruct erased trails for all
256 rules, compare different drawing histories, exercise mixed-direction walks,
reset and boundaries, maximum cloths, exact gaps and live memories in SVG, ink
geometry, invalid inputs, and immutable snapshots. Browser QA also checks the
actual controls, failed drafts, downloads, animation, and narrow layouts.

The gallery and Pages bundle include only five approved browser assets: HTML,
CSS, the app, the core, and the loom. The CLI, tests, and generated tapestries stay
outside the browser release.
