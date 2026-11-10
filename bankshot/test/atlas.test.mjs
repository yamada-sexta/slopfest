import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { atlasSVG, survey } from '../atlas.mjs';

test('The default atlas labels every interior start and preserves exact event times', () => {
  const atlas = survey();
  assert.equal(atlas.scale, 2);
  assert.deepEqual(atlas.counts, { loop: 74, NW: 2, NE: 5, SW: 2, SE: 5 });
  assert.equal(atlas.rows.length, 8);
  assert.ok(atlas.rows.every(row => row.length === 11));
  assert.deepEqual(atlas.rows[1][2], { outcome: 'loop', tick: 72, banks: 10 });
  assert.deepEqual(atlas.rows[1][3], { outcome: 'NE', tick: 32, banks: 3 });
  assert.deepEqual(atlas.rows[6][1], { outcome: 'NW', tick: 22, banks: 2 });
  assert.deepEqual(atlas.rows[0][7], { outcome: 'SW', tick: 16, banks: 1 });
  assert.deepEqual(atlas.rows[3][1], { outcome: 'SE', tick: 10, banks: 0 });
  for (const [outcome, count] of Object.entries(atlas.counts)) {
    assert.equal(atlas.rows.flat().filter(cell => cell.outcome === outcome).length, count);
  }
});

test('Mirroring the heading mirrors the atlas, and doubling speed halves physical time', () => {
  const original = survey({ width: 8, height: 7, velocity: [2, 3] });
  const eastWest = survey({ width: 8, height: 7, velocity: [-2, 3] });
  const northSouth = survey({ width: 8, height: 7, velocity: [2, -3] });
  const twice = survey({ width: 8, height: 7, velocity: [4, 6] });
  const flipX = { loop: 'loop', NW: 'NE', NE: 'NW', SW: 'SE', SE: 'SW' };
  const flipY = { loop: 'loop', NW: 'SW', NE: 'SE', SW: 'NW', SE: 'NE' };
  assert.deepEqual(eastWest.rows, original.rows.map(row =>
    row.toReversed().map(cell => ({ ...cell, outcome: flipX[cell.outcome] }))));
  assert.deepEqual(northSouth.rows, original.rows.toReversed().map(row =>
    row.map(cell => ({ ...cell, outcome: flipY[cell.outcome] }))));
  assert.deepEqual(twice.rows, original.rows);
  assert.equal(twice.scale, 2 * original.scale);
  assert.ok(original.counts.loop > 0 && original.counts.loop < original.rows.flat().length);
});

test('Small, axial, and maximum-size tables have complete atlases', () => {
  const small = survey({ width: 2, height: 2, velocity: [1, -1] });
  assert.deepEqual(small.rows, [[{ outcome: 'NE', tick: 1, banks: 0 }]]);
  const axial = survey({ width: 8, height: 6, velocity: [-1, 0] });
  assert.equal(axial.counts.loop, 35);
  assert.ok(axial.rows.flat().every(cell => cell.tick === 16 && cell.banks === 2));
  const large = survey({ width: 24, height: 24, velocity: [11, -12] });
  assert.equal(large.rows.flat().length, 529);
  assert.equal(Object.values(large.counts).reduce((sum, count) => sum + count, 0), 529);
  assert.equal((atlasSVG(large).match(/data-start="/g) ?? []).length, 529);
  assert.throws(() => survey({ width: 1 }), /2 to 24/);
  assert.throws(() => survey({ velocity: [0, 0] }), /nonzero/);
});

test('The CLI map exports SVG and JSON and rejects incompatible shot options', async () => {
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
  const terminal = run('--map');
  assert.equal(terminal.status, 0, terminal.stderr);
  assert.match(terminal.stdout, /88 starts · \.\. loop 74 · NW 2 · NE 5 · SW 2 · SE 5/);
  const directory = await mkdtemp(join(tmpdir(), 'bankshot-atlas-'));
  try {
    const path = join(directory, 'atlas.svg');
    const result = run('--map', '--json', '--svg', path);
    assert.equal(result.status, 0, result.stderr);
    const atlas = survey();
    assert.deepEqual(JSON.parse(result.stdout), atlas);
    const svg = await readFile(path, 'utf8');
    assert.equal(svg, atlasSVG(atlas));
    assert.match(svg, /data-start="4,2" data-outcome="NE">\n<title>Start \(4, 2\)\. North-east pocket at t=16 after 3 banks\./);
    assert.equal(run('--map', '--svg', path).status, 1);
    assert.equal(await readFile(path, 'utf8'), svg);
    const unused = join(directory, 'unused.svg');
    for (const args of [['--trace'], ['--from', '4,2'], ['--map']]) {
      const invalid = run('--map', ...args, '--svg', unused);
      assert.equal(invalid.status, 1);
      assert.equal(invalid.stdout, '');
      assert.match(invalid.stderr, /--map/);
    }
    await assert.rejects(readFile(unused), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
