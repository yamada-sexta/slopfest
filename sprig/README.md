# Sprig

A tiny deterministic language for growing vector drawings. It is an L-system
playground: rewrite every symbol simultaneously for several generations, then
interpret the final word as a turtle path. The five specimens include a fern,
coral, Koch snowflake, Hilbert curve, and Heighway dragon.

Run `npm start` from the repository root and visit **http://localhost:4173/sprig/**.
Edit a seed packet, change its generation or angle, switch palettes, and save an
SVG. Text stays in the current tab; reload restores the original specimen.

## Follow the pen

The workbench opens with the complete drawing. **Draw** replays it from a blank
page; press it again to pause. **Start**, **Back**, **Step**, **All marks**, and
the progress slider let you inspect any moment. One step draws one stroke (`F`)
or one bud (`.`). Silent letters, moves, turns, and branch returns happen between
marks, so the pen can jump across the page. The highlighted symbol belongs to the
**expanded word**, after rewriting, rather than a line of the seed packet.

The camera always fits the full drawing. **Show last mark** adds an inspection
ring that stays the same size on screen. Focus the drawing to use **← / →** for
one mark, **Home / End** for start and finish, and **Space** to play or pause.
Long drawings replay in roughly twelve seconds; small ones draw four marks per
second. Hiding the tab pauses playback.

**Save SVG** saves the marks currently visible, including a blank or unfinished
drawing, with the full drawing's viewport and without the inspection ring.
Changing the palette retains your position. Changing the seed, generation,
angle, or specimen shows the new complete drawing. Editing pauses the pen
immediately; an error keeps the last good picture and disables replay and export
until the seed is valid again. The canvas preview and SVG export use the same
geometry, colors, and line sizes. The command line always exports the full drawing.

```sprig
# A seed packet
seed X
angle 25
depth 6
step 5

rule X -> F[+X][-X]FX.
rule F -> FF
```

| Instruction | Meaning |
| --- | --- |
| `seed WORD` | Required starting word, with no spaces. |
| `rule X -> WORD` | Replace one uppercase symbol with a word; an empty word deletes it. |
| `depth N` | Generations, integer 0–8. Default 5. |
| `angle N` | Turning angle in degrees, 0–180. Default 25. |
| `step N` | Forward distance, greater than 0 and at most 50. Default 8. |
| `# comment` | The rest of the line is a comment. |

`F` draws forward, `M` moves without drawing, `.` places a bud, `+` turns right,
`-` turns left, and `|` turns around. `[` saves position and heading; `]` restores
them. Other uppercase letters are silent drawing symbols, useful as rewrite
variables. Seeds and rule replacements must each have balanced brackets.

Settings and rules cannot be duplicated. Whitespace within words, arbitrary code,
and unknown instructions are errors. Expansion is bounded to 100,000 symbols and
30,000 strokes; oversized plants produce an error while the editor preserves the
last successful drawing. Generated SVG contains numeric geometry and fixed colors.

## Command line

```sh
mkdir -p .local
node sprig/cli.mjs sprig/examples/fern.sprig .local/fern.svg
node sprig/cli.mjs sprig/examples/snowflake.sprig > .local/snowflake.svg
```

The optional second argument is an output path. Without it, SVG goes to stdout.
Errors go to stderr with a nonzero exit status. There are no third-party packages.
Run `node --test sprig/test/*.test.mjs` from the root to check parsing, parallel
rewriting, branching, geometry, output, growth limits, ordered replay, fixed-camera
partial SVGs, and expanded-word excerpts.
