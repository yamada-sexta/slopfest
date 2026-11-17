import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clock, machine, follow, synchronize, toSVG } from '../core.mjs';

// Independent oracle: enumerate words and move individual starting states.
function destinations(source, word, starts = source.a.map((_, i) => i)) {
  return starts.map(origin => [...word].reduce((state, button) => source[button][state], origin));
}
function reference(source, starts) {
  let words = [''];
  for (let length = 0; length <= 8; length++) {
    for (const word of words) if (new Set(destinations(source, word, starts)).size === 1) return word;
    words = words.flatMap(word => ['a', 'b'].map(button => word + button));
  }
  return null;
}
// A reset exists iff each pair can meet. Search pairs independently of subsets.
function everyPairMeets(source) {
  for (let x = 0; x < source.a.length; x++) for (let y = x + 1; y < source.a.length; y++) {
    const queue = [[x, y]], seen = new Set([`${x},${y}`]);
    let met = false;
    for (let head = 0; head < queue.length; head++) {
      const [a, b] = queue[head];
      if (a === b) { met = true; break; }
      for (const button of ['a', 'b']) {
        const pair = [source[button][a], source[button][b]].sort((a, b) => a - b), key = pair.join(',');
        if (!seen.has(key)) { seen.add(key); queue.push(pair); }
      }
    }
    if (!met) return false;
  }
  return true;
}

test('All 729 two-button three-state machines match word enumeration and a pair oracle', () => {
  let resets = 0;
  for (let encoded = 0; encoded < 729; encoded++) {
    let rest = encoded;
    const entries = Array.from({ length: 6 }, () => { const digit = rest % 3; rest = Math.floor(rest / 3); return digit; });
    const source = { a: entries.slice(0, 3), b: entries.slice(3) };
    const result = synchronize(source), expected = reference(source);
    assert.equal(result.word, expected, JSON.stringify(source));
    assert.equal(result.status === 'synchronized', everyPairMeets(source));
    assert.ok(result.explored <= 7);
    if (expected !== null) {
      resets++;
      result.frames.forEach((frame, i) => assert.deepEqual(frame.positions, destinations(source, expected.slice(0, i))));
      assert.equal(result.frames.at(-1).states.length, 1);
    } else assert.deepEqual(result.frames, []);
  }
  assert.equal(resets, 549);
});

test('Clock-and-gate machines need square-length words, through the maximum size', () => {
  for (let n = 2; n <= 10; n++) {
    const source = clock(n), result = synchronize(source);
    assert.equal(result.word.length, (n - 1) ** 2);
    assert.equal(follow(source, result.word).synchronized, true);
    assert.deepEqual(result.frames, follow(source, result.word).frames);
    assert.ok(result.explored <= (1 << n) - 1);
  }
  assert.equal(synchronize(clock()).word, 'baaabaaab');
});

test('Every nonempty subset of all 729 three-state machines gets a shortest remaining route', () => {
  let checked = 0;
  for (let encoded = 0; encoded < 729; encoded++) {
    let rest = encoded;
    const entries = Array.from({ length: 6 }, () => { const digit = rest % 3; rest = Math.floor(rest / 3); return digit; });
    const source = { a: entries.slice(0, 3), b: entries.slice(3) };
    for (let mask = 1; mask < 8; mask++) {
      const states = [0, 1, 2].filter(state => mask & (1 << state));
      const result = synchronize(source, { states });
      assert.equal(result.word, reference(source, states), `${encoded} / ${mask}`);
      if (result.word !== null) {
        assert.deepEqual(result.frames[0].positions, states);
        result.frames.forEach((frame, i) => assert.deepEqual(frame.positions, destinations(source, result.word.slice(0, i), states)));
      }
      checked++;
    }
  }
  assert.equal(checked, 5103);
});

test('Subset hints validate, sort, and copy the starting possibilities', () => {
  const starts = [3, 0], before = [...starts];
  const result = synchronize(clock(), { states: starts });
  assert.equal(result.word, 'b');
  assert.deepEqual(result.frames[0].positions, [0, 3]);
  assert.deepEqual(starts, before);
  starts[0] = 2;
  assert.deepEqual(result.frames[0].positions, [0, 3]);
  assert.equal(synchronize(clock(), { states: [2] }).word, '');
  for (const states of [null, [], [0, 0], [4], [-1], [0.5], ['0'], Array(2), new Set([0])]) {
    assert.throws(() => synchronize(clock(), { states }), /Starting states/);
  }
});

