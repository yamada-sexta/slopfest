import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile), cli = (...args) => exec(process.execPath, ['detour/cli.mjs', ...args]);

test('Real CLI emits raw UTF-8 bytes, human traces, structured results, and honest stop statuses', async () => {
  const help = await cli('--help'); assert.match(help.stdout, /code takes the long way home/); assert.equal(help.stderr, '');
  assert.match((await cli()).stdout, /Usage:/);
  const hello = await cli('detour/examples/hello.tour'); assert.match(hello.stdout, /Output: "HI!"/);
  const raw = await cli('detour/examples/echo.tour', '--input', '🍃 café', '--raw'); assert.equal(raw.stdout, '🍃 café'); assert.equal(raw.stderr, '');
  assert.equal((await cli('detour/examples/echo.tour', '--input', '--help', '--raw')).stdout, '--help');
  const traced = await cli('--trace', 'detour/examples/countdown.tour');
  assert.match(traced.stdout, /00038.*#.*byte 0→0/); assert.match(traced.stdout, /Output: "3 2 1 0 "/);
  const json = JSON.parse((await cli('--json', '--trace', 'detour/examples/countdown.tour')).stdout);
  assert.equal(json.status, 'halted'); assert.equal(json.history.length, 38); assert.equal(json.text, '3 2 1 0 ');
  await assert.rejects(cli('detour/examples/forever.tour', '--json'), error => {
    assert.equal(error.code, 2); assert.equal(error.stderr, ''); const result = JSON.parse(error.stdout);
    assert.equal(result.status, 'cycle'); assert.equal(result.cycle.period, 6); assert.equal(result.text, '0 '); assert.ok(!Object.hasOwn(result, 'history')); return true;
  });
  await assert.rejects(cli('detour/examples/forever.tour', '--steps', '7', '--json'), error => error.code === 2 && JSON.parse(error.stdout).status === 'step-limit');
  await assert.rejects(cli('detour/examples/forever.tour', '--raw'), error => error.code === 2 && error.stdout === '0 ' && /Cycle prefix: 2 steps; period 6/.test(error.stderr));
});

test('Real CLI validates options and files, and SVG export never replaces existing work', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'detour-test-'));
  try {
    const map = join(dir, 'map.tour'), svg = join(dir, 'route.svg');
    await writeFile(map, '@>#');
    const output = await cli(map, '--svg', svg, '--json');
    assert.equal(JSON.parse(output.stdout).status, 'halted');
    const saved = await readFile(svg, 'utf8'); assert.match(saved, /^<svg/); assert.match(saved, /data-cell="3,1" data-visits="1"/);
    await assert.rejects(cli(map, '--svg', svg), error => error.code === 1 && /EEXIST/.test(error.stderr) && error.stdout === '');
    assert.equal(await readFile(svg, 'utf8'), saved);
    for (const args of [['--json', '--json'], ['--steps', '0'], ['--steps', '01'], ['--steps', '1.5'], ['--steps', '100001'], ['--steps'], ['--input'], ['--input', 'π'.repeat(513)], ['--svg'], ['--raw', '--json'], ['--raw', '--trace'], ['--unknown']]) {
      await assert.rejects(cli(map, ...args), error => error.code === 1 && error.stdout === '' && Boolean(error.stderr));
    }
    await assert.rejects(cli('--trace'), error => error.code === 1 && /Choose a map/.test(error.stderr));
    await assert.rejects(cli(map, map), error => error.code === 1 && /exactly one/.test(error.stderr));
    await writeFile(map, '@x'); await assert.rejects(cli(map), error => error.code === 1 && /Line 1, column 2/.test(error.stderr));
    await writeFile(map, ' '.repeat(8193)); await assert.rejects(cli(map), error => error.code === 1 && /8,192 bytes/.test(error.stderr));
    await writeFile(map, '@'); const escaped = await cli(map, '--json'); assert.equal(JSON.parse(escaped.stdout).status, 'escaped');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
