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

## 2026-10-23 — Does a kernel know its name?

Added **CUDA name game** for a requested investigation of the `cutlass` kernel-name
heuristic. Three handwritten CUDA kernels cover a vector arithmetic control,
shared-memory matrix multiplication, and a larger register-tiled matrix multiply.
A builder compiles equal-length neutral/cutlass prefixes from the same source,
rejects any PTX difference beyond those names, then assembles and disassembles
both modules. The compiler is explicitly selectable, including Homebrew GCC.

A CUDA Driver API harness checks every output against independent CPU references,
including small random matrices, ragged edges, exact periodic timing inputs, NaN
initialization, and output guards. It warms both variants, calibrates shared
batch sizes, and alternates AB/BA order for CUDA-event timing. The analyzer
reports paired medians, variation between runs, and encoded SASS comparisons,
including control words. Source links and a reproducible workflow are in the
project README; results are scoped to the tested kernels and toolchain.

Verification included three process runs of 24 paired rounds across seven
workload/size combinations. Both names passed full output validation before and
after timing. Compute Sanitizer memcheck completed with zero errors. Three
GPU-independent analyzer tests cover invalid timing data, balanced ordering,
recomputed ratios, and machine-code comparison. The installed compiler produced
name-dependent machine code for the matrix kernels, while the vector control's
encoded instructions matched. Hardware details, timings, compiler metadata,
binaries, and logs remain in ignored local output. The existing 134 Node tests
and the explicit 41-asset static build remain separate from the GPU experiment.

## 2026-10-23 — A spell with a visible way home

Gave **Counterspell** a browser workbench and made it the ninth browser experiment
in the cabinet. Four register cards show decimal, hex, and binary values, starting
values, and the bits changed by the last move. Step forward or backward, cast or
uncast the whole spell, or scrub to an arbitrary instruction position. A compact
expanded tape follows the current instruction and its original source line;
forward and backward previews show the operations the engine will actually run.

The workbench retains the current bytes, program, inverse program, and position.
Backward travel applies inverse instructions to those bytes; the initial values
are comparison labels, never undo snapshots. The editor pauses execution while a
draft differs from the loaded spell. Loading validates source and starting bytes
before replacing the machine. Four specimens cover the existing mixer, borrowed
key, and carousel, plus an edge-of-byte tour. A pocket language guide and an
executable inverse source panel make the arithmetic inspectable and reusable.

Verification: all 141 Node tests pass, including seven new workbench tests for
nonsequential travel against independent traces, inverse execution despite a
poisoned starting label, specimen parity with CLI sources, operation explanations,
invalid inputs, immutable state, and a 4,096-step program. Browser checks cover all
four specimens, exact mixer recovery, per-step inversion, machine and slider
keyboard controls, invalid source and starting bytes preserving the loaded state,
and executing the displayed inverse as a new spell. Desktop and 390/320-pixel
phone layouts have no horizontal overflow. The gallery links to the workbench;
the static bundle now has 47 explicitly approved browser assets. No dependency
or service was added, and the CLI remains available from the source checkout.

## 2026-10-24 — A neighbor who listens

Added **Chorusfield**, a silent meadow of 72 little clocks, as the tenth browser
experiment. Nearby clocks gently pull one another's phase toward a common pace.
Three seeded clearings show a shared rhythm forming, two internally synchronized
but disconnected choirs, and independent clocks drifting without a neighbor's
pull. Change listening distance, pull, or natural speed variation; tap a light to
nudge it a quarter turn; scatter phases; or move exactly a tenth-second or ten
seconds at a time. A selected clock shows its listening circle and connections.

Clock hands, phase colors, and brightening halos make timing visible. The meter
and a bounded 30-second history measure whole-field phase agreement, with notes
explaining why two local choirs can still disagree globally. The simulation uses
fixed synchronous numerical steps: every clock reads the old field before new
phases are installed. It is a mathematical toy, with no claim to model firefly
biology. SVG stills preserve the current clocks, time, and agreement without
inspection guides. Keyboard selection and nudging accompany pointer controls.

