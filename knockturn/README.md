# Knockturn

A small goodnight puzzle, inspired by the cross-toggle rule of Lights Out.
Knocking a window flips it and its immediate neighbors above, below, left, and
right. Lit becomes dark and dark becomes lit. Nothing wraps around the edges.
Put every light out to finish a room.

Run `npm start` from the repository root with Node.js 20 or newer and open
**http://localhost:4173/knockturn/**. No dependencies, accounts, services, storage,
or sound are needed.

## Play

Six prepared rooms use 3 × 3, 4 × 4, and 5 × 5 buildings. Their starting shortest
routes are **1, 2, 4, 5, 6, and 8 knocks**. Every starting pattern is solvable.
The first room deliberately teaches the rule: knock the center window once.

- Hover or focus a window to preview the cross it would flip. Dotted frames show
  future changes; gold glass and ON/OFF labels show the current lights.
- **Hint one knock** frames and focuses a window on a shortest route. It does not
  change any lights or count a move. Make the knock when ready.
- **Show the whole quiet plan** marks a smallest set of windows in mint. Knock
  those windows in any order. The displayed plan updates after every knock.
- **Undo** retracts the last knock and its move count, including after a win.
  **Reset room** restores this room's original pattern and hides the helpers.
- **Shortest remaining** is measured from the current pattern. A detour can raise
  it; undo and hints remain available. There is no timer or failure state.
- A solved room keeps its windows quiet until undo or reset. **Next room** moves
  onward; the last room offers a return to the first. The room selector allows
  every room from the start. Switching rooms clears the attempt and hides the plan.

Keyboard: Tab into the building; arrows choose a window without wrapping;
**Home / End** choose the first / last window; **Enter / Space** knocks. The board
uses one tab stop and retains keyboard focus during play. Completing a room
focuses Next. Accessible labels identify lit/dark, suggestions, and quiet-plan
windows; hints also describe their row and column. Rows run top to bottom.

**Save postcard SVG** saves the current lights, room name, attempt count, and
shortest remaining count. It excludes hints, the quiet plan, focus, and preview
frames. Exports are generated locally. Nothing persists: reloading starts with
the first room, and no input or scores are sent elsewhere.

## Why the hint is shortest

Knocks combine by parity. Knocking the same window twice cancels, and changing
the order does not change the result. A shortest solution therefore knocks each
selected window once. The engine builds one binary equation per light and solves
it with Gaussian elimination over GF(2). It then enumerates every free-variable
combination and chooses the plan with the fewest set bits. Ties use the smallest
numeric mask, so hints are deterministic.

| Size | Rank | Free choices | Valid plans for a reachable pattern |
| --- | ---: | ---: | ---: |
| 3 × 3 | 9 | 0 | 1 |
| 4 × 4 | 12 | 4 | 16 |
| 5 × 5 | 23 | 2 | 4 |

The helper checks at most sixteen valid plans. Every window in a shortest plan
reduces the minimum remaining distance by exactly one. Some arbitrary 4 × 4 and
5 × 5 light patterns have no solution; the API returns `null` for those. All UI
rooms start reachable, and ordinary knocks keep them reachable.

`core.mjs` exports `affected(size, index)`, `knock(size, lights, index)`,
`applyPlan(size, lights, plan)`, `solve(size, lights)`, `countBits`, `ROOMS`, and
`toSVG(size, lights, { title, moves })`. Light and plan masks use up to 25 bits;
bit zero is the top-left window, proceeding across each row. `solve` returns a
minimum `mask` and `distance`, plus `rank`, `nullity`, total `solutions`, and the
number of equally `shortest` plans. Results and room definitions are frozen.
The browser keeps only the current lights and a stack of knocked indices for undo.

## Verify

```sh
node --test knockturn/test/*.test.mjs
```

Tests compare every reachable 3 × 3 and 4 × 4 board against exhaustive independent
press-pattern enumeration, and compare 5 × 5 boards with a separate complete
row-chasing solver. They check exact crosses, boundaries, pair cancellation,
commutativity, solvability, deterministic shortest ties, all room distances,
monotonically improving hints, SVG state/metadata, and invalid inputs. `npm test`
runs the cabinet, and `npm run build` includes only allowlisted browser assets.
