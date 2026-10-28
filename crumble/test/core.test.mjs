import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, SIZE, PAD, GRAIN_COLORS, create, pour, inspect, wave, settle, compareOrders, specimen, PRESETS, positionAt, colorAt, toSVG } from '../core.mjs';
const sum = values => values.reduce((a, b) => a + b, 0);
const same = (a, b) => { assert.deepEqual(a.cells, b.cells); assert.deepEqual(a.odometer, b.odometer); assert.equal(a.escaped, b.escaped); assert.equal(a.topplings, b.topplings); };
function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }; }
// Deliberately slow oracle: pick any legal cell, fire ONCE, and search anew.
function reference(size, input, seed) {
  const cells = [...input], odometer = cells.map(() => 0), rng = random(seed); let escaped = 0, steps = 0;
  for (;;) {
    const ready = cells.map((n, i) => n >= 4 ? i : -1).filter(i => i !== -1);
    if (!ready.length) break;
    assert.ok(++steps < 100000, 'reference must terminate');
    const i = ready[rng() % ready.length], x = i % size, y = Math.floor(i / size);
    cells[i] -= 4; odometer[i]++;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) escaped++; else cells[ny * size + nx]++;
    }
  }
  return { cells: Uint32Array.from(cells), odometer: Uint32Array.from(odometer), escaped, topplings: steps };
}
function potential(state) {
  const n = state.size;
  return state.cells.reduce((total, height, i) => { const x = i % n + 1, y = Math.floor(i / n) + 1; return total + height * (x * (n + 1 - x) + y * (n + 1 - y)); }, 0);
}

test('Four grains split only to cardinal neighbors; open corners lose two and never wrap', () => {
  const center = wave(pour(create(5), 12, 4));
  assert.deepEqual([...center.cells].flatMap((n, i) => n ? [[i, n]] : []), [[7, 1], [11, 1], [13, 1], [17, 1]]);
  assert.equal(center.odometer[12], 1); assert.equal(center.escaped, 0); assert.equal(center.topplings, 1);
  const corner = wave(pour(create(5), 0, 4));
  assert.deepEqual([...corner.cells].flatMap((n, i) => n ? [[i, n]] : []), [[1, 1], [5, 1]]);
  assert.equal(corner.escaped, 2); assert.equal(inspect(corner).grains, 2);
  const edge = wave(pour(create(5), 4, 4));
  assert.equal(edge.cells[5], 0); assert.equal(edge.cells[0], 0); assert.equal(edge.escaped, 2);
});

test('A parallel wave uses old heights and batches only already legal topplings', () => {
  let state = pour(pour(create(5), 12, 8), 13, 3);
  state = wave(state);
  assert.equal(state.cells[12], 0); assert.equal(state.cells[13], 5);
  assert.equal(state.odometer[12], 2); assert.equal(state.odometer[13], 0);
  assert.equal(inspect(state).unstable, 1);
  state = wave(state);
  assert.equal(state.cells[13], 1); assert.equal(state.cells[12], 1);
  assert.equal(state.odometer[13], 1); assert.equal(state.topplings, 3);
});

test('FIFO and LIFO bulk queues match independent random single firings on varied boards', () => {
  const rng = random(721);
  for (const size of [5, 7, 9]) for (let trial = 0; trial < 8; trial++) {
    const input = new Uint32Array(size * size);
    for (let grain = 0; grain < 80 + trial * 19; grain++) input[rng() % input.length]++;
    const state = create(size, input), expected = reference(size, input, rng());
    same(settle(state, 'fifo').state, expected); same(settle(state, 'lifo').state, expected);
  }
});

test('Every pour has the same stable cells, per-cell topplings, and escape count in either order', () => {
  const known = [[1992, 2104, 232420], [2066, 2030, 202170], [1776, 100, 2925]];
  PRESETS.forEach((_, index) => {
    const origin = specimen(index), a = settle(origin, 'fifo'), b = settle(origin, 'lifo'); same(a.state, b.state);
    const stats = inspect(a.state); assert.ok(stats.stable); assert.ok(stats.peak <= 3);
    assert.deepEqual([stats.grains, a.state.escaped, a.state.topplings], known[index]);
    assert.ok(a.state.topplings * 4 <= potential(origin));
    const proof = compareOrders(a.state);
    assert.ok(proof.sameCells && proof.sameOdometer && proof.sameEscape);
    assert.equal(proof.topplings, a.state.topplings);
    assert.equal(proof.fifoVisits, a.visits); assert.equal(proof.lifoVisits, b.visits);
    if (index < 2) assert.notEqual(proof.fifoVisits, proof.lifoVisits);
  });
});

test('Parallel waves settle to the queue result and decrease a finite potential every active wave', () => {
  for (let index = 0; index < PRESETS.length; index++) {
    let state = specimen(index); const expected = settle(state).state;
    let rounds = 0;
    while (!inspect(state).stable) {
      const before = state; state = wave(state);
      assert.ok(potential(before) - potential(state) >= 4 * (state.topplings - before.topplings) - 1e-8);
      assert.equal(sum(state.cells) + state.escaped, state.added);
      assert.ok(++rounds < 10000);
    }
    same(state, expected);
  }
});