Verification: all 151 Node tests pass. Ten new tests cover exact distance
boundaries, hand-calculated simultaneous derivatives, closed-form independent
clock motion, node-order and batch invariance, known alignment values, local
versus global choir timing, synchronization after reconnecting islands, isolated
nudges, repeatable scattering, export geometry, and invalid bounds. Browser
checks reproduce 99.9% agreement after ten seconds in the first clearing and
24.9% for disconnected choirs; widening their listening distance to 700 joins
them. Animation, paused setting edits, stepping, reset, pointer/keyboard nudges,
all presets, and the downloaded 72-clock SVG work. After forty simulated seconds,
the chart keeps 301 tenth-second samples spanning the last thirty seconds.
Desktop and 390/320-pixel phone layouts have no horizontal overflow. The gallery
links to the new project, and the build contains 51 explicitly approved assets.
No dependency, account, or service was added.

## 2026-10-25 — Every word, one small loop

Added **Wordloop**, a circular ribbon containing every possible short word exactly
once. Binary symbols, three letters, or compass directions combine with word
lengths from one through five. A suffix graph and an iterative circuit walk build
the ring, then an independent audit reads all cyclic windows to check for missing
and repeated words. The largest supported ring holds 1,024 five-symbol words in
1,024 beads. Every bead begins one word, so these circular ribbons are minimal.

Walk forward or backward, find a word, tap a bead, or take an animated lap that
returns to its starting position. The visit meter records the walk separately
from the ring's completeness proof. An enlarged straight ribbon makes overlap
and the join visible, including repeated context on tiny rings. Keyboard controls
cover stepping, the first and last positions, and walking or pausing. SVG stills
preserve every bead and the selected word. Lookup errors retain the current
window and visits; case and surrounding whitespace are normalized on valid input.

Verification: all 159 Node tests pass. Eight new tests independently enumerate the
word spaces for all three shipped alphabets and five lengths, compare every
lookup and wrapping window, test deterministic examples, catch missing/repeated
words, traverse full laps, check pointer geometry through 1,024 positions, inspect
SVG highlights, and reject invalid inputs. Browser checks confirm the default
join-crossing word `100` reads beads 8, 1, and 2; invalid lookups preserve state;
and both small and 1,024-position laps finish with all words visited, back at the
starting bead. Pointer selection, keyboard wrapping, pause/reset, all alphabets,
one-symbol words, and padded lowercase lookup work. A downloaded large SVG has
1,024 bead groups, five highlighted symbols, and the correct seam-crossing word.
Desktop and 390/320-pixel phone layouts have no horizontal overflow. The gallery
now holds eleven browser experiments, and the static build includes 55 explicitly
approved assets. No dependency or service was added.

## 2026-10-26 — Follow the pen

Returned to **Sprig** to make its drawings readable as a process. Draw replays a
specimen from a blank page; pause, step in either direction, jump to the start or
finish, or scrub through every visible mark. Each stroke and bud retains its
position in the expanded word. A small excerpt highlights the current symbol,
and the optional last-mark ring follows branch returns and nondrawing moves.
The camera stays fixed on the full drawing, so a tiny beginning does not fill
the entire screen. Keyboard controls accompany the buttons and slider.

SVG export now saves the current moment, including unfinished and empty drawings,
without the inspection ring. Complete exports remain identical to the original
serializer, and the command line still exports the whole drawing. Palette edits
retain pen position; seed and geometry changes show the new full result. Editing
pauses immediately, invalid drafts preserve the last good picture and disable
replay/export, and hiding the tab pauses playback. Prefix counts provide direct
access to any frame without storing a separate geometry snapshot for every mark.

Verification: all 167 Node tests pass. Eight new tests cover ordered interleaved
strokes and buds, silent moves, restored branches, every specimen's prefix counts
against an independent symbol scan, exact full SVG compatibility across palettes,
fixed-camera partial exports, empty words, excerpt boundaries, malformed traces,
and the 100,000-symbol and 30,000-stroke limits. Browser checks cover all five
specimens, playback and pause, keyboard and slider travel, palette retention,
generation/angle resets, and recovery from an invalid and then empty seed. A
partial downloaded SVG contains exactly one stroke and two buds with the full
viewport; a complete download matches the original serializer byte for byte.
Desktop and 390/320-pixel phone layouts fit without horizontal overflow. The
catalog describes replay, and the build includes 56 explicitly approved browser
assets. No dependency or service was added.

## 2026-10-27 — Just one more grain

Added **Crumble**, the twelfth browser experiment: a small sandpile with open
edges. A cell with four grains topples, giving one grain to each cardinal
neighbor. Drop grains, take one parallel wave, animate an avalanche, or settle
it immediately. Three postcards begin with one mountain, two heaps, and a
three-grain carpet disturbed by one extra grain. The opening pictures are
settled; replaying a pour reveals the avalanche that made them.

