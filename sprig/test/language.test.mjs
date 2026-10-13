import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse, expand, trace, grow, SprigError } from '../language.mjs';
import { specimens } from '../specimens.mjs';
const exec = promisify(execFile);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

test('Settings, defaults, decimals, comments, and CRLF parse', () => {
  const p = parse('# hello\r\nseed X # seed\r\nangle 22.5\r\nstep .5\r\nrule X -> F[+X]');
  assert.equal(p.depth, 5); assert.equal(p.angle, 22.5); assert.equal(p.step, .5);
  assert.equal(p.rules.get('X'), 'F[+X]');
});
test('Rewriting is parallel, preserves unruled symbols, and depth zero is the seed', () => {
  const p = parse('seed F+G\ndepth 2\nrule F -> FG\nrule G -> F');
  assert.equal(expand(p, 0), 'F+G');
  assert.equal(expand(p, 1), 'FG+F');
  assert.equal(expand(p), 'FGF+FG');
});
test('An empty rule deletes a symbol', () => {
  assert.equal(expand(parse('seed XF\ndepth 1\nrule X ->')), 'F');
});
test('Turning, nondrawing movement, buds, and silent symbols have distinct semantics', () => {
  const d = trace('XF+MF.|F', { angle: 90, step: 10 });
  assert.equal(d.segments.length, 3); assert.equal(d.buds.length, 1);
  close(d.segments[0].x2, 0); close(d.segments[0].y2, -10);
  close(d.segments[1].x1, 10); close(d.segments[1].x2, 20);
  close(d.segments[2].x2, 10);
  close(d.buds[0].x, 20);
});
test('Branching restores both position and heading', () => {
  const d = trace('F[+F]F', { angle: 90, step: 10 });
  close(d.segments[1].x2, 10); close(d.segments[1].y2, -10);
  close(d.segments[2].x1, 0); close(d.segments[2].y1, -10);
  close(d.segments[2].x2, 0); close(d.segments[2].y2, -20);
  assert.equal(d.segments[1].branch, 1); assert.equal(d.segments[2].branch, 0);
});
for (const specimen of specimens) {
  test(`Specimen grows into finite SVG geometry: ${specimen.name}`, () => {
    const result = grow(specimen.source);
    assert.ok(result.drawing.segments.length > 50);
    assert.ok(Object.values(result.drawing.bounds).every(Number.isFinite));
    assert.match(result.svg, /^<svg xmlns=/);
    assert.doesNotMatch(result.svg, /NaN|Infinity|undefined|script|foreignObject/);
    assert.equal(grow(specimen.source).svg, result.svg);
  });
}
test('Known Hilbert and Koch stroke counts catch rewrite regressions', () => {
  assert.equal(grow(specimens[2].source).drawing.segments.length, 3 * 4 ** 4);
  assert.equal(grow(specimens[3].source).drawing.segments.length, 4 ** 5 - 1);
});
test('Line-numbered errors reject malformed input and duplicate instructions', () => {
  for (const [source, message] of [
    ['seed F\nangle -5', /Line 2/], ['seed F\ndepth 9', /0 to 8/],
    ['seed F\ndepth 1.5', /integer/], ['seed F\nstep 0', /greater/],
    ['seed F\nangle 181', /180/], ['seed F\nangle Infinity', /number/],
    ['seed F\nrule F -> F[', /opening/], ['seed F\nrule F -> F]', /closing/],
    ['seed F\nseed X', /already/], ['seed F\nrule F -> F\nrule F -> FF', /already/],
    ['seed F\nrule F -> F F', /rule looks like/], ['seed <script>', /uppercase/],
    ['sprout F', /Expected/], ['# no seed', /seed first/]
  ]) assert.throws(() => parse(source), message);
});
test('Growth limits stop exponential expansion and excessive drawing', () => {
  assert.throws(() => grow('seed F\ndepth 8\nrule F -> FFFFFFFFFF'), /100,000/);
  assert.throws(() => grow('seed F\ndepth 8\nrule F -> FFFF'), /30,000/);
  assert.throws(() => parse(' '.repeat(20001)), /too long/);
  assert.throws(() => expand(parse('seed F'), -1), /Depth/);
  assert.throws(() => trace(']', { angle: 90, step: 1 }), SprigError);
});
test('Empty drawings and all palettes produce finite, inert SVG', () => {
  for (const palette of ['moss', 'blueprint', 'ink', '<script>']) {
    const { svg } = grow('seed X\ndepth 0', { palette });
    assert.match(svg, /viewBox=/); assert.doesNotMatch(svg, /NaN|Infinity|<script>/);
  }
});
test('CLI writes SVG and returns a useful failure for invalid input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sprig-test-'));
  try {
    const source = join(dir, 'seed.sprig'), output = join(dir, 'drawing.svg');
    await writeFile(source, 'seed F+F\nangle 90\ndepth 0');
    await exec(process.execPath, ['sprig/cli.mjs', source, output]);
    assert.match(await readFile(output, 'utf8'), /^<svg/);
    const { stdout } = await exec(process.execPath, ['sprig/cli.mjs', source]);
    assert.match(stdout, /^<svg/);
    await writeFile(source, 'seed F\ndepth 99');
    await assert.rejects(exec(process.execPath, ['sprig/cli.mjs', source]), error => error.code === 1 && /Line 2/.test(error.stderr));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
