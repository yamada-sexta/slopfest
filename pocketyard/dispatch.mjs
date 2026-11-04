import { createYard, board, solve } from './core.mjs';

export function makeDispatch(start, goal) {
  const yard = createYard(goal), initial = board(yard, start), solution = solve(yard, initial);
  if (!solution) throw new Error('This starting yard cannot reach the dispatch order.');
  return Object.freeze({ title: 'Your dispatch', note: 'Your wagons, your order. Only the rightmost wagon can move; hints still find a shortest route.', yard, start: initial, par: solution.distance });
}
export function encodeDispatch(start, goal) {
  const yard = createYard(goal), initial = board(yard, start);
  return `#dispatch=v1:${initial.join('.')}:${yard.goal.join('.')}`;
}
export function decodeDispatch(hash) {
  const prefix = '#dispatch=v1:';
  if (typeof hash !== 'string' || hash.length > 64 || !hash.startsWith(prefix)) throw new Error('Use a Pocketyard v1 dispatch link.');
  const halves = hash.slice(prefix.length).split(':');
  if (halves.length !== 2) throw new Error('A dispatch link needs a starting yard and a goal.');
  const start = halves[0].split('.'), goal = halves[1].split('.');
  const dispatch = makeDispatch(start, goal);
  if (encodeDispatch(dispatch.start, dispatch.yard.goal) !== hash) throw new Error('The dispatch link is not in its canonical form.');
  return dispatch;
}