A second drawing layer counts every cell's topplings, with a logarithmic heat
map and exact counts at the selected cell. The receipt balances every poured
grain against what remains and what escaped. An order check starts from the
entire recorded input twice, settling the oldest ready cell first and the newest
ready cell first. Both final heights and per-cell topplings agree, even though
the queues can visit cells different numbers of times. The picture stays in
place during the comparison. Keyboard and pointer selection, paused stepping,
explicit replay/reset, and SVG postcards complete the toy.

Verification: all 178 Node tests pass. Eleven new tests check exact neighbor and
edge behavior, synchronous waves, both bulk queues against a separate random
single-topple interpreter, known postcard results, decreasing finite potential,
conservation, interleaved drops, independently owned arrays, every cell center,
SVG geometry and colors, invalid inputs, and the largest supported pour. The
first postcard finishes with 1,992 grains present and 2,104 escaped after 232,420
topplings. Browser checks reproduce all three postcards and order comparisons,
pause and complete a replay with a keyboard drop, select a corner with the
pointer, and confirm that its first topple loses exactly two grains. Downloaded
work and unfinished-grain SVGs match their engine states byte for byte. The
8,192-grain budget rejects another drop without changing counts or the drawing.
Desktop and 390/320-pixel phone layouts fit without horizontal overflow. The
gallery links to Crumble, and the build contains 60 explicitly approved assets.
No dependency or service was added.

## 2026-10-28 — Code takes the long way home

Added **Detour**, a terminal language whose program is a two-dimensional map.
A cursor walks in through a single entrance, carrying one byte. Arrows and mirrors
steer it; arithmetic changes its pocket; commas consume input bytes; dots and
colons print. A question mark turns right on zero and left otherwise. Spaces are
real track, and map edges do not wrap. Four executable examples greet, count down
through a mirrored loop, echo UTF-8 input, and repeat a small route forever.

The walker records complete future-relevant states, including the input cursor.
An exact repeat reports a cycle prefix, period, and repeating output block;
exhausting a budget reports a separate resource stop. Immutable snapshots support
human traces, structured JSON, and SVG footprints showing visited cells and the
final cursor. Raw output remains byte-exact. Source, input, output, and execution
are bounded, and SVG exports refuse to replace existing files. No source is
evaluated as JavaScript.

Verification: all 191 Node tests pass. Thirteen new tests exhaust byte arithmetic,
relative turns, and mirror directions; compare a separate velocity-vector walker
against seeded random maps and all examples; check repeated-input echo, UTF-8 and
NUL, exact silent/productive cycle witnesses, budget boundaries, independent
frozen results, SVG cell visits and escaped text, and the 100,000-step maximum.
Real CLI subprocesses verify raw bytes, traces, JSON, every exit-status category,
invalid files/options, and exclusive writes. The countdown prints `3 2 1 0 ` in
38 steps; the forever map proves a two-step prefix and six-step cycle. A generated
countdown SVG parses as 28 cells, 38 visits, and 39 route points, and its rendered
preview keeps glyphs readable above the route. The root catalog links to the
new terminal project. The static build still has 60 approved browser assets;
Detour runs directly from the source checkout. No dependency or service was added.

## 2026-10-29 — The map room

Gave **Detour** a browser workbench, making it the thirteenth browser experiment.
The cursor shows the next tile, while a byte pocket, heading, coordinates, input
cursor, and escaped output follow the recorded execution. Step, step backward,
scrub, or animate the walk. A preview explains the actual pending operation,
including why the countdown turns left with three in its pocket and right with
zero. Source, UTF-8 input, and trace budget are editable; drafts pause and disable
execution/export, and failed loads preserve the last loaded map and cursor.

At a proven repeat, loop tiles are framed and a button jumps to the matching
earlier state. The cursor, pocket, heading, and input position match while the
intervening output is retracted. Step and output limits retain their distinct
explanations. SVG can now save any trace prefix, including the ready state before
the first tile. The camera stays fixed, and complete exports remain byte-identical
to the previous CLI serializer. Browser map packets match the four executable
CLI files. The browser caps traces at 10,000 steps; the CLI still supports 100,000.