test('Empty words, permutation machines, four buttons, and deterministic tie breaking', () => {
  assert.equal(synchronize({ z: [0] }).word, '');
  assert.equal(follow({ z: [0] }, '').synchronized, true);
  assert.equal(synchronize({ a: [1, 2, 0], b: [2, 0, 1] }).status, 'impossible');
  assert.equal(synchronize({ d: [0, 0], c: [1, 1], b: [0, 0], a: [1, 1] }).word, 'a');
  assert.equal(follow(clock(), '').synchronized, false);
  assert.equal(follow(clock(), 'a'.repeat(1023)).frames.length, 1024);
});

test('Validation bounds, copied immutable transitions, and repeatability', () => {
  for (const source of [null, [], {}, { A: [0] }, { aa: [0] }, { a: [] }, { a: Array(11).fill(0) },
    { a: [0, 2] }, { a: [-1] }, { a: [0.5] }, { a: [0], b: [0, 0] }, { a: Array(2) },
    { a: [0], b: [0], c: [0], d: [0], e: [0] }]) assert.throws(() => machine(source));
  for (const n of [1, 11, 2.5, '4']) assert.throws(() => clock(n));
  for (const word of [null, 5, 'c', 'A', 'a'.repeat(1024)]) assert.throws(() => follow(clock(), word));
  const source = { a: [1, 0], b: [0, 0] }, copied = machine(source);
  source.b[1] = 1;
  assert.deepEqual(copied.b, [0, 0]);
  assert.throws(() => { copied.a[0] = 0; });
  const first = synchronize(copied);
  first.frames[0].positions[0] = 99;
  assert.deepEqual(synchronize(copied).frames[0].positions, [0, 1]);
});

test('SVG wraps traces, preserves merged routes, and handles an empty word', () => {
  const svg = toSVG(clock(5), synchronize(clock(5)).word);
  assert.match(svg, /Steps 0–12/);
  assert.match(svg, /Steps 12–16/);
  assert.equal((svg.match(/<polyline /g) ?? []).length, 10);
  assert.match(svg, /All paths meet/);
  assert.match(toSVG({ a: [0] }, ''), /<circle /);
  assert.match(toSVG(clock(), 'a'), /Multiple destinations remain/);
  assert.throws(() => toSVG(clock(), '<script>'));
});

const cli = new URL('../cli.mjs', import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
test('CLI receipts, traces, custom machines, and exclusive SVG writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rendezvous-'));
  try {
    const receipt = JSON.parse(execFileSync(process.execPath, [cli, '--json'], { encoding: 'utf8' }));
    assert.equal(receipt.word, 'baaabaaab');
    assert.equal(receipt.frames.length, 10);
    assert.match(run('--trace').stdout, /9  b  \{0\}/);
    const file = join(directory, 'machine.json'), image = join(directory, 'trace.svg');
    await writeFile(file, JSON.stringify({ a: [1, 0] }));
    assert.equal(run('--machine', file).status, 2);
    assert.equal(run('--machine', file, '--svg', image).status, 1);
    const chosen = run('--machine', file, '--word', 'aa', '--svg', image, '--json');
    assert.equal(chosen.status, 2);
    assert.equal(JSON.parse(chosen.stdout).synchronized, false);
    const saved = await readFile(image, 'utf8');
    assert.equal(saved, toSVG({ a: [1, 0] }, 'aa'));
    assert.equal(run('--svg', image).status, 1);
    assert.equal(await readFile(image, 'utf8'), saved);
    await writeFile(file, JSON.stringify({ a: [0] }));
    assert.equal(run('--machine', file, '--word', '').status, 0);
    await writeFile(file, 'broken');
    assert.equal(run('--machine', file).status, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI rejects ambiguous and malformed options', () => {
  assert.equal(run('--help').status, 0);
  for (const args of [['--help', '--json'], ['--states', '03'], ['--states', '11'], ['--word'],
    ['--states', '3', '--states', '4'], ['--states', '3', '--machine', 'x'], ['--unknown'], ['oops'],
    ['--word', 'x'], ['--svg', ''], ['--json', '--json']]) assert.equal(run(...args).status, 1, args.join(' '));
  assert.equal(run('--word', 'a').status, 2);
});
