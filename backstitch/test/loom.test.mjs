import test from 'node:test';
import assert from 'node:assert/strict';
import { pair, centered, walk } from '../core.mjs';
import { createLoom, advance, forgetTrail, resetLoom, atHome, clothSVG } from '../loom.mjs';

function moves(loom, count, direction) { for (let i = 0; i < count; i++) loom = advance(loom, direction); return loom; }
const times = loom => loom.trail.map(row => row.time);

test('A loom follows the engine, then reconstructs the entire missing trail from just its endpoint pair', () => {
  for (let rule = 0; rule < 256; rule++) {
    const state = rule % 2 ? pair('1000001', '0010100') : centered(13);
    const expected = walk(state, { rule, steps: 33 });
    const outward = moves(createLoom({ state, rule, depth: 33 }), 33, 1);
    assert.deepEqual(outward.state, expected.at(-1));
    assert.equal(outward.trail.length, 34);
    const forgotten = forgetTrail(outward);
    assert.equal(forgotten.trail.length, 1);
    assert.equal(forgotten.state, outward.state, 'forgetting does not alter either live row');
    let homeward = forgotten;
    for (let time = 32; time >= 0; time--) {
      homeward = advance(homeward, -1);
      assert.deepEqual(homeward.state, expected[time]);
    }
    assert.equal(atHome(homeward), true);
    assert.equal(homeward.hasMoved, true);
    assert.deepEqual(homeward.trail, outward.trail);
  }
});

test('Different drawing trails cannot influence forward or backward evolution', () => {
  const start = createLoom({ state: pair('00101101', '11010100'), rule: 30, depth: 64 });
  const drawn = moves(start, 27, 1), blank = forgetTrail(drawn);
  for (const direction of [-1, 1]) {
    let a = drawn, b = blank;
    for (let i = 0; i < 20; i++) {
      a = advance(a, direction); b = advance(b, direction);
      assert.deepEqual(a.state, b.state);
      assert.equal(a.time, b.time);
    }
  }
  let loom = forgetTrail(moves(start, 12, 1));
  loom = moves(loom, 3, -1); loom = moves(loom, 2, 1);
  assert.deepEqual(times(loom), [9, 10, 11, 12], 'visited times are unique and sorted');
  assert.deepEqual(loom.state, walk(start.state, { rule: 30, steps: 11 }).at(-1));
});

test('Time stops at both boundaries, reset restores the original seed, and states are immutable snapshots', () => {
  const input = { past: '10', current: '01' };
  const initial = createLoom({ state: input, rule: 110, depth: 1 });
  input.current = '00';
  assert.equal(initial.state.current, '01');
  assert.equal(advance(initial, -1), initial);
  const edge = advance(initial, 1);
  assert.equal(advance(edge, 1), edge);
  assert.equal(atHome(edge), false);
  assert.deepEqual(resetLoom(edge), initial);
  assert.equal(atHome(initial), true); assert.equal(initial.hasMoved, false);
  for (const value of [initial, initial.state, initial.origin, initial.trail, initial.trail[0], edge, edge.trail]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { edge.trail.push({ time: 20, current: '00' }); }, TypeError);
  assert.throws(() => { initial.state.past = '00'; }, TypeError);
});

test('Maximum-width and maximum-depth looms recover both rows after repeated forgetting', () => {
  const state = pair('1010'.repeat(40), '00111'.repeat(32));
  let loom = createLoom({ state, rule: 255, depth: 256 });
  for (let i = 0; i < 256; i++) { loom = advance(loom, 1); if (i % 7 === 0) loom = forgetTrail(loom); }
  for (let i = 0; i < 256; i++) { loom = advance(loom, -1); if (i % 11 === 0) loom = forgetTrail(loom); }
  assert.equal(atHome(loom), true);
  assert.deepEqual(loom.state, state);
  assert.ok(loom.trail.length < 12);
  assert.ok(clothSVG(loom).length < 100000);
});

test('Visible-cloth SVG keeps forgotten gaps, exact live memories, and sorted times without rebuilding', () => {
  const drawn = moves(createLoom({ rule: 110, depth: 64 }), 32, 1);
  const blank = forgetTrail(drawn), svg = clothSVG(blank);
  assert.deepEqual([...svg.matchAll(/data-time="(\d+)" data-bits="([01]+)"/g)].map(match => match.slice(1)), [['32', drawn.state.current]]);
  assert.deepEqual([...svg.matchAll(/data-memory="(past|current)" data-bits="([01]+)"/g)].map(match => match.slice(1)), [['past', drawn.state.past], ['current', drawn.state.current]]);
  assert.match(svg, /1 recorded row on/);
  assert.match(svg, /Blank rows are unrecorded/);
  assert.match(svg, /time 32 of 64/);
  assert.doesNotMatch(svg, /<script|href=|<image|foreignObject/);
  const home = moves(blank, 32, -1);
  assert.equal([...clothSVG(home).matchAll(/data-time=/g)].length, 33);
  assert.match(clothSVG(home), /Both rows match the starting pair/);
  assert.equal(clothSVG(drawn), clothSVG(drawn), 'stable export bytes');
});

test('SVG ink geometry paints every memory and recorded bit, including one-cell and 160-cell rings', () => {
  for (const width of [1, 7, 65, 160]) {
    const loom = moves(createLoom({ state: centered(width), depth: 16 }), 13, 1);
    const groups = [...clothSVG(loom).matchAll(/<g data-(?:time="\d+"|memory="(?:past|current)") data-bits="([01]+)"><rect[^>]*\/><path d="([^"]*)"/g)];
    assert.equal(groups.length, 16);
    for (const [, bits, path] of groups) {
      const runs = [...path.matchAll(/M([\d.]+),([\d.]+)h([\d.]+)v([\d.]+)h-([\d.]+)z/g)];
      for (let i = 0; i < width; i++) {
        const x = 64 + (i + 0.5) * 800 / width;
        assert.equal(runs.some(run => x > Number(run[1]) && x < Number(run[1]) + Number(run[3])), bits[i] === '1');
      }
      for (const run of runs) assert.equal(run[3], run[5]);
    }
  }
});

test('Invalid seeds, rules, depths, directions and forged looms are refused', () => {
  for (const state of [null, {}, { past: '01', current: '1' }, { past: '1\n', current: '01' }]) {
    assert.throws(() => createLoom({ state }));
  }
  for (const rule of [-1, 256, 1.2, '90', NaN, Infinity]) assert.throws(() => createLoom({ rule }));
  for (const depth of [0, 257, 1.2, '64', NaN, Infinity]) assert.throws(() => createLoom({ depth }));
  for (const direction of [0, 2, '-1', null]) assert.throws(() => advance(createLoom(), direction));
  for (const loom of [null, {}, JSON.parse(JSON.stringify(createLoom()))]) {
    for (const action of [forgetTrail, resetLoom, atHome, clothSVG]) assert.throws(() => action(loom));
    assert.throws(() => advance(loom, 1));
  }
});