Verification: all 201 Node tests pass. Ten new checks cover specimen parity,
every frame/output/visit prefix, nonsequential backward jumps, faithful operation
previews, cycle witnesses and bounded summaries, partial SVG geometry, all stop
conditions, and failed drafts. Browser checks reproduce the 38-step countdown,
15-step greeting, 53-step UTF-8 echo, and two-step-prefix/six-step cycle. A second
map exhausts a 200-step budget, then proves its 2,048-step byte cycle with a larger
budget. The 8,192-byte output stop leaves its tile unexecuted. Oversized UTF-8
input preserves the loaded trace, a 64 × 64 map runs, and edge exits are visible.
Downloaded complete and ten-step SVGs match the engine; the partial has ten
visits, pocket two, and only the earlier `3 ` output. Desktop and 390/320-pixel
phone layouts fit, including long escaped cycle output and full input counters.

Version 0.4.0 is the release checkpoint for thirteen browser experiments and 66
explicitly approved static assets. It gathers Counterspell, Chorusfield, Wordloop,
Crumble, Detour, and Sprig's replay improvements since v0.3.0. The source checkout
retains the CLIs and CUDA project; the site archive contains only the vetted
browser bundle. No dependency or service was added.

## 2026-10-30 — A small goodnight

Added **Knockturn**, the fourteenth browser experiment: a little building of
cross-toggle windows. A knock flips its window and immediate cardinal neighbors;
edges stop the cross. Six rooms grow from a three-by-three landing to a five-by-five
building, with shortest starting routes of 1, 2, 4, 5, 6, and 8 knocks. The first
room directly explains its one-knock center solution. Undo, reset, a room selector,
and next-room controls keep the puzzle forgiving, with no timer or saved score.

Dotted frames preview a knock. Hints frame and focus a window without changing
lights; a whole-plan overlay reveals a smallest set of windows to knock in any
order. Hints are calculated from the current pattern using binary elimination
and enumeration of every valid free-variable combination, rather than a stored
walkthrough. ON/OFF text, accessible hint/plan labels, roving keyboard focus, and
arrow-key navigation accompany the mouse controls. SVG postcards save the actual
lights and counts, without helpers. Two knocks at one window cancel; undo also
reopens solved rooms.

Verification: all 209 Node tests pass. Eight new tests compare every reachable
3 × 3 and 4 × 4 board with independent exhaustive press enumeration, compare
5 × 5 boards with a separate complete row-chasing solver, and check topology,
boundaries, cancellation, commutativity, null spaces, minimum ties, improving
hints, postcard data, and invalid bounds. Browser checks complete all six rooms
with the displayed minimum plans, verify a hint changes no lights, undo a win,
wrap the final room to the first, preserve focus through keyboard knocks, and
recover from a move that raises the remaining distance. A downloaded five-by-five
postcard matches the engine byte for byte: 25 windows, 18 lit, two cancelling
knocks, and six remaining. Desktop and 390/320-pixel phone layouts have no
horizontal overflow; the narrow five-by-five targets remain over 44 pixels wide.
The gallery and root catalog include Knockturn, and the static build contains 70
explicitly approved browser assets. No dependency or service was added.

## 2026-10-31 — Every stitch came home

Added **Backstitch**, a terminal tapestry with a two-row memory. Any elementary
rule from 0 through 255 can weave a binary ring outward, then return exactly to
both starting rows. Forward evolution XORs the ordinary rule's output with the
past row; backward evolution cancels it with the same XOR. This changes the
machine into a reversible second-order automaton, rather than claiming an inverse
for an ordinary rule that discards information. The return leg receives only the
final pair and rule, with no access to the outward snapshots.

The CLI prints paired plain-text tapestries or complete JSON. SVG exports put
mint outward rows beside amber homeward rows, with time labels in opposite
orders and an exact-recovery report. Custom starting pairs, all 256 rules,
1–160-cell rings, and zero through 256 steps per leg are supported. Frozen engine
snapshots retain both rows; file exports refuse replacement. There are no runtime
dependencies, services, terminal escape sequences, or browser assets to install.

Verification: all 221 Node tests pass. Twelve new checks compare every rule with
an independent neighborhood table on every row up to seven cells, exhaust all
87,040 rule/pair combinations on rings up to four cells to prove both inverse
laws and distinct outputs, and rebuild longer journeys from serialized endpoints.
They also cover ring edges, nonzero memories, maximum bounds, frozen results,
SVG ink geometry and reversed row times, real CLI output and JSON, invalid options,
and exclusive writes. The rule-110, 79-cell, 64-step SVG was rendered and visually
inspected: its return ends at the original centered stitch. The root catalog
includes this source-checkout project; the static build retains its 70 explicitly
approved browser assets. Generated tapestries and preview images remain ignored.

