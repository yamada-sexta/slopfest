import test from 'node:test';
import assert from 'node:assert/strict';
import { TAU, DT, SCENES, scene, settings, advance, neighbors, agreement, nudge, scatter, nearest, toSVG } from '../core.mjs';
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
const field = phases => ({ nodes: phases.map((phase, i) => ({ x: 100 + i * 40, y: 100, phase, bias: 0 })), tick: 0, scrambles: 0 });

test('Every clearing is reproducible, bounded, independently owned, and distinct', () => {
  const worlds = SCENES.map((_, i) => scene(i));
  for (let i = 0; i < worlds.length; i++) {
    assert.deepEqual(worlds[i], scene(i)); assert.equal(worlds[i].nodes.length, 72);
    for (const node of worlds[i].nodes) { assert.ok(node.x >= 0 && node.x <= 960); assert.ok(node.y >= 0 && node.y <= 560); assert.ok(node.phase >= 0 && node.phase < TAU); }
  }
  assert.notDeepEqual(worlds[0], worlds[1]); assert.notDeepEqual(worlds[1], worlds[2]);
  worlds[0].nodes[0].phase = 1; assert.notDeepEqual(worlds[0], scene(0));
});
test('Distance creates a symmetric graph with no self edges, including the exact boundary', () => {
  const world = field([0, 1, 2]);
  assert.deepEqual(neighbors(world, 40), [[1], [0, 2], [1]]);
  assert.deepEqual(neighbors(world, 39), [[], [], []]);
  assert.deepEqual(neighbors(world, 80), [[1, 2], [0, 2], [0, 1]]);
  world.nodes[1].y = 130; assert.deepEqual(neighbors(world, 50), [[1], [0, 2], [1]]);
});
test('A simultaneous step matches hand-calculated pair and three-clock derivatives', () => {
  const world = field([0, Math.PI / 2]); advance(world, { radius: 40, pull: 3, spread: 0 });
  close(world.nodes[0].phase, DT * (TAU * .8 + 3));
  close(world.nodes[1].phase, Math.PI / 2 + DT * (TAU * .8 - 3));
  const chain = field([0, Math.PI / 2, Math.PI]); advance(chain, { radius: 40, pull: 2, spread: 0 });
  close(chain.nodes[0].phase, DT * (TAU * .8 + 2));
  close(chain.nodes[1].phase, Math.PI / 2 + DT * TAU * .8);
  close(chain.nodes[2].phase, Math.PI + DT * (TAU * .8 - 2));
});
test('Isolated clocks and zero-pull fields follow their exact independent frequencies', () => {
  for (const options of [{ radius: 20, pull: 8, spread: .2 }, { radius: 1000, pull: 0, spread: .2 }]) {
    const world = field([.3, 2.1, 5.9]); world.nodes.forEach((node, i) => { node.bias = i - 1; });
    const before = structuredClone(world); advance(world, options, 1800);
    world.nodes.forEach((node, i) => {
      const expected = (before.nodes[i].phase + 15 * TAU * (.8 + options.spread * node.bias)) % TAU;
      close(node.phase, expected); assert.equal(node.x, before.nodes[i].x); assert.equal(node.bias, before.nodes[i].bias);
    });
    assert.equal(world.tick, 1800);
  }
});
test('Batch sizes and node order do not change the simultaneous evolution', () => {
  const original = scene(0), batched = structuredClone(original), chunked = structuredClone(original), reversed = structuredClone(original);
  reversed.nodes.reverse(); advance(batched, SCENES[0], 360);
  for (let i = 0; i < 60; i++) advance(chunked, SCENES[0], 6);
  advance(reversed, SCENES[0], 360); reversed.nodes.reverse();
  assert.deepEqual(chunked, batched);
  batched.nodes.forEach((node, i) => close(reversed.nodes[i].phase, node.phase));
  assert.deepEqual(original, scene(0));
});
test('Agreement measures phase alignment, not coincident brightness or local choir timing', () => {
  close(agreement(field([1, 1, 1, 1])), 1);
  close(agreement(field([0, Math.PI / 2, Math.PI, Math.PI * 1.5])), 0);
  close(agreement(field([.3, .3 + Math.PI])), 0);
  const left = scene(1); left.nodes = left.nodes.slice(0, 36);
  const right = scene(1); right.nodes = right.nodes.slice(36);
  advance(left, SCENES[1], 1200); advance(right, SCENES[1], 1200);
  assert.ok(agreement(left) > .999); assert.ok(agreement(right) > .999);
  assert.ok(agreement({ ...left, nodes: [...left.nodes, ...right.nodes] }) < .3);
});
test('Neighbors synchronize a clearing, while disconnected choirs join only when they can hear', () => {
  const one = scene(0), initial = agreement(one); advance(one, SCENES[0], 1200);
  assert.ok(agreement(one) > .97); assert.ok(agreement(one) > initial + .3);
  const two = scene(1); advance(two, SCENES[1], 1200); assert.ok(agreement(two) < .3);
  advance(two, { ...SCENES[1], radius: 700 }, 1200); assert.ok(agreement(two) > .999);
  const independent = scene(2); advance(independent, SCENES[2], 1200); assert.ok(agreement(independent) < .4);
});
test('Nudges affect one phase only; scatter changes phases without resetting time or positions', () => {
  const world = scene(0), before = structuredClone(world); nudge(world, 31);
  world.nodes.forEach((node, i) => { if (i === 31) close(node.phase, (before.nodes[i].phase + TAU / 4) % TAU); else assert.deepEqual(node, before.nodes[i]); });
  assert.equal(world.tick, before.tick);
  advance(world, SCENES[0], 120); const positions = world.nodes.map(({ phase, ...node }) => node);
  scatter(world); const first = world.nodes.map(node => node.phase);
  assert.equal(world.tick, 120); assert.deepEqual(world.nodes.map(({ phase, ...node }) => node), positions);
  scatter(world); assert.notDeepEqual(world.nodes.map(node => node.phase), first);
  const same = scene(0); scatter(same); assert.deepEqual(same.nodes.map(node => node.phase), first);
  assert.equal(nearest(world, world.nodes[45].x, world.nodes[45].y), 45);
});
test('SVG captures exact clock hands and simulation labels without selection guides or mutation', () => {
  const world = field([0, Math.PI / 2, Math.PI, Math.PI * 1.5]); world.tick = 120;
  const before = structuredClone(world), svg = toSVG(world);
  assert.equal((svg.match(/<g transform=/g) ?? []).length, 4);
  for (const endpoint of ['0.000 -12.000', '12.000 -0.000', '0.000 12.000', '-12.000 0.000']) assert.ok(svg.includes(`L${endpoint}`));
  assert.match(svg, /1\.00s \/ 0\.0% FIELD AGREEMENT/);
  assert.ok(!svg.includes('NaN') && !svg.includes('undefined') && !svg.includes('script') && !svg.includes('stroke-dasharray'));
  assert.deepEqual(world, before);
});
test('Malformed fields, settings, and work limits fail clearly before simulation', () => {
  for (const kind of [-1, 3, 0.5, '0']) assert.throws(() => scene(kind), RangeError);
  for (const options of [{ radius: 19 }, { radius: Infinity }, { pull: -1 }, { pull: 9 }, { spread: NaN }, { spread: .21 }, { pull: '4' }]) assert.throws(() => settings(options), RangeError);
  const world = scene(0), original = structuredClone(world);
  for (const ticks of [0, -1, .5, 3601, NaN]) assert.throws(() => advance(world, {}, ticks), RangeError);
  for (const index of [-1, 72, 1.5]) assert.throws(() => nudge(world, index), RangeError);
  assert.throws(() => nearest(world, Infinity, 0), RangeError); assert.deepEqual(world, original);
  for (const bad of [null, field([]), { ...world, nodes: Array(145) }, { ...world, tick: -1 }, { ...world, nodes: [{ x: 0, y: 0, bias: 0, phase: TAU }] }]) assert.throws(() => advance(bad), RangeError);
});
