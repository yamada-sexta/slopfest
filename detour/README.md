# Detour

A tiny language whose program is a map. A cursor enters at `@`, carrying one
byte, and walks east. Arrows and mirrors steer it. Arithmetic changes its pocket;
commas read bytes, dots print them, and a question mark chooses a turn. Each
visited tile is a step, including spaces. Code takes the long way home.

Use the browser map room or the terminal CLI with Node.js 20 or newer.
There are no dependencies or external services.

## Follow the map

From the repository root, run `npm start` and open **http://localhost:4173/detour/**.
Four map packets preserve the executable CLI examples. The countdown opens with
its cursor at the entrance. **Step** executes one tile; **Back** restores the
previous recorded state and retracts its output. **Walk** follows the trace,
**Start** returns to the entrance, **To end** reveals the final state, and the
step slider can inspect any moment. At the end, Walk replays from the beginning.

The orange box and arrow mark the next tile and travel direction. The pocket
appears in decimal, binary, and hexadecimal, beside coordinates and consumed
input bytes. The next-tile preview explains the actual pending operation, including
which way a question mark will turn. Output uses the same escaped-byte notation
as the human CLI summary; incomplete UTF-8 is shown as bytes rather than guessed
characters. Input text is encoded as UTF-8 when loaded.

Edit source, input, or the trace budget, then **Load map & restart**. Any edit
pauses and disables execution and export immediately. Failed loads preserve the
last good map and cursor until a valid draft is loaded. **Restore** reloads the
selected packet and its original input; the chosen budget stays in place. Nothing
is stored locally or uploaded. Focus the drawing for **Left / Right**, **Home /
End**, and **Space** to step, jump, and walk or pause. Hiding the page pauses a walk.

At a proven cycle's endpoint, purple frames mark tiles in the repeat and a proof
panel identifies the matching earlier state. **Show matching earlier state**
jumps to it, preserving the same cursor, pocket, direction, and input cursor while
retracting the intervening output. A budget endpoint explicitly says no loop has
been proved. The browser records at most 10,000 steps, with a default of 2,000;
the CLI and engine retain their larger limits. Playback takes roughly twenty
seconds for long traces and five tiles per second for short ones.

**Save this SVG** exports the current trace prefix with its cursor and output,
including the ready state before the entrance executes. The full map and camera
stay fixed across exports. Full-run exports retain the CLI's original format.
The workbench's Back button restores trace snapshots: byte arithmetic and input
reads are not reversible instructions.

## Take a walk

From the repository root:

```sh
node detour/cli.mjs detour/examples/hello.tour
node detour/cli.mjs detour/examples/countdown.tour --trace
node detour/cli.mjs detour/examples/echo.tour --input 'take the scenic route' --raw
```

The first prints `HI!`. The second takes **38 steps** and prints `3 2 1 0 `,
including the spaces. The third writes its input bytes unchanged, without a
summary or extra newline. Human summaries escape control bytes and non-ASCII
bytes; use `--raw` for the actual byte stream.

The countdown is a four-row map. Its second row is deliberately blank:

```text
   /:-\

@3:>  ?
      #
```

The cursor loads 3 and prints it. At `?`, a nonzero pocket turns left, toward
the upper mirror. Traveling west, it subtracts one, prints the result, and returns
to the question. With zero in its pocket it turns right instead, into `#`.
Maps have no comments or string literals; keep explanations in a separate file.

## The tiles

| Tile | What happens before moving one cell |
| --- | --- |
| `@` | The single entrance. Start here facing east, with byte 0. Later visits do nothing. |
| space | Keep walking. Ragged rows are padded with spaces. |
| `>` `v` `<` `^` | Set direction to east, south, west, or north. |
| `/` | Reflect: east ↔ north, west ↔ south. |
| `\` | Reflect: east ↔ south, west ↔ north. |
| `0` … `9` | Load that one digit into the pocket. `12` loads 1, then loads 2. |
| `+` `-` | Add or subtract one, wrapping modulo 256. |
| `*` | Double the byte, modulo 256. |
| `?` | Turn right if the byte is zero; otherwise turn left. Directions are relative to travel. |
| `,` | Consume one input byte. At end of input, load zero without advancing the input position. |
| `.` | Emit the pocket byte unchanged. |
| `:` | Emit its decimal value followed by one ASCII space. |
| `#` | Halt here without moving. This tile still counts as a step. |

