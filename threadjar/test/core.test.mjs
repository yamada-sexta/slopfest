import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse, createState, step, runnable, status, explore, LIMITS } from '../core.mjs';
import { examples } from '../examples.mjs';
const exec = promisify(execFile);
const busySource = 'shared a = 0\nshared b = 0\n' + [
  'load a\nadd 1\nstore b\nload b\nadd 1\nstore a\n',
  'load b\nadd 2\nstore a\nload a\nadd 2\nstore b\n',
  'load a\nadd 3\nstore a\nload b\nadd 3\nstore b\n'
].map((body, i) => `thread t${i}\n${body.repeat(2)}end`).join('\n');
const replay = (program, schedule) => {
  let state = createState(program);
  for (const id of schedule) { const result = step(state, id); assert.equal(result.ok, true, result.message); state = result.state; }
  return state;
};

test('The parser supports comments, CRLF, signed integers, and declared names', () => {
  const program = parse('# note\r\nshared jar = -2\r\nmutex key\r\nthread amber\r\n lock key\r\n load jar # private copy\r\n add +3\r\n store jar\r\n unlock key\r\nend');
  assert.equal(replay(program, Array(5).fill('amber')).shared.jar, 1);
});
test('Each instruction is one turn and earlier states remain unchanged', () => {
  const program = parse(examples[0].source), initial = createState(program);
  const first = step(initial, 'amber').state;
  const second = step(first, 'amber').state;
  assert.equal(first.tick, 1); assert.equal(second.tick, 2);
  assert.equal(initial.workers[0].pc, 0); assert.equal(first.workers[0].pocket, 0);
  assert.equal(second.workers[0].pocket, 1); assert.equal(second.shared.jar, 0);
  assert.equal(program.shared.jar, 0);
});
test('Different schedules reproduce both a lost update and two successful additions', () => {
  const program = parse(examples[0].source);
  const race = replay(program, ['amber', 'blue', 'amber', 'blue', 'amber', 'blue']);
  const serial = replay(program, ['amber', 'amber', 'amber', 'blue', 'blue', 'blue']);
  assert.equal(race.shared.jar, 1); assert.equal(serial.shared.jar, 2);
  assert.equal(status(race), 'finished'); assert.equal(status(serial), 'finished');
  assert.equal(step(race, 'amber').ok, false);
});
test('A held mutex blocks a worker without advancing time or changing the state', () => {
  let state = createState(parse(examples[1].source));
  state = step(state, 'amber').state;
  assert.deepEqual(runnable(state), ['amber']);
  const blocked = step(state, 'blue');
  assert.equal(blocked.ok, false); assert.equal(blocked.state, state); assert.equal(state.tick, 1);
  for (let i = 0; i < 4; i++) state = step(state, 'amber').state;
  assert.deepEqual(runnable(state), ['blue']); assert.equal(state.locks.brass, null);
});

