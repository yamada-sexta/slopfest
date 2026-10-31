import test from 'node:test';
import assert from 'node:assert/strict';
import { affected, knock, applyPlan, solve, countBits, ROOMS, toSVG } from '../core.mjs';
const weight = mask => mask.toString(2).replaceAll('0', '').length;
function referencePress(size, grid, index) {
  const row = Math.floor(index / size), column = index % size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.abs(y - row) + Math.abs(x - column) <= 1) grid[y * size + x] = 1 - grid[y * size + x];
}
const encode = grid => grid.reduce((mask, bit, index) => mask + bit * 2 ** index, 0);
function referenceApply(size, lights, plan) {
  const grid = Array.from({ length: size * size }, (_, i) => Math.floor(lights / 2 ** i) % 2);
  for (let i = 0; i < grid.length; i++) if (Math.floor(plan / 2 ** i) % 2) referencePress(size, grid, i);
  return encode(grid);
}
function brute(size) {
  const count = 2 ** (size * size), distance = new Uint8Array(count).fill(255), best = new Uint32Array(count), solutions = new Uint16Array(count), shortest = new Uint16Array(count);
  for (let plan = 0; plan < count; plan++) {
    const lights = referenceApply(size, 0, plan), knocks = weight(plan); solutions[lights]++;
    if (knocks < distance[lights]) { distance[lights] = knocks; best[lights] = plan; shortest[lights] = 1; }
    else if (knocks === distance[lights]) shortest[lights]++;
  }
  return { distance, best, solutions, shortest };
}
// A different complete solver: try each first-row pattern, then extinguish each
// row from the row below. The last row decides whether that first choice worked.
function chase(size, lights) {
  const plans = [];
  for (let first = 0; first < 2 ** size; first++) {
    const grid = Array.from({ length: size * size }, (_, i) => Math.floor(lights / 2 ** i) % 2); let plan = 0;
    const press = i => { referencePress(size, grid, i); plan += 2 ** i; };
    for (let x = 0; x < size; x++) if (Math.floor(first / 2 ** x) % 2) press(x);
    for (let y = 1; y < size; y++) for (let x = 0; x < size; x++) if (grid[(y - 1) * size + x]) press(y * size + x);
    if (grid.every(bit => bit === 0)) plans.push(plan);
  }
  return plans.sort((a, b) => weight(a) - weight(b) || a - b);
}

test('Every window toggles exactly its in-bounds cross, with no diagonals or edge wrapping', () => {
  for (const size of [3, 4, 5]) for (let index = 0; index < size * size; index++) {
    const grid = Array(size * size).fill(0); referencePress(size, grid, index);
    assert.equal(affected(size, index), encode(grid)); assert.equal(knock(size, 0, index), encode(grid));
    const corner = index === 0; if (corner) assert.equal(countBits(affected(size, index)), 3);
  }
  assert.equal(countBits(affected(5, 12)), 5); assert.equal(countBits(affected(5, 2)), 4);
});

test('Gaussian solutions match every reachable 3x3 and 4x4 board against exhaustive press enumeration', () => {
  for (const size of [3, 4]) {
    const oracle = brute(size); let reachable = 0;
    for (let lights = 0; lights < oracle.distance.length; lights++) {
      if (oracle.distance[lights] === 255) { if (lights % 71 === 0) assert.equal(solve(size, lights), null); continue; }
      reachable++; const result = solve(size, lights);
      assert.equal(result.distance, oracle.distance[lights]); assert.equal(result.mask, oracle.best[lights]);
      assert.equal(result.solutions, oracle.solutions[lights]); assert.equal(result.shortest, oracle.shortest[lights]);
      assert.equal(referenceApply(size, lights, result.mask), 0);
    }
    assert.equal(reachable, size === 3 ? 512 : 4096);
  }
});

test('Five-by-five solutions and impossibility match an independent complete row-chasing solver', () => {
  let seed = 42, unreachable = 0;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (const lights of [0, 1, 0x1ffffff, 1 << 24, ...Array.from({ length: 120 }, () => rand() % 2 ** 25)]) {
    const expected = chase(5, lights), result = solve(5, lights);
    if (!expected.length) { unreachable++; assert.equal(result, null); continue; }
    assert.equal(result.mask, expected[0]); assert.equal(result.distance, weight(expected[0]));
    assert.equal(result.solutions, expected.length); assert.equal(result.shortest, expected.filter(plan => weight(plan) === result.distance).length);
    assert.equal(referenceApply(5, lights, result.mask), 0);
  }
  assert.ok(unreachable > 0);
});

