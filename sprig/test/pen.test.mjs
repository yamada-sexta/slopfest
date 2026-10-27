import test from 'node:test';
import assert from 'node:assert/strict';
import { trace, grow, LIMITS } from '../language.mjs';
import { preparePen, frameAt, snapshotSVG, sourceWindow, drawingStyle } from '../pen.mjs';
import { specimens } from '../specimens.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);
const viewBox = svg => svg.match(/viewBox="([^"]+)"/)[1];
const paths = svg => [...svg.matchAll(/M[-\d.,]+L[-\d.,]+/g)].length;
const dots = svg => [...svg.matchAll(/<circle /g)].length;

test('Visible marks retain expanded order across silent letters, moves, turns, and branches', () => {
  const word = 'XF.[+M.F.]F.';
  const drawing = trace(word, { angle: 90, step: 10 });
  assert.deepEqual(drawing.marks, [
    { kind: 'stroke', index: 0, source: 1 }, { kind: 'bud', index: 0, source: 2 },
    { kind: 'bud', index: 1, source: 6 }, { kind: 'stroke', index: 1, source: 7 },
    { kind: 'bud', index: 2, source: 8 }, { kind: 'stroke', index: 2, source: 10 },
    { kind: 'bud', index: 3, source: 11 },
  ]);
  const pen = preparePen(drawing);
  assert.deepEqual(frameAt(pen, 0), { position: 0, strokes: 0, buds: 0, marker: null });
  const expected = [
    [1, 0, 0, -10, 0], [1, 1, 0, -10, null], [1, 2, 10, -10, null],
    [2, 2, 20, -10, 1], [2, 3, 20, -10, null], [3, 3, 0, -20, 0],
    [3, 4, 0, -20, null],
  ];
  expected.forEach(([strokes, buds, x, y, branch], i) => {
    const frame = frameAt(pen, i + 1);
    assert.equal(frame.strokes, strokes); assert.equal(frame.buds, buds);
    close(frame.marker.x, x); close(frame.marker.y, y); assert.equal(frame.marker.branch, branch);
    assert.equal(frame.marker.source, drawing.marks[i].source);
    assert.equal(word[frame.marker.source], frame.marker.kind === 'stroke' ? 'F' : '.');
  });
});

test('Every specimen prefix agrees with an independent scan of the expanded word', () => {
  for (const specimen of specimens) {
    const result = grow(specimen.source), pen = preparePen(result.drawing);
    let strokes = 0, buds = 0, position = 0;
    for (let source = 0; source < result.symbols.length; source++) {
      const symbol = result.symbols[source];
      if (symbol !== 'F' && symbol !== '.') continue;
      if (symbol === 'F') strokes++; else buds++;
      const frame = frameAt(pen, ++position);
      assert.equal(frame.strokes, strokes); assert.equal(frame.buds, buds);
      assert.equal(frame.marker.source, source);
    }
    assert.equal(position, pen.total);
    for (const point of [0, 1, Math.floor(position / 2), position - 1, position]) {
      const frame = frameAt(pen, point), svg = snapshotSVG(pen, point);
      assert.equal(paths(svg), frame.strokes); assert.equal(dots(svg), frame.buds);
      assert.equal(viewBox(svg), viewBox(result.svg));
    }
  }
});

test('Full snapshots match the original serializer in every palette; preview colors and camera agree', () => {
  for (const specimen of specimens) for (const palette of ['moss', 'blueprint', 'ink', 'unknown']) {
    const result = grow(specimen.source, { palette }), pen = preparePen(result.drawing);
    const before = structuredClone(result.drawing);
    assert.equal(snapshotSVG(pen, pen.total, { palette }), result.svg);
    const style = drawingStyle(result.drawing, palette);
    const rounded = value => Number(value.toFixed(3));
    assert.deepEqual(viewBox(result.svg).split(' ').map(Number), [style.x, style.y, style.width, style.height].map(rounded));
    assert.ok(result.svg.includes(`fill="${style.background}"`));
    assert.ok(result.svg.includes(`stroke="${style.stroke}"`));
    assert.ok(result.svg.includes(`<g fill="${style.bud}">`));
    assert.ok(result.svg.includes(`stroke-width="${rounded(style.thickness)}"`));
    if (result.drawing.buds.length) assert.ok(result.svg.includes(`r="${rounded(style.radius)}"`));
    snapshotSVG(pen, 0, { palette }); frameAt(pen, 1);
    assert.deepEqual(result.drawing, before);
  }
});