## 2026-11-01 — Forget the way, keep the way home

Opened **Backstitch's browser loom**, the fifteenth experiment on the gallery
shelf. Four specimens begin 32 stitches out. Weave in either direction, take one
step, or pause; the clock is bounded by the loaded cloth depth. Mint marks form
the drawing, an amber frame follows the present, and two live memory strips sit
below the cloth. Readable binary rows are available in an inspector. The starting
pair is kept separately for the homecoming check, without entering the inverse.

The important button is **Forget the trail**. It discards every mark except the
present row, leaving both live rows unchanged. Running backward reconstructs the
missing drawing from that pair and the rule. The loom's evolution calls the same
inverse as the CLI; it never uses the drawing trail as a state log. Custom binary
pairs, all 256 rules, widths through 160, and cloth depths through 256 are editable.
Drafts pause transport and disable exports; failed loads keep the last loom intact.
Saving the visible cloth preserves its gaps and both live rows rather than
silently rendering a complete journey. The CLI's two-panel SVG stays unchanged.

Verification: all 228 Node tests pass. Seven new tests erase and reconstruct
journeys under every rule, compare different drawing histories and mixed-direction
walks, check immutable snapshots and boundaries, and exercise maximum-size cloths,
SVG ink geometry, exact live pairs, and unrecorded gaps. Browser checks bring all
four specimens home after forgetting, exercise keyboard steps and failed drafts,
and load a 160-cell, 256-step custom cloth. A downloaded forgotten-cloth SVG matches
the serializer byte for byte: time three, one recorded row, and both live memories.
Desktop and narrow phone layouts are inspected with the editor open. The root
catalog and gallery link to the loom; the static build has 75 explicitly approved
assets. No dependency, service, or persistence was added, and generated artifacts
remain ignored.

## 2026-11-02 — Little freight, a little order

Added **Pocketyard**, the sixteenth browser experiment: a toy shunting yard with
three tracks and numbered wagons. Pick a track's exposed rightmost wagon, then
choose another track with room. The wagon joins that track's right end. Small
dispatch rows beneath each track show the required order, including empty tracks.
The first puzzle explicitly teaches its one-transfer solution, B to A; the second
teaches temporary parking. Six dispatches begin 1, 3, 5, 7, 9, and 12 transfers
from home, without a timer or persistent score.

Hints mark and focus a source and mark a destination without moving anything.
They come from exact breadth-first distances over the current yard's state graph,
rather than a recorded walkthrough. Every transfer has a legal inverse; six
wagons on three three-space tracks have 7,200 arrangements. The solver caches
distances from the goal and handles detours. Undo also reopens a win. Full tracks
refuse arrivals while preserving the selection, and clicking a selected track
again cancels it. Wagon numbers, textual hints, native keyboard buttons, and a
focus jump to Next accompany the colors and outlines. SVG postcards put the
current yard beside its dispatch order, without selection or hint marks.

Verification: all 234 Node tests pass. Six new tests compare shortest distances
and returned routes for 9,336 boards against an independent array-stack graph and
synchronous distance relaxation. They also exercise every legal and illegal
transfer on all 7,200 six-wagon boards, exact inverses, conserved wagons,
unreachable tight-capacity yards, immutable results, invalid inputs, and escaped
SVG exports. Browser playthroughs complete all six dispatches using live hints;
other checks cover keyboard wins, hints that do not move wagons, undo after a win,
cancel, empty sources, full destinations, detours, and wrapping to the first room.
A downloaded postcard matches the serializer byte for byte: six wagons, two
transfers, and ten shortest remaining. Its rendered preview was inspected.
Desktop and 390/320-pixel layouts fit, with large full-track targets. The root
catalog and gallery link to Pocketyard; the build contains 80 explicitly approved
browser assets. No dependency, service, or persistence was added. Generated
postcards, screenshots, and test logs remain ignored.

## 2026-11-03 — Write the dispatch yourself

Opened **Pocketyard's dispatch maker**. Edit three starting tracks and three goal
tracks, apply a new puzzle, or copy a partially worked yard into the draft. Equal
sets of one through six distinct wagons are required, with at most three per
track. Invalid drafts leave the loaded yard and its undo history intact. Hints,
undo, reset, postcards, and the original six dispatches work with custom puzzles.
Already-arranged starts are accepted as complete with zero transfers.

