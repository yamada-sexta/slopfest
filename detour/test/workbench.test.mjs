import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initial, advance, toSVG } from '../core.mjs';
import { MAX_STEPS, loadMap, frameAt, visitsAt, explain } from '../workbench.mjs';
import { specimens } from '../specimens.mjs';

for (const specimen of specimens) test(`Browser specimen preserves executable CLI source: ${specimen.file}`, async () => {
  assert.equal(specimen.source, await readFile(new URL(`../examples/${specimen.file}.tour`, import.meta.url), 'utf8'));
});

test('Every frame, byte prefix, and visit count matches direct execution, including backward jumps', () => {
  for (const specimen of specimens) {
    const bench = loadMap(specimen.source, specimen.input), input = Uint8Array.from(bench.input), expected = [], output = [];
    let cursor = initial(bench.program); expected.push({ cursor, output: [] });
    for (let i = 0; i < bench.result.steps; i++) {
      const next = advance(bench.program, cursor, input); output.push(...next.emitted); cursor = next.state;
      expected.push({ cursor, output: [...output] });
    }
    const positions = [...expected.keys(), bench.result.steps, 0, 3, 1, bench.result.steps - 1, 0];
    for (const position of positions) {
      const frame = frameAt(bench, position);
      assert.deepEqual(frame.cursor, expected[position].cursor); assert.deepEqual(frame.output, expected[position].output);
      assert.equal(frame.complete, position === bench.result.steps);
      const counts = visitsAt(bench, position); assert.equal(counts.reduce((a, b) => a + b, 0), position);
      for (let cell = 0; cell < counts.length; cell++) assert.equal(counts[cell], expected.slice(0, position).filter(entry => entry.cursor.y * bench.program.width + entry.cursor.x === cell).length);
    }
    visitsAt(bench, bench.result.steps).fill(0);
    assert.equal(visitsAt(bench, bench.result.steps).reduce((a, b) => a + b, 0), bench.result.steps);
    assert.throws(() => frameAt(bench, 1).output.push(9), TypeError);
  }
});

test('Instruction previews use actual zero/nonzero branches, input exhaustion, arithmetic, and emissions', () => {
  const countdown = loadMap(specimens[0].source);
  assert.match(explain(countdown, 6), /pocket 3 turns left, from east to north/);
  assert.match(explain(countdown, 36), /pocket 0 turns right, from east to south/);
  assert.match(explain(countdown, 9), /changes the pocket from 3 to 2/);
  assert.match(explain(countdown, 10), /emits "2 "/);
  assert.match(explain(countdown, 37), /halts here without moving/);
  assert.match(explain(countdown, 38), /walk is complete/);
  const echo = loadMap(specimens[2].source, 'aa');
  const reads = echo.result.history.flatMap((entry, i) => entry.op === ',' ? [i] : []);
  assert.match(explain(echo, reads[0]), /input byte 1 \(97\)/);
  assert.match(explain(echo, reads[1]), /input byte 2 \(97\)/);
  assert.match(explain(echo, reads[2]), /exhausted.*zero/);
  assert.deepEqual(frameAt(echo, echo.result.steps).output, [97, 97]);
});

test('Partial SVGs retain the full camera, exact visits and output, and an entry cursor before step one', () => {
  const bench = loadMap(specimens[0].source), box = toSVG(bench.program, bench.result).match(/viewBox="([^"]+)"/)[1];
  for (let position = 0; position <= bench.result.steps; position++) {
    const svg = toSVG(bench.program, bench.result, { position }), frame = frameAt(bench, position);
    assert.equal(svg.match(/viewBox="([^"]+)"/)[1], box);
    assert.equal([...svg.matchAll(/data-visits="(\d+)"/g)].reduce((sum, match) => sum + Number(match[1]), 0), position);
    assert.equal(svg.match(/points="([^"]+)"/)[1].split(' ').length, position + 1);
    assert.ok(svg.includes(` / ${position} steps / pocket ${frame.cursor.byte}`));
    assert.ok(svg.includes(`output: ${String.fromCharCode(...frame.output)}</text>`));
    assert.match(svg, /<circle /);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  }
  assert.match(toSVG(bench.program, bench.result, { position: 0 }), /ready \/ 0 steps/);
  assert.match(toSVG(bench.program, bench.result, { position: 12 }), /paused \/ 12 steps/);
  assert.equal(toSVG(bench.program, bench.result), toSVG(bench.program, bench.result, { position: bench.result.steps }));
});

test('Cycle inspection visits the exact repeated state and exports a proof only at the completed witness', () => {
  const bench = loadMap(specimens[3].source), cycle = bench.result.cycle;
  assert.equal(bench.result.status, 'cycle');
  assert.deepEqual(frameAt(bench, cycle.start).cursor, frameAt(bench, bench.result.steps).cursor);
  assert.match(explain(bench, bench.result.steps), /2 steps before a 6-step repeat.*"0 "/);
  assert.doesNotMatch(toSVG(bench.program, bench.result, { position: cycle.start }), /prefix: 2 steps/);
  assert.match(toSVG(bench.program, bench.result), /prefix: 2 steps \/ cycle: 6 steps/);
  assert.deepEqual(frameAt(bench, 2).output, []); assert.deepEqual(frameAt(bench, 3).output, [48, 32]);
  const long = loadMap('@>+:v\n ^  <', '', MAX_STEPS), summary = explain(long, long.result.steps);
  assert.ok(summary.length < 220); assert.match(summary, /914 bytes; preview:.*…/);
});

test('Budget, edge, and output stops keep their distinct explanations and final unexecuted tile', () => {
  const short = loadMap(specimens[0].source, '', 5);
  assert.equal(short.result.status, 'step-limit'); assert.match(explain(short, 5), /No loop has been proved/);
  const edge = loadMap('@'); assert.equal(edge.result.status, 'escaped'); assert.match(explain(edge, 1), /Edges do not wrap/);
  const output = loadMap(' /::::\\\n\n@>,   ?\n      #', 'ÿ'.repeat(512), MAX_STEPS);
  assert.equal(output.result.status, 'output-limit'); assert.equal(frameAt(output, output.result.steps).output.length, 8192);
  assert.match(explain(output, output.result.steps), /tile has not executed/);
  assert.equal(output.program.rows[output.result.cursor.y][output.result.cursor.x], ':');
});

test('Malformed drafts and invalid positions cannot mutate an existing loaded trace', () => {
  const bench = loadMap(specimens[0].source), saved = frameAt(bench, 20);
  for (const source of ['@xx', '@@', '', ' '.repeat(8193)]) assert.throws(() => loadMap(source), RangeError);
  assert.throws(() => loadMap('@#', 'π'.repeat(513)), RangeError);
  for (const steps of [0, -1, .5, 10001, NaN, '2000']) assert.throws(() => loadMap('@#', '', steps), RangeError);
  for (const position of [-1, .5, 39, null, NaN, '1']) {
    assert.throws(() => frameAt(bench, position), RangeError);
    assert.throws(() => visitsAt(bench, position), RangeError);
    assert.throws(() => toSVG(bench.program, bench.result, { position }), RangeError);
  }
  assert.throws(() => frameAt({}, 0), RangeError); assert.deepEqual(frameAt(bench, 20), saved);
});
