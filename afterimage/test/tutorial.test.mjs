import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, parseRoom, move, rewind, undo } from '../core.mjs';
import { rooms } from '../rooms.mjs';
import { firstRoomGuide } from '../tutorial.mjs';
const fresh = () => createState(parseRoom(rooms[0].rows));
const plateWalk = state => { move(state, 'right'); move(state, 'right'); move(state, 'down'); };
const wait = (state, count) => { for (let i = 0; i < count; i++) move(state, 'wait'); };

test('The first-room guide teaches the whole mechanic using the real game state', () => {
  const state = fresh();
  assert.equal(firstRoomGuide(state).step, 0);
  assert.match(firstRoomGuide(state).instruction, /→ → ↓/);
  move(state, 'right'); move(state, 'right');
  assert.match(firstRoomGuide(state).instruction, /Move ↓/);
  move(state, 'down');
  assert.equal(firstRoomGuide(state).step, 1);
  assert.match(firstRoomGuide(state).instruction, /Stop here.*Rewind/);
  rewind(state);
  assert.equal(firstRoomGuide(state).step, 2);
  for (let i = 0; i < 6; i++) assert.equal(move(state, 'right').ok, true);
  assert.equal(firstRoomGuide(state).step, 3);
});
test('Undo rewinds the guide, and a recording away from the plate does not count as success', () => {
  const state = fresh(); plateWalk(state); undo(state);
  assert.equal(firstRoomGuide(state).step, 0);
  rewind(state);
  assert.equal(firstRoomGuide(state).step, 0);
  assert.match(firstRoomGuide(state).instruction, /circle marked a/);
  plateWalk(state);
  assert.equal(firstRoomGuide(state).step, 1);
});
test('A late but useful ghost gets waiting advice and then holding advice', () => {
  const state = fresh(); wait(state, 50); plateWalk(state); rewind(state);
  move(state, 'right'); move(state, 'right');
  assert.equal(move(state, 'right').ok, false);
  assert.equal(firstRoomGuide(state).step, 2);
  assert.match(firstRoomGuide(state).instruction, /use Wait/);
  wait(state, 51);
  assert.match(firstRoomGuide(state).instruction, /ghost is holding a/);
  for (let i = 0; i < 4; i++) assert.equal(move(state, 'right').ok, true);
  assert.equal(state.won, true);
});
test('Waits at the end of a plate recording do not delay its actual holding time', () => {
  const state = fresh(); plateWalk(state); wait(state, 60); rewind(state);
  assert.equal(firstRoomGuide(state).step, 2);
  assert.equal(firstRoomGuide(state).restart, undefined);
  for (let i = 0; i < 6; i++) assert.equal(move(state, 'right').ok, true);
  assert.equal(state.won, true);
});
test('Impossible tape budgets and three wrong recordings explain how to restart', () => {
  const long = fresh(); wait(long, 59); plateWalk(long); rewind(long);
  assert.equal(firstRoomGuide(long).restart, true);
  assert.match(firstRoomGuide(long).instruction, /Reset room/);
  const full = fresh();
  for (let i = 0; i < 3; i++) { move(full, 'wait'); rewind(full); }
  assert.equal(firstRoomGuide(full).restart, true);
  assert.match(firstRoomGuide(full).instruction, /All three recordings/);
  const tired = fresh(); wait(tired, 60);
  assert.equal(firstRoomGuide(tired).restart, true);
});
test('Returning to the bottom corridor gives an upward route toward the exit', () => {
  const state = fresh(); plateWalk(state); rewind(state);
  move(state, 'down');
  assert.match(firstRoomGuide(state).instruction, /Move ↑/);
});
test('Filling the tape beyond the door gets recovery advice rather than an impossible move', () => {
  const state = fresh(); plateWalk(state); rewind(state);
  for (let i = 0; i < 5; i++) move(state, 'right');
  wait(state, 59);
  assert.equal(firstRoomGuide(state).restart, true);
  assert.match(firstRoomGuide(state).instruction, /Undo a wait/);
  undo(state);
  assert.equal(firstRoomGuide(state).step, 2);
  move(state, 'right'); assert.equal(state.won, true);
});
