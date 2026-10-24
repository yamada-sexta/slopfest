import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { run, parse } from '../core.mjs';
import { createWorkbench, seek, preview, inverseSource } from '../workbench.mjs';
import { specimens } from '../specimens.mjs';

test('Workbench jumps match every independent trace state, in a nonsequential order', () => {
  const { source, initial } = specimens[0], spell = createWorkbench(source, initial);
  const reference = run(parse(source), initial, { trace: true });
  let current = spell;
  for (const cursor of [18, 5, 12, 1, 17, 0, 9, 4, 18, 0]) {
    const prior = current, bytes = current.values.slice(); current = seek(current, cursor);
    assert.equal(current.cursor, cursor); assert.deepEqual(current.values, reference.history[cursor].values);
    assert.deepEqual(prior.values, bytes); assert.equal(current.program, spell.program);
  }
  assert.deepEqual(spell.values, initial);
});

test('Backward travel uses current bytes, not the initial comparison label or a snapshot stack', () => {
  const original = createWorkbench('add a b\nmul a 13', [255, 7, 8, 9]);
  const end = seek(original, 2);
  // Poison the comparison label: inversion must still compute the real start.
  const recovered = seek({ ...end, initial: [0, 0, 0, 0] }, 0);
  assert.deepEqual(recovered.values, original.values);
  assert.equal(preview(end, -1).instruction, 'mul a 197');
  assert.deepEqual(preview(end, -1).after, seek(end, 1).values);
});

test('Every specimen can step, unstep, and execute its exported inverse as ordinary source', () => {
  for (const specimen of specimens) {
    const start = createWorkbench(specimen.source, specimen.initial);
    let current = start;
    for (let cursor = 0; cursor < start.program.length; cursor++) {
      const next = preview(current), forward = seek(current, cursor + 1);
      assert.deepEqual(next.after, forward.values);
      assert.deepEqual(seek(forward, cursor).values, current.values);
      current = forward;
    }
    assert.equal(preview(start, -1), null); assert.equal(preview(current), null);
    assert.deepEqual(run(parse(inverseSource(start)), current.values).values, specimen.initial);
    assert.deepEqual(seek(current, 0).values, specimen.initial);
  }
});

test('Browser specimens preserve the CLI examples and their known results', async () => {
  for (const [i, name] of ['mixer', 'borrowed-key', 'carousel'].entries()) {
    const source = await readFile(new URL(`../examples/${name}.spell`, import.meta.url), 'utf8');
    assert.deepEqual(parse(specimens[i].source).map(({ line, ...item }) => item), parse(source).map(({ line, ...item }) => item));
  }
  const start = createWorkbench(specimens[0].source);
  assert.deepEqual(seek(start, 18).values, [155, 224, 97, 192]);
  const wrap = createWorkbench(specimens[3].source, specimens[3].initial);
  assert.deepEqual(seek(wrap, 3).values, [0, 255, 1, 85]);
});

test('Previews explain actual operands, byte wrapping, swaps, rotations, and complement', () => {
  assert.match(preview(createWorkbench('add a b', [255, 1, 0, 0])).explanation, /255 \+ 1 \(b\) → 0/);
  assert.match(preview(createWorkbench('sub a 1')).explanation, /12 − 1 → 11/);
  assert.match(preview(createWorkbench('xor a 255')).explanation, /12 XOR 255 → 243/);
  assert.match(preview(createWorkbench('mul a 13')).explanation, /12 × 13 → 156/);
  assert.match(preview(createWorkbench('swap a b')).explanation, /a and b exchange 12 and 34/);
  assert.match(preview(createWorkbench('rol a 3')).explanation, /rotate 12 left by 3 bits → 96/);
  assert.match(preview(createWorkbench('ror a 3')).explanation, /rotate 12 right by 3 bits → 129/);
  assert.match(preview(createWorkbench('not a')).explanation, /flip all eight bits, 12 → 243/);
});

test('Bad drafts and invalid positions cannot corrupt a loaded workbench', () => {
  const good = seek(createWorkbench('add a 1'), 1), before = good.values.slice();
  assert.throws(() => createWorkbench('mul a 2'), /odd/);
  assert.throws(() => createWorkbench('not a', [256, 0, 0, 0]), /four integer bytes/);
  for (const cursor of [-1, 2, 0.5, NaN, '0']) assert.throws(() => seek(good, cursor), RangeError);
  assert.throws(() => preview(good, 0), RangeError);
  assert.deepEqual(good.values, before);
  assert.throws(() => { good.values[0] = 0; }, TypeError);
  assert.throws(() => { good.program[0].operand = 9; }, TypeError);
  assert.deepEqual(seek(good, 0).values, [12, 34, 56, 78]);
});

test('Maximum expanded spells travel both directions without retaining intermediate states', () => {
  const start = createWorkbench('repeat 32\nrepeat 32\nrepeat 4\nadd a b\nend\nend\nend');
  assert.equal(start.program.length, 4096);
  const end = seek(start, 4096); assert.deepEqual(end.values, start.values);
  const middle = seek(end, 2049); assert.equal(middle.values[0], 46);
  assert.deepEqual(seek(middle, 0).values, start.values);
});
