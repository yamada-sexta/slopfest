# Slopfest 0.2.0 — Five ways to play

The cabinet now has five complete, local-first experiments:

- **Afterimage:** five turn-based puzzle rooms where recorded versions of your
  past self hold doors open for your present self. A guided first rewind teaches
  the recording mechanic as you play.
- **Sprig:** a small rewrite language with five specimens, a live editor, three
  palettes, and SVG export. The source also includes a command line interpreter.
- **Unspill:** a reversible ink machine. Scatter a picture and recover every pixel
  by running its rules backward. Includes painting, three pours, and SVG export.
- **Threadjar:** a tiny concurrency language. Schedule workers, reproduce a lost
  update, protect a shared jar with a key, and explore deadlocks. Inspect witness
  traces in the browser or run the checker from source at the command line.
- **Orbitone:** three independent rhythm rings with synthesized percussion. Change
  lengths, pulse counts, rotations, and mutes; save eight bars as a stereo WAV.

The browser bundle includes the gallery and all five projects, with no accounts,
tracking, external fonts, or dependency installation. Extract the release ZIP and
serve it over HTTP, for example with `python3 -m http.server --bind 127.0.0.1`.
Open the server's address in a browser, then choose an experiment from the gallery.
Each project has instructions in its source README. To use the command line tools
or run tests, use the source archive instead (`npm test`, Node.js 20 or newer).

Verification: 77 tests cover puzzle solutions, language parsing and evaluation,
reversible ink rules, reachable schedules, rhythm spacing, audio synthesis, WAV
encoding, and the portable build and server. Browser checks cover the interactive
projects and phone layouts. The release ZIP contains only 28 manifest-listed
browser assets; no build tools, dependencies, tests, local configuration, or
generated media are packaged.

Orbitone requires Web Audio for live playback. WAV export works independently.
Its eight-bar phrases include a half-second tail and may end before all three
rings realign, so they are not promised to loop seamlessly.
