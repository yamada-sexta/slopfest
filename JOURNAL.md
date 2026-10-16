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

## 2026-10-14 — Every drop remembers

Added **Unspill**, a little ink machine that takes a picture apart and puts it
back together by reversing its rules. Alternating groups of four cells rotate
according to a deterministic rule. Their ink counts survive every rotation, so
the previous turn can be computed exactly without recording animation frames.

Three pours give it something to remember: overlapping puddles, the word UNDO,
and a colored border. Painting creates a new time origin; single stepping,
variable speed, keyboard painting, a comparison thumbnail, and SVG export make
the rules available to play with. The engine keeps two working grids, and the
interface keeps one origin snapshot for comparison and its explicit Restore
button. Reverse motion does not read that snapshot.

Verification: all 53 tests pass, including exhaustive colored-block inversion,
long mixed timelines, and per-color conservation. Browser checks recovered a
picture after 533 steps, exercised all three pours, mouse and keyboard painting,
single stepping, SVG download, and a phone layout. The cabinet's 19-file static
bundle includes the new project through the explicit asset manifest.

## 2026-10-15 — Who gets the next turn?

Added **Threadjar**, a tiny language and scheduling playground. Each worker has a
private pocket; jars are shared. A load, addition, and store each take a separate
turn, so two workers can both add one and leave only one marble behind. One key
protects the update; two keys acquired in opposite orders can produce a deadlock.

The explorer merges equivalent reachable states and keeps a witness trace for
each distinct ending. Inspecting a trace loads it into the same debugger used for
manual play. A bounded search explicitly reports incomplete results instead of
promising that the endings it found are exhaustive. A command-line checker uses
the same interpreter and explorer as the browser.

Verification: all 69 tests pass, including exhaustive comparison against 1,680
unmerged schedules, replay of every preset ending, lock ownership faults, parser
limits, CLI exit statuses, and an actual 12,000-state truncated search. Browser
checks reproduce the lost update and crossed-key deadlock, confirm lock blocking,
replay and undo witnesses, apply custom source, preserve a run after invalid
edits, and download a valid JSON trace. The phone layout keeps the controls
readable, and the four-project cabinet builds through its 24-file asset manifest.