test('Knocks cancel in pairs, commute in every supported position pair, and compose like reference presses', () => {
  for (const size of [3, 4, 5]) {
    const lights = 2 ** (size * size) - 1;
    for (let i = 0; i < size * size; i++) {
      assert.equal(knock(size, knock(size, lights, i), i), lights);
      for (let j = 0; j < size * size; j++) assert.equal(knock(size, knock(size, lights, i), j), knock(size, knock(size, lights, j), i));
    }
    for (let plan = 0; plan <= lights; plan += Math.max(1, Math.floor(lights / 97))) assert.equal(applyPlan(size, lights, plan), referenceApply(size, lights, plan));
  }
});

test('All six rooms have the intended shortest route and every hint reduces it by exactly one', () => {
  assert.deepEqual(ROOMS.map(room => solve(room.size, room.lights).distance), [1, 2, 4, 5, 6, 8]);
  assert.equal(new Set(ROOMS.map(room => `${room.size}:${room.lights}`)).size, 6);
  for (const room of ROOMS) {
    let lights = room.lights, steps = 0, solution = solve(room.size, lights), start = solution.distance;
    while (lights) {
      const index = Math.log2(solution.mask & -solution.mask), previous = solution.distance;
      lights = knock(room.size, lights, index); solution = solve(room.size, lights); steps++;
      assert.equal(solution.distance, previous - 1);
    }
    assert.equal(steps, start); assert.equal(solution.mask, 0);
    assert.throws(() => { room.lights = 0; }, TypeError);
  }
});

test('Ranks, nullities, alternative plans, and deterministic ties describe the complete solution space', () => {
  for (const [size, rank, solutions] of [[3, 9, 1], [4, 12, 16], [5, 23, 4]]) {
    const result = solve(size, 0);
    assert.equal(result.rank, rank); assert.equal(result.nullity, size * size - rank); assert.equal(result.solutions, solutions);
    assert.equal(result.distance, 0); assert.equal(result.shortest, 1);
  }
  let tied;
  for (let lights = 1; lights < 65536 && !tied; lights++) { const result = solve(4, lights); if (result?.shortest > 1) tied = { lights, result }; }
  assert.ok(tied); const expected = chase(4, tied.lights); assert.equal(tied.result.mask, expected[0]);
  assert.equal(solve(4, tied.lights).mask, tied.result.mask);
});

test('Postcards encode the exact window state and honest remaining distance, without helper overlays', () => {
  for (const room of ROOMS) for (const lights of [room.lights, 0]) {
    const svg = toSVG(room.size, lights, { title: room.name, moves: 7 }), windows = [...svg.matchAll(/data-window="(\d+)" data-lit="(true|false)"/g)];
    assert.equal(windows.length, room.size ** 2);
    windows.forEach((window, i) => { assert.equal(Number(window[1]), i); assert.equal(window[2], String(Boolean(lights & (1 << i)))); });
    assert.ok(svg.includes(`7 knocks this attempt / ${solve(room.size, lights).distance} shortest remaining`));
    assert.doesNotMatch(svg, /NaN|Infinity|undefined|hint|plan-mark|<script/);
  }
  assert.match(toSVG(3, 0, { title: '<>&"' }), /&lt;&gt;&amp;&quot;/);
  assert.match(toSVG(5, 1), /no quiet plan/);
});

test('Out-of-building positions, malformed masks, sizes, and postcard metadata are rejected', () => {
  for (const size of [0, 2, 6, 4.5, NaN, '3']) assert.throws(() => solve(size, 0), RangeError);
  for (const mask of [-1, .5, 512, NaN, Infinity, '0']) {
    assert.throws(() => solve(3, mask), RangeError); assert.throws(() => knock(3, mask, 0), RangeError); assert.throws(() => applyPlan(3, 0, mask), RangeError);
  }
  for (const index of [-1, 9, .5, NaN, '1']) assert.throws(() => affected(3, index), RangeError);
  for (const metadata of [{ title: null }, { title: 'x'.repeat(61) }, { title: '\u0000' }, { moves: -1 }, { moves: 1.5 }, { moves: 1000001 }]) assert.throws(() => toSVG(3, 0, metadata), RangeError);
  for (const mask of [-1, 2 ** 25, '1', NaN]) assert.throws(() => countBits(mask), RangeError);
});