test('Partial snapshots omit later marks and the inspection ring while keeping the full viewport', () => {
  const result = grow('seed F.[+F.]F.\ndepth 0\nangle 90'), pen = preparePen(result.drawing);
  for (let point = 0; point <= pen.total; point++) {
    const svg = snapshotSVG(pen, point), frame = frameAt(pen, point);
    assert.equal(paths(svg), frame.strokes); assert.equal(dots(svg), frame.buds);
    assert.equal(viewBox(svg), viewBox(result.svg));
    assert.doesNotMatch(svg, /marker|last.mark|<script|NaN|Infinity/);
  }
});

test('Empty words, silent drawings, and bud-only drawings have usable pen states and SVGs', () => {
  for (const source of ['seed X\ndepth 1\nrule X ->', 'seed M[+X]|\ndepth 0']) {
    const result = grow(source), pen = preparePen(result.drawing);
    assert.equal(pen.total, 0); assert.equal(frameAt(pen, 0).marker, null);
    assert.equal(snapshotSVG(pen, 0), result.svg);
    assert.doesNotMatch(result.svg, /NaN|Infinity/);
  }
  const pen = preparePen(trace('.M..', { angle: 90, step: 2 }));
  assert.equal(pen.total, 3); assert.equal(frameAt(pen, 2).strokes, 0);
  close(frameAt(pen, 2).marker.y, -2);
  assert.equal(dots(snapshotSVG(pen, 2)), 2);
});

test('Expanded-word excerpts identify endpoints, clipped context, and the state before drawing', () => {
  assert.deepEqual(sourceWindow('', -1), { before: '', current: '', after: '', left: false, right: false });
  assert.deepEqual(sourceWindow('ABCDEF', -1, 2), { before: '', current: '', after: 'AB', left: false, right: true });
  assert.deepEqual(sourceWindow('ABCDEF', 0, 2), { before: '', current: 'A', after: 'BC', left: false, right: true });
  assert.deepEqual(sourceWindow('ABCDEF', 3, 2), { before: 'BC', current: 'D', after: 'EF', left: true, right: false });
  assert.deepEqual(sourceWindow('ABCDEF', 5, 2), { before: 'DE', current: 'F', after: '', left: true, right: false });
});

test('Malformed pen traces cannot point outside finite, ordered geometry', () => {
  const valid = trace('F.F.', { angle: 90, step: 2 });
  const mutations = [
    d => { d.marks.pop(); }, d => { d.marks[1].source = 0; },
    d => { d.marks[1].source = LIMITS.symbols; }, d => { d.marks[0].source = -1; },
    d => { d.marks[0].index = 1; }, d => { d.marks[1].kind = 'move'; },
    d => { d.marks[0].index = .5; }, d => { d.bounds.minX = NaN; },
    d => { d.bounds.maxY = d.bounds.minY - 1; }, d => { d.segments[0].x2 = Infinity; },
    d => { d.segments[0].branch = -1; }, d => { d.buds[0].x = NaN; },
    d => { d.marks[0] = null; }, d => { d.segments[0] = null; },
  ];
  for (const mutate of mutations) {
    const drawing = structuredClone(valid); mutate(drawing);
    assert.throws(() => preparePen(drawing), RangeError);
  }
  assert.throws(() => preparePen(null), RangeError);
  const pen = preparePen(valid);
  for (const value of [-1, .5, 5, NaN, Infinity, '1']) {
    assert.throws(() => frameAt(pen, value), RangeError);
    assert.throws(() => snapshotSVG(pen, value), RangeError);
  }
  for (const args of [[null, -1], ['ABC', -2], ['ABC', 3], ['ABC', 1.5], ['ABC', 0, 0], ['ABC', 0, 31]]) {
    assert.throws(() => sourceWindow(...args), RangeError);
  }
});

test('Replay remains bounded at the symbol and stroke limits, including bud-heavy words', () => {
  const buds = preparePen(trace('.'.repeat(LIMITS.symbols), { angle: 0, step: 1 }));
  assert.equal(buds.total, LIMITS.symbols);
  assert.equal(frameAt(buds, LIMITS.symbols).buds, LIMITS.symbols);
  assert.equal(frameAt(buds, 1).buds, 1);
  assert.equal(dots(snapshotSVG(buds, 2)), 2);
  const strokes = preparePen(trace('F'.repeat(LIMITS.segments), { angle: 0, step: 1 }));
  assert.equal(frameAt(strokes, LIMITS.segments).strokes, LIMITS.segments);
  assert.throws(() => trace('.'.repeat(LIMITS.symbols + 1), { angle: 0, step: 1 }), /100,000/);
  assert.throws(() => trace('F'.repeat(LIMITS.segments + 1), { angle: 0, step: 1 }), /30,000/);
  assert.throws(() => sourceWindow('.'.repeat(LIMITS.symbols + 1), 0), RangeError);
});
