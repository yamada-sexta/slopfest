# Lumenpost

A small mirror puzzle about delivering light to postage stamps. Five postcards
teach reflection, two-color routing, shared stamps, and escaping a loop.
No timer, dependencies, accounts, external assets, or browser storage.

Run `npm start` at the repository root and open **http://localhost:4173/lumenpost/**.

## Deliver a postcard

Click a pale mirror bar to turn it between `/` and `\`. With a keyboard, Tab to
a mirror and press Enter or Space. Amber light is solid and blue light is dashed.
Stamps are labeled A (amber), B (blue), or AB (both). Light passes through stamps
and other beams; a mirror turns every beam that reaches it. Lamps are transparent
to other beams. Every stamp must receive all its required colors at once.

The first postcard takes one turn: rotate its only mirror to send the light down.
**Undo** reverses a turn. **Reset card** returns the selected card to its starting
arrangement. **A little nudge** highlights one mirror on a shortest route to a
solution and gives its row and column; it never turns the mirror for you. A hint
does not add a turn. After delivery, **Next postcard** opens the next puzzle.
You can select any card at any time, including after finishing all five.

The delivered-card count remembers successes during the current visit, even if
you undo a winning turn or reset. Switching cards starts that card fresh. Reloading
the page clears progress. There is no automatic playback or persistence.

## The little optical machine

`cards.mjs` describes rectangular boards up to 8 × 8. A/B are lamps, a/b are
single-color stamps, x needs both, `#` blocks a beam, and dots are empty. Slashes
are rotatable mirrors. Each lamp has a compass direction in the card metadata.
The engine accepts at most ten mirrors, keeping an exhaustive search to 1,024
arrangements. All shipped cards have one solution; hints minimize the number of
mirror flips from the current arrangement, not the number of clicks already made.

Each beam tracks `(column, row, outgoing direction)`. Repeating that state means
a loop; revisiting a tile in a different direction is allowed. A beam visits at
most four states per tile. Rays stop at wall or card boundaries and never mutate
the card. The two color masks accumulate independently, so a shared stamp can
receive its colors in opposite directions. This is a discrete routing puzzle,
not a physical optics simulation.

```sh
node --test lumenpost/test/*.test.mjs
```

Tests verify all mirror reflections, every card's unique solution and hint length,
color matching, transparent stamps, wall boundaries, closed loops, undo semantics,
unreachable cards, and bounded malformed input. Hints are checked from every
arrangement of a shared-stamp card, and all arrangements of the final card are
traced to verify termination.
