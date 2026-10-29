import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LIMITS, parse, initial, advance, run, encodeInput, escapedBytes, toSVG } from '../core.mjs';
const load = async name => parse(await readFile(new URL(`../examples/${name}.tour`, import.meta.url), 'utf8'));
const text = result => new TextDecoder().decode(Uint8Array.from(result.output));
const tile = op => parse(op === '@' ? '   \n @ \n   ' : `@  \n ${op} \n   `);
const cursor = (byte = 0, direction = 0, inputAt = 0) => ({ x: 1, y: 1, byte, direction, inputAt });

// A separate walker uses velocity vectors and one mutable pocket, rather than
// the VM's direction tables and immutable advance() operation.
function reference(program, input, budget) {
  let x = program.start.x, y = program.start.y, vx = 1, vy = 0, byte = 0, inputAt = 0, steps = 0;
  const output = [], seen = new Map(); let status, cycle = null;
  for (;;) {
    const key = JSON.stringify([x, y, vx, vy, byte, inputAt]);
    if (seen.has(key)) { const old = seen.get(key); cycle = { start: old.steps, period: steps - old.steps, outputAt: old.output, output: output.slice(old.output) }; status = 'cycle'; break; }
    if (steps === budget) { status = 'step-limit'; break; }
    seen.set(key, { steps, output: output.length });
    const op = program.rows[y][x], emission = op === '.' ? [byte] : op === ':' ? [...`${byte} `].map(char => char.charCodeAt(0)) : [];
    if (output.length + emission.length > LIMITS.output) { status = 'output-limit'; break; }
    steps++; output.push(...emission);
    if (op === '#') { status = 'halted'; break; }
    if (op >= '0' && op <= '9') byte = Number(op);
    else if (op === '+') byte = (byte + 1) % 256;
    else if (op === '-') byte = (byte + 255) % 256;
    else if (op === '*') byte = byte * 2 % 256;
    else if (op === '>') { vx = 1; vy = 0; }
    else if (op === '<') { vx = -1; vy = 0; }
    else if (op === '^') { vx = 0; vy = -1; }
    else if (op === 'v') { vx = 0; vy = 1; }
    else if (op === '/') [vx, vy] = [-vy, -vx];
    else if (op === '\\') [vx, vy] = [vy, vx];
    else if (op === '?') [vx, vy] = byte === 0 ? [-vy, vx] : [vy, -vx];
    else if (op === ',') { byte = inputAt === input.length ? 0 : input[inputAt++]; }
    x += vx; y += vy;
    if (x < 0 || x >= program.width || y < 0 || y >= program.height) { status = 'escaped'; break; }
  }
  const direction = vx === 1 ? 0 : vy === 1 ? 1 : vx === -1 ? 2 : 3;
  return { status, steps, output, cycle, cursor: { x, y, direction, byte, inputAt } };
}

test('Maps preserve blank rows, pad ragged tracks, accept CRLF, and have one entrance', () => {
  const map = parse('  #\r\n\r\n@>\r\n');
  assert.deepEqual(map.rows, ['  #', '   ', '@> ']); assert.equal(map.width, 3); assert.equal(map.height, 3);
  assert.deepEqual(map.start, { x: 0, y: 2 });
  assert.equal(run(parse('@')).status, 'escaped');
  const large = parse('@' + ' '.repeat(63) + '\n' + Array(63).fill(' '.repeat(64)).join('\n'));
  assert.equal(large.rows.length * large.width, 4096);
  for (const source of ['', '  ', '@@', '@\t#', '@x#', '@🍃', '@\r#', '@' + ' '.repeat(64), '@' + '\n'.repeat(65), ' '.repeat(8193)]) assert.throws(() => parse(source), RangeError);
  assert.throws(() => parse('@\n x'), /Line 2, column 2/);
});

test('Byte arithmetic and decimal digit loads are exact for every starting byte', () => {
  for (const op of ['+', '-', '*', ...'0123456789']) {
    const map = tile(op);
    for (let byte = 0; byte < 256; byte++) {
      const result = advance(map, cursor(byte));
      const expected = op === '+' ? (byte + 1) % 256 : op === '-' ? (byte + 255) % 256 : op === '*' ? byte * 2 % 256 : Number(op);
      assert.equal(result.state.byte, expected); assert.equal(result.state.x, 2); assert.equal(result.state.y, 1);
    }
  }
});