for (const [example, expected] of [
  [examples[0], ['finished:1', 'finished:2']],
  [examples[1], ['finished:2']],
  [examples[2], ['deadlock:0', 'finished:2']]
]) {
  test(`Exploration finds the expected endings and replayable witnesses: ${example.name}`, () => {
    const program = parse(example.source), result = explore(program);
    assert.equal(result.complete, true);
    assert.deepEqual(result.outcomes.map(o => `${o.kind}:${o.shared.jar}`).sort(), expected.sort());
    for (const outcome of result.outcomes) {
      const end = replay(program, outcome.schedule);
      assert.equal(status(end), outcome.kind); assert.deepEqual(end.shared, outcome.shared);
    }
  });
}
test('State merging agrees with unmerged enumeration for three independent pockets', () => {
  const source = 'shared jar = 0\n' + ['amber', 'blue', 'violet'].map((id, i) => `thread ${id}\nload jar\nadd ${i + 1}\nstore jar\nend`).join('\n');
  const program = parse(source), endings = new Set(); let finishedSchedules = 0;
  const visit = state => {
    if (status(state) !== 'running') { endings.add(`${status(state)}:${state.shared.jar}`); finishedSchedules++; return; }
    for (const id of runnable(state)) visit(step(state, id).state);
  };
  visit(createState(program));
  assert.equal(finishedSchedules, 1680);
  const result = explore(program);
  assert.equal(result.complete, true);
  assert.deepEqual(new Set(result.outcomes.map(o => `${o.kind}:${o.shared.jar}`)), endings);
  assert.ok(result.visited < finishedSchedules);
});
test('A bounded search honestly reports incomplete exploration', () => {
  const result = explore(parse(examples[0].source), { maxStates: 1 });
  assert.equal(result.complete, false); assert.equal(result.visited, 1); assert.deepEqual(result.outcomes, []);
  assert.throws(() => explore(parse(examples[0].source), { maxStates: 0 }), /Search limit/);
});
test('The default budget bounds a real three-worker search', () => {
  const result = explore(parse(busySource));
  assert.equal(result.complete, false); assert.equal(result.visited, LIMITS.states);
  for (const outcome of result.outcomes) assert.equal(status(replay(parse(busySource), outcome.schedule)), outcome.kind);
});
test('Self-locking and a key held by a finished worker can deadlock', () => {
  const self = parse('mutex key\nthread amber\nlock key\nlock key\nend');
  assert.equal(explore(self).outcomes[0].kind, 'deadlock');
  const abandoned = parse('mutex key\nthread amber\nlock key\nend\nthread blue\nlock key\nend');
  const result = explore(abandoned);
  assert.ok(result.outcomes.every(o => o.kind === 'deadlock'));
});
test('Unlocking a key without owning it ends with an inspectable fault', () => {
  const program = parse('mutex key\nthread amber\nunlock key\nend');
  const state = step(createState(program), 'amber').state;
  assert.equal(status(state), 'fault'); assert.match(state.fault, /does not hold.*line 3/);
  assert.deepEqual(runnable(state), []); assert.equal(explore(program).outcomes[0].kind, 'fault');
});
test('Inherited object properties cannot masquerade as undeclared jars', () => {
  assert.throws(() => parse('thread amber\nload constructor\nend'), /not declared/);
  const valid = parse('shared constructor = 0\nthread amber\nload constructor\nadd 1\nstore constructor\nend');
  assert.equal(replay(valid, ['amber', 'amber', 'amber']).shared.constructor, 1);
});
test('Malformed programs fail with clear errors and bounded source sizes', () => {
  for (const [source, message] of [
    ['', /Add a worker/], ['thread amber\nload jar', /needs an end/],
    ['thread amber\nend', /at least one/], ['shared jar = 0\nshared jar = 1', /Line 2.*already/],
    ['mutex key\nmutex key', /already/], ['thread amber\nadd 1\nend\nthread amber\nadd 2\nend', /already/],
    ['thread amber\nload absent\nend', /not declared/], ['thread amber\nlock absent\nend', /not declared/],
    ['thread amber\nadd banana\nend', /integer/], ['thread amber\nadd 1000001\nend', /integer/],
    ['thread amber\nfetch secrets\nend', /Expected/], ['thread amber\nadd 1.5\nend', /Expected/],
    ['thread amber\n' + 'add 1\n'.repeat(13) + 'end', /at most 12/],
    ['#'.repeat(LIMITS.source + 1), /12,000/]
  ]) assert.throws(() => parse(source), message);
  assert.throws(() => step(createState(parse(examples[0].source)), 'missing'), /Unknown worker/);
});
test('The shipped command-line seed matches the browser experiment', async () => {
  assert.deepEqual(parse(await readFile(new URL('../examples/marbles.jar', import.meta.url), 'utf8')), parse(examples[0].source));
});
test('CLI emits machine-readable endings and useful nonzero syntax failures', async () => {
  const { stdout } = await exec(process.execPath, ['threadjar/cli.mjs', 'threadjar/examples/marbles.jar', '--json']);
  const result = JSON.parse(stdout); assert.equal(result.complete, true); assert.equal(result.outcomes.length, 2);
  const dir = await mkdtemp(join(tmpdir(), 'threadjar-test-'));
  try {
    const file = join(dir, 'invalid.jar'); await writeFile(file, 'thread amber\nload absent\nend');
    await assert.rejects(exec(process.execPath, ['threadjar/cli.mjs', file]), error => error.code === 1 && /Line 2.*not declared/.test(error.stderr));
    const busy = join(dir, 'busy.jar'); await writeFile(busy, busySource);
    await assert.rejects(exec(process.execPath, ['threadjar/cli.mjs', busy, '--json']), error => error.code === 2 && JSON.parse(error.stdout).complete === false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
