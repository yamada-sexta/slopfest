import test from 'node:test';
import assert from 'node:assert/strict';
import { createYard, board, transfer, legalMoves, isSolved, solve, toSVG, yardStats } from '../core.mjs';
import { ROOMS } from '../rooms.mjs';

function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(tail => [value, ...tail]));
}
function universe(count, capacity) {
  const states = [];
  for (const order of permutations(Array.from({ length: count }, (_, i) => i + 1))) {
    for (let a = 0; a <= capacity; a++) for (let b = 0; b <= capacity; b++) {
      const c = count - a - b;
      if (c < 0 || c > capacity) continue;
      states.push([order.slice(0, a), order.slice(a, a + b), order.slice(a + b)]);
    }
  }
  return states;
}
const encode = rows => JSON.stringify(rows);
// Independent array-stack graph and synchronous value iteration, rather than
// the engine's string boards and queue traversal from the goal.
function oracle(count, capacity, goal) {
  const states = universe(count, capacity), indices = new Map(states.map((state, i) => [encode(state), i]));
  const edges = states.map(state => {
    const result = [];
    for (let source = 0; source < 3; source++) for (let dest = 0; dest < 3; dest++) {
      if (source === dest || !state[source].length || state[dest].length >= capacity) continue;
      const changed = state.map(row => row.slice());
      changed[dest].push(changed[source].pop()); result.push(indices.get(encode(changed)));
    }
    return result;
  });
  let costs = states.map(() => Infinity); costs[indices.get(encode(goal))] = 0;
  for (;;) {
    const next = costs.map((cost, i) => Math.min(cost, ...edges[i].map(j => costs[j] + 1)));
    if (next.every((cost, i) => cost === costs[i])) return { states, costs, edges };
    costs = next;
  }
}

test('Every arrangement through six wagons agrees with independent fixed-point shortest distances', () => {
  for (const [count, capacity, goal] of [
    [2, 1, [[1], [2], []]], [3, 2, [[1, 2], [3], []]],
    [4, 3, [[1, 2], [3, 4], []]], [5, 2, [[1, 2], [3, 4], [5]]],
    [5, 3, [[1, 2, 3], [4, 5], []]], [6, 3, [[1, 2, 3], [4, 5, 6], []]],
    [6, 3, [[1, 2], [3, 4], [5, 6]]],
  ]) {
    const yard = createYard(goal.map(row => row.join('')), capacity), expected = oracle(count, capacity, goal);
    const counts = [];
    for (const cost of expected.costs) if (Number.isFinite(cost)) counts[cost] = (counts[cost] ?? 0) + 1;
    assert.deepEqual(yardStats(yard), { states: counts.reduce((a,b) => a+b,0), maxDistance: counts.length - 1, counts });
    for (let i = 0; i < expected.states.length; i++) {
      let state = expected.states[i].map(row => row.join(''));
      const actual = solve(yard, state);
      if (expected.costs[i] === Infinity) { assert.equal(actual, null); continue; }
      assert.equal(actual.distance, expected.costs[i], `${capacity}: ${state}`);
      assert.equal(actual.route.length, actual.distance);
      for (const move of actual.route) {
        assert.equal(state[move.from].at(-1), move.wagon);
        state = transfer(yard, state, move.from, move.to); assert.ok(state);
      }
      assert.equal(isSolved(yard, state), true);
    }
    if (count === 6) {
      assert.equal(expected.states.length, 7200);
      if (goal[0].length === 3) assert.equal(Math.max(...expected.costs), 19);
    }
  }
});

test('Transfers take exactly the rightmost wagon, append it, respect capacity, and have legal inverses', () => {
  const yard = createYard(['123', '456', '']);
  for (const rows of universe(6, 3)) {
    const state = rows.map(row => row.join('')), moves = legalMoves(yard, state);
    for (const move of moves) {
      const next = transfer(yard, state, move.from, move.to);
      assert.equal(move.wagon, state[move.from].at(-1));
      assert.equal(next[move.from], state[move.from].slice(0, -1));
      assert.equal(next[move.to], state[move.to] + move.wagon);
      assert.deepEqual(transfer(yard, next, move.to, move.from), state);
      assert.deepEqual([...next.join('')].sort(), ['1','2','3','4','5','6']);
    }
    for (let from = 0; from < 3; from++) for (let to = 0; to < 3; to++) {
      const valid = from !== to && state[from].length > 0 && state[to].length < 3;
      assert.equal(transfer(yard, state, from, to) !== null, valid);
      assert.equal(moves.some(move => move.from === from && move.to === to), valid);
    }
  }
});