test('Both mirrors, all arrows, and zero/nonzero turns work in all four directions', () => {
  const vectors = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const op of ['/', '\\', '?', '>', '<', '^', 'v', ' ', '@']) for (let direction = 0; direction < 4; direction++) for (let byte = 0; byte < 256; byte++) {
    let [dx, dy] = vectors[direction];
    if (op === '/') [dx, dy] = [-dy, -dx];
    if (op === '\\') [dx, dy] = [dy, dx];
    if (op === '?') [dx, dy] = byte === 0 ? [-dy, dx] : [dy, -dx];
    if (op === '>') [dx, dy] = [1, 0]; if (op === '<') [dx, dy] = [-1, 0];
    if (op === '^') [dx, dy] = [0, -1]; if (op === 'v') [dx, dy] = [0, 1];
    const result = advance(tile(op), cursor(byte, direction));
    assert.equal(result.state.x, 1 + dx); assert.equal(result.state.y, 1 + dy); assert.equal(result.state.byte, byte);
  }
});

test('Shipped maps print their known results, and input position prevents false echo cycles', async () => {
  const hello = run(await load('hello'), { trace: true });
  assert.equal(text(hello), 'HI!'); assert.equal(hello.steps, 15); assert.equal(hello.status, 'halted');
  const countdown = run(await load('countdown'), { trace: true });
  assert.equal(text(countdown), '3 2 1 0 '); assert.equal(countdown.steps, 38);
  assert.deepEqual(countdown.history.filter(entry => entry.op === '?').map(entry => entry.after.direction), [3, 3, 3, 1]);
  const echo = await load('echo');
  for (const source of ['', 'aaaaaa', 'scenic route', '🍃 café']) {
    const bytes = encodeInput(source), result = run(echo, { input: bytes });
    assert.equal(text(result), source); assert.equal(result.cursor.inputAt, bytes.length); assert.equal(result.status, 'halted');
    assert.deepEqual(result.output, [...bytes]);
  }
  const sentinel = run(echo, { input: Uint8Array.of(65, 0, 66) });
  assert.equal(text(sentinel), 'A'); assert.equal(sentinel.cursor.inputAt, 2);
  const eof = advance(tile(','), cursor(77, 0, 1), Uint8Array.of(7));
  assert.equal(eof.state.byte, 0); assert.equal(eof.state.inputAt, 1);
});

test('Silent and productive cycles retain a prefix and exact repeating output; budgets are distinct', async () => {
  const silent = run(parse('@>v\n ^<'));
  assert.equal(silent.status, 'cycle'); assert.equal(silent.steps, 6);
  assert.deepEqual(silent.cycle, { start: 2, period: 4, outputAt: 0, output: [] });
  const forever = await load('forever'), result = run(forever, { trace: true, steps: 8 });
  assert.equal(result.status, 'cycle'); assert.equal(result.steps, 8);
  assert.deepEqual(result.cycle, { start: 2, period: 6, outputAt: 0, output: [48, 32] });
  const a = result.history[result.cycle.start].before, b = result.cursor; assert.deepEqual(a, b);
  let at = b, bytes = [];
  for (let i = 0; i < result.cycle.period; i++) { const next = advance(forever, at); at = next.state; bytes.push(...next.emitted); }
  assert.deepEqual(at, b); assert.deepEqual(bytes, result.cycle.output);
  assert.equal(run(forever, { steps: 7 }).status, 'step-limit'); assert.equal(run(forever, { steps: 7 }).cycle, null);
  const prefix = run(parse('@1.>:v\n   ^ <'), { trace: true });
  assert.equal(prefix.status, 'cycle'); assert.ok(prefix.cycle.outputAt > 0); assert.equal(prefix.output[0], 1);
});

test('Independent vector execution agrees on seeded random maps and every shipped map', async () => {
  let seed = 17; const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const maps = await Promise.all(['hello', 'countdown', 'echo', 'forever'].map(load));
  const alphabet = '   #><^v/\\+-*?:.,0123456789';
  for (let trial = 0; trial < 120; trial++) {
    const rows = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => alphabet[rand() % alphabet.length])); rows[3][3] = '@';
    maps.push(parse(rows.map(row => row.join('')).join('\n')));
  }
  for (const map of maps) {
    const input = Uint8Array.from({ length: 32 }, () => rand() % 256), budget = 1000, expected = reference(map, input, budget);
    const actual = run(map, { input, steps: budget });
    for (const key of ['status', 'steps', 'output', 'cycle', 'cursor']) assert.deepEqual(actual[key], expected[key], key);
  }
});

