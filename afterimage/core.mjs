export const MAX_ECHOES = 3;
export const MAX_STEPS = 64;
export const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], wait: [0, 0] };
const same = (a, b) => a.x === b.x && a.y === b.y;

export function parseRoom(rows) {
  if (!rows.length || rows.some(row => row.length !== rows[0].length)) throw new Error('Room must be rectangular');
  const room = { rows, width: rows[0].length, height: rows.length, plates: {}, start: null, exit: null };
  let starts = 0, exits = 0;
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    if (!/^[#.SEabcABC]$/.test(tile)) throw new Error(`Unknown tile: ${tile}`);
    if (tile === 'S') { room.start = { x, y }; starts++; }
    if (tile === 'E') { room.exit = { x, y }; exits++; }
    if (/[abc]/.test(tile)) (room.plates[tile] ??= []).push({ x, y });
  }));
  if (starts !== 1 || exits !== 1) throw new Error('Room needs exactly one start and one exit');
  for (const row of rows) for (const tile of row) {
    if (/[ABC]/.test(tile) && !room.plates[tile.toLowerCase()]) throw new Error(`Gate ${tile} has no plate`);
  }
  return room;
}

export function createState(room) {
  return { room, tick: 0, path: [{ ...room.start }], echoes: [], won: false };
}
export const position = state => state.path[state.path.length - 1];
export const echoPosition = (echo, tick) => echo[Math.min(tick, echo.length - 1)];
export function gateOpen(state, letter, tick = state.tick, livePosition = position(state)) {
  const occupants = [livePosition, ...state.echoes.map(echo => echoPosition(echo, tick))];
  const plates = state.room.plates[letter.toLowerCase()];
  return Boolean(plates?.length && plates.every(plate => occupants.some(p => same(p, plate))));
}

// The live player and every echo advance on a successful step or wait. A blocked
// move consumes no time. Echoes are recordings, so later doors cannot alter them.
export function move(state, direction) {
  if (state.won) return { ok: false, message: 'Room complete. Onward.' };
  if (!DIRECTIONS[direction]) return { ok: false, message: 'Unknown direction.' };
  if (state.tick >= MAX_STEPS) return { ok: false, message: 'The tape is full. Rewind or undo a step.' };
  const [dx, dy] = DIRECTIONS[direction];
  const current = position(state), next = { x: current.x + dx, y: current.y + dy };
  const tile = state.room.rows[next.y]?.[next.x];
  if (!tile || tile === '#') return { ok: false, message: 'A wall. Try another way.' };
  if ((dx || dy) && /[ABC]/.test(tile) && !gateOpen(state, tile, state.tick + 1, next)) {
    const required = `Door ${tile} needs every ${tile.toLowerCase()} plate held.`;
    if (!state.echoes.length) {
      return { ok: false, message: `${required} Walk onto a plate, then press Rewind to leave a ghost there.` };
    }
    let opensLater = false;
    for (let tick = state.tick + 2; tick <= MAX_STEPS; tick++) {
      if (gateOpen(state, tile, tick, next)) { opensLater = true; break; }
    }
    return { ok: false, message: opensLater
      ? `${required} Your recordings can open it on a later beat. Use Wait to advance your ghosts.`
      : `${required} Your recordings will not open it from here. Record a walk that holds the plate, or reset the room.` };
  }
  state.tick++;
  state.path.push(next);
  state.won = same(next, state.room.exit);
  return { ok: true, message: state.won ? 'A future made possible by your past.' : direction === 'wait' ? 'One beat passes. Your echoes keep walking.' : '' };
}

export function rewind(state) {
  if (state.won) return { ok: false, message: 'Room complete. Onward.' };
  if (!state.tick) return { ok: false, message: 'Take a walk first. Then leave it behind.' };
  if (state.echoes.length >= MAX_ECHOES) return { ok: false, message: 'All three tapes are in use. Reset the room to record again.' };
  state.echoes.push(state.path.map(p => ({ ...p })));
  state.path = [{ ...state.room.start }];
  state.tick = 0;
  return { ok: true, message: `Echo ${state.echoes.length} recorded. It will replay your walk and hold its final position.` };
}

export function undo(state) {
  if (!state.tick) return { ok: false, message: 'Already at the start of this tape.' };
  state.path.pop(); state.tick--; state.won = false;
  return { ok: true, message: 'One beat unwound.' };
}
