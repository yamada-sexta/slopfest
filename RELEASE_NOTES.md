# Slopfest 0.7.0 — Every beginning counts

Twenty browser experiments now live in the cabinet. This checkpoint opens
Rendezvous and Bankshot in the gallery and adds Starling to the terminal labs.

- **Rendezvous** begins with an unknown machine state. Press buttons until all
  possible beginnings meet at one destination. Shortest hints search from your
  current possibilities, so manual detours work too. Four presets, custom JSON
  wiring, undo, and wrapped SVG traces are included.
- **Bankshot** lets you choose a point on a pocket atlas and follow an exact
  billiards path. Explore with the keyboard, change the table and velocity,
  and save shot or atlas SVGs. The CLI and browser share the same tracer.
- **Starling**, in the source archive, compiles lambda expressions into S, K,
  and I and follows each rewrite. Lexical scope, inert names, exact traces,
  and bounded execution make small expressions practical to explore.

Extract `slopfest-site.zip` and serve its contents over HTTP.

```sh
python3 -m http.server --bind 127.0.0.1
```

Open the address printed by the server and choose an experiment from the
gallery. All browser assets use relative URLs and work locally. The ZIP
contains only 98 explicitly approved browser assets. Use the source archive
for project instructions, tests, and terminal tools, which require Node.js
20 or newer. The CUDA experiment lists its separate hardware requirements.

All 296 Node tests pass. Rendezvous checks all 729 three-state, two-button
machines against independent word enumeration and a pair-merging oracle;
all 5,103 nonempty starting subsets also match word enumeration. Bankshot
compares 10,800 shots with a physical-step model. Starling checks reductions,
lambda scope, and Church arithmetic with independent oracles.

DOM checks exercise both new browser entries: presets, exact diagrams,
invalid drafts, undo, keyboard behavior where supported, boundary sizes,
and byte-identical SVG downloads. Exported SVGs were rendered and inspected.
A browser surface was unavailable for these additions, so their page layouts
have not had a rendered browser check.
