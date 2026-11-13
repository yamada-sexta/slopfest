import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run as reduce } from '../core.mjs';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });

test('The CLI explains every rewrite and emits the exact receipt as JSON', () => {
  const normal = run(['--trace']);
  assert.equal(normal.status, 0, normal.stderr);
  assert.match(normal.stdout, /1  K feather \(K feather\)  \[S at root\]/);
  assert.match(normal.stdout, /Normal form after 2 rewrites/);
  const expression = 'K sunshine (S I I (S I I))';
  const json = run([expression, '--json']);
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), reduce(expression));
  const stopped = run(['S I I (S I I)', '--steps', '12', '--json']);
  assert.equal(stopped.status, 2);
  assert.deepEqual(JSON.parse(stopped.stdout), reduce('S I I (S I I)', { maxSteps: 12 }));
  const sized = run(['S x y (z z)', '--nodes', '9']);
  assert.equal(sized.status, 2);
  assert.match(sized.stdout, /next term needs 11 nodes/);
  assert.equal(run(['I x', '--steps', '0']).status, 2);
  assert.equal(run(['--help']).status, 0);
});

test('Invalid arguments print an error and preserve empty stdout', () => {
  for (const args of [
    ['--what'], ['--help', '--json'], ['x', 'y'], ['--steps'], ['--nodes'],
    ['--steps', '-1'], ['--steps', '01'], ['--steps', '1.5'], ['--steps', '501'],
    ['--nodes', '4097'], ['--json', '--json'], ['--steps', '1', '--steps', '2'],
    [''], ['(x'], ['x)'], ['()'], ['x + y'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim());
  }
});
