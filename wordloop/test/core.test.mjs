import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLoop, windowAt, audit, locate, move, selection, bead, positionAt, toSVG, CENTER, RADIUS } from '../core.mjs';
function words(alphabet, order) {
  if (order === 0) return [''];
  return words(alphabet, order - 1).flatMap(prefix => [...alphabet].map(symbol => prefix + symbol));
}
test('Every supported alphabet size and order produces exactly every independently enumerated word', () => {
  for (const alphabet of ['01', 'ABC', 'NSEW']) for (let order = 1; order <= 5; order++) {
    const loop = makeLoop(alphabet, order), expected = words(alphabet, order), observed = [];
    assert.equal(loop.tape.length, alphabet.length ** order);
    for (let position = 0; position < loop.tape.length; position++) {
      // Independent circular indexing checks the construction, not just its audit.
      let word = ''; for (let offset = 0; offset < order; offset++) word += loop.tape[(position + offset) % loop.tape.length];
      observed.push(word); assert.equal(windowAt(loop.tape, order, position), word); assert.equal(locate(loop, word), position);
    }
    assert.deepEqual(observed.sort(), expected.sort());
    assert.deepEqual(loop.proof, { possible: expected.length, positions: expected.length, distinct: expected.length, missing: 0, repeats: 0, valid: true });
  }
});
test('Known binary and one-symbol loops are deterministic and begin at the all-first-symbol window', () => {
  assert.equal(makeLoop('01', 3).tape, '00010111');
  assert.equal(makeLoop('ABC', 1).tape, 'ABC');
  for (const alphabet of ['01', 'ABC', 'NSEW', 'Z2', 'DABC']) for (const order of [1, 2, 5]) {
    const loop = makeLoop(alphabet, order);
    assert.equal(windowAt(loop.tape, order, 0), alphabet[0].repeat(order));
    assert.equal(makeLoop(alphabet, order).tape, loop.tape);
  }
  const first = makeLoop(); first.lookup.clear(); assert.equal(makeLoop().lookup.size, 8);
});
test('The join supplies real word symbols, even when a window wraps more than once', () => {
  const loop = makeLoop('01', 3);
  assert.equal(windowAt(loop.tape, 3, 6), '110'); assert.equal(windowAt(loop.tape, 3, 7), '100');
  assert.deepEqual(selection(loop, 7), [7, 0, 1]);
  assert.equal(locate(loop, '100'), 7); assert.equal(windowAt('01', 5, 1), '10101');
});
test('Audit detects missing and repeated words instead of trusting ribbon length', () => {
  assert.deepEqual(audit('00000000', '01', 3), { possible: 8, positions: 8, distinct: 1, missing: 7, repeats: 7, valid: false });
  const original = makeLoop().tape;
  assert.equal(audit(original.slice(0, -1), '01', 3).valid, false);
  assert.equal(audit(original + original, '01', 3).repeats, 8);
  for (let shift = 0; shift < original.length; shift++) assert.equal(audit(original.slice(shift) + original.slice(0, shift), '01', 3).valid, true);
  assert.equal(audit(original.split('').reverse().join(''), '01', 3).valid, true);
});
test('Walking either direction and a full lap preserves the starting position and covers every window', () => {
  for (const length of [2, 8, 27, 256, 1024]) for (const start of [0, length - 1]) {
    let position = start; const seen = new Set([position]);
    for (let i = 0; i < length; i++) { position = move(position, 1, length); seen.add(position); }
    assert.equal(position, start); assert.equal(seen.size, length);
    assert.equal(move(move(start, -1, length), 1, length), start);
    assert.equal(move(start, length * 100, length), start);
    assert.ok(move(start, Number.MAX_SAFE_INTEGER, length) < length);
  }
});
test('Pointer geometry agrees with every drawn bead, cardinal points, and the ring join', () => {
  for (const length of [2, 8, 27, 1024]) for (let position = 0; position < length; position++) {
    const point = bead(position, length); assert.equal(positionAt(point.x, point.y, length), position);
    assert.ok(Math.abs(Math.hypot(point.x - CENTER, point.y - CENTER) - RADIUS) < 1e-10);
  }
  assert.equal(positionAt(CENTER, CENTER - RADIUS, 8), 0);
  assert.equal(positionAt(CENTER + RADIUS, CENTER, 8), 2);
  assert.equal(positionAt(CENTER, CENTER + RADIUS, 8), 4);
  assert.equal(positionAt(CENTER - RADIUS, CENTER, 8), 6);
  assert.equal(positionAt(CENTER, CENTER, 8), null); assert.equal(positionAt(0, 0, 8), null);
});
test('SVG shows the seam-crossing word, all beads, and only the selected window as bright', () => {
  const loop = makeLoop('01', 3), before = loop.tape, svg = toSVG(loop, 7);
  assert.equal((svg.match(/<g>/g) ?? []).length, 8);
  assert.equal((svg.match(/opacity="1"/g) ?? []).length, 3);
  assert.equal((svg.match(/stroke-width="2" fill="none"/g) ?? []).length, 3);
  assert.match(svg, />100<\/text>/); assert.match(svg, /POSITION 8 OF 8/);
  assert.ok(!svg.includes('NaN') && !svg.includes('script') && !svg.includes('undefined'));
  assert.equal(loop.tape, before);
  const big = toSVG(makeLoop('NSEW', 5), 1023); assert.equal((big.match(/<g>/g) ?? []).length, 1024);
});
test('Invalid alphabets, words, geometry, and bounds fail before building or exporting', () => {
  for (const alphabet of ['', '0', '001', 'ABCDE', 'ab', '<>', '🪡🧵', 'A B', null]) assert.throws(() => makeLoop(alphabet), RangeError);
  for (const order of [0, 6, 1.5, NaN, '3']) assert.throws(() => makeLoop('01', order), RangeError);
  for (const word of ['', '00', '0000', '0X1', 'abc']) assert.throws(() => locate(makeLoop(), word), RangeError);
  for (const position of [-1, 8, .1, NaN]) assert.throws(() => windowAt('00010111', 3, position), RangeError);
  assert.throws(() => audit('00X1', '01', 2), RangeError);
  assert.throws(() => audit('0'.repeat(1025), '01', 3), RangeError);
  assert.throws(() => windowAt('0', 3, 0), RangeError);
  assert.throws(() => move(0, 1, 1025), RangeError); assert.throws(() => move(0, Infinity, 8), RangeError);
  assert.throws(() => positionAt(NaN, 1, 8), RangeError); assert.throws(() => bead(0, 0), RangeError);
  assert.throws(() => toSVG({ alphabet: '<script>', order: 3, tape: '00010111' }), RangeError);
  assert.throws(() => selection({ alphabet: '01', order: 1000000, tape: '01' }, 0), RangeError);
});
