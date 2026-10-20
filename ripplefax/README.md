# Ripplefax

A small wave tank for sending ripples through slits, around corners, and into
each other. Draw a barrier, cut an opening, reverse a source, and watch the quiet
places move. The orange and blue surface is drawn locally from a 96 × 64 grid.

Run `npm start` at the repository root and open **http://localhost:4173/ripplefax/**.
No install, accounts, external assets, browser storage, or network service.

## Touch the water

- **Run / Pause** advances the tank. **One tick** pauses and computes one step.
- Click or drag with **Ripple** to add a small displacement. **Barrier** draws
  fixed cells; **Erase** opens them. Drawing pauses the tank. Its outer boundary
  stays closed. Barriers painted over a source silence it until erased.
- Focus the tank and use arrow keys to move the brush; hold Shift for eight-cell
  jumps. Enter applies the brush. Space runs or pauses. The cursor is shown only
  while using the keyboard and is excluded from exports.
- **Steady source** drives one or two marked cells. **Opposite second source**
  reverses the second one's sign in the twin-source scene. It is disabled when
  the scene has only one source. Existing waves remain when source settings change.
- **Wave period** spans 12–60 ticks. A longer period makes longer waves. Settings
  changes pause playback; run again to watch the new waves meet the old ones.
- **Clear waves** clears the field and tick counter, preserving barriers and
  source settings. **Reset scene** restores its barriers and default source settings.
  All scenes arrive paused after a deterministic 360-tick preparation.
- **Save PNG** downloads the current frame at 960 × 640, including source markers.
  The image is generated locally and never uploaded. Hiding the page pauses playback.

Three starting scenes explore a two-slit barrier, two equal sources, and a bent
barrier with a path around its end. Drawing uses connected single-cell barrier
strokes, so small openings are possible even on a narrow screen.

## A little discrete water

Each cell keeps its displacement for the current and previous tick. The next is
`1.982 × current − 0.982 × previous + 0.18 × laplacian(current)`, using the four
orthogonal neighbors. Barriers and outer edges stay at zero. A driven source adds
a sinusoid of amplitude 0.09 each tick. Three arrays are reused, with no frame
history. Brush ripples add a bounded displacement equally to both time states.

The grid supports reflection, spreading through openings, and superposition.
It is a damped finite-difference toy, not a calibrated fluid simulation. Source
forcing adds energy; damping removes it. Brightness is a nonlinear enhancement,
not a measurement of energy. Frame timing aims for 60 simulation ticks per second,
with at most four updates per frame; slow browsers run slower rather than catching
up in an unbounded burst. All times and periods refer to simulation ticks.

```sh
node --test ripplefax/test/*.test.mjs
```

Tests cover the stencil numerically, finite propagation, symmetry, long damped
runs, blocked and open barriers, opposite-source cancellation, covered sources,
brush limits, clear semantics, prepared scenes, and raster colors. No generated
images or PNG downloads belong in the source repository.