A dealer chooses an arrangement from an exact shortest-distance layer, keeping
the loaded goal. Repeated deals cycle through that layer, and the goal determines
the available difficulty. The six-wagon goal split 3/3/0 reaches 19 transfers;
the 2/2/2 goal reaches 17. Frozen layer histograms and deterministic scramble
selection extend the existing exact solver without exposing its cache.

Compact versioned links carry only the starting wagons and their goal in an
address fragment. Reload opens a fresh attempt; progress, hints, drafts, and query
parameters stay out of the packet. A strict parser validates both arrangements
before changing the loaded puzzle. Invalid incoming fragments preserve an active
yard, while invalid initial links fall back to the first dispatch with an error.
Custom apply/deal actions update the address, and guided dispatches clear it.

Verification: all 241 Node tests pass. Seven new maker tests cover exact layers,
deterministic cycles, the 19-transfer extreme, tiny and disconnected yards,
immutable histograms, curated puzzle round-trips, zero-transfer starts, partial
positions, malformed/oversized/future links, and input bounds. Existing independent
graph checks now cover 16,536 boards, including a second six-wagon goal layout,
and compare complete distance histograms as well as returned shortest routes.
Browser checks exercise failed drafts and links, shared reloads, custom hints and
undo, two distinct 19-transfer deals, changing goal-dependent maxima, single-wagon
and already-ordered puzzles, query-free share URLs, and 390/320-pixel layouts.

Version 0.5.0 is the checkpoint for sixteen browser experiments and 81 explicitly
approved static assets. It gathers Knockturn, Backstitch's CLI and browser loom,
and Pocketyard with its dispatch maker since v0.4.0. The root catalog, gallery,
project instructions, and release notes describe the finished behavior. No new
dependency, service, storage, or machine configuration was added; generated
artifacts remain ignored.

## 2026-11-04 — A little paper, taking sides

Added **Turnleaf**, a terminal paper-folding lab. Start with a strip of numbered
panels, then fold its left half over its right or its right half over its left.
The moving half lands on top, reversing both its cell order and layer order and
flipping every face. The model keeps immutable frames with each original panel's
identity and upward-facing side. Widths from one through 64 panels are supported,
in powers of two. Complete half-folds halve the width and double the layer count.

The CLI prints final packets from top to bottom, optionally traces every fold,
emits structured JSON, locates an original panel, and saves an SVG diagram with
a single-panel highlight. SVG columns read left to right and layers read down;
front-up layers are gold and back-up layers are mint. The default 16-panel `LRR`
strip becomes two eight-layer packets, with panel 1 six layers down in the first.
Exports refuse to replace files. The model ignores crease thickness, and IDs on
back-facing layers remain annotations to the original numbered strip.

Verification: all 251 Node tests pass. Ten new tests check all 247 valid fold
words across the supported widths against a separate per-panel coordinate model,
reflecting x, height z, and orientation rather than constructing stacks. They
also check hand-folded fixtures, left/right mirror symmetry, conserved panels,
every trace prefix, exact lookup depths, immutable results, SVG layer order and
highlights, input limits, real CLI text/JSON, and exclusive file writes. A rendered
SVG of the default fold was visually inspected, including the highlighted lookup.
The root catalog links to the new source-checkout project. The browser bundle
retains its 81 approved assets; terminal code, diagrams, previews, and test logs
stay outside it. No dependency or service was added, and generated artifacts
remain ignored.

## 2026-11-06 — The advantage of choosing second

Added **Slydice**, a terminal lab for nontransitive dice. Its default trio has
A beating B, B beating C, and C beating A, each on five of nine equally likely
face pairings. All three dice have the same mean. Pick any die first and the lab
can name another with an advantage against it. Exact integer counts explain
the result; there is no random sampling or dependence on a lucky trial.

The forge exhaustively divides consecutive integers among three dice of three,
four, or five faces. It visits each partition once, ignoring face order and die
names, tests both possible cycle directions, and maximizes the weakest winning
edge. Among 280, 5,775, and 126,126 partitions, respectively, it finds 5, 13, and
1,732 cycles. The best weakest edges are 5/9, 9/16, and 15/25. Only three
five-face partitions reach the last score. These are finite partition results;
custom dice with repeated labels belong to a broader problem.

