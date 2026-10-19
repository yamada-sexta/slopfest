import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCard, trace, solve, turnMirror } from '../core.mjs';
import { cards } from '../cards.mjs';

for (const [index, definition] of cards.entries()) test(`Postcard ${index + 1} is uniquely solvable: ${definition.title}`, () => {
  const card = parseCard(definition), initial = [...card.initial], solution = solve(card);
  assert.equal(trace(card).solved, false); assert.ok(solution); assert.equal(solution.solutions, 1);
  assert.equal(solution.flips.length, [1, 3, 3, 4, 4][index]);
  let turns = initial;
  for (const mirror of solution.flips) turns = turnMirror(card, turns, mirror);
  const result = trace(card, turns);
  assert.equal(result.solved, true); assert.equal(result.lit, card.stamps.length);
  assert.deepEqual(card.initial, initial); assert.notEqual(turns, initial);
  for (const ray of result.rays) assert.ok(ray.visited <= card.width * card.height * 4);
});

test('Both mirror orientations reflect all four incoming directions correctly', () => {
  const incoming = ['N', 'E', 'S', 'W'], starts = { N: [1, 2], E: [0, 1], S: [1, 0], W: [2, 1] };
  const exits = { N: [1.5, 0], E: [3, 1.5], S: [1.5, 3], W: [0, 1.5] };
  const reflected = { '/': ['E', 'N', 'W', 'S'], '\\': ['W', 'S', 'E', 'N'] };
  for (const glyph of ['/', '\\']) for (const [i, dir] of incoming.entries()) {
    const rows = ['...', `.${glyph}.`, '...'].map(row => [...row]);
    const [x, y] = starts[dir]; rows[y][x] = 'A';
    // A spare stamp off the source line keeps this a well-formed card.
    rows[0][0] = 'a';
    const card = parseCard({ rows: rows.map(row => row.join('')), directions: { A: dir } });
    const end = trace(card).rays[0].points.at(-1);
    assert.deepEqual([end.x, end.y], exits[reflected[glyph][i]], `${glyph} from ${dir}`);
  }
});
test('Stamps pass light onward and require the matching color', () => {
  const card = parseCard({ rows: ['AaxbB', '..../'], directions: { A: 'E', B: 'W' } });
  const result = trace(card);
  assert.ok(result.stamps.every(stamp => stamp.lit));
  assert.ok(result.stamps.every(stamp => stamp.received === 3));
  const miss = parseCard({ rows: ['A.x..', '..b./', '..B..'], directions: { A: 'E', B: 'N' } });
  const mixed = trace(miss).stamps.find(stamp => stamp.mask === 3);
  // Here both colors reach x, even though their directions differ.
  assert.equal(mixed.lit, true);
  const onlyAmber = parseCard({ rows: ['A.x.B', '..b./'], directions: { A: 'E', B: 'N' } });
  assert.equal(trace(onlyAmber).stamps.find(stamp => stamp.mask === 3).lit, false);
});
test('Walls and card edges stop the beam at the boundary, not inside the wall', () => {
  const card = parseCard({ rows: ['A.#a', '.../'], directions: { A: 'E' } });
  const result = trace(card);
  assert.deepEqual(result.rays[0].points.at(-1), { x: 2, y: 0.5 }); assert.equal(result.lit, 0);
  const edge = parseCard({ rows: ['A.a/', '....'], directions: { A: 'W' } });
  assert.deepEqual(trace(edge).rays[0].points.at(-1), { x: 0, y: 0.5 });
});
test('Loop detection uses direction as well as position and always terminates', () => {
  const card = parseCard(cards[4]), result = trace(card);
  assert.deepEqual(result.rays.map(ray => ray.ending), ['loop', 'loop']);
  assert.ok(result.rays.every(ray => ray.visited <= 4 * card.width * card.height));
  const solution = solve(card);
  assert.ok(trace(card, solution.turns).rays.every(ray => ray.ending === 'edge'));
  // Every possible arrangement of the largest shipped card is bounded.
  for (let bits = 0; bits < 2 ** card.mirrors.length; bits++) {
    const state = card.initial.map((_, i) => Boolean(bits & (1 << i)));
    for (const ray of trace(card, state).rays) assert.ok(ray.visited <= 4 * card.width * card.height);
  }
});
test('A crossing can revisit a cell in a new direction without becoming a loop', () => {
  const card = parseCard({ rows: ['../.\\', '.....', 'A.../', '..a..', '.....'], directions: { A: 'E' } });
  const ray = trace(card).rays[0];
  assert.equal(ray.ending, 'edge');
  assert.equal(ray.points.filter(point => point.x === 2.5 && point.y === 2.5).length, 2);
  assert.deepEqual(ray.points.at(-1), { x: 2.5, y: 5 });
  assert.equal(trace(card).solved, true);
});
test('Hints give a shortest path from every arrangement, including solved states', () => {
  const card = parseCard(cards[3]), goal = solve(card).turns;
  for (let bits = 0; bits < 2 ** card.mirrors.length; bits++) {
    const state = card.initial.map((_, i) => Boolean(bits & (1 << i))), answer = solve(card, state);
    const distance = goal.filter((turn, i) => turn !== state[i]).length;
    assert.equal(answer.flips.length, distance);
    if (distance) assert.equal(solve(card, turnMirror(card, state, answer.flips[0])).flips.length, distance - 1);
    else assert.equal(trace(card, state).solved, true);
  }
});
test('Unreachable cards have no hint, and turning twice restores the same arrangement', () => {
  const card = parseCard({ rows: ['A.#a', '.../'], directions: { A: 'E' } });
  assert.equal(solve(card), null);
  assert.deepEqual(turnMirror(card, turnMirror(card, card.initial, 0), 0), card.initial);
  assert.throws(() => turnMirror(card, card.initial, -1), /Choose/);
  assert.throws(() => trace(card, []), /every mirror/);
  assert.throws(() => trace(card, [1]), /every mirror/);
});
test('Malformed cards are rejected before tracing or exponential search', () => {
  for (const definition of [
    { rows: [] }, { rows: ['A..', '/a'], directions: { A: 'E' } },
    { rows: ['A?/', '.a.'], directions: { A: 'E' } },
    { rows: ['A./', '.a.'], directions: { A: 'sideways' } },
    { rows: ['AA/', '.a.'], directions: { A: 'E' } },
    { rows: ['A./', '.b.'], directions: { A: 'E' } },
    { rows: ['A..', '.a.'], directions: { A: 'E' } },
    { rows: ['A///', '////', '///a', '/...'], directions: { A: 'E' } },
    { rows: ['A......./', 'a........'], directions: { A: 'E' } }
  ]) assert.throws(() => parseCard(definition));
});
