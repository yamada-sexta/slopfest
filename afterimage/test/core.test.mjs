import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, parseRoom, move, rewind, undo, position, echoPosition, gateOpen, MAX_STEPS } from '../core.mjs';
import { rooms } from '../rooms.mjs';
const commands = { R: 'right', L: 'left', U: 'up', D: 'down', '.': 'wait' };

for (const room of rooms) {
  test(`Room is solvable: ${room.name}`, () => {
    const state = createState(parseRoom(room.rows));
    for (const symbol of room.solution) {
      const result = symbol === '|' ? rewind(state) : move(state, commands[symbol]);
      assert.equal(result.ok, true, `Command ${symbol} at beat ${state.tick}: ${result.message}`);
    }
    assert.equal(state.won, true);
  });
}
test('Blocked walls and gates consume no time', () => {
  const s = createState(parseRoom(rooms[0].rows));
  assert.equal(move(s, 'up').ok, false);
  move(s, 'right'); move(s, 'right');
  assert.equal(move(s, 'right').ok, false);
  assert.equal(s.tick, 2); assert.equal(s.path.length, 3);
});
test('Doors use echo positions on the destination beat', () => {
  const s = createState(parseRoom(rooms[0].rows));
  for (const d of ['right', 'right', 'down']) move(s, d);
  rewind(s); move(s, 'right'); move(s, 'right');
  assert.equal(gateOpen(s, 'A'), false);
  assert.equal(move(s, 'right').ok, true);
  assert.equal(gateOpen(s, 'A'), true);
});
test('A player cannot hold a plate they leave, but can wait inside a closing door', () => {
  const room = parseRoom(['######', '#SaAE#', '#....#', '######']);
  const s = createState(room);
  move(s, 'right');
  assert.equal(move(s, 'right').ok, false);
  const recording = createState(room);
  move(recording, 'wait'); move(recording, 'right'); move(recording, 'down'); rewind(recording);
  move(recording, 'right'); assert.equal(move(recording, 'right').ok, true);
  assert.equal(move(recording, 'wait').ok, true);
  assert.equal(gateOpen(recording, 'A'), false);
  assert.equal(move(recording, 'right').ok, true);
  assert.equal(recording.won, true);
});
test('Echoes retain independent recordings, stop at the end, and undo tracks time', () => {
  const s = createState(parseRoom(rooms[0].rows));
  move(s, 'right'); move(s, 'down'); rewind(s);
  assert.deepEqual(echoPosition(s.echoes[0], 999), { x: 2, y: 2 });
  const recorded = JSON.stringify(s.echoes[0]);
  move(s, 'right'); move(s, 'right'); undo(s);
  assert.equal(s.tick, 1); assert.deepEqual(position(s), { x: 2, y: 1 });
  assert.equal(JSON.stringify(s.echoes[0]), recorded);
});
test('Every plate for a letter must be held, and waiting synchronizes echoes', () => {
  const s = createState(parseRoom(rooms[3].rows));
  move(s, 'down'); move(s, 'down'); rewind(s);
  assert.equal(gateOpen(s, 'A', 10), false);
  for (const symbol of 'RRRRDD') move(s, commands[symbol]);
  rewind(s);
  for (const symbol of 'RRRR') move(s, commands[symbol]);
  assert.equal(move(s, 'right').ok, false);
  assert.equal(move(s, 'wait').ok, true);
  assert.equal(move(s, 'right').ok, true);
});
test('Tape count and duration are bounded, and an empty tape is not recorded', () => {
  const s = createState(parseRoom(rooms[0].rows));
  assert.equal(rewind(s).ok, false);
  for (let i = 0; i < 3; i++) { move(s, 'wait'); assert.equal(rewind(s).ok, true); }
  move(s, 'wait'); assert.equal(rewind(s).ok, false);
  for (let i = 1; i < MAX_STEPS; i++) move(s, 'wait');
  assert.equal(move(s, 'wait').ok, false); assert.equal(s.tick, MAX_STEPS);
  undo(s); assert.equal(move(s, 'wait').ok, true);
});
test('A won timeline stays resolved until undo', () => {
  const s = createState(parseRoom(['#####', '#S.E#', '#####']));
  move(s, 'right'); move(s, 'right');
  assert.equal(move(s, 'left').ok, false); assert.equal(rewind(s).ok, false);
  undo(s); assert.equal(s.won, false); assert.equal(move(s, 'right').ok, true);
});
test('Malformed rooms fail clearly', () => {
  assert.throws(() => parseRoom(['S.E', '#']), /rectangular/);
  assert.throws(() => parseRoom(['SSE']), /exactly/);
  assert.throws(() => parseRoom(['SAE']), /no plate/);
  assert.throws(() => parseRoom(['S?E']), /Unknown tile/);
});
