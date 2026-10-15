import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, inventory, paint, samePicture, toSVG } from '../core.mjs';
import { pours, pour } from '../pours.mjs';

test('Every colored 2 × 2 block has a unique forward state and exact inverse in both partitions', () => {
  for (const phase of [0, 1]) {
    const outputs = new Set();
    for (let pattern = 0; pattern < 256; pattern++) {
      const input = [pattern & 3, (pattern >>> 2) & 3, (pattern >>> 4) & 3, (pattern >>> 6) & 3];
      const world = createWorld(2, 2, input); world.tick = phase;
      step(world); outputs.add([...world.cells].join(''));
      step(world, -1);
      assert.deepEqual([...world.cells], input, `pattern ${pattern}, partition ${phase}`);
      assert.equal(world.tick, phase);
    }
    assert.equal(outputs.size, 256);
  }
});

for (const [width, height] of [[2, 6], [4, 4], [10, 14], [96, 64]]) {
  test(`A long mixed timeline returns exactly on a ${width} × ${height} wrapping grid`, () => {
    const input = Array.from({ length: width * height }, (_, i) => ((Math.imul(i + 19, 2654435761) >>> 8) ^ (i >>> 3)) & 3);
    const world = createWorld(width, height, input), counts = inventory(world.cells);
    for (let i = 0; i < 301; i++) {
      step(world);
      if (i % 37 === 0) assert.deepEqual(inventory(world.cells), counts);
    }
    for (let i = 0; i < 111; i++) step(world, -1);
    for (let i = 0; i < 19; i++) step(world);
    for (let i = 0; i < 209; i++) step(world, -1);
    assert.equal(world.tick, 0);
    assert.deepEqual([...world.cells], input);
    assert.deepEqual(inventory(world.cells), counts);
    assert.equal(step(world, -1), false);
  });
}

for (const specimen of pours) {
  test(`The ${specimen.name} pour changes, conserves every color, and unspills`, () => {
    const world = pour(specimen.id), initial = world.cells.slice(), counts = inventory(initial);
    assert.ok(counts.slice(1).every(count => count > 0));
    for (let i = 0; i < 200; i++) step(world);
    assert.equal(samePicture(initial, world.cells), false);
    assert.deepEqual(inventory(world.cells), counts);
    for (let i = 0; i < 200; i++) step(world, -1);
    assert.equal(samePicture(initial, world.cells), true);
    assert.deepEqual(pour(specimen.id).cells, initial);
  });
}

test('Painting rebases time, clips at the edges, and preserves untouched ink', () => {
  const world = createWorld(8, 8); step(world);
  assert.equal(paint(world, 0, 0, 2, 1), true);
  assert.equal(world.tick, 0);
  assert.equal(inventory(world.cells)[2], 3);
  assert.equal(world.cells[7], 0); assert.equal(world.cells[56], 0);
  step(world); const before = world.cells.slice();
  assert.equal(paint(world, 6, 6, 3, 0), true);
  assert.equal(world.cells[54], 3);
  assert.equal(inventory(world.cells)[2], inventory(before)[2]);
  const edited = world.cells.slice();
  for (let i = 0; i < 17; i++) step(world);
  for (let i = 0; i < 17; i++) step(world, -1);
  assert.deepEqual(world.cells, edited);
  assert.equal(paint(world, 6, 6, 0, 0), true);
  assert.equal(world.cells[54], 0);
});

test('Empty strokes do not reset the clock and input snapshots remain independent', () => {
  const input = new Uint8Array(16), world = createWorld(4, 4, input);
  input[0] = 3; assert.equal(world.cells[0], 0);
  step(world);
  assert.equal(paint(world, 1, 1, 0, 0), false);
  assert.equal(world.tick, 1);
  assert.equal(paint(world, -10, -10, 1, 1), false);
});

test('Malformed worlds, unsupported time directions, and invalid brushes fail clearly', () => {
  for (const [width, height] of [[3, 4], [0, 4], [4, 161], [2.5, 4]]) assert.throws(() => createWorld(width, height), /even integers/);
  assert.throws(() => createWorld(2, 2, [0, 1]), /per cell/);
  assert.throws(() => createWorld(2, 2, [0, 1, 2, 256]), /ink value/);
  assert.throws(() => createWorld(2, 2, [0, 1, 2, .5]), /ink value/);
  assert.throws(() => pour('missing'), /Unknown/);
  const world = createWorld(4, 4);
  assert.throws(() => step(world, 0), /direction/);
  assert.throws(() => paint(world, 0, 0, 4), /ink/);
  assert.throws(() => paint(world, 0, 0, 1, 7), /radius/);
});

test('SVG encodes exact cell positions with fixed colors and a finite view box', () => {
  const world = createWorld(2, 2, [1, 0, 2, 3]);
  const svg = toSVG(world);
  assert.match(svg, /viewBox="0 0 2 2"/);
  assert.match(svg, /M0,0h1v1h-1z/); assert.match(svg, /M0,1h1v1h-1z/); assert.match(svg, /M1,1h1v1h-1z/);
  assert.doesNotMatch(svg, /M1,0h1v1h-1z|NaN|undefined|script|foreignObject/);
});