test('Interleaving drops with avalanches matches pouring the same grains all at once', () => {
  let state = specimen(2);
  state = settle(state).state;
  for (const [index, amount] of [[0, 32], [312, 256], [624, 4], [312, 1]]) {
    state = pour(state, index, amount); state = wave(state); state = wave(state);
  }
  const finished = settle(state).state, together = settle(create(state.size, state.input), 'lifo').state;
  same(finished, together); assert.deepEqual(finished.input, state.input);
  const proof = compareOrders(state); assert.equal(proof.escaped, finished.escaped); assert.equal(proof.topplings, finished.topplings);
});

test('States, pour histories, and odometers remain independently owned through all operations', () => {
  const input = new Uint32Array(25); input[12] = 40;
  const state = create(5, input), saved = structuredClone(state); input.fill(0);
  for (const next of [pour(state, 0, 1), wave(state), settle(state).state]) {
    assert.notEqual(next.cells, state.cells); assert.notEqual(next.input, state.input); assert.notEqual(next.odometer, state.odometer);
    next.cells.fill(0); next.input.fill(0); next.odometer.fill(0);
    assert.deepEqual(state, saved);
  }
  compareOrders(state); assert.deepEqual(state, saved);
});

test('Pointer mapping selects every cell center and respects all four open boundaries', () => {
  for (const size of [5, 25, 31, 41]) {
    const unit = (SIZE - PAD * 2) / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) assert.equal(positionAt(PAD + (x + .5) * unit, PAD + (y + .5) * unit, size), y * size + x);
    assert.equal(positionAt(PAD, PAD, size), 0);
    for (const [x, y] of [[PAD - .01, PAD], [PAD, PAD - .01], [SIZE - PAD, PAD], [PAD, SIZE - PAD]]) assert.equal(positionAt(x, y, size), null);
  }
});

test('SVG records the current stable or unstable board and logarithmic work colors without selection guides', () => {
  for (const state of [specimen(0), settle(specimen(0)).state]) for (const layer of ['grains', 'work']) {
    const stats = inspect(state), svg = toSVG(state, layer);
    const rectangles = [...svg.matchAll(/<rect data-cell="(\d+)" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="(#[\da-f]+)"\/>/g)];
    assert.equal(rectangles.length, state.size ** 2);
    rectangles.forEach((rect, i) => { assert.equal(Number(rect[1]), i); assert.ok(Number(rect[2]) >= PAD); assert.ok(Number(rect[3]) >= PAD + 32); assert.equal(rect[6], colorAt(state.cells[i], state.odometer[i], stats.busiest, layer)); });
    assert.ok(svg.includes(`${stats.grains} grains here / ${state.escaped} escaped / ${state.topplings} topplings`));
    assert.ok(svg.includes(stats.stable ? 'Settled /' : `${stats.unstable} cells ready to spill /`));
    assert.doesNotMatch(svg, /NaN|undefined|Infinity|script|selection|focus/);
  }
  for (let i = 0; i < 5; i++) assert.equal(colorAt(i, 0, 0, 'grains'), GRAIN_COLORS[i]);
});

test('Grain limits and malformed inputs fail before mutating a valid board', () => {
  for (const size of [-1, 0, 4, 6, 43, NaN, Infinity, 1000000000, '5']) assert.throws(() => create(size), RangeError);
  for (const input of [null, [], new Uint32Array(24), Uint32Array.from({ length: 25 }, () => 400)]) assert.throws(() => create(5, input), RangeError);
  const state = specimen(0), before = structuredClone(state);
  for (const [index, amount] of [[-1, 1], [961, 1], [.5, 1], [0, 0], [0, -1], [0, .5], [0, 8192], [0, Infinity]]) assert.throws(() => pour(state, index, amount), RangeError);
  assert.throws(() => settle(state, 'random'), RangeError); assert.throws(() => toSVG(state, 'unknown'), RangeError);
  for (const mutation of [s => s.cells[0]++, s => s.input[0]++, s => s.odometer[0]++, s => s.escaped = -1, s => s.added = 8193, s => s.size = 30, s => s.cells = [], s => s.topplings = Infinity]) {
    const broken = structuredClone(state); mutation(broken); assert.throws(() => wave(broken), RangeError); assert.throws(() => settle(broken), RangeError);
  }
  assert.throws(() => inspect(null), RangeError); assert.throws(() => positionAt(NaN, 1, 31), RangeError);
  assert.throws(() => specimen(3), RangeError); assert.throws(() => specimen(.5), RangeError);
  assert.deepEqual(state, before);
});

test('The largest supported pour terminates within its finite toppling bound and conserves all grains', () => {
  const state = pour(create(LIMITS.maxSize), Math.floor(LIMITS.maxSize ** 2 / 2), LIMITS.grains);
  const end = settle(state).state, stats = inspect(end);
  assert.ok(stats.stable); assert.equal(stats.grains + end.escaped, LIMITS.grains);
  assert.ok(end.topplings <= potential(state) / 4); assert.equal(sum(end.odometer), end.topplings);
  assert.throws(() => pour(state, 0, 1), RangeError);
});