For example, `9***` makes 72, the ASCII code for H. `-` on zero makes 255.
The cursor can also leave any edge of the map; that ends execution with status
`escaped`. Edges never wrap. The echo example treats the first zero byte as an
end marker, so embedded NUL input stops it even if more bytes follow. UTF-8 text
without NUL round-trips through that example byte for byte.

CRLF files work. One final newline is ignored; other blank rows are real space.
Tabs, unknown symbols, and multiple or missing entrances are errors. A map is at
most 64 × 64 cells and 8,192 ASCII source characters/bytes. File and engine limits
are checked separately. Input is at most 1,024 bytes, after UTF-8 encoding.

## Loops that leave footprints

```sh
node detour/cli.mjs detour/examples/forever.tour --json
```

This map would print `0 ` forever. Detour executes one complete repeating cycle
and stops with exit code **2**, reporting a two-step prefix and a six-step cycle.
Cycle detection compares the full future-relevant state: position, direction,
pocket, and input cursor. Output is append-only and cannot affect execution.
Equal input bytes at different input positions are different states.

The result contains the output produced so far. `cycle.outputAt` divides that
output into a nonrepeating prefix and one complete repeating block;
`cycle.output` gives the block explicitly. `cycle.start` is the number of steps
before the cycle, so a start of 2 means the first cycle tile is step 3 in the trace.
This is an exact repeated-state witness, including silent cycles.

The CLI and engine default step budget is 20,000. `--steps N` accepts 1–100,000. Reaching the
budget gives `step-limit`, **not** a claim that the map loops. At most 8,192 output
bytes may be emitted. If the next tile would exceed that limit, `output-limit`
stops **before** that tile executes; decimal emissions are never cut in half.
A proven repeat at a step-budget boundary takes precedence over the budget stop.

## Keep the route

```sh
mkdir -p .local
node detour/cli.mjs detour/examples/countdown.tour --svg .local/countdown-route.svg
```

The SVG shows every padded code cell, visited cells, the full route, and a ring
at the final cursor. It includes status, pocket, step count, and a bounded escaped
output preview. Source glyphs and output are XML-escaped. Exports are inert vector
drawings and never embed input text separately. `--svg` refuses to replace an
existing file; choose another name for a new run.

`--trace` prints every executed tile, before/after cursor and byte, input position,
and emitted bytes. Coordinates in the human trace are one-based. `--json` emits
machine-readable results; add `--trace` to include history. Engine cursor coordinates
are zero-based, and directions are east=0, south=1, west=2, north=3. `--raw` cannot
be combined with `--trace` or `--json`; it can accompany an SVG export.

Options may precede or follow the map path. `--help` works alone. Successful
halts and edge exits use status 0, cycles and resource stops use status 2, and
invalid options, source, or I/O use status 1. Diagnostics go to stderr; JSON and
raw modes keep stdout clean. Ordinary summaries describe the stop and show an
escaped output string.

## Use the walker

```js
import { parse, run, encodeInput, toSVG } from './detour/core.mjs';
const map = parse('@9***.+.4***+.#');
const result = run(map, { input: encodeInput(''), trace: true });
// result.output is [72, 73, 33]; result.status is 'halted'.
const drawing = toSVG(map, result);
const beginning = toSVG(map, result, { position: 3 }); // First three executed tiles.
```

`initial(map)` returns the entry cursor. `advance(map, cursor, inputBytes)` executes
one tile and returns the next cursor, emitted bytes, and any terminal status.
`run` copies input bytes, freezes its output and trace snapshots, and leaves the
map and caller's input unchanged. Parsed maps are immutable; use `parse` rather
than constructing or mutating compiled objects. SVG export requires a traced run
of that exact map. Its optional `position` selects a recorded prefix, defaulting
to the full run. No source is evaluated as JavaScript.

## Verification

```sh
node --test detour/test/*.test.mjs
```

The tests exhaust arithmetic, turns, and mirrors over all bytes and directions;
compare a separate vector-based interpreter against seeded random maps and all
examples; check repeated-input echo, UTF-8 and NUL behavior, exact cycle witnesses,
budget boundaries, immutability, exported visits/routes/XML escaping, and maximum
step/output/input bounds. Real CLI subprocesses verify raw bytes, human and JSON
traces, all exit statuses, invalid flags/files, and exclusive SVG writes.
`npm test` includes these checks in the cabinet. `npm run build` still packages
the allowlisted browser assets, including the map room. The CLI remains available
from the source checkout. Workbench tests cover every frame, output prefix, visit
count, branch preview, cycle jump, and partial SVG, plus malformed drafts and all
stop conditions. Browser specimens are checked against the CLI source files.