test('Every shipped dispatch has the stated minimum; each hint lowers it by exactly one', () => {
  assert.deepEqual(ROOMS.map(room => room.par), [1, 3, 5, 7, 9, 12]);
  for (const room of ROOMS) {
    let state = room.start;
    for (let remaining = room.par; remaining > 0; remaining--) {
      const solution = solve(room.yard, state);
      assert.equal(solution.distance, remaining);
      const next = solution.route[0]; state = transfer(room.yard, state, next.from, next.to);
    }
    assert.deepEqual(state, room.yard.goal);
    assert.deepEqual(solve(room.yard, state), { distance: 0, route: [] });
    assert.ok(Object.isFrozen(room) && Object.isFrozen(room.start));
  }
  assert.deepEqual(solve(ROOMS[0].yard, ROOMS[0].start).route, [{ from: 1, to: 0, wagon: '2' }]);
  assert.deepEqual(solve(ROOMS[1].yard, ROOMS[1].start).route, [{ from: 0, to: 2, wagon: '3' }, { from: 1, to: 0, wagon: '2' }, { from: 2, to: 0, wagon: '3' }]);
});

test('Hints handle detours and are deterministic, with immutable results independent of caller arrays', () => {
  const goal = ['12', '34', ''], yard = createYard(goal), input = ['12', '34', ''];
  goal[0] = '21';
  const state = board(yard, input); input[0] = '21';
  assert.equal(state[0], '12'); assert.equal(yard.goal[0], '12');
  const detour = transfer(yard, state, 0, 2);
  assert.equal(solve(yard, detour).distance, 1);
  assert.deepEqual(solve(yard, detour), solve(yard, detour));
  const solution = solve(yard, detour);
  for (const value of [yard, yard.goal, state, detour, solution, solution.route, solution.route[0], legalMoves(yard, state)]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { solution.route[0].from = 9; }, TypeError);
  assert.throws(() => { state.push('5'); }, TypeError);
  assert.equal(isSolved(yard, ['21', '34', '']), false, 'order within a track matters');
});

test('Postcards contain the exact yard, goal and counts, with escaped titles and no hint marks', () => {
  const room = ROOMS[5], title = '<a & "small"> \'dispatch\'';
  const svg = toSVG(room.yard, room.start, { title, moves: 17 });
  const rows = [...svg.matchAll(/data-panel="(yard|goal)" data-track="(\d)" data-wagons="([1-6]*)"/g)].map(match => match.slice(1));
  assert.deepEqual(rows, [ ...room.start.map((row,i) => ['yard',String(i),row]), ...room.yard.goal.map((row,i) => ['goal',String(i),row]) ]);
  assert.equal([...svg.matchAll(/data-wagon=/g)].length, 12);
  assert.match(svg, /17 TRANSFERS \/ 12 SHORTEST REMAINING/);
  assert.match(svg, /&lt;a &amp; &quot;small&quot;&gt; &apos;dispatch&apos;/);
  assert.doesNotMatch(svg, /<script|href=|foreignObject|selected|hint-from/);
  assert.match(toSVG(ROOMS[0].yard, ROOMS[0].yard.goal), /0 SHORTEST REMAINING/);
  const blocked = createYard(['12','34','5'],2);
  assert.equal(solve(blocked, ['21','34','5']), null);
  assert.match(toSVG(blocked, ['21','34','5']), /NO ROUTE TO DISPATCH/);
});

test('Invalid yards, duplicate or missing wagons, malformed tracks, forged metadata and bad export options fail', () => {
  for (const goal of [null, [], ['1','2'], ['1','2','',''], ['1','1',''], ['1234','',''], ['0','',''], ['7','',''], ['1\n','',''], [1,'',''], ['','',''], Object.assign(new Array(3),{0:'1'})]) assert.throws(() => createYard(goal));
  for (const capacity of [0,4,1.5,'3',null,Infinity,NaN]) assert.throws(() => createYard(['1','',''], capacity));
  assert.throws(() => createYard(['1','2','3'], 1), /empty/);
  const yard = createYard(['12','3','']);
  for (const tracks of [['12','',''], ['12','4',''], ['12','33',''], ['1234','',''], null]) {
    for (const fn of [board,legalMoves,isSolved,solve,toSVG]) assert.throws(() => fn(yard,tracks));
  }
  for (const index of [-1,3,1.5,'0',null,NaN]) assert.throws(() => transfer(yard,yard.goal,index,1));
  for (const fake of [null,{},JSON.parse(JSON.stringify(yard))]) assert.throws(() => solve(fake,yard.goal));
  for (const moves of [-1,1.5,'2',1000001,NaN]) assert.throws(() => toSVG(yard,yard.goal,{moves}));
  for (const title of [null,123,'x'.repeat(61),'a\u0000b','two\nlines']) assert.throws(() => toSVG(yard,yard.goal,{title}));
});
