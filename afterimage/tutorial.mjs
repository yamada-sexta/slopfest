import { position, MAX_ECHOES, MAX_STEPS } from './core.mjs';
const same = (a, b) => a.x === b.x && a.y === b.y;

// Derived from the first room's actual timeline, so undo and reset also unwind
// the guide. The guide advises; it never restricts player actions.
export function firstRoomGuide(state) {
  const p = position(state), plate = state.room.plates.a[0];
  const doorX = state.room.rows[1].indexOf('A'), exit = state.room.exit;
  const restart = instruction => ({ step: 0, restart: true, instruction });
  if (state.won) return { step: 3, instruction: 'You did it. Your ghost held the plate while you reached the exit. Try the next room.' };
  if (p.x >= doorX) {
    if (state.tick + exit.x - p.x > MAX_STEPS) {
      return restart('The tape is too full to reach the exit. Undo a wait with Z, or reset the room and try the short recording → → ↓.');
    }
    return { step: 2, instruction: 'You are through the door. Keep moving → to the glowing exit.' };
  }

  // A recording may contain waits at its endpoint: holding starts when the
  // ghost first reaches that final uninterrupted stay, not when the tape ends.
  const holds = state.echoes.filter(echo => same(echo.at(-1), plate)).map(echo => {
    let tick = echo.length - 1;
    while (tick > 0 && same(echo[tick - 1], plate)) tick--;
    return tick;
  });
  const holdFrom = Math.min(...holds);
  if (Number.isFinite(holdFrom)) {
    const doorAt = Math.max(state.tick + Math.abs(p.y - exit.y) + doorX - p.x, holdFrom);
    if (doorAt + exit.x - doorX > MAX_STEPS) {
      return restart('There is too little tape left to reach the exit. Reset room, then record a short walk: → → ↓, Rewind.');
    }
    const corridor = p.y === exit.y ? '' : 'Move ↑ to the upper corridor, then ';
    return { step: 2, instruction: holdFrom <= state.tick
      ? `${corridor || ''}${corridor ? 'walk' : 'Walk'} → toward the exit. Your ghost is holding a, so door A will open.`
      : `${corridor || ''}${corridor ? 'walk' : 'Walk'} → toward door A. Your moves advance the ghost. If the door is still closed, use Wait until the ghost reaches a.` };
  }
  if (state.echoes.length >= MAX_ECHOES) {
    return restart('All three recordings end away from a. Reset room, then stop on the plate before pressing Rewind.');
  }
  const distance = Math.abs(p.x - plate.x) + Math.abs(p.y - plate.y);
  if (state.tick + distance > MAX_STEPS - (exit.x - doorX)) {
    return restart('This walk is too long to make a useful ghost. Reset room, then take the short route → → ↓ and press Rewind.');
  }
  if (same(p, plate)) {
    return { step: 1, instruction: 'Stop here. Press R or “Rewind & leave echo”. Your walk becomes a ghost that stays on a after replaying it.' };
  }
  const route = `${'→ '.repeat(plate.x - p.x)}${p.y === plate.y ? '' : '↓'}`.trim();
  return { step: 0, instruction: `Move ${route} onto the circle marked a. Stop there: that is where your ghost needs to stay.` };
}
