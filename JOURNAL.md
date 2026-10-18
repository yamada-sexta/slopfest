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

## 2026-10-16 — Three clocks walk into a room

Added **Orbitone**, a rhythm instrument with three independently wrapping rings.
Distribute pulses evenly, rotate them, and give each ring a different length.
Thump, glass, and dust voices are synthesized from decaying waves and fixed-seed
noise. Audio-clock scheduling drives playback; the drawing follows that clock.
Ring edits stop playback cleanly, and hiding the page stops its clocks as well.

Three arrangements are included. The WAV renderer uses the same voice samples as
live playback and exports eight bars from the beginning with current mutes and
volume, followed by a short sound tail. The UI explains that the phrase boundary
does not necessarily coincide with the rings' common period.

Verification: all 77 tests pass, including exhaustive supported pulse counts and
rotations, least common periods, event timing, synthesis bounds, PCM headers,
duration, rotated pulse onsets, silent exports, and dense-pattern headroom.
Browser checks cover playback and stop, presets, keyboard slider bounds, muting,
edit-stop behavior, downloaded WAV data, and a phone layout. The cabinet now
ships 28 explicitly listed browser files.

Prepared **v0.2.0 — Five ways to play**, the five-experiment cabinet milestone.
The release workflow retests and rebuilds before packaging only the vetted static
bundle. Project instructions and CLI tools remain available in the source archive.

## 2026-10-17 — A rhythm with handwriting

Deepened **Orbitone** with hand-placed pulses and shareable arrangement links.
Each voice has a numbered step editor that follows the visible ring, including
rotation. Buttons retain focus while editing. Resizing preserves the unrotated
prefix and pads with quiet steps; Space evenly restores a generated rhythm at
the current pulse count. Hand edits stop playback just like the existing sliders.

The share button encodes the complete musical arrangement in a compact versioned
URL fragment. It includes custom masks, tempo, rotations, and mutes, while volume
stays local and loading never starts playback. A read-only field supports manual
copying. Invalid links preserve the current composition, and browser history can
revisit linked scores. There is no storage, account, or sharing service.

Verification: all 83 tests pass. New cases check toggling at every supported
rotation, resizing, preset round trips, 480 custom mask round trips, malformed
and inconsistent encodings, and restored WAV onsets. Browser checks cover keyboard
focus, edit-stop behavior, copying and reopening a score, invalid-link recovery,
history navigation, sixteen-step phone controls, and even-spacing reset. A WAV
downloaded from the browser matches the linked custom score byte for byte.
