import test from 'node:test';
import assert from 'node:assert/strict';
import { cloth, turn, loops, svg, arcPath, PRESETS } from '../core.mjs';

// Independent endpoint union, without following a thread around the cloth.
function components(world) {
  const { width: w, height: h, tiles } = world, parent = Array.from({ length: tiles.length * 4 }, (_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { parent[find(a)] = find(b); };
  for (let cell = 0; cell < tiles.length; cell++) {
    const x = cell % w, y = Math.floor(cell / w), base = 4 * cell;
    const pairs = tiles[cell] ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
    pairs.forEach(([a, b]) => join(base + a, base + b));
    join(base + 1, 4 * (y * w + (x + 1) % w) + 3);
    join(base + 2, 4 * (((y + 1) % h) * w + x));
  }
  return { find, count: new Set(parent.map((_, i) => find(i))).size };
}
test('Checkerboard closes into four-arc rings, including rings across the seams', () => {
  const world = cloth(8, 6, 0, 'check'), result = loops(world);
  assert.equal(result.threads.length, 24);
  assert.ok(result.threads.every(t => t.pieces.length === 4 && t.horizontal === 0 && t.vertical === 0));
});
test('Uniform tiles wind around the loom with the expected lengths and winding', () => {
  for (const [w, h, count, length, horizontal, vertical] of [[4, 4, 4, 8, 1, 1], [8, 6, 2, 48, 3, 4], [20, 14, 2, 280, 7, 10]]) {
    const result = loops(cloth(w, h, 0, 'same'));
    assert.equal(result.threads.length, count);
    for (const thread of result.threads) { assert.equal(thread.pieces.length, length); assert.equal(Math.abs(thread.horizontal), horizontal); assert.equal(Math.abs(thread.vertical), vertical); }
  }
});
test('Tracing agrees with an independent endpoint graph across seeds and odd dimensions', () => {
  for (const [w, h] of [[4, 4], [5, 7], [12, 10], [24, 24]]) for (let seed = 0; seed < 20; seed++) {
    const world = cloth(w, h, seed), result = loops(world), graph = components(world);
    assert.equal(result.threads.length, graph.count);
    assert.deepEqual([...result.threads.flatMap(t => t.pieces)].sort((a, b) => a - b), Array.from({ length: 2 * w * h }, (_, i) => i));
    result.threads.forEach((thread, owner) => {
      const startCell = Math.floor(thread.pieces[0] / 2), startArc = thread.pieces[0] % 2;
      const port = world.tiles[startCell] && startArc === 1 ? 1 : startArc === 1 ? 2 : 0;
      const root = graph.find(startCell * 4 + port);
      thread.pieces.forEach(id => {
        assert.equal(result.owners[id], owner);
        const cell = Math.floor(id / 2), arc = id % 2, endpoint = world.tiles[cell] && arc === 1 ? 1 : arc === 1 ? 2 : 0;
        assert.equal(graph.find(cell * 4 + endpoint), root);
      });
    });
  }
});
test('A tile turn merges local rings; turning it back recovers the exact cloth', () => {
  const world = cloth(8, 6, 0, 'check'), changed = turn(world, 9);
  assert.equal(loops(changed).threads.length, loops(world).threads.length - 1);
  assert.deepEqual(turn(changed, 9), world); assert.notDeepEqual(world, changed);
  assert.equal(world.tiles[9], 0);
});
test('Single turns can split, merge, or reconnect a winding thread without losing arcs', () => {
  const changes = new Set();
  for (let seed = 0; seed < 6; seed++) {
    const world = cloth(5, 7, seed), before = loops(world).threads.length;
    for (let cell = 0; cell < world.tiles.length; cell++) {
      const result = loops(turn(world, cell)), delta = result.threads.length - before;
      assert.ok(Math.abs(delta) <= 1); changes.add(delta);
      assert.equal(result.threads.reduce((sum, t) => sum + t.pieces.length, 0), 70);
    }
  }
  assert.deepEqual([...changes].sort(), [-1, 0, 1]);
});
test('Seeds and presets are repeatable, independent, and actually differ', () => {
  for (const preset of PRESETS) {
    const { width, height, seed, pattern } = preset;
    const first = cloth(width, height, seed, pattern), second = cloth(width, height, seed, pattern);
    assert.deepEqual(first, second); first.tiles[0] ^= 1; assert.notDeepEqual(first, second);
  }
  assert.notDeepEqual(cloth(12, 10, 42), cloth(12, 10, 43));
});
test('SVG has two correctly paired arcs per tile, local geometry, colors, and optional isolation', () => {
  const world = cloth(8, 6, 0, 'check'), image = svg(world), isolated = svg(world, { selected: 0, grid: false });
  assert.match(image, /viewBox="0 0 8 6" width="512" height="384"/);
  assert.equal((image.match(/data-arc=/g) || []).length, 96);
  assert.equal((isolated.match(/opacity="1"/g) || []).length, 4);
  assert.equal((isolated.match(/opacity="0.14"/g) || []).length, 92);
  assert.ok(!isolated.includes('#38424a')); assert.ok(!image.includes('NaN'));
  assert.equal(new Set([arcPath(0, 0), arcPath(0, 1), arcPath(1, 0), arcPath(1, 1)]).size, 4);
  assert.throws(() => svg(world, { selected: 24 }), RangeError);
});
test('Bounds fail clearly before oversized allocation or an invalid trace', () => {
  for (const [w, h] of [[0, 6], [4.5, 6], [25, 6], [6, 3]]) assert.throws(() => cloth(w, h), RangeError);
  for (const seed of [-1, 0x100000000, NaN, 0.5]) assert.throws(() => cloth(8, 6, seed), RangeError);
  assert.throws(() => cloth(8, 6, 0, 'unknown'), RangeError);
  const world = cloth(8, 6); assert.throws(() => turn(world, 48), RangeError); assert.throws(() => turn(world, -1), RangeError);
  assert.throws(() => loops({ width: 8, height: 6, tiles: [0] }), RangeError);
  assert.throws(() => arcPath(2, 0), RangeError);
});
