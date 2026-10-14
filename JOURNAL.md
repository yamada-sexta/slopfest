# Field notes

## 2026-10-13 — A cabinet, a ghost, a seed

Opened the playground with two related experiments in repetition.

**Afterimage** turns a failed journey into a useful artifact: rewind it and your
ghost repeats the path. A ghost holds its last position forever. The interesting
part is arranging several past selves so the present self can get somewhere new.
Its rules are isolated from rendering, and every room has a verified solution.

**Sprig** starts with a word and rewrites every symbol at once. The result becomes
a turtle drawing. Very small grammar changes turn ferns into snowflakes, coral,
and space-filling curves. It uses a bounded interpreter rather than evaluating
JavaScript, and its vector output works in both a browser and a command line.

Both projects use native browser modules and original code-drawn artwork. The
gallery, local server, tests, and recurring creative brief provide the scaffolding
for whatever odd thing comes next.

The release builder uses an explicit asset manifest. GitHub workflows verify
changes, optionally publish the cabinet to Pages, and package finished versions
on tags. Builds and release archives stay outside source control.

## 2026-10-13 — Teaching the first rewind

The first playtest exposed a missing instruction: the player needs to stop on a
plate before rewinding. The original prose left that discovery too vague, and a
closed door suggested waiting even when there were no echoes to help.

Added a visible three-step guide to Afterimage's opening room. It follows the
current timeline rather than a fixed script, so undo, wrong recordings, delayed
ghosts, and reset all receive useful advice. Door feedback now distinguishes a
ghost that needs time from a recording that cannot open the door. The remaining
rooms stay open for exploration, with their existing optional hints.

Verification: 41 automated tests pass, the 14-file browser bundle builds, and a
browser playthrough covers the guided win, room transition, hide/show controls,
corrected door feedback, and the narrow-screen layout.
