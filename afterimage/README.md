# Afterimage

A small turn-based puzzle game about turning your past walks into collaborators.
Walk onto a pressure plate, rewind, and an echo will repeat the walk while you
take a new route. Five rooms teach the mechanic one idea at a time.

From the repository root, run `npm start` and visit
**http://localhost:4173/afterimage/**. No install or build step.

## Controls and rules

- Arrow keys or WASD: move. On-screen arrows work on touch devices.
- Space: wait. Every successful move or wait advances all recordings by one beat.
- R: seal this walk as an echo and restart the timeline. Three echoes maximum.
- Z: undo a step of the current walk. Reset clears all echoes.
- Echoes stay on their final position after their recording ends.
- Doors require **every** matching plate to be held on the next beat, when you
  enter them. Recordings replay exact positions, independent of later door states.
- Blocked moves take no time. You have 64 beats per recording.

There is no timer, no reflex challenge, and no saved personal data. Every room is
selectable, and hints are tucked into a disclosure below the rules. The engine
in `core.mjs` has no browser dependencies; room definitions and verified example
solutions live in `rooms.mjs`.

Run `node --test afterimage/test/*.test.mjs` from the root. Tests solve every room
and cover waiting, blocked moves, simultaneous plates, undo, immutable recordings,
and the tape limits.
