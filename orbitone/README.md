# Orbitone

Three rhythm rings, each with its own way home. Every shared eighth-note tick
advances all three pointers by one step. A bright dot makes a sound; a gap stays
quiet. Rings of different lengths drift against each other before realigning.

Run `npm start` at the repository root and open **http://localhost:4173/orbitone/**.
No install, accounts, recordings, external requests, or browser storage are needed.

## Play

- Press **Play** to start all rings at step zero. **Stop** returns to the beginning.
  Start with a low device volume. Sound starts only after pressing Play.
- **Steps** sets a ring's length, **Pulses** distributes hits around it, and
  **Rotate** shifts those hits clockwise. A zero-pulse ring is silent.
- Open **Place pulses by hand** under any voice and toggle the numbered steps.
  These buttons also work with Tab and Enter or Space. Their bright state matches
  the ring's visible steps, including its rotation. Hand edits keep keyboard focus.
- **Space evenly**, or moving the **Pulses** slider, returns that voice to even
  spacing using its current pulse count. Rotating a hand-placed pattern preserves
  its gaps. Resizing keeps its unrotated prefix, adds quiet steps when growing,
  and adjusts the pulse count and rotation to fit.
- **Mute** silences one voice while its pointer keeps moving. **Volume** changes
  playback and export volume. Other edits stop playback to avoid mixed schedules.
- Three arrangements give you starting points: Odd company (8/7/5 steps),
  Evening train (8/8/16), and Slow moons (5/9/13).
- The pointer realignment count is the least common multiple of all three ring
  lengths, including muted rings. Pulse patterns can repeat sooner than pointers.
- Playback stops when the page is hidden. Return and press Play to restart.

## Share an arrangement

**Share arrangement** copies a link containing all three rings, including
hand-placed pulses, tempo, rotations, and mutes. The link is also shown in a
read-only text field for manual copying if clipboard access is unavailable.
Each edit hides the old link; press Share again to copy the latest arrangement.
The address bar is unchanged, so bookmark the copied link to keep your edits.

The compact, versioned score lives entirely in the URL fragment after `#`.
No service or browser storage saves it. Loading a link leaves playback stopped;
volume is excluded and starts at 60% in a fresh page. Changing fragments within
the page retains your current local volume. Invalid or unsupported links show a
message and preserve the current arrangement. Removing the fragment restores
Odd company; browser Back and Forward reload the score in the displayed link.

The thump, glass tone, and dusty click are synthesized using decaying sine waves
and deterministic noise. They have fixed stereo positions. The same generated
samples are used for live playback and file rendering. Playback requires a browser
with Web Audio; WAV export still works if audio playback is unavailable.

## Save a phrase

**Save 8 bars WAV** renders 64 eighth-note ticks (eight bars of 4/4) from step zero
at the current tempo, with current mutes and volume. It adds half a second for
the sound tail and downloads stereo, 16-bit PCM at 22,050 Hz. At 120 BPM that is
16 seconds of rhythm plus the tail. The end is a phrase boundary, not necessarily
a common ring boundary: arbitrary ring lengths do not always form a seamless
eight-bar loop. Exports are generated locally and never uploaded.

## Rules and verification

For an evenly spaced ring with `n` steps and `k` pulses, step `i` is bright when
`(i × k) mod n < k`, before rotation. This puts exactly `k` hits around the ring;
the circular distances between successive hits differ by at most one. Rotation
shifts the entire pattern and never changes its pulse count. Rings support 2–16
steps, 0–length pulses, and tempos from 60–180 quarter notes per minute.

```sh
node --test orbitone/test/*.test.mjs
```

Tests exhaustively check all supported evenly spaced pulse counts and rotations, event timing,
independent periods, muting, reproducible synthesis, WAV headers and duration,
stereo audio, silent tails, and dense-pattern headroom. Hand editing is checked at
every rotation. Score-link tests cover presets and 480 custom masks, including
empty/full rings, the sixteenth step, malformed links, and WAV equivalence.
Live playback schedules
against the audio clock ahead of the visual frame, so animation delays do not
set the musical timing. Notes missed during a browser stall are skipped rather
than played in a burst. This is a playful browser instrument, not a DAW.
