# Chorusfield

A meadow of 72 little clocks. Each has its own rhythm and listens to nearby
clocks. Nudge one ahead, change how far it hears, or let two isolated choirs find
one shared beat. This is a silent mathematical toy with fixed lights and a simple
phase-pulling rule, not a biological simulation.

## Run

From the repository root, run `npm start` with Node.js 20 or newer and open
**http://localhost:4173/chorusfield/**. Any static HTTP server works too. There are
no dependencies, accounts, network requests beyond local assets, or saved settings.

- **Run / Pause** moves simulated time at roughly real time. **Step 0.1 s** moves
  exactly twelve integration ticks; **Listen for 10 s** computes ten simulated
  seconds and pauses, so you can compare settings without waiting.
- Tap near a light to move its phase a quarter turn ahead. Its clock hand and
  color show the new phase. The halo brightens near twelve. The selected light has
  a square; its listening circle and connecting lines show who it hears.
- Focus the meadow and use Left/Right to select a clock, Enter to nudge it, or
  Space to run/pause. The canvas's accessible label reports the selected clock,
  neighbor count, simulated time, and field agreement. Disable **Show who it
  hears** for a cleaner view.
- **Listening distance** changes the neighbor graph; **Neighbor's pull** controls
  how strongly phases attract; **Clock differences** controls natural speed
  variation. Changing a setting pauses the field and keeps its current phases.
- **Scatter clocks** randomizes phases while preserving positions, natural speed
  biases, settings, and time. **Reset clearing** restores the preset and starts a
  fresh history. Preset changes also reset. Hiding the tab pauses animation;
  returning does not fast-forward. Reduced-motion users start paused too.
- **Save SVG** downloads the current meadow as a vector still, including clock
  hands, simulated time, and phase agreement. Selection, listening guides, and
  the history chart stay in the browser. Refreshing resets the field.

## Three small experiments

| Clearing | Try this |
| --- | --- |
| One clearing | Press Listen for 10 s: the default field rises from about 54.6% to 99.9% agreement. Nudge a clock, then listen again. |
| Two choirs | Listen for 10 s: each island settles, while whole-field agreement stays around 24.9%. Set listening distance to 700 and listen again: both islands join one timing. |
| Nobody listening | Listen with zero pull: phases drift at different speeds. Raise the pull to bring neighboring clocks toward one another. |

Agreement measures phase alignment across **all** clocks. It is the length of the
mean unit vector, from zero (phases cancel) to one (all phases match). It does not
measure identical speeds, the percentage of bright lights, or whether individual
islands are synchronized internally. The chart keeps the last 30 simulated
seconds, sampled every tenth-second, with disturbances recorded immediately.

## The rule

For clock `i` with phase `θ[i]` in radians:

```text
speed[i] = 2π × (0.8 + spread × bias[i])
           + pull × mean(sin(θ[j] − θ[i])) for neighbors j
θ_next[i] = wrap(θ[i] + speed[i] / 120)
```

There is no neighbor term for an isolated clock. Neighbors are other clocks at a
Euclidean distance at most the listening distance. Self-edges are excluded. Each
clock averages its own neighbors, so dense areas do not simply get a larger
pull. Phases wrap into `[0, 2π)`. Every clock reads the old field before any next
phase is installed. This explicit numerical rule is the toy's definition; it is
not an exact continuous-time solver.

Positions and speed biases are fixed, seeded, and reproducible. Natural speeds
range from `0.8 − spread` to `0.8 + spread` cycles per second. The two-choir preset
uses identical natural speeds with an island phase offset of 0.42 turns; exact
opposition would be an unstable balanced arrangement. Animation uses fixed
1/120-second steps, caps catch-up work after a slow frame, and drops hidden time.
There is no sound or data storage.

## Verify

```sh
node --test chorusfield/test/*.test.mjs
```

Ten tests check seeded independent worlds, the exact distance boundary and graph
symmetry, hand-calculated synchronous updates, closed-form independent clocks,
batch and node-order invariance, known phase-agreement values, local versus global
choir timing, synchronization after reconnecting islands, perturbation isolation,
scatter reproducibility, SVG geometry and labels, and malformed input bounds.

Use `npm test` for the entire cabinet and `npm run build` for the approved static
bundle. Browser checks cover the presets, measured ten-second transitions, paused
edits, nudging by pointer and keyboard, animation, reset, history, SVG download,
and desktop/phone layouts.
