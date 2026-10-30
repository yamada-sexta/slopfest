# Slopfest 0.4.0 — Code takes a walk

Thirteen browser experiments now live in the cabinet. This release completes
Detour's map room and gathers five additions since v0.3.0:

- **Detour:** run a map of arrows and mirrors with one byte in your pocket.
  Step forward or backward, follow the cursor, inspect actual branch decisions,
  edit input, distinguish proven loops from budget stops, and export any recorded
  moment as SVG. The same walker powers the source checkout's CLI.
- **Crumble:** an open-edge sandpile. Drop grains, animate parallel waves, inspect
  the toppling heat map, and compare oldest-first and newest-first avalanches.
- **Wordloop:** a minimal circular ribbon containing every possible short word
  exactly once. Walk, look up words, inspect the join, and save SVG rings.
- **Chorusfield:** a meadow of coupled clocks. Nudge a light, change who it hears,
  and watch one chorus or disconnected choirs find their timing.
- **Counterspell:** a reversible four-byte language, with a browser workbench,
  instruction stepping in either direction, generated inverse spells, and a CLI.

**Sprig** gains drawing replay, stroke/bud stepping, expanded-symbol inspection,
and unfinished SVG exports with a fixed camera. Existing games, instruments,
puzzles, and simulations remain in the cabinet.

Extract `slopfest-site.zip` and serve its contents over HTTP:

```sh
python3 -m http.server --bind 127.0.0.1
```

Open the address printed by the server and choose a project from the gallery.
The portable bundle uses relative URLs and needs no accounts, external assets,
tracking, or dependency installation. Orbitone uses Web Audio for live sound;
its WAV export works independently. Generated media stays on your device.

For project READMEs, CLI tools, and tests, use the source archive with Node.js 20
or newer. Detour and Counterspell include executable examples. CUDA name game is
source-only and additionally requires an NVIDIA GPU, the CUDA toolkit, and a
compatible C++ compiler; benchmark outputs are excluded from this release.

Verification: all 201 Node tests pass. The static build contains exactly 66
manifest-listed browser assets. Detour workbench checks compare every cursor,
byte prefix, and visit count against direct execution; test all stop conditions,
cycle jumps, malformed drafts, and partial SVGs; and preserve the CLI examples.
Browser checks cover both countdown branches, backward travel, playback/pause,
UTF-8 input, exact cycle witnesses, error recovery, maximum map size, step/output
limits, downloaded SVGs, and desktop/phone layouts. Source, tests, READMEs, local
configuration, screenshots, caches, and generated exports are not in the site ZIP.
