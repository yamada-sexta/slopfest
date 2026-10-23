import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse, state, apply, run, invert, format, SpellError } from '../core.mjs';
const exec = promisify(execFile);

test('Comments, flexible whitespace, CRLF, nested repeats, and source lines compile in order', () => {
  const program = parse('# hi\r\nrepeat\t2\r\n add a 1\r\n repeat 3\r\n  xor b a # borrowed\r\n end\r\nend');
  assert.equal(program.length, 8);
  assert.deepEqual(program.map(i => i.line), [3, 5, 5, 5, 3, 5, 5, 5]);
  assert.equal(program.map(format).join(';'), 'add a 1;xor b a;xor b a;xor b a;add a 1;xor b a;xor b a;xor b a');
  program[0].operand = 5; assert.equal(program[4].operand, 1);
});
test('Known byte arithmetic, rotates, swapping, and complement have exact results', () => {
  assert.deepEqual(run(parse('add a 1\nsub b 1\nxor c 255\nmul d 3'), [255, 0, 170, 85]).values, [0, 255, 85, 255]);
  assert.deepEqual(run(parse('rol a 3\nror b 2\nnot c\nswap a d'), [129, 129, 170, 7]).values, [7, 96, 85, 12]);
  assert.deepEqual(run(parse('add a b\nsub c d\nxor b d'), [250, 20, 0, 255]).values, [14, 235, 1, 255]);
});
test('Every literal add, subtract, and xor is a permutation on all 256 bytes', () => {
  for (const op of ['add', 'sub', 'xor']) for (let operand = 0; operand < 256; operand++) {
    const program = parse(`${op} a ${operand}`), inverse = invert(program)[0], outputs = new Set();
    for (let value = 0; value < 256; value++) {
      const before = [value, 17, 29, 43], after = apply(before, program[0]); outputs.add(after[0]);
      assert.deepEqual(apply(after, inverse), before); assert.deepEqual(after.slice(1), before.slice(1));
    }
    assert.equal(outputs.size, 256);
  }
});
test('Register arithmetic restores all pairs, and preserves the source and other registers', () => {
  for (const op of ['add', 'sub', 'xor']) {
    const instruction = parse(`${op} a b`)[0], inverse = invert([instruction])[0];
    for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) {
      const before = [a, b, 101, 203], after = apply(before, instruction);
      assert.deepEqual(apply(after, inverse), before); assert.deepEqual(after.slice(1), before.slice(1));
    }
  }
});
test('Every odd multiplier has an inverse and is a permutation of every byte', () => {
  for (let multiplier = 1; multiplier < 256; multiplier += 2) {
    const instruction = parse(`mul a ${multiplier}`)[0], inverse = invert([instruction])[0], outputs = new Set();
    assert.equal(multiplier * inverse.operand % 256, 1);
    for (let a = 0; a < 256; a++) {
      const before = [a, 2, 3, 4], after = apply(before, instruction); outputs.add(after[0]); assert.deepEqual(apply(after, inverse), before);
    }
    assert.equal(outputs.size, 256);
  }
});
test('All rotations and complements invert exactly, and a swapped pair restores every pair', () => {
  for (const op of [...Array.from({ length: 8 }, (_, i) => `rol a ${i}`), ...Array.from({ length: 8 }, (_, i) => `ror a ${i}`), 'not a']) {
    const instruction = parse(op)[0], inverse = invert([instruction])[0];
    for (let a = 0; a < 256; a++) { const before = [a, 5, 17, 255]; assert.deepEqual(apply(apply(before, instruction), inverse), before); }
  }
  const swap = parse('swap a b')[0];
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) assert.deepEqual(apply(apply([a, b, 19, 21], swap), swap), [a, b, 19, 21]);
});
test('Inverse source reverses operation order and runs as ordinary source', () => {
  const program = parse('add a b\nrol c 3\nmul d 13\nxor b d\nswap a c');
  const inverse = invert(program), source = inverse.map(format).join('\n');
  assert.equal(source, 'swap a c\nxor b d\nmul d 197\nror c 3\nsub a b');
  assert.deepEqual(invert(inverse), program);
  let seed = 9;
  for (let i = 0; i < 1000; i++) {
    const before = Array.from({ length: 4 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 24; });
    assert.deepEqual(run(parse(source), run(program, before).values).values, before);
  }
});
test('Traces are independent snapshots; reversing from each intermediate point recovers the input', () => {
  const before = [255, 0, 17, 128], program = parse('repeat 3\nadd a b\nrol c 1\nxor b c\nswap a d\nend'), original = structuredClone(program);
  const result = run(program, before, { trace: true });
  assert.equal(result.history.length, program.length + 1);
  for (let i = 1; i <= program.length; i++) assert.deepEqual(run(program.slice(0, i), result.history[i].values, { reverse: true }).values, before);
  assert.deepEqual(before, [255, 0, 17, 128]); assert.deepEqual(program, original);
  result.history[0].values[0] = 8; assert.notEqual(result.history[1].values[0], 8);
  result.history.at(-1).values[0] ^= 1; assert.notDeepEqual(result.history.at(-1).values, result.values);
});
for (const name of ['carousel', 'mixer', 'borrowed-key']) test(`Shipped spell makes a reversible change: ${name}`, async () => {
  const program = parse(await readFile(new URL(`../examples/${name}.spell`, import.meta.url), 'utf8')), before = [12, 34, 56, 78];
  const after = run(program, before).values; assert.notDeepEqual(after, before); assert.deepEqual(run(program, after, { reverse: true }).values, before);
  if (name === 'borrowed-key') assert.equal(after[1], before[1]);
  if (name === 'carousel') { let values = before; for (let i = 0; i < 4; i++) values = run(program, values).values; assert.deepEqual(values, before); }
});
test('Irreversible forms, malformed blocks, unknown input, and oversized expansions fail with useful errors', () => {
  for (const source of ['add a a', 'sub b b', 'xor d d', 'mul a 0', 'mul b 2', 'mul d b', 'swap a a', 'rol a 8', 'ror a -1', 'not a 2', 'load a 1', 'add x 2', 'add a 256', 'add a 01', 'add a 1.5', 'add a -1', 'end', 'repeat 1\nend', 'repeat 0\nnot a\nend', 'repeat 33\nnot a\nend', 'repeat 2\nnot a', 'repeat 1\n'.repeat(5) + 'not a\n' + 'end\n'.repeat(5)]) assert.throws(() => parse(source), /Line \d+:/);
  assert.throws(() => parse('repeat 32\nrepeat 32\nrepeat 32\nnot a\nend\nend\nend'), /4,096/);
  assert.throws(() => parse(' '.repeat(16001)), /16,000/); assert.throws(() => parse('# empty'), SpellError);
  assert.equal(parse('repeat 32\nrepeat 32\nrepeat 4\nnot a\nend\nend\nend').length, 4096);
});
test('Public execution bounds reject invalid states and malformed compiled instructions without hanging', () => {
  for (const values of [[-1, 0, 0, 0], [0, 0, 0, 256], [0, 0, 0, 0.5], [0, 0, 0], Array(4)]) assert.throws(() => state(values), SpellError);
  for (const item of [{ op: 'mul', target: 'a', operand: 2 }, { op: 'xor', target: 'b', operand: 'b' }, { op: 'not', target: 'q' }, { op: 'rol', target: 'a', operand: 8 }, { op: 'unknown', target: 'a' }, null]) {
    assert.throws(() => invert([item]), SpellError); assert.throws(() => apply([0, 0, 0, 0], item), SpellError);
  }
  assert.throws(() => run([], [0, 0, 0, 0]), SpellError); assert.throws(() => run(parse('not a'), [0, 0, 0, 0], { reverse: 'yes' }), SpellError);
});
test('CLI JSON and inverse source round-trip, while errors stay on stderr with status one', async () => {
  const path = 'counterspell/examples/mixer.spell', args = ['counterspell/cli.mjs', path];
  const forward = JSON.parse((await exec(process.execPath, [...args, '--state', '12,34,56,78', '--trace', '--json'])).stdout);
  assert.deepEqual(forward.values, [155, 224, 97, 192]); assert.equal(forward.history.length, 19);
  const reverse = JSON.parse((await exec(process.execPath, [...args, '--state', forward.values.join(','), '--reverse', '--json'])).stdout);
  assert.deepEqual(reverse.values, forward.initial);
  const dir = await mkdtemp(join(tmpdir(), 'counterspell-test-'));
  try {
    const source = (await exec(process.execPath, [...args, '--inverse'])).stdout, inversePath = join(dir, 'inverse.spell'); await writeFile(inversePath, source);
    const inverted = JSON.parse((await exec(process.execPath, ['counterspell/cli.mjs', inversePath, '--state', forward.values.join(','), '--json'])).stdout);
    assert.deepEqual(inverted.values, forward.initial);
    await writeFile(inversePath, 'not a\nxor b b');
    await assert.rejects(exec(process.execPath, ['counterspell/cli.mjs', inversePath]), error => error.code === 1 && error.stdout === '' && /Line 2/.test(error.stderr));
    await writeFile(inversePath, ' '.repeat(16001));
    await assert.rejects(exec(process.execPath, ['counterspell/cli.mjs', inversePath]), error => error.code === 1 && /16,000 bytes/.test(error.stderr));
  } finally { await rm(dir, { recursive: true, force: true }); }
  for (const flags of [['--unknown'], ['--state', '1,2,3'], ['--state', '256,0,0,0'], ['--json', '--json'], ['--inverse', '--trace'], ['--inverse', '--state', '0,0,0,0']]) await assert.rejects(exec(process.execPath, [...args, ...flags]), error => error.code === 1 && error.stdout === '');
  assert.match((await exec(process.execPath, ['counterspell/cli.mjs', '--help'])).stdout, /four bytes, nothing lost/);
});
