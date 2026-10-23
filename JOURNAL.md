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

## 2026-10-18 — The optical postal service

Added **Lumenpost**, a mirror puzzle about delivering light to postage stamps.
Five postcards teach a single reflection, a route through several stamps, two
lamps sharing a mirror, stamps that need both colors, and escaping a closed loop.
The first card takes one click. Mirrors support keyboard activation, Undo retraces
a turn, and a small hint highlights one mirror without turning it for you.

The ray engine tracks tile and outgoing direction, so a crossing is distinct from
a loop. A bounded exhaustive solver finds the closest winning arrangement from
the current card. Every shipped puzzle has one solution. Solid amber and dashed
blue beams remain distinguishable where they overlap; stamps carry letter labels
as well as color. Progress is session-only, with no storage or external assets.

Verification: all 96 tests pass. New tests cover all eight mirror reflections,
unique solutions and flip counts, color masks, transparent stamps, exact wall
boundaries, crossings, closed loops, unreachable cards, and input bounds. Hints
are checked from every arrangement of a shared-stamp card. Browser playthroughs
deliver all five postcards, exercise undo and reset, check keyboard focus and
hint highlighting, and finish the loop card on a phone-sized layout. The catalog
now has six experiments and the static bundle contains 33 approved browser files.

## 2026-10-19 — A ripple takes the long way

Added **Ripplefax**, a small wave tank for drawing barriers and dropping ripples.
Three prepared scenes explore a two-slit wall, two periodic sources, and a path
around a bent barrier. A second source can reverse its sign; changing the period
lets new waves meet old ones. Single stepping, keyboard painting, and local PNG
export make the surface available to inspect as well as watch.

The engine reuses three displacement grids and applies a damped four-neighbor
stencil. Boundaries and barriers hold the surface at zero. Source forcing adds
motion, while a brush adds a bounded displacement without an initial velocity.
The display boosts small crests and troughs so transmitted waves remain visible.
Scenes arrive paused after 360 deterministic ticks. The UI describes the model
as a grid experiment, with simulation ticks and no promise of calibrated physics.

Verification: all 108 tests pass. New checks cover the exact stencil, finite
propagation, symmetry and long-run damping, wall isolation and an erased opening,
opposite-source cancellation, covered sources, connected strokes, brush limits,
prepared scenes, and raster colors. Browser checks cover run/pause, all scenes,
source and period controls, pointer and keyboard painting, erasing, clearing,
reset, single stepping, and the phone layout. A downloaded 960 × 640 PNG decodes
correctly with its barrier marks and source marker. The seven-project cabinet
builds through its explicit 37-file browser manifest.

## 2026-10-20 — Every thread comes home

Added **Looploom**, a tile loom whose two quarter-circle arcs always meet their
neighbors. Opposite edges join, so a thread can return locally or wind around
the whole cloth. Turning one square can merge, split, or reroute loops. Three
starting cloths range from 24 small rings to two 280-arc winding journeys.

The inspector isolates a complete thread and reports its arc length and net
horizontal/vertical winding. Keyboard navigation wraps too; Enter and Space
can choose either arc. Undo restores up to 200 turns. Seeded scattering, a grid
toggle, and local SVG export complete the toy. The export keeps the current
highlight and omits the keyboard cursor. No storage or external assets are used.
The root cabinet now pairs Ripplefax and Looploom in an eight-project gallery.

Verification: all 116 tests pass. The new tracer is compared against an
independent endpoint-union graph on 80 cloths, including odd and maximum-size
grids. Tests cover exact loop lengths and winding counts, complete arc coverage,
merge/split/reroute behavior, undo by inverse turns, seeded generation, SVG
geometry and highlight counts, and bounds. Browser checks cover pointer and
keyboard turns, both arc selections, undo, all three cloths, scattering, reset,
loop navigation, grid visibility, and desktop/phone layouts. An actual downloaded
SVG parses with 560 arcs, exactly 280 highlighted, and no grid or cursor. The
static bundle builds through its explicit 41-file browser manifest.

## 2026-10-21 — Walk the thread home

Added a stitch-by-stitch walker to **Looploom**. Start at the arc you chose and
move forward or backward around its loop. A white arc marks the current stitch;
the inspector reports entry/exit sides and exact destination cells across seams.
Restart returns to the chosen arc. Selecting or editing cloth ends the walk,
and walking never modifies tiles or undo history. SVG export excludes the marker.

The rendered walk exposed a drawing error in one tile's second arc: its SVG
sweep bent outward, giving four-arc loops a kink. Corrected that sweep and added
a geometry regression that reconstructs each arc's center and midpoint. Small
loops now draw as smooth circles. The traced connections and winding are unchanged.

Verification: all 120 tests pass, including every walking exit-to-entry join,
closed cycles, seam coordinates, summed winding, input immutability, marker
bounds, and export exclusion. Browser checks cross and return through a seam,
complete and reverse a four-stitch cycle, restart, select either arc, walk a
280-stitch loop, and clear the walk by editing and undoing. Desktop and phone
layouts work without horizontal overflow. A downloaded SVG has 560 arcs, 280
selected, and no walking marker. The static bundle still has 41 approved assets.

Prepared **v0.3.0 — Threads, light, and waves**, an eight-project milestone after
the five-project release. Updated release notes describe Lumenpost, Ripplefax,
Looploom, and Orbitone's hand-placed/shared scores, with offline serving
instructions. The existing release workflow tests and builds the versioned tag
before packaging only the browser manifest as a ZIP.

## 2026-10-22 — Four bytes, nothing lost

Added **Counterspell**, a terminal language for reversible spells on four byte
registers. Add, subtract, XOR, rotate, complement, swap, and multiply by odd
constants; every operation has an inverse. Nested repeats expand at compile time.
The CLI runs forward or backward, traces each state, emits JSON, and prints an
executable inverse program. Three spells mix neighbors, rotate a seating order,
and borrow a register while returning it exactly as it was.

No history is needed to uncast a spell: the inverse reverses operation order and
undoes each step using the restored source values. Forms that erase information
are rejected, including self-XOR, self-addition, and even multiplication. Source,
repeat nesting, expansion, byte values, and compiled instructions are bounded.
Runs and traces preserve independent snapshots, and no instruction evaluates code.

Verification: all 134 tests pass. The new checks exhaust all literal arithmetic
mappings and odd multipliers across every byte, every pair of byte values for
register arithmetic, all rotations, and swapped pairs. They also cover exact
results, inverse-source execution, reversing intermediate traces, repeated-block
order, resource bounds, example contracts, and the real CLI's JSON, trace, help,
errors, and file-size limit. The mixer takes 12,34,56,78 to 155,224,97,192 and
recovers the original bytes in reverse. The gallery's terminal instructions were
checked on desktop and phone layouts. Its static bundle remains 41 approved
browser assets; this source-only language ships through the repository, with no
CLI files added to the Pages manifest.
