import { createYard, board } from './core.mjs';

const two = createYard(['12', '', '']), three = createYard(['123', '', '']);
const four = createYard(['12', '34', '']), five = createYard(['123', '45', '']);
const six = createYard(['123', '456', '']);
const room = (title, note, yard, start, par) => Object.freeze({ title, note, yard, start: board(yard, start), par });
export const ROOMS = Object.freeze([
  room('One little transfer', 'Click track B, then track A. Wagon 2 joins wagon 1. That is the whole first dispatch.', two, ['1', '2', ''], 1),
  room('Behind the buffer', 'Wagon 2 belongs between 1 and 3. Give wagon 3 somewhere to wait, then bring it back.', three, ['13', '2', ''], 3),
  room('A spare siding', 'An empty track is a workspace. Every track can hold three wagons, even when its dispatch order is shorter.', four, ['24', '', '13'], 5),
  room('Leave a little room', 'Full tracks refuse an arrival. Make a space before you ask another wagon to join.', five, ['3', '5', '214'], 7),
  room('Morning freight', 'Six wagons, three tracks. The wagon at the right end is the only one you can take.', six, ['652', '14', '3'], 9),
  room('Evening dispatch', 'A few small transfers can make a long shuffle. Undo any move; there is no clock to beat.', six, ['56', '14', '32'], 12),
]);
