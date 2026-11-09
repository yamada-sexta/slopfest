import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { fraction, shoot, toSVG } from '../core.mjs';

// Step a ball in the physical table, flipping components when it hits a rail.
// Let corners reflect both components here so we can also check the full period.
function slowShot(width, height, start, velocity) {
  const scale = (Math.abs(velocity[0]) || 1) * (Math.abs(velocity[1]) || 1);
  const [originX, originY] = start.map(value => value * scale);
  let x = originX;
  let y = originY;
  let [vx, vy] = velocity;
  const points = [{ tick: 0, x, y, walls: [] }];
  let pocketed = false;
  for (let tick = 1; tick <= 4096; tick++) {
    x += vx;
    y += vy;
    assert.ok(x >= 0 && x <= width * scale && y >= 0 && y <= height * scale);
    const walls = [];
    if (y === 0 || y === height * scale) {
      walls.push(y === 0 ? 'north' : 'south');
      vy = -vy;
    }
    if (x === 0 || x === width * scale) {
      walls.push(x === 0 ? 'west' : 'east');
      vx = -vx;
    }
    if (walls.length && !pocketed) points.push({ tick, x, y, walls });
    if (walls.length === 2) pocketed = true;
    if (x === originX && y === originY && vx === velocity[0] && vy === velocity[1]) {
      if (!pocketed) points.push({ tick, x, y, walls: [] });
      return { scale, returnTicks: tick, end: pocketed ? 'pocket' : 'return', points };
    }
  }
  throw new Error('Small reference shot exceeded its tick limit.');
}

test('Unfolded event traces match physical stepping across 10,800 small shots', () => {
  for (let width = 2; width <= 6; width++) {
    for (let height = 2; height <= 6; height++) {
      for (let x = 1; x < width; x++) {
        for (let y = 1; y < height; y++) {
          for (let vx = -3; vx <= 3; vx++) {
            for (let vy = -3; vy <= 3; vy++) {
              if (vx === 0 && vy === 0) continue;
              const start = [x, y];
              const velocity = [vx, vy];
              const fast = shoot({ width, height, start, velocity });
              const slow = slowShot(width, height, start, velocity);
              const ratio = slow.scale / fast.scale;
              const context = JSON.stringify({ width, height, start, velocity });
              assert.equal(fast.returnTicks * ratio, slow.returnTicks, context);
              assert.equal(fast.end, slow.end, context);
              assert.equal(fast.banks, slow.points.length - 2, context);
              const points = fast.points.map(p => ({
                tick: p.tick * ratio, x: p.x * ratio, y: p.y * ratio, walls: p.walls,
              }));
              assert.deepEqual(points, slow.points, context);
            }
          }
        }
      }
    }
  }
});

test('The default fractional bank, a one-unit move into a pocket, and an axial return', () => {
  const normal = shoot();
  assert.equal(normal.end, 'return');
  assert.equal(normal.banks, 10);
  assert.deepEqual(normal.points[1], { tick: 9, x: 24, y: 13, walls: ['east'] });
  assert.equal(fraction(normal.returnTicks, normal.scale), '36');
  const pocket = shoot({ start: [4, 2] });
  assert.equal(pocket.end, 'pocket');
  assert.equal(pocket.banks, 3);
  assert.deepEqual(pocket.points.at(-1), { tick: 32, x: 24, y: 0, walls: ['north', 'east'] });
  const axial = shoot({ width: 8, height: 6, velocity: [-1, 0] });
  assert.deepEqual(axial.points, [
    { tick: 0, x: 2, y: 1, walls: [] },
    { tick: 2, x: 0, y: 1, walls: ['west'] },
    { tick: 10, x: 8, y: 1, walls: ['east'] },
    { tick: 16, x: 2, y: 1, walls: [] },
  ]);
});

test('A corner can be the first event, and a dense path retains its full trace', () => {
  const corner = shoot({ width: 2, height: 2, velocity: [-1, -1] });
  assert.equal(corner.banks, 0);
  assert.deepEqual(corner.points[1], { tick: 1, x: 0, y: 0, walls: ['north', 'west'] });
  const dense = shoot({ width: 23, height: 24, start: [1, 2], velocity: [12, 11] });
  const svg = toSVG(dense);
  assert.ok(dense.banks > 24);
  assert.equal(svg.match(/<polyline points="([^"]+)"/)[1].split(' ').length, dense.points.length);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('Bounds reject malformed shots and geometry stays independent of caller arrays', () => {
  for (const options of [
    { width: 1 }, { height: 25 }, { height: 2.5 }, { width: '12' },
    { start: [0, 1] }, { start: [3, 9] }, { start: [2, 2.5] }, { start: Array(2) },
    { velocity: [0, 0] }, { velocity: [1, -13] }, { velocity: [1, NaN] }, { velocity: null },
  ]) assert.throws(() => shoot(options));
  const start = [3, 2], velocity = [2, 1];
  const shot = shoot({ start, velocity });
  start[0] = 4;
  velocity[0] = 1;
  assert.deepEqual(shot.start, [3, 2]);
  assert.deepEqual(shot.velocity, [2, 1]);
  assert.throws(() => shot.points[1].walls.push('north'), TypeError);
  assert.throws(() => toSVG({ ...shot }));
});

test('CLI shows exact traces and saves the full SVG without overwriting files', async () => {
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
  const result = run('--trace');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /t=9\/2  \(12, 13\/2\)  east/);
  assert.match(result.stdout, /t=36  \(3, 2\)  return/);
  const dir = await mkdtemp(join(tmpdir(), 'bankshot-'));
  try {
    const path = join(dir, 'pocket.svg');
    const exportResult = run('--from', '4,2', '--svg', path, '--json');
    assert.equal(exportResult.status, 0, exportResult.stderr);
    const shot = shoot({ start: [4, 2] });
    assert.deepEqual(JSON.parse(exportResult.stdout), shot);
    assert.equal(await readFile(path, 'utf8'), toSVG(shot));
    assert.equal(run('--svg', path).status, 1);
    assert.equal(await readFile(path, 'utf8'), toSVG(shot));
    const badPath = join(dir, 'invalid.svg');
    for (const args of [['--velocity', '0,0'], ['--table', '12x'], ['--from', '3,2\n'], ['--trace', '--trace'], ['--help', '--json']]) {
      const invalid = run(...args, '--svg', badPath);
      assert.equal(invalid.status, 1);
      assert.equal(invalid.stdout, '');
      assert.ok(invalid.stderr);
    }
    await assert.rejects(readFile(badPath), { code: 'ENOENT' });
    assert.equal(run('--velocity', '-1,0').status, 0);
    assert.match(run('--help').stdout, /--table WxH/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
