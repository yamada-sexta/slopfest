import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, forge, toSVG } from '../core.mjs';
const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });

test('The real CLI defaults to an exact forged cycle and explains second choice', () => {
  const result = run(['--pick', 'A']); assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /280 unlabeled partitions of 1–9; 5 have/);
  assert.match(result.stdout, /A: 1 5 9/); assert.match(result.stdout, /A beats B beats C beats A/);
  assert.match(result.stdout, /choose C, which wins 5\/9 pairings \(55.6%\)/);
  assert.doesNotMatch(result.stdout, /\x1b/);
  const help = run(['--help']); assert.equal(help.status, 0); assert.match(help.stdout, /--dice SPEC/); assert.match(help.stdout, /never rerolled/);
});

test('JSON carries exact forge counts, sorted custom faces, ties, and absent recommendations', () => {
  for (const faces of [3, 4, 5]) {
    const result = run(['--faces', String(faces), '--pick', 'B', '--json']); assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout), { analysis, ...search } = forge(faces);
    assert.deepEqual(data, { mode: 'forge', search, analysis, recommendation: { picked: 'B', counter: 'A', match: analysis.matches[0][1] } });
  }
  const custom = run(['--dice', '9,2,4;8,1,6;7,3,5', '--json']); assert.equal(custom.status, 0, custom.stderr);
  assert.deepEqual(JSON.parse(custom.stdout), { mode: 'custom', search: null, analysis: analyze([[2, 4, 9], [1, 6, 8], [3, 5, 7]]), recommendation: null });
  const tied = run(['--dice', '0,1;1,1;1,1', '--pick', 'A', '--json']); assert.equal(tied.status, 0);
  assert.deepEqual(JSON.parse(tied.stdout).recommendation, { picked: 'A', counter: null, match: null });
  const noCycle = run(['--dice', '1;2;3', '--pick', 'C']); assert.equal(noCycle.status, 0);
  assert.match(noCycle.stdout, /No strict-majority cycle/); assert.match(noCycle.stdout, /no other die wins more than 50%/);
  const max = Array(8).fill('99').join(','); assert.equal(run(['--dice', `${max};${max};${max}`]).status, 0);
});

test('Exports use the exact SVG, refuse overwrites, and validate input before writing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'slydice-'));
  try {
    const path = join(directory, 'dice.svg');
    const result = run(['--faces', '5', '--svg', path, '--json']); assert.equal(result.status, 0, result.stderr);
    const bytes = await readFile(path, 'utf8'); assert.equal(bytes, toSVG(forge(5).analysis));
    assert.equal(JSON.parse(result.stdout).search.bestWins, 15);
    assert.equal(run(['--svg', path]).status, 1); assert.equal(await readFile(path, 'utf8'), bytes);
    const keep = join(directory, 'keep.svg'); await writeFile(keep, 'keep');
    assert.equal(run(['--svg', keep]).status, 1); assert.equal(await readFile(keep, 'utf8'), 'keep');
    for (const args of [['--faces', '6'], ['--dice', '1;2;'], ['--pick', 'D']]) assert.equal(run([...args, '--svg', join(directory, 'bad.svg')]).status, 1);
    assert.equal(run(['--svg', join(directory, 'missing', 'dice.svg')]).status, 1);
    assert.deepEqual((await readdir(directory)).sort(), ['dice.svg', 'keep.svg']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI rejects malformed dice, option conflicts, duplicates, and noncanonical numbers', () => {
  for (const args of [
    ['--wat'], ['--help', '--json'], ['hello'], ['--faces'], ['--dice'], ['--pick'], ['--svg'], ['--svg', ''],
    ['--faces', '03'], ['--faces', '3\n'], ['--faces', '2'], ['--faces', '6'], ['--faces', '3.0'],
    ['--faces', '3', '--dice', '1;2;3'], ['--faces', '3', '--faces', '4'], ['--json', '--json'], ['--pick', 'A', '--pick', 'B'],
    ['--dice', '1;2;3', '--dice', '3;2;1'], ['--pick', 'a'], ['--pick', 'D'], ['--pick', '--json'],
    ...['', '1,2', '1;2', '1;2;', '1;;3', '1;2;3;4', '1,;2;3', '1,2;3;4', '01;2;3', '-1;2;3', '100;2;3', '1.0;2;3', '1; 2;3', '1;2;3\n', '<script>;2;3', '1'.repeat(101)].map(spec => ['--dice', spec]),
  ]) {
    const result = run(args); assert.equal(result.status, 1, JSON.stringify(args)); assert.equal(result.stdout, ''); assert.ok(result.stderr.trim());
  }
});
