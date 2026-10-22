# Looploom

Turn a tile; change a whole journey. Each square holds two quarter-circle arcs.
Neighboring ends always meet, and opposite edges of the cloth are joined. Every
thread closes, even if it travels around the entire loom before coming home.

Run `npm start` from the repository root and open **http://localhost:4173/looploom/**.
No dependencies, accounts, external assets, network services, or browser storage.

## A small change of direction

- **Turn tiles**: click a square to turn its pair of arcs. A turn can join two
  loops, split one into two, or reroute a loop without changing the count.
- **Follow a loop**: click a curve to light its whole journey. Clicking the empty
  part of a tile picks its first arc. Previous/next visits every loop; **Show all**
  restores the other colors. Colors and loop numbers are reassigned after turns.
- **Walk this loop** starts from the arc you selected. **Next stitch** and
  **Previous stitch** move a white marker through its arcs, wrapping at the start
  and end. The readout gives one-based row/column, entry and exit sides, and the
  exact return cell when an edge is crossed. Sides describe the forward trace,
  including when inspecting a previous stitch. **Restart walk** returns to the
  chosen arc. Walking changes neither tiles nor undo history; selecting another
  loop, showing all, turning, undoing, resetting, or scattering ends the walk.
- **Undo turn** recovers the previous arrangement (up to 200 turns). The cloth
  never changes itself. **Reset** returns to the selected starting cloth.
- **Scatter again** fills the current size using the next numeric seed. It and
  changing the starting cloth clear the undo history. The seed is repeatable;
  reset restores the original seed and pattern.
- **Tile grid** hides or shows the squares. **Save SVG** downloads a vector image
  with the current colors, highlight, and grid setting. It excludes the keyboard
  cursor and walking marker. Nothing is uploaded or saved in browser storage.

Focus the cloth and use arrows to move the cursor, wrapping across its edges.
Enter turns a tile. In Follow mode Enter picks its first arc, Space its second.
Space also turns a tile in Turn mode. Z undoes. Every pointer action has a keyboard
alternative; the inspector's previous/next buttons enumerate the loops.

Three starting cloths: a seeded 12 × 10 scattering, an 8 × 6 checkerboard of
24 four-arc loops, and a uniform 20 × 14 cloth with two 280-arc winding loops.
All arcs have the same length, so the inspector measures a thread in arcs.

## Where the ends go

Ports are north, east, south, west. One tile pairs north/east and south/west; its
turned form pairs north/west and east/south. Every arc has exactly two neighbors.
The tracer follows an unused arc until it returns to its starting entry port,
marks each arc once, and records its entry, exit, next cell, and signed seam
crossing, then starts the next loop. There are exactly two arcs per
tile. Coordinates wrap, making the surface a rectangular torus.

Winding counts **net** seam crossings while tracing a loop. Crossing right adds
one horizontal trip; crossing left subtracts one. Bottom/top do the same for
vertical trips. The UI reports absolute counts because traversal direction is
arbitrary. A loop can cross a seam and return without winding. This is a tiling
toy: no crossings pass over or under each other, so it is not a knot simulator.

`cloth(width, height, seed, pattern)` supports sides from 4 to 24, odd sizes too.
Its unsigned 32-bit recurrence is `s = (1664525 × s + 1013904223) mod 2^32`;
the high bit chooses each scattered tile. Turning returns an independent cloth.
Tracing and SVG export leave their input untouched.

```sh
node --test looploom/test/*.test.mjs
```

Tests compare tracing with a separate endpoint-union graph across 80 cloths,
including odd and maximum-size grids. They also verify complete arc coverage,
known loop lengths and winding counts, merge/split/reroute behavior, reversibility,
deterministic seeds, export geometry/highlights, and input bounds. Walking checks
connect every exit to the next entry, close every trace, and sum seam crossings
to the reported winding. A geometry regression checks that all quarter circles
bow inward so neighboring arcs form smooth rings.
