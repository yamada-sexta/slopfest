import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pair, centered, roundTrip, toSVG } from '../core.mjs';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 3 * 1024 * 1024 });

test('Real CLI has a usable default tapestry, standalone help, and honest round-trip output', () => {
  const output = run([]);
  assert.equal(output.status, 0, output.stderr);
  assert.match(output.stdout, /rule 90 · 65 cells · 48 steps/);
  assert.match(output.stdout, /Both starting rows recovered: YES/);
  assert.equal(output.stdout.split('\n').filter(line => /^\s*\d+   [.#]+  [.#]+/.test(line)).length, 49);
  assert.doesNotMatch(output.stdout, /\x1b/);
  const help = run(['--help']);
  assert.equal(help.status, 0); assert.match(help.stdout, /--past BITS/);
  assert.match(help.stdout, /only the final two rows/);
});

test('CLI infers custom widths, preserves both starting rows, and produces parseable JSON', () => {
  const args = ['--rule', '110', '--seed', '0010100', '--past', '1000001', '--steps', '16', '--json'];
  const result = run(args);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), roundTrip(pair('1000001', '0010100'), { rule: 110, steps: 16 }));
  for (const args of [ ['--width', '1', '--steps', '0', '--rule', '0', '--json'], ['--width', '160', '--steps', '256', '--rule', '255', '--json'] ]) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const trip = JSON.parse(result.stdout);
    assert.equal(trip.recovered, true);
    assert.deepEqual(trip.outward[0], trip.homeward.at(-1));
  }
});

test('Exports are exclusive and byte-identical to the engine, including combined JSON; invalid runs create no files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'backstitch-'));
  try {
    const path = join(directory, 'tapestry.svg');
    const result = run(['--width', '11', '--steps', '8', '--svg', path, '--json']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).width, 11);
    const bytes = await readFile(path, 'utf8');
    assert.equal(bytes, toSVG(roundTrip(centered(11), { steps: 8 })));
    const again = run(['--svg', path]);
    assert.equal(again.status, 1); assert.equal(again.stdout, '');
    assert.equal(await readFile(path, 'utf8'), bytes);
    const keep = join(directory, 'keep.svg'); await writeFile(keep, 'keep');
    assert.equal(run(['--svg', keep]).status, 1);
    assert.equal(await readFile(keep, 'utf8'), 'keep');
    const invalid = run(['--svg', join(directory, 'bad.svg'), '--seed', 'oops']);
    assert.equal(invalid.status, 1);
    assert.deepEqual((await readdir(directory)).sort(), ['keep.svg', 'tapestry.svg']);
    assert.equal(run(['--svg', join(directory, 'missing', 'tapestry.svg')]).status, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI rejects ambiguous, malformed, oversized and incomplete options', () => {
  for (const args of [
    ['--help', '--json'], ['file'], ['--unknown'], ['--rule'], ['--rule', '--json'],
    ['--json', '--json'], ['--steps', '1', '--steps', '2'], ['--rule', '256'], ['--rule', '-1'],
    ['--width', '0'], ['--width', '161'], ['--width', '2.5'], ['--steps', '257'], ['--steps', '01'],
    ['--steps', 'NaN'], ['--seed', ''], ['--seed', '0'.repeat(161)], ['--seed', '01x'],
    ['--seed', '1\n'], ['--width', '8', '--seed', '001'], ['--seed', '001', '--past', '00'],
    ['--past', '10'], ['--svg'], ['--svg', ''],
  ]) {
    const result = run(args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.equal(result.stdout, '', JSON.stringify(args));
    assert.ok(result.stderr.trim(), JSON.stringify(args));
  }
});
