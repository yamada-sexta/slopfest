# Bankshot

A terminal billiards toy with one ball, four rails, and a pocket at each corner.
Launch from an integer point inside the table. A rail flips one component of
the velocity. The shot ends at a corner pocket or when the ball returns to its
starting point with its original heading.

Run from the repository root with Node.js 20 or newer.

```sh
node bankshot/cli.mjs --trace
node bankshot/cli.mjs --from 4,2 --trace
node bankshot/cli.mjs --table 8x6 --velocity -1,0 --json
node bankshot/cli.mjs --svg loop.svg
node bankshot/cli.mjs --help
```

The default shot starts at `(3,2)` with velocity `(2,1)` on a 12 × 9 table.
Its first bank is at time **9/2** and position **(12, 13/2)**. It returns
after ten banks at time **36**. Move the start one unit east to `(4,2)` and
the same velocity puts it in the north-east pocket after three banks at time
**16**.

Choose width and height from 2 to 24. X increases east and Y increases south
from the north-west corner. Coordinates must be strictly inside the table.
If omitted, the start is one quarter of each side, rounded down to at least
one. The velocity components can range from -12 to 12, including zero on
one axis. The model treats the ball as a point with no friction or spin.

## Unfolding the table

Imagine a mirrored copy of the table behind every rail. A ball that would
bounce can instead continue straight into the next copy. Its unfolded
coordinates are the starting coordinates plus velocity times time.

For a moving axis, multiply time by a common integer scale divisible by
the absolute speed. That puts every wall crossing on an integer tick.
The engine merges the two lists of crossing times in order, then folds
each coordinate back into the table by reflecting it every other copy.
Crossings on both axes at the same tick mean a corner pocket.

The full state on a moving axis repeats when its unfolded displacement
is a multiple of twice the side length. A stationary axis is already
repeated. The first shared repeat of the moving axes gives the earliest
return with the original heading, unless a corner pockets the ball first.

## Keep a shot

`--trace` prints the start, banks, and terminal event using reduced fractions.
`--json` returns the full trace for other programs. Divide every point's
`tick`, `x`, and `y` by `scale` to get the physical values. Each point's
`walls` array lists the rails it touched. The start and full return have
empty arrays, while a pocket lists both rails. `returnTicks` gives the
full repeat tick in the unfolded model, even for a shot that pockets earlier.

`--svg PATH` saves the whole trajectory with the start and first leg in
gold. Sparse paths get a dot at each bank. Dense paths keep every segment
and use a fainter line. A coral dot marks the terminal pocket. SVG display
coordinates are rounded separately from the exact trace. Exports require a
new filename and can accompany either text or JSON output.

## Verify

```sh
node --test bankshot/test/*.test.mjs
npm test
npm run build
```

The test oracle moves the ball by one tick at a time and flips its physical
velocity at each rail. It checks the full return period, pocket time, and
every recorded point on all 10,800 shots on tables up to 6 × 6 with velocity
components from -3 to 3. The tests also exercise fractional traces, dense
diagrams, CLI validation, and exclusive SVG writes.
