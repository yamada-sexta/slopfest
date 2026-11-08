# Slydice

A browser table and terminal lab for dice that refuse to line up. A beats B,
B beats C, and C beats A. Choose a die, then let the lab find its counterpick.
The engine counts all face pairings to calculate the exact odds.

## At the browser table

Run `npm start` from the repository root with Node.js 20 or newer, then open
[the local Slydice table](http://localhost:4173/slydice/). Choose three, four, or
five faces per die. Pick the first die and the table assigns its counterpick to
the second seat. The pairing grid lists the winner of each possible roll.

Roll both dice once or sample 20 independent pairs. The outline marks the last
sample, and the tally shows how often the counterpick actually won. Compare that
rate to its exact win probability above the grid. Changing the first die or set
starts a fresh tally. Choose **Save trio SVG** to keep a diagram of all three
matchups in the selected set.

## In the terminal

Run from the repository root with Node.js 20 or newer.

```sh
node slydice/cli.mjs --pick A
node slydice/cli.mjs --faces 5 --svg slydice.svg
node slydice/cli.mjs --dice '2,4,9;1,6,8;3,5,7' --pick B
node slydice/cli.mjs --faces 4 --json
node slydice/cli.mjs --help
```

The default forge checks all **280** ways to partition the numbers 1 through 9
among three dice with three faces each, ignoring face order and die names. Only
five partitions form a strict-majority cycle. The first strongest result is:

| Die | Faces | Wins against |
| --- | --- | --- |
| A | 1, 5, 9 | B: 5 of 9 pairings |
| B | 3, 4, 8 | C: 5 of 9 pairings |
| C | 2, 6, 7 | A: 5 of 9 pairings |

All three means are 5, yet choosing second lets you win **5/9** of the time
against whichever die was chosen first. An advantage is a probability, not a
guaranteed win on the next roll.

## The forge

`--faces 3`, `4`, or `5` divides the integers 1 through three times that number
among three equally sized dice. It exhaustively maximizes the **weakest edge**
of a winning cycle. Thus it looks for a set with an advantage regardless of the
first choice. Among equally strong partitions, it shows the first in canonical
search order. It does not require the three edges or the dice means to be equal.

| Faces each | Unlabeled partitions | Cyclic partitions | Best weakest edge | Partitions achieving it |
| --- | ---: | ---: | ---: | ---: |
| 3 | 280 | 5 | 5/9 | 5 |
| 4 | 5,775 | 13 | 9/16 | 13 |
| 5 | 126,126 | 1,732 | 15/25 | 3 |

The five-face specimen wins 15/25, 15/25, and 16/25 around its cycle. Its
lowest-mean die beats the middle-mean die. Means cannot rank pairwise win chances.
These optimality claims apply to this finite partition problem, rather than to
all possible dice with repeated or unrestricted labels.

Each partition is visited once: the first die contains 1, the second contains the
smallest remaining number. Both possible cycle orientations are checked. The
returned specimen is relabeled to read A → B → C → A, keeping 1 on A. Search
results include a histogram indexed by the weakest edge's winning-pair count.
Results are deterministic and cached immutably within the process.

## Bring your own dice

`--dice '2,4,9;1,6,8;3,5,7'` supplies A, B, C in that order. Quote the argument
so the shell does not interpret its semicolons. Each die needs the same number
of faces, from one to eight, labeled with integers 0–99. Repeats are allowed and
remain separate equally likely faces. Labels are sorted for display. Do not
combine `--dice` with `--faces`.

The model assumes fair dice and independent rolls. A strict numerical comparison
decides a win. Ties are counted and **never rerolled**. A cycle requires more than
50% wins on each of its three edges, using **all** pairings as the denominator.
For example, winning half the time and tying half the time does not qualify.
Some custom sets have no cycle or no majority counterpick.

`--pick A`, `B`, or `C` reports the other die with the greatest win probability
above 50% against that choice. Equal winning counts prefer the earlier die label.
It never recommends the chosen die itself. A custom set can have one strong die
with no counterpick; this is reported explicitly. The table reads **row die
against column die**. Fractions are exact unreduced counts; displayed means and
percentages are rounded annotations.

## Pairing postcards

`--svg PATH` saves a self-contained diagram with three matchup grids. Each row
is a face on the left die, each column a face on the right. Every square is an
equally likely pair: coral wins, slate loses, gold ties. Repeated labels still
get separate rows and columns. Cycles determine the three grid directions;
sets without a cycle show A vs B, B vs C, C vs A. The SVG includes every result
and can be opened in a browser or image viewer.

The CLI validates all inputs before exporting, refuses to overwrite existing
files, and exits 1 on invalid input or I/O errors. Successful analysis exits 0,
including a valid custom set with no cycle. Combine `--json` with `--svg` for
machine-readable stdout and a diagram file. The static bundle includes the
browser table and shared engine. Use a source checkout for the CLI.

## Use the engine

```js
import { forge, analyze, match, toSVG } from './slydice/core.mjs';
const search = forge(5); // faces, partitions, cycles, total, bestWins,
                        // bestCount, histogram, analysis
const set = analyze([[2, 4, 9], [1, 6, 8], [3, 5, 7]]);
set.cycle;        // [0, 1, 2], or null; indices into dice
set.counterpicks; // [2, 0, 1], or null entries when none qualify
set.matches[0][1];// { wins: 5, losses: 4, ties: 0, total: 9 }
match([0, 99], [1]); // also supports different lengths for standalone matches
const svg = toSVG(set); // accepts an engine-created analysis
```

Inputs are copied; all exposed data is deeply frozen. `analyze` supports exactly
three equally sized dice; standalone `match` supports 1–8 faces on either side.

## Verify

```sh
node --test slydice/test/*.test.mjs
npm test
npm run build
```

The independent search oracle assigns increasing ranks to die owners and counts
wins against lower ranks already seen, rather than generating combinations and
comparing face pairs. It checks **all 132,181 partitions** across the three forge
sizes, their complete cycle histograms, optimal scores, and optimal-set counts.
Another oracle checks 1,521 pairs of small dice, including repeated labels and
unequal lengths. Tests also cover both cycle directions, strict tie thresholds,
counterpick ties, immutable snapshots, SVG cells, real CLI text/JSON, bad inputs,
and exclusive export writes. Generated pairing diagrams are visually inspected.

For a browser smoke check, open Slydice from the gallery. With three faces per
die, each first pick has a counter that wins 5/9 pairings. With five faces and
die A first, count 16 cells marked C in the 25-cell grid. Roll once, then roll a
batch and check that the win tallies add to 21. The outlined square should match
the faces in the last roll. Clear the tally or change the first pick to start
over. The downloaded trio SVG should show all three matchups.