The CLI also accepts three custom dice with up to eight faces apiece, labels
0–99, repeats, and ties. It sorts copied faces, reports a complete win matrix,
finds the strongest strict-majority counterpick, and explains when none exists.
Ties remain in the denominator and are never rerolled. JSON retains exact counts,
search histograms, and recommendations. Immutable engine results protect cached
searches. SVG postcards show every face pairing, including separate rows for
repeated labels, with wins, losses, and ties distinguished by color. Exports
refuse overwrites, and invalid inputs are checked before writing.

Verification: all 261 Node tests pass. Ten new tests include a separate rank-word
oracle that checks all 132,181 supported partitions and their full histograms,
optimal scores, and optimal-set counts. A frequency-based oracle checks 1,521
pairs of small dice, including unequal lengths and repeated faces. Other checks
cover both cycle directions, exact-half ties, counterpick tie-breaking, mean
comparisons, immutable results, all SVG cells, malformed input, real CLI output,
JSON, and exclusive file writes. Rendered default, five-face, and eight-face
diagrams were visually inspected. The root catalog and project instructions are
updated. The vetted browser build retains 81 assets; this source-checkout toy,
generated diagrams, preview images, and test logs stay outside it. No dependency,
service, or machine configuration was added.

## 2026-11-07 — A seat at the dice table

Opened **Slydice's browser table**. Pick A, B, or C for the first seat and
the shared engine picks its counter for the second. The three forged sets have
three, four, or five faces per die. Their pairing grids spell out the winner
of every possible roll and report exact counterpick odds. A forge receipt gives
the partition and cycle counts for the selected set.

Roll one pair or a batch of twenty to compare the observed win rate with the
exact probability. An outline follows the latest pair to its square. Changing
the set or first pick clears the tally. Selecting the same die keeps the
current tally, and clearing it returns keyboard focus to the roll button.
The trio SVG saves all three matchups for the selected set. The terminal
command still accepts custom dice and reports exact counts for them.

All 261 Node tests passed. Browser checks covered every cell in all nine
matchups, keyboard selection, single rolls and batches, tally resets,
gallery navigation, and layout at 320, 390, 768, and 1280 pixels. The browser
SVG download matched the five-face engine export byte for byte. The vetted
build now contains 85 assets and the gallery has 17 browser experiments.

## 2026-11-08 — A kernel by any other name

Expanded **CUDA name game** into a reproducible naming and compiler-flag
investigation. Four equal-length name prefixes cross five ptxas policies, with
normalized-identical PTX. Six FP32 task families cover vectors, stencil,
reduction, FMA chains, shared-tiled GEMM, and register-tiled GEMM. A second suite
adds native FP16, BF16, signed INT8, and packed signed INT4 WMMA GEMM at five sizes
through 4096. The RTX 3060 Ti and second RTX 2060 system use the same CUDA 13.2.86
device compiler; Turing explicitly excludes unsupported BF16 WMMA.

Collected ten fresh graph-timing processes and five independent-order direct
confirmation processes per GPU/suite: 61 cases, 366,000 batch measurements,
132,912,000 logical timed kernel executions. Processes remain the replication
units. Balanced timing positions, multiple unrelated-name controls, telemetry,
whole-process uncertainty, correction across the four primary cohorts, full
process ranges, and equivalent-code policy comparisons keep small means from
becoming sweeping claims. No timing outliers were removed.

The name-sensitive code path is real, and its runtime effect is conditional.
The most repeatable gains on Ampere are register GEMM at all three tested sizes
(about 8–10%) and INT4 N=4096 (about 5–7%), across all O3 policies and both methods.
Small INT4 regresses about 10–14%. Other default-O3 INT4 sizes can improve, but
some equivalent-policy module pairs lose individual processes. Turing has no
comparably robust useful win; its small tiled-GEMM effects vary by method and
have limited confirmation precision. Expensive-optimization flags do not change
the code here; O2 suppresses the naming path. The findings record exact task,
format, dimensions, flags, hardware, and measurement scope rather than a general
promise about renaming CUDA kernels.

Correctness checks every output and guard, including random ragged matrices and
all timed sizes. Separate actual graph-output tests clobber host argument slots
before replay and reuse the CPU oracles. All four graph checks and both GPUs'
memory checks pass. All 80 cubins match clean rebuilds; all 1,830 contrast and
per-process estimates independently match raw-data recomputation. Six host-tool
tests, exhaustive signed-code/floating packing round-trips, all 261 existing Node
tests, and the vetted 85-asset build pass. Final graph/direct figures were rendered
and inspected on common axes. The independent review is recorded in the project.

