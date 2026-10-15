# Unspill

A reversible ink machine. Scatter a picture, then recover every pixel by running
the rules backward. There is no animation frame history to replay.

Run `npm start` at the repository root and open **http://localhost:4173/unspill/**.
No dependencies, account, build step, or saved personal data. The same files work
on GitHub Pages through the root site's asset manifest.

## Play with time

1. Pick one of three starting pictures and press **Stir**.
2. Let the colors scatter, then press **Unspill**. Time runs backward to step zero
   and stops automatically when every pixel has returned.
3. Use **Step →** and **← Step** to inspect individual updates. Space pauses or
   stirs; R starts unspilling. `[` and `]` take single steps. Escape pauses.

Change the speed from 1 to 60 steps per second. **Restore this origin** resets
directly to the pictured origin; **Unspill** computes the reverse journey.
Changing the starting-picture menu starts a new experiment.

## Draw a new origin

Choose cyan, peach, violet, or the eraser, then paint on the main picture with a
mouse or touch. Painting pauses time and establishes a new origin, including the
existing ink you did not erase. Unspill recovers that newly edited picture.
Empty strokes that change no cells leave the origin and step counter untouched.

For keyboard painting, focus the picture with Tab or a click, move the brush with
the arrow keys, and press Enter. The brush outline shows its position. Use the
brush menu to change its radius. **Save SVG** downloads the current picture as a
vector drawing, whether time is paused or running. Reload restores the initial
pour; drawings are not saved to browser storage.

## The reversible rule

The world is a 96 × 64 grid with four cell values: empty and three ink colors.
Each update partitions it into 2 × 2 groups, reads each group's ink-cell count,
then rotates the entire group. Empty groups stay put. Groups with two ink cells
turn 180 degrees; other occupied groups turn 90 degrees in a direction chosen
deterministically from their coordinates and ink count. The next update offsets
the grouping by one cell in both axes. Edges wrap around.

Rotation preserves a group's ink count. In reverse, the step counter identifies
the previous grouping, and its unchanged count selects the same turn to invert.
This recovers the previous state exactly, including every color. Integer cell
permutations avoid floating-point drift.

The engine keeps two reusable grids: the current state and its working buffer.
The interface also keeps one starting snapshot for its thumbnail, comparison,
and the explicit Restore button. Reverse stepping never reads that snapshot.
Painting resets the counter because editing cannot itself be reversed by the
motion rule. This is a playful rule system, not a physical fluid model.

Run `node --test unspill/test/*.test.mjs` from the root. Tests exhaustively check
both partitions of all 256 colored 2 × 2 blocks, verify long reversals on several
world sizes, check conservation of each color, and cover editing and SVG output.
