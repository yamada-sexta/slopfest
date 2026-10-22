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

test('Every walking stitch joins the next entry, closes, and sums to the loop winding', () => {
  for (const [width, height] of [[4, 4], [5, 7], [20, 14]]) for (let seed = 0; seed < 12; seed++) {
    const world = cloth(width, height, seed), before = structuredClone(world), result = loops(world);
    for (const thread of result.threads) {
      assert.deepEqual(thread.steps.map(step => step.arc), thread.pieces);
      let horizontal = 0, vertical = 0;
      for (let i = 0; i < thread.steps.length; i++) {
        const step = thread.steps[i], next = thread.steps[(i + 1) % thread.steps.length];
        assert.equal(Math.floor(step.arc / 2), step.cell);
        assert.equal(step.nextCell, next.cell); assert.equal((step.exit + 2) % 4, next.entry);
        assert.notEqual(step.entry, step.exit);
        const x = step.cell % width, y = Math.floor(step.cell / width);
        const dx = [0, 1, 0, -1][step.exit], dy = [-1, 0, 1, 0][step.exit];
        const nx = (x + dx + width) % width, ny = (y + dy + height) % height;
        assert.equal(step.nextCell, ny * width + nx);
        assert.equal(step.wrapX, x + dx < 0 ? -1 : x + dx >= width ? 1 : 0);
        assert.equal(step.wrapY, y + dy < 0 ? -1 : y + dy >= height ? 1 : 0);
        horizontal += step.wrapX; vertical += step.wrapY;
      }
      assert.equal(horizontal, thread.horizontal); assert.equal(vertical, thread.vertical);
    }
    assert.deepEqual(world, before);
  }
});
test('A zero-winding seam loop walks out and back; a winding thread makes net trips', () => {
  const little = loops(cloth(8, 6, 0, 'check')).threads[0];
  assert.equal(little.steps.length, 4);
  assert.deepEqual(little.steps.map(({ cell, entry, exit, nextCell, wrapX, wrapY }) => [cell, entry, exit, nextCell, wrapX, wrapY]), [
    [0, 0, 1, 1, 0, 0], [1, 3, 0, 41, 0, -1], [41, 2, 3, 40, 0, 0], [40, 1, 2, 0, 0, 1]
  ]);
  assert.equal(little.vertical, 0);
  const long = loops(cloth(20, 14, 0, 'same')).threads[0];
  assert.equal(long.steps.length, 280); assert.equal(Math.abs(long.horizontal), 7); assert.equal(Math.abs(long.vertical), 10);
});
test('The walking marker follows the selected arc and stays out of ordinary SVG exports', () => {
  const world = cloth(8, 6, 0, 'check'), result = loops(world), thread = result.threads[3];
  for (const active of thread.pieces) {
    const cell = Math.floor(active / 2), marked = svg(world, { selected: 3, active });
    assert.match(marked, /stroke="#fff4d7" stroke-width=".18"/);
    assert.ok(marked.includes(`transform="translate(${cell % 8} ${Math.floor(cell / 8)})" d="${arcPath(world.tiles[cell], active % 2)}" fill="none" stroke="#fff4d7"`));
  }
  assert.ok(!svg(world, { selected: 3 }).includes('#fff4d7'));
  for (const active of [-1, 96, 0.5, NaN]) assert.throws(() => svg(world, { active }), RangeError);
  assert.throws(() => svg(world, { selected: 0, active: thread.pieces[0] }), RangeError);
});
test('Quarter-circle arcs bow toward the tile center so neighboring arcs form smooth rings', () => {
  for (const tile of [0, 1]) for (const arc of [0, 1]) {
    const match = arcPath(tile, arc).match(/^M ([\d.]+) ([\d.]+) A 0.5 0.5 0 0 ([01]) ([\d.]+) ([\d.]+)$/);
    assert.ok(match);
    const [sx, sy, sweep, ex, ey] = match.slice(1).map(Number), dx = ex - sx, dy = ey - sy;
    const distance = Math.hypot(dx, dy), height = Math.sqrt(0.25 - distance * distance / 4);
    // Recover the SVG circle center from the endpoints, radius, and sweep.
    const centers = [-1, 1].map(sign => [(sx + ex) / 2 - sign * dy / distance * height, (sy + ey) / 2 + sign * dx / distance * height]);
    const [cx, cy] = centers.find(([x, y]) => ((sx - x) * (ey - y) - (sy - y) * (ex - x) > 0) === Boolean(sweep));
    const bx = sx + ex - 2 * cx, by = sy + ey - 2 * cy, scale = 0.5 / Math.hypot(bx, by);
    const midX = cx + bx * scale, midY = cy + by * scale;
    assert.ok(Math.abs(Math.hypot(midX - 0.5, midY - 0.5) - (Math.SQRT1_2 - 0.5)) < 1e-12);
  }
});
