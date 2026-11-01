import test from 'node:test';
import assert from 'node:assert/strict';
import { pair, centered, elementary, step, walk, roundTrip, toSVG } from '../core.mjs';

const bits = (n, width) => n.toString(2).padStart(width, '0');
function reference(row, rule) {
  const table = bits(rule, 8), cells = [...row].map(Number), size = cells.length;
  return cells.map((_, i) => {
    const left = cells[(i + size - 1) % size], middle = cells[i], right = cells[(i + 1) % size];
    return table[7 - (4 * left + 2 * middle + right)];
  }).join('');
}

test('All 256 elementary rules agree with a separate neighborhood table, including tiny rings', () => {
  for (let rule = 0; rule < 256; rule++) {
    for (let width = 1; width <= 7; width++) {
      for (let n = 0; n < 2 ** width; n++) {
        const row = bits(n, width);
        assert.equal(elementary(row, rule), reference(row, rule));
      }
    }
  }
  assert.equal(elementary('0001000', 90), '0010100');
  assert.equal(elementary('10000', 90), '01001', 'the ring joins its ends');
  assert.equal(elementary('01001', 204), '01001', 'rule 204 copies the center');
});

test('Every pair on rings up to four cells is a permutation for every rule; both inverse laws hold', () => {
  for (let rule = 0; rule < 256; rule++) {
    for (let width = 1; width <= 4; width++) {
      const outputs = new Set();
      for (let a = 0; a < 2 ** width; a++) for (let b = 0; b < 2 ** width; b++) {
        const state = pair(bits(a, width), bits(b, width));
        const next = step(state, rule);
        outputs.add(`${next.past}/${next.current}`);
        assert.deepEqual(step(next, rule, -1), state);
        assert.deepEqual(step(step(state, rule, -1), rule), state);
        assert.equal(next.past, state.current);
        const expected = [...reference(state.current, rule)].map((bit, i) => String(Number(bit) ^ Number(state.past[i]))).join('');
        assert.equal(next.current, expected);
      }
      assert.equal(outputs.size, 2 ** (2 * width));
    }
  }
});

test('Reversal from a serialized endpoint reconstructs all earlier pairs without a log', () => {
  let random = 0xdecafbad;
  const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0);
  for (let rule = 0; rule < 256; rule++) {
    const width = rule % 37 + 1;
    const row = () => Array.from({ length: width }, () => String(next() >>> 31)).join('');
    const state = pair(row(), row()), outward = walk(state, { rule, steps: 41 });
    const endpoint = JSON.parse(JSON.stringify(outward.at(-1)));
    const homeward = walk(endpoint, { rule, steps: 41, direction: -1 });
    assert.deepEqual(homeward, [...outward].reverse());
    assert.deepEqual(homeward.at(-1), state);
  }
  for (const rule of [0, 30, 90, 110, 255]) {
    const trip = roundTrip(centered(160), { rule, steps: 256 });
    assert.equal(trip.recovered, true);
    assert.equal(trip.outward.length, 257);
    assert.equal(trip.homeward.length, 257);
  }
});

test('This is a second-order machine, not an ordinary automaton with an alleged inverse', () => {
  const a = pair('00000', '00100'), b = pair('10000', '00100');
  assert.notEqual(step(a, 90).current, step(b, 90).current, 'the past row matters');
  assert.equal(elementary('00000', 0), elementary('11111', 0), 'ordinary rule 0 loses the row');
  assert.deepEqual(step(a, 0), pair('00100', '00000'));
  assert.deepEqual(step(step(a, 0), 0), a, 'rule 0 swaps the two rows');
  assert.deepEqual(roundTrip(a, { steps: 0 }).outward, [a]);
  const trip = roundTrip(a, { steps: 0 });
  assert.equal(trip.recovered, true);
  assert.deepEqual(trip.homeward, [a]);
});

test('States and journeys own immutable snapshots, with a single centered seed', () => {
  assert.deepEqual(centered(1), pair('0', '1'));
  assert.equal(centered(4).current, '0010');
  const input = { past: '001', current: '110' }, trip = roundTrip(input, { steps: 2 });
  input.current = '000';
  assert.equal(trip.outward[0].current, '110');
  assert.ok(Object.isFrozen(trip) && Object.isFrozen(trip.outward) && Object.isFrozen(trip.homeward));
  for (const state of [...trip.outward, ...trip.homeward]) assert.ok(Object.isFrozen(state));
  assert.throws(() => { trip.outward[0].current = '000'; }, TypeError);
});

test('SVG records the exact current rows, reverse times, and both journeys, without external resources', () => {
  const trip = roundTrip(pair('1000001', '0010100'), { rule: 110, steps: 16 });
  const svg = toSVG(trip);
  const rows = [...svg.matchAll(/data-panel="(outward|homeward)" data-time="(\d+)" data-bits="([01]+)"/g)];
  assert.equal(rows.length, 34);
  for (let i = 0; i <= 16; i++) {
    assert.deepEqual(rows[i].slice(1), ['outward', String(i), trip.outward[i].current]);
    assert.deepEqual(rows[17 + i].slice(1), ['homeward', String(16 - i), trip.homeward[i].current]);
  }
  assert.match(svg, /Every stitch came home/);
  assert.match(svg, /rule 110, 16 steps/);
  assert.doesNotMatch(svg, /<script|href=|<image|<foreignObject/);
  assert.throws(() => toSVG(JSON.parse(JSON.stringify(trip))), /roundTrip/);
  assert.throws(() => toSVG(null), /roundTrip/);
  assert.equal([...toSVG(roundTrip(centered(), { steps: 0 })).matchAll(/data-panel=/g)].length, 2);
});

test('SVG ink run geometry paints the state, including fractional cell widths and edge runs', () => {
  const trip = roundTrip(pair('10101010101', '11100010011'), { rule: 30, steps: 23 });
  const groups = [...toSVG(trip).matchAll(/<g data-panel="(outward|homeward)"[^>]*data-bits="([01]+)"><rect[^>]*\/><path d="([^"]*)"/g)];
  assert.equal(groups.length, 48);
  for (const [, panel, row, path] of groups) {
    const runs = [...path.matchAll(/M([\d.]+),(\d+)h([\d.]+)v6h-([\d.]+)z/g)];
    for (let i = 0; i < row.length; i++) {
      const x = (panel === 'outward' ? 64 : 608) + (i + 0.5) * 448 / row.length;
      assert.equal(runs.some(run => x > Number(run[1]) && x < Number(run[1]) + Number(run[3])), row[i] === '1');
    }
    for (const run of runs) assert.equal(run[3], run[4]);
  }
});

test('Malformed pairs, rules, budgets, directions and oversized rows fail before work', () => {
  for (const row of ['', '012', '01\n', ['0'], null, '0'.repeat(161)]) assert.throws(() => pair(row, row));
  assert.throws(() => pair('1', '00'), /equal widths/);
  for (const width of [0, -1, 161, 1.5, '3', Infinity, NaN]) assert.throws(() => centered(width));
  for (const rule of [-1, 256, 1.5, '90', Infinity, NaN]) {
    assert.throws(() => elementary('001', rule));
    assert.throws(() => roundTrip(centered(), { rule, steps: 0 }));
  }
  for (const steps of [-1, 257, 1.5, '3', Infinity, NaN]) assert.throws(() => roundTrip(centered(), { steps }));
  for (const direction of [0, 2, '-1', null]) assert.throws(() => walk(centered(), { steps: 0, direction }));
  for (const state of [null, '01', {}, { past: '01', current: '0' }]) assert.throws(() => step(state, 90));
});
