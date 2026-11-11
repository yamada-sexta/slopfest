# Domino Index

Count the ways to cover a board with 1 × 2 dominoes, then open any tiling by
its number. A domino can lie horizontally or vertically. The terminal drawing
shows its edges and fills holes with `###`.

Run from the repository root with Node.js 20 or newer.

```sh
node domino-index/cli.mjs
node domino-index/cli.mjs --size 4x4 --index 17
node domino-index/cli.mjs --board '..../.##./.##./....' --index 2
node domino-index/cli.mjs --size 10x20 --index 289415868852204573601981 --json
```

Use `--size WxH` for a rectangle or `--board` for custom rows. In a custom
board, `.` is open, `#` is a hole, and `/` separates rows. Quote the pattern
in the shell. Boards can be 1–10 columns wide and 1–20 rows tall.

The default 4 × 4 board has 36 tilings. The ring with four holes has two.
An impossible board reports zero tilings. A board filled with holes has
one tiling made of zero dominoes.

## How the index works

The catalog visits the first uncovered square in row order. When both
orientations fit, it tries horizontal before vertical. It memoizes the
number of completions from each position and occupancy mask. The mask only
tracks reservations in the next row's worth of cells because a domino
reaches at most one row ahead.

The first branch might contain millions of completions. To open a tiling,
compare its one-based index with the first branch's count. Stay in that
branch if the index fits. Otherwise subtract its count and proceed to the
next branch. Repeat until the board is covered. Counts and indices use
BigInt throughout.

`--json` writes `board`, `count`, `index`, and `tiles`. The count and
index are decimal strings so clients can parse them exactly. The same
positive tile ID appears on each domino's two squares. Holes use `null`.
An impossible board has a `null` index and tile grid when no index is
requested. An explicitly requested index must exist.

## Verify

```sh
node --test domino-index/test/*.test.mjs
npm test
npm run build
```

A separate enumerator starts in the bottom right and keeps a full set
of uncovered squares. Tests compare every tiling for all 4,096 hole
patterns on a 3 × 4 board. They also check the large-board count, distinct
tilings at adjacent large indices, impossible and empty boards, and CLI
text and JSON.
