# Slopfest 0.3.0 — Threads, light, and waves

Eight complete experiments now live in the cabinet. Three join this release:

- **Lumenpost:** five light-routing postcards. Turn mirrors to deliver both
  lamps to their stamps, with undo and hints that find a shortest route.
- **Ripplefax:** a wave tank with three prepared scenes, barrier painting,
  opposite sources, single stepping, keyboard controls, and local PNG export.
- **Looploom:** turn tiles to join or split closed threads on a cloth whose
  opposite edges meet. Follow a loop, walk it stitch by stitch across the seams,
  undo turns, scatter a new cloth, and save the artwork as SVG. Quarter-circle
  geometry now forms smooth rings in both the browser and exported artwork.

**Orbitone** also gains hand-placed rhythm pulses and shareable arrangement links.
Afterimage, Sprig, Unspill, and Threadjar remain in the cabinet, with their puzzle
rooms, growing drawings, reversible ink, and tiny concurrency language.

Extract `slopfest-site.zip` and serve its contents over HTTP, for example:

```sh
python3 -m http.server --bind 127.0.0.1
```

Open the address printed by the server and choose a project from the gallery.
The bundle uses relative URLs and needs no accounts, external assets, tracking,
or dependency installation. Orbitone uses Web Audio for live sound; WAV export
works independently and is not promised to produce seamless loops. Nothing else
requires audio. To read project instructions, use the command line tools, or run
checks, use the source archive: each directory has a README, and `npm test` runs
with Node.js 20 or newer.

Verification: all 120 tests pass and the portable static build contains exactly
41 manifest-listed browser assets. New checks verify walking trace continuity,
seam destinations and winding, marker bounds and export exclusion, and the
quarter-circle geometry. Browser checks exercise the walker, complete a small
seam loop in both directions, inspect a long winding loop, verify editing clears
the walk, and check desktop and phone layouts. A downloaded SVG retains its
selected thread and excludes the walking marker. Build tools, tests, source
READMEs, local configuration, screenshots, and generated media are not packaged.
