# Slopfest 0.6.0 — Every way to fit

Eighteen browser experiments now live in the cabinet. This checkpoint adds
Domino Index and Slydice to the gallery.

- **Domino Index** counts complete domino tilings on rectangles and boards
  with holes. Edit a board, browse with First/Previous/Next/Last, or enter an
  exact tiling number. A 10 × 20 board has 289,415,868,852,204,573,601,981
  tilings. Invalid drafts preserve the loaded picture.
- **Slydice** demonstrates dice where A beats B, B beats C, and C beats A.
  Pick the first die and the lab picks its counter. Roll one or twenty pairs,
  compare observed results with the exact pairing grid, and save the trio
  as an SVG diagram.

Extract `slopfest-site.zip` and serve its contents over HTTP.

```sh
python3 -m http.server --bind 127.0.0.1
```

Open the address printed by the server and choose an experiment from the
gallery. All browser assets use relative URLs and run locally.

The source archive also includes three recent terminal experiments.
Turnleaf folds a numbered strip and tracks its layers and faces.
Bankshot traces exact billiards paths and maps the outcome of every
integer start at a fixed velocity. Domino Index's CLI accepts custom
boards and emits exact counts and tile IDs as JSON. Run their documented
commands with Node.js 20 or newer.

The CUDA name game source includes the kernel-name investigation,
benchmark commands, and a reproduced PTXAS substring check. Its project
README lists the GPU and compiler requirements.

All 274 Node tests pass. The domino catalog agrees with an independent
enumerator on every tiling for all 4,096 hole patterns on a 3 × 4 board.
Slydice's forge agrees with a separate rank-word search across 132,181
partitions. Bankshot's exact events agree with a physical-step model on
10,800 small shots. Browser checks exercise complete small catalogs,
large-index precision, invalid drafts, keyboard controls, and phone layouts.

The downloadable site ZIP contains 89 explicitly approved browser assets.
Use the source archive for project instructions, tests, and terminal tools.