test('An output-budget stop leaves the blocked tile unexecuted and never cuts a decimal emission', () => {
  const map = parse(' /::::\\\n\n@>,   ?\n      #'), input = new Uint8Array(1024).fill(255);
  const result = run(map, { input, trace: true });
  assert.equal(result.status, 'output-limit'); assert.equal(result.output.length, 8192);
  assert.equal(text(result), '255 '.repeat(2048)); assert.equal(result.cursor.inputAt, 513);
  assert.equal(result.history.length, result.steps); assert.equal(map.rows[result.cursor.y][result.cursor.x], ':');
  assert.deepEqual(advance(map, result.cursor, input).emitted, [50, 53, 53, 32]);
  const expected = reference(map, input, 20000); assert.equal(expected.steps, result.steps); assert.deepEqual(expected.cursor, result.cursor);
});

test('The maximum step budget stays bounded on a large loop with changing input position', () => {
  const rows = Array.from({ length: 64 }, () => Array(64).fill(' '));
  rows[1][0] = '@'; rows[1][1] = '>'; rows[1][2] = ','; rows[1][63] = 'v'; rows[63][63] = '<'; rows[63][1] = '^';
  const result = run(parse(rows.map(row => row.join('')).join('\n')), { input: new Uint8Array(1024).fill(255), steps: LIMITS.steps });
  assert.equal(result.status, 'step-limit'); assert.equal(result.steps, 100000); assert.equal(result.history, null); assert.ok(result.cursor.inputAt > 300);
});

test('Maps, states, trace entries, and output are immutable and do not alias input bytes', async () => {
  const map = await load('echo'), input = encodeInput('abc'), saved = [...input], result = run(map, { input, trace: true });
  assert.deepEqual([...input], saved); input.fill(0); assert.equal(text(result), 'abc');
  for (const mutation of [() => map.rows[0] = '#', () => map.start.x++, () => result.output.push(1), () => result.cursor.byte++, () => result.history[0].before.x++, () => result.history[0].emitted.push(2)]) assert.throws(mutation, TypeError);
  const state = initial(map), next = advance(map, state); assert.notEqual(state, next.state); assert.deepEqual(state, initial(map));
});

test('SVG includes every padded cell, exact visit counts and route, escaped text, and the final cursor', async () => {
  const map = await load('echo'), result = run(map, { input: encodeInput('<>&"'), trace: true }), svg = toSVG(map, result);
  const groups = [...svg.matchAll(/data-cell="(\d+),(\d+)" data-visits="(\d+)"/g)];
  assert.equal(groups.length, map.width * map.height);
  for (const group of groups) assert.equal(Number(group[3]), result.history.filter(entry => entry.before.x + 1 === Number(group[1]) && entry.before.y + 1 === Number(group[2])).length);
  assert.equal(svg.match(/points="([^"]+)"/)[1].split(' ').length, result.steps + 1);
  assert.match(svg, /&lt;&gt;&amp;/); assert.match(svg, /\\&quot;/); assert.doesNotMatch(svg, /NaN|undefined|<script|foreignObject/);
  assert.throws(() => toSVG(map, run(map)), /trace/); assert.throws(() => toSVG(parse('@#'), result), /this map/);
});

test('Invalid options, forged maps, bad cursors, and oversized UTF-8 input fail explicitly', () => {
  const map = parse('@#');
  for (const value of [-1, 0, 1.5, 100001, NaN, Infinity, '1']) assert.throws(() => run(map, { steps: value }), RangeError);
  for (const input of [[], 'text', new Uint8Array(1025)]) assert.throws(() => run(map, { input }), RangeError);
  assert.throws(() => run(map, { trace: 1 }), RangeError); assert.throws(() => run({ ...map }), RangeError);
  for (const state of [null, { ...initial(map), x: -1 }, { ...initial(map), direction: 4 }, { ...initial(map), byte: 256 }, { ...initial(map), inputAt: 1 }, { ...initial(map), x: .5 }]) assert.throws(() => advance(map, state), RangeError);
  assert.equal(encodeInput('π'.repeat(512)).length, 1024); assert.throws(() => encodeInput('π'.repeat(513)), RangeError);
  assert.throws(() => encodeInput(null), RangeError); assert.throws(() => encodeInput('x'.repeat(1025)), RangeError);
  assert.equal(escapedBytes([27, 0, 10, 255, 34, 92]), '\\x1b\\x00\\n\\xff\\"\\\\');
});
