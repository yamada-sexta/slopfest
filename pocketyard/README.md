# Pocketyard

A little wagon-shunting puzzle. Three pocket tracks, a few numbered wagons, and
a dispatch order to match. Only the exposed **rightmost** wagon on a track can
move. Transfer it to the right end of another track with a free space.

This is an abstract stack puzzle dressed as a toy rail yard. The connecting
shunter is offstage; there is no locomotive-routing or real railway simulation.

## Play

Use Node.js 20 or newer at the repository root:

```sh
npm start
```

Open **http://localhost:4173/pocketyard/**, or choose Pocketyard in the gallery.
No package installation, account, service, timer, or saved progress is needed.

1. Choose an occupied track. Its rightmost wagon becomes selected.
2. Choose another track with room. The wagon joins its right end; that is one
   transfer. Every track has three spaces, including tracks with an empty goal.
3. Match the small **Dispatch** row beneath every track, in left-to-right order.

The first dispatch needs just **B → A**: wagon 2 joins wagon 1. The second teaches
temporary parking: move wagon 3 out of A, bring wagon 2 in, then bring 3 back.
Six dispatches start 1, 3, 5, 7, 9, and 12 transfers from their goals.

Choose the same selected track again, or use **Cancel selection**, to put the
selection down. A full destination refuses the move without dropping the
selection or increasing the counter. An empty source does nothing. You may use
an already-correct track as workspace; matching a track never locks it.

**Undo transfer** restores the previous yard, including after a win. **Reset yard**
restarts the loaded dispatch. The dispatch selector loads any of the six puzzles;
**Next dispatch** appears enabled after a win and wraps the last puzzle to the
first. Buttons work with Tab and Enter/Space. Track buttons keep focus through
ordinary moves; completing a dispatch focuses Next.

**Hint next transfer** marks and focuses a source and marks a destination. It
changes no wagon or counter. Follow the suggested transfer and ask again for
another shortest step. Hints adapt after detours; the remaining count may rise,
fall, or stay the same after your move. Selecting a different source clears a
conflicting hint. Numbers and text accompany the colors and outlines.

**Save yard SVG** downloads the current tracks beside the dispatch order, including
the move and shortest-remaining counts. Selection and hint marks stay out of the
postcard. Browser download handling chooses the final filename.

## The small engine

`core.mjs` is independent of the browser. Tracks are three strings in buffer-to-end
order: `['56', '14', '32']` puts wagon 6 at A's exposed end. The engine supports
one through six distinct wagon IDs from `1`–`6`, uniform capacities 1–3, and at
least one empty space. Boards must contain exactly the goal's wagons. Yard
metadata, boards, moves, and returned routes are immutable snapshots.

```js
import { createYard, solve, transfer } from './pocketyard/core.mjs';
const yard = createYard(['12', '', '']);
const start = ['1', '2', ''];
const solution = solve(yard, start);
// { distance: 1, route: [{ from: 1, to: 0, wagon: '2' }] }
const ready = transfer(yard, start, 1, 0); // ['12', '', '']
```

Track indices are 0–2 in the engine. Malformed input throws; a same-track,
empty-source, or full-destination transfer returns `null`. `legalMoves` lists
available transfers and `isSolved` checks the exact order. `solve` returns `null`
for a valid but unreachable arrangement. Tight custom yards can have disconnected
components; all shipped dispatches are reachable.

Every transfer has a legal inverse. The solver therefore explores backward from
the goal with breadth-first search, caching exact distances and the next transfer
toward the goal. It searches all states in that goal's reachable component, without
a depth cutoff or a heuristic. With six wagons and three three-space tracks there
are 7,200 arrangements; the largest exact distance in the shipped six-wagon yard
is 19. Ties follow deterministic track order. The browser uses the current board's
route, rather than a prerecorded walkthrough.

## Verify

```sh
node --test pocketyard/test/*.test.mjs
npm test
npm run build
```

Six tests cover 9,336 boards across multiple wagon counts and capacities, using
independent array-stack transitions and synchronous shortest-distance relaxation
instead of the engine's string states and search queue. They validate returned
routes, unreachable states, every legal and illegal transfer on all 7,200 six-car
boards, exact inverses, conserved wagons, minimum routes for all rooms, detours,
immutability, invalid inputs, and escaped SVG state/goal exports. Browser checks
exercise actual wins, hints, keyboard steps, cancellation, blocked transfers,
undo, reset, wrapping, downloads, and narrow layouts.

The static manifest includes only the project's five browser assets. Source
documentation, tests, screenshots, and generated postcards stay out of Pages.
