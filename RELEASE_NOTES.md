# Slopfest 0.5.0 — A place for every little wagon

Sixteen browser experiments now live in the cabinet. This release adds three
projects since v0.4.0 and opens Pocketyard's dispatch maker:

- **Pocketyard:** a tiny shunting puzzle with six guided dispatches, temporary
  parking, undo, exact shortest-route hints, and SVG postcards. Arrange custom
  starts and goals, deal a scramble at an exact minimum distance, and pass puzzles
  along as compact links. Invalid drafts and incoming links preserve the loaded
  yard. The first dispatch is one transfer: choose B, then A.
- **Backstitch:** weave a cellular tapestry, erase the drawing trail, then
  reconstruct it from two live rows and the rule. A browser loom and terminal CLI
  share the same reversible engine. Custom binary pairs, all 256 rules, readable
  memories, exact homecoming checks, and SVG exports are included.
- **Knockturn:** put a building to sleep with cross-toggle window knocks. Six
  rooms, undo, shortest hints, whole-plan overlays, keyboard navigation, and SVG
  postcards. The first room directly explains its one-knock center solution.

The existing games, languages, instruments, and simulations remain in the cabinet.

Extract `slopfest-site.zip` and serve its contents over HTTP:

```sh
python3 -m http.server --bind 127.0.0.1
```

Open the address printed by the server and choose a project from the gallery.
The bundle uses relative URLs and needs no accounts, external assets, tracking,
or dependency installation. Pocketyard links keep the puzzle in the address
fragment; they begin at the shared starting arrangement, with a fresh move count.
Generated media stays on your device. Orbitone uses Web Audio for live sound;
its WAV export works independently.

For READMEs, tests, and CLIs, use the source archive with Node.js 20 or newer.
Backstitch, Detour, Counterspell, and Sprig include terminal tools. CUDA name game
is source-only and additionally requires an NVIDIA GPU, the CUDA toolkit, and a
compatible C++ compiler. Machine-specific benchmark outputs are excluded.

Verification: all 241 Node tests pass. The static bundle contains exactly 81
manifest-listed browser assets. Pocketyard shortest distances and layer counts
are checked against an independent graph and synchronous relaxation over 16,536
boards, including different six-wagon goals. New checks cover exact-distance
deals, immutable histograms, canonical shared packets, invalid inputs, and zero-
transfer starts. Knockturn's minima and Backstitch's inverse laws have exhaustive
small-state checks and independent references. Browser QA covers all curated
puzzles, failed drafts/links, reloads, a 19-transfer deal, live memories, maximum
cloths, keyboard controls, SVG downloads, and desktop/phone layouts.

The site ZIP contains only the vetted browser assets. Source, tests, READMEs,
credentials, local configuration, screenshots, caches, and generated media are
excluded from it.
