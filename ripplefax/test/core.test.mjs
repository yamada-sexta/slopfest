import test from 'node:test';
import assert from 'node:assert/strict';
import { tank, paint, line, clearWaves, advance, scene, pixels, SCENES, WIDTH, HEIGHT } from '../core.mjs';
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-11, `${actual} != ${expected}`);
const impulse = (world, x, y) => { world.current[y * world.width + x] = world.previous[y * world.width + x] = 1; };

test('One wave tick follows the four-neighbor stencil and reuses exactly three buffers', () => {
  const world = tank(17, 17), buffers = new Set([world.current, world.previous, world.scratch]); impulse(world, 8, 8);
  advance(world, { driven: false });
  close(world.current[8 * 17 + 8], 0.28);
  for (const [x, y] of [[7, 8], [9, 8], [8, 7], [8, 9]]) close(world.current[y * 17 + x], 0.18);
  assert.equal(world.current[7 * 17 + 7], 0); assert.equal(world.tick, 1);
  for (let i = 0; i < 20; i++) { advance(world, { driven: false }); assert.ok(buffers.has(world.current)); assert.ok(buffers.has(world.previous)); assert.ok(buffers.has(world.scratch)); }
  assert.equal(new Set([world.current, world.previous, world.scratch]).size, 3);
});
test('An impulse cannot jump farther than one cell per tick', () => {
  const world = tank(25, 25); impulse(world, 12, 12);
  for (let tick = 1; tick <= 8; tick++) {
    advance(world, { driven: false });
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) if (Math.abs(x - 12) + Math.abs(y - 12) > tick) assert.equal(world.current[y * 25 + x], 0);
  }
});
test('An undriven impulse remains symmetric and bounded through a long damped run', () => {
  const world = tank(25, 25); impulse(world, 12, 12); let peak = 0;
  for (let tick = 0; tick < 1500; tick++) {
    advance(world, { driven: false });
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
      const value = world.current[y * 25 + x]; assert.ok(Number.isFinite(value)); peak = Math.max(peak, Math.abs(value));
      if (tick % 100 === 0) { close(value, world.current[y * 25 + 24 - x]); close(value, world.current[(24 - y) * 25 + x]); }
    }
  }
  assert.ok(peak < 1); assert.ok(world.current.every(value => Math.abs(value) < 0.01));
});
test('A complete barrier blocks transmission; an erased opening lets the wave through', () => {
  const world = tank(31, 21); line(world, { x: 15, y: 0 }, { x: 15, y: 20 }, 'wall'); impulse(world, 8, 10);
  for (let tick = 0; tick < 200; tick++) advance(world, { driven: false });
  for (let y = 0; y < 21; y++) for (let x = 16; x < 31; x++) assert.equal(world.current[y * 31 + x], 0);
  paint(world, 15, 10, 'erase'); impulse(world, 8, 10);
  for (let tick = 0; tick < 100; tick++) advance(world, { driven: false });
  assert.ok(world.current.some((value, i) => i % 31 > 15 && Math.abs(value) > 0.001));
  for (let i = 0; i < world.walls.length; i++) if (world.walls[i]) { assert.equal(world.current[i], 0); assert.equal(world.previous[i], 0); assert.equal(world.scratch[i], 0); }
});
test('Opposite symmetric sources cancel on the middle line; matching sources reinforce it', () => {
  const opposite = tank(41, 41), matching = tank(41, 41);
  opposite.sources = matching.sources = [{ x: 14, y: 14 }, { x: 14, y: 26 }];
  for (let tick = 0; tick < 100; tick++) { advance(opposite, { opposite: true }); advance(matching); }
  for (let x = 0; x < 41; x++) close(opposite.current[20 * 41 + x], 0);
  assert.ok(matching.current.slice(20 * 41, 21 * 41).some(value => Math.abs(value) > 0.01));
  for (let y = 0; y < 41; y++) for (let x = 0; x < 41; x++) close(opposite.current[y * 41 + x], -opposite.current[(40 - y) * 41 + x]);
});
test('Wall strokes fill their path, keep the boundary closed, and silence covered sources', () => {
  const world = tank(17, 17); line(world, { x: 2, y: 3 }, { x: 14, y: 9 }, 'wall');
  assert.equal(world.walls[3 * 17 + 2], 1); assert.equal(world.walls[9 * 17 + 14], 1);
  for (let x = 2; x <= 14; x++) assert.equal(world.walls[(3 + Math.ceil((x - 2) / 2)) * 17 + x], 1);
  assert.equal(paint(world, 0, 0, 'erase'), false); assert.equal(world.walls[0], 1);
  assert.equal(line(world, { x: 2, y: 3 }, { x: 2, y: 3 }, 'ripple'), false);
  world.sources = [{ x: 2, y: 3 }]; for (let tick = 0; tick < 50; tick++) advance(world);
  assert.ok(world.current.every(value => value === 0));
  assert.throws(() => line(world, { x: -1, y: 0 }, { x: 1, y: 1 }, 'wall'), RangeError);
});
test('Ripple painting is bounded and dry walls stay zero; clear preserves the barriers', () => {
  const world = tank(17, 17); paint(world, 8, 8, 'wall'); assert.equal(paint(world, 8, 8), false);
  for (let i = 0; i < 100; i++) paint(world, 7, 8);
  assert.ok(world.current.every(value => value <= 2)); assert.equal(world.current[8 * 17 + 8], 0);
  assert.deepEqual(world.current, world.previous);
  const walls = world.walls.slice(); advance(world); clearWaves(world);
  assert.deepEqual(world.walls, walls); assert.equal(world.tick, 0); assert.ok(world.current.every(value => value === 0)); assert.ok(world.previous.every(value => value === 0));
});
for (let index = 0; index < SCENES.length; index++) test(`Prepared scene is deterministic, finite, and animated: ${SCENES[index]}`, () => {
  const first = scene(index), second = scene(index);
  assert.equal(first.width, WIDTH); assert.equal(first.height, HEIGHT); assert.equal(first.tick, 360); assert.deepEqual(first.current, second.current);
  assert.ok(first.current.some(value => Math.abs(value) > 0.01));
  for (let tick = 0; tick < 600; tick++) advance(first, { period: 12, opposite: true });
  assert.ok(first.current.every(value => Number.isFinite(value) && Math.abs(value) < 20));
  for (let i = 0; i < first.walls.length; i++) if (first.walls[i]) assert.equal(first.current[i], 0);
});
test('Raster output is opaque and distinguishes crests, troughs, and walls without changing the field', () => {
  const world = tank(8, 8); world.current[9] = 1; world.current[10] = -1;
  const before = world.current.slice(), data = pixels(world);
  assert.equal(data.length, 8 * 8 * 4); for (let i = 3; i < data.length; i += 4) assert.equal(data[i], 255);
  assert.ok(data[9 * 4] > data[9 * 4 + 2]); assert.ok(data[10 * 4 + 2] > data[10 * 4]); assert.deepEqual([...data.slice(0, 3)], [165, 181, 151]); assert.deepEqual(world.current, before);
});
test('Invalid dimensions, scene ids, brushes, and wave periods fail clearly', () => {
  for (const dims of [[7, 8], [8, 129], [8.5, 8]]) assert.throws(() => tank(...dims), RangeError);
  assert.throws(() => scene(3), RangeError); assert.throws(() => paint(tank(), 3, 3, 'unknown'), RangeError);
  for (const period of [0, 11, 61, NaN, 24.5]) assert.throws(() => advance(tank(), { period }), RangeError);
});
