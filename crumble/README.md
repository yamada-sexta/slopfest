# Crumble

A local sandpile toy: four grains are too many for one cell. A topple sends one
grain north, east, south, and west. Grains crossing the square's edges leave
forever. Watch avalanches, inspect their work, and compare different legal
orders of falling. It is a discrete mathematical model, rather than a physical
sand simulation.

## Play

Run `npm start` from the repository root with Node.js 20 or newer, then visit
**http://localhost:4173/crumble/**. No packages, accounts, or network services
are needed. A static server can serve the same files.

The opening postcard is already settled. Tap a cell, choose a drop of 1, 4, 32,
or 256 grains, and press **Drop grains**. **One wave** fires all cells that were
ready at the start of that wave. Newly received grains wait until the next wave.
A tall cell can fire several times in one wave. **Run avalanche** animates 160
waves per second, **Pause** stops it, and **Settle now** finishes immediately.

Three original pours are included: a 4,096-grain mountain, two 2,048-grain heaps,
and a 25 × 25 carpet of three grains per cell with one extra in the center.
**Replay pour** starts the selected original pour from its unsettled beginning.
Changing postcards or **Restore settled pour** discards extra drops and restores
the settled original. The drawing layer and drop size stay as chosen. Reloading
starts fresh; nothing is stored or uploaded.

The **grains** layer shows heights 0–3; coral means a cell is ready to topple.
The **work** layer is an odometer: each cell counts every individual topple since
the original pour. Its colors follow a logarithmic scale normalized to the current
busiest cell. A cell's exact height and toppling count appear beside the board.
The counters below conserve grains: poured in = still here + escaped at edges.

**Try both orders** starts twice from the entire recorded input, including extra
drops, and stabilizes the oldest ready cell first and the newest ready cell first.
It compares every final height, every odometer entry, and the escape totals. The
current picture stays in place, even when it is still falling. Queue visits can
differ because one visit can fire a tall cell several times; the individual
number of topplings at each cell agrees.

**Save SVG** pauses and exports the current drawing layer, even an unsettled
board, with the grain totals and toppling count. The selection box is omitted.
Focus the board for arrow-key selection, **Home** to choose the center,
**Enter** to drop, and **Space** to run or pause. Selection pauses an avalanche;
hiding the tab pauses it too. The board has open boundaries and never wraps.

## Engine and verification

`core.mjs` exports immutable-state operations: `create`, `pour`, `wave`, `settle`,
`inspect`, `compareOrders`, `specimen`, pointer mapping, and SVG serialization.
Every state owns its cell heights, cumulative input, and odometer arrays. The
input records where all grains entered; it is not a list of prior frames.
The engine supports odd boards from 5 × 5 to 41 × 41 and at most 8,192 cumulative
poured grains. Exceeding the budget preserves the picture; restore a pour to
start fresh. Tall-cell firings are batched, while the queue keeps at most one
pending entry per cell.

Termination has a concrete bound. Give cell `(x,y)`, with coordinates 1 through
`n`, weight `x(n+1-x) + y(n+1-y)`. Every interior topple decreases the weighted
sum of heights by four; boundary topples decrease it by at least four. The
nonnegative sum therefore bounds the total topplings. With the supported grain
and board limits, counts stay safely inside unsigned 32-bit arrays.

Run `node --test crumble/test/*.test.mjs` from the repository root. Tests compare
both bulk queues against a separate random one-topple-at-a-time interpreter;
compare parallel waves, FIFO, and LIFO on all postcards; check exact known
results, conservation, decreasing potential, interleaved drops, independent state
ownership, all cell centers, exported geometry/colors, invalid states, and the
largest supported pour. `npm test` runs the whole cabinet; `npm run build` includes
only allowlisted static assets.