Raw machine evidence, executable builds, figures, and temporary remote state stay
outside source control; no address or account detail is committed. The root
catalog and project README point to the reusable commands, findings, and
investigation record. No dependency, hosting change, or release artifact was added.

## 2026-11-08 — One ball, four rails

Added **Bankshot**, a terminal billiards toy with a pocket in each corner.
Give the ball an integer start and velocity. The shot traces fractional
wall hits until it reaches a corner or returns to the same place with the
same heading. On the default table, moving the start from (3, 2) to (4, 2)
turns a ten-bank loop into a three-bank shot to the north-east pocket.

The tracer unfolds the rails into reflected copies of the table. A common
integer tick scale makes both sets of wall crossings exact, and a simultaneous
crossing marks a pocket. The first common repeat of the moving axes bounds
the trace. The CLI prints reduced fractions or writes the full trace as JSON.
SVG diagrams mark the starting leg in gold and the terminal pocket in coral.

All 266 Node tests and the 85-asset build passed. A separate physical-step
model agreed with the return period and every recorded event on 10,800 small
shots. Tests also cover dense paths, invalid input, and exclusive SVG writes.
The default loop and pocket diagrams were rendered and visually checked.

## 2026-11-09 — The pocket atlas

Bankshot can now survey every integer start at a fixed velocity. The terminal
grid labels each start with a corner or a full return. JSON preserves exact
times and bank counts, and the SVG shows the same data in tile tooltips.
A coordinate from the atlas can go straight into the single-shot tracer.

The default velocity pockets 14 of 88 starts. Every odd X column loops
because its vertical rail crossings occur halfway between integer times
and its horizontal rail crossings occur at integer times. Changing velocity
or table dimensions makes different stripes and diagonals appear.

All 270 Node tests and the 85-asset build passed. Checks cover all four
pocket labels, mirroring both axes, speed scaling, a 529-start map, and
CLI export. The default and largest atlases were rendered and inspected.

## 2026-11-10 — Open any domino tiling

Domino Index counts complete tilings of rectangles and boards with holes.
Pick a number to draw that tiling in the terminal. The default 4 × 4 board
has 36 tilings, and the ring around four holes has two. JSON includes
matching tile IDs and preserves counts and indices as decimal strings.

A row-width occupancy mask tracks where earlier dominoes reach into
unprocessed squares. Counts for the remaining branches let the index
skip entire groups of tilings. It can jump directly to the last of
289,415,868,852,204,573,601,981 tilings on a 10 × 20 board.

All 274 Node tests and the 85-asset build passed. A separate enumerator
agreed on every tiling for all 4,096 hole patterns on a 3 × 4 board.
An independent row transfer calculation reproduced the 10 × 20 count.


## 2026-11-10 — Find the compiler’s name check

Located the actual lowercase `cutlass` substring predicate inside the inspected
PTXAS 13.2.86 executable. Disassembly connects the literal to a `strstr` call
and a boolean result; GDB observes the kernel-name arguments and results during
compilation. A small hash-checked command reproduces this with four names,
including an interior match and an uppercase control. The inspection runs no
GPU kernels and leaves the installed compiler unchanged on disk.

The report separates that confirmed predicate from unknown pass internals and
unsupported option mappings. Original performance CSVs were recounted to clarify
300 timed batches per name/policy/case across 15 fresh processes, with primary
and confirmation inference kept separate. Machine-specific evidence stays local.

Verification: static inspection, four actual debugger observations, rejection of
an unknown compiler hash, and an unchanged compiler file hash all pass. The
independent reviewer reproduced the evidence and raw counts without material
corrections. All 274 Node tests and the 85-asset static build passed.

## 2026-11-11 — Browse every way to fit

Opened Domino Index's browser catalog. Choose a rectangle or write a
board with holes, then browse its tilings or jump to an exact number.
The 10 × 20 preset accepts every digit of its 24-digit final index.
Invalid board and index drafts preserve the loaded picture. Impossible
boards display open squares and holes, and all-hole boards have a single
empty tiling.

All 274 Node tests passed. Browser checks covered every one of the 36
small-board layouts, preset counts, neighboring large indices, first/last
boundaries, invalid drafts, keyboard controls, empty and impossible boards,
gallery navigation, and layouts down to 320 pixels.

Version 0.6.0 collects eighteen browser experiments and 89 approved static
assets. It brings Slydice and Domino Index into the downloadable gallery,
with Turnleaf and Bankshot available through the source archive. Release
notes and project instructions describe how to run the finished catalog.
