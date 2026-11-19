import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse, print, step, run } from '../core.mjs';
import { compileLambda } from '../lambda.mjs';

// Independent oracle: gather every redex by its left spine, discard those
// with reducible descendants, then select the leftmost remaining path.
// This does not use the engine's traversal stack or application-node patterns.
function contract(tree) {
  const args = [];
  let head = tree;
  while (Array.isArray(head)) { args.unshift(head[1]); head = head[0]; }
  if (head === 'I' && args.length === 1) return { term: args[0], rule: 'I' };
  if (head === 'K' && args.length === 2) return { term: args[0], rule: 'K' };
  if (head === 'S' && args.length === 3) return { term: [[args[0], args[2]], [args[1], args[2]]], rule: 'S' };
  return null;
}
function reference(tree) {
  const candidates = [];
  function gather(at, path) {
    const replacement = contract(at);
    if (replacement) candidates.push({ ...replacement, path });
    if (Array.isArray(at)) { gather(at[0], path + 'f'); gather(at[1], path + 'a'); }
  }
  gather(tree, '');
  const inner = candidates.filter(candidate => !candidates.some(other => other.path.length > candidate.path.length && other.path.startsWith(candidate.path)));
  const key = path => path.replaceAll('f', '0').replaceAll('a', '1');
  inner.sort((a, b) => key(a.path) < key(b.path) ? -1 : 1);
  if (!inner.length) return null;
  const chosen = inner[0];
  function replace(at, path) {
    if (!path) return chosen.term;
    return path[0] === 'f' ? [replace(at[0], path.slice(1)), at[1]] : [at[0], replace(at[1], path.slice(1))];
  }
  return { ...chosen, term: replace(tree, chosen.path) };
}
const source = tree => typeof tree === 'string' ? tree : `(${source(tree[0])} ${source(tree[1])})`;

test('All 15,764 terms through five leaves match an independent innermost candidate oracle', () => {
  const terms = [[], ['S', 'K', 'I', 'x']];
  let checked = 0;
  for (let leaves = 1; leaves <= 5; leaves++) {
    if (leaves > 1) {
      terms[leaves] = [];
      for (let left = 1; left < leaves; left++) for (const fn of terms[left]) for (const arg of terms[leaves - left]) terms[leaves].push([fn, arg]);
    }
    for (const tree of terms[leaves]) {
      const input = parse(source(tree)), before = print(input), expected = reference(tree);
      const actual = step(input, { strategy: 'applicative' });
      assert.equal(actual === null, expected === null, before);
      if (actual) {
        assert.equal(print(actual.term), print(parse(source(expected.term))));
        assert.equal(actual.rule, expected.rule, before);
        assert.equal(actual.path, expected.path, before);
      }
      assert.equal(print(input), before);
      checked++;
    }
  }
  assert.equal(checked, 15764);
});

test('Leftmost innermost order includes function spines, arguments, and partial applications', () => {
  for (const [expression, expected, path] of [
    ['I (I x)', 'I x', 'a'],
    ['K (I x) (I y)', 'K x (I y)', 'fa'],
    ['I x (I y)', 'x (I y)', 'f'],
    ['S (I x) (I y) (I z)', 'S x (I y) (I z)', 'ffa'],
    ['K (I x)', 'K x', 'a'],
    ['I (x (I y))', 'I (x y)', 'aa'],
  ]) {
    const result = step(parse(expression), { strategy: 'applicative' });
    assert.equal(print(result.term), expected);
    assert.equal(result.path, path);
    assert.equal(result.rule, 'I');
  }
  const expression = 'K (I sunshine) (I rain)';
  assert.deepEqual(run(expression, { strategy: 'applicative' }).frames.map(frame => frame.term),
    [expression, 'K sunshine (I rain)', 'K sunshine rain', 'sunshine']);
  assert.equal(run(expression).frames.at(-1).term, 'sunshine');
  assert.equal(run(expression).reductions, 2);
  const duplicated = 'S I I (I feather)';
  const normal = run(duplicated), inner = run(duplicated, { strategy: 'applicative' });
  assert.equal(normal.frames.at(-1).term, 'feather feather');
  assert.equal(inner.frames.at(-1).term, 'feather feather');
  assert.equal(normal.reductions, 5);
  assert.equal(inner.reductions, 4);
});

test('Normal order discards an endless argument; applicative order spends its own budget', () => {
  const expression = 'K sunshine (S I I (S I I))';
  const normal = run(expression), inner = run(expression, { strategy: 'applicative', maxSteps: 12 });
  assert.equal(normal.strategy, 'normal');
  assert.equal(normal.status, 'normal');
  assert.equal(normal.reductions, 1);
  assert.equal(normal.frames.at(-1).term, 'sunshine');
  assert.equal(inner.strategy, 'applicative');
  assert.equal(inner.status, 'steps');
  assert.equal(inner.reductions, 12);
  assert.equal(inner.frames[3].term, expression);
  assert.equal(inner.frames.at(-1).term, expression);
  assert.ok(inner.frames.slice(1).every(frame => frame.path.startsWith('a')));
});

test('Both strategies enforce step and node limits before accepting a rewrite', () => {
  const expression = 'K sunshine (S x y (z z))';
  const limited = run(expression, { strategy: 'applicative', maxNodes: 13 });
  assert.equal(limited.status, 'size');
  assert.equal(limited.reductions, 0);
  assert.equal(limited.nextNodes, 15);
  assert.equal(limited.nextRule, 'S');
  assert.equal(limited.nextPath, 'a');
  assert.equal(run(expression, { maxNodes: 13 }).status, 'normal');
  assert.equal(run(expression, { strategy: 'applicative', maxNodes: 15 }).status, 'normal');
  const shrinkFirst = 'S x y (I z)';
  assert.equal(run(shrinkFirst, { maxNodes: 9 }).status, 'size');
  assert.equal(run(shrinkFirst, { strategy: 'applicative', maxNodes: 9 }).status, 'normal');
  for (const strategy of ['normal', 'applicative']) {
    assert.equal(run('x', { strategy, maxSteps: 0 }).status, 'normal');
    assert.equal(run('I x', { strategy, maxSteps: 0 }).status, 'steps');
    assert.equal(run('I x', { strategy, maxSteps: 1 }).status, 'normal');
  }
  const result = run('I x', { strategy: 'applicative' });
  assert.throws(() => { result.strategy = 'normal'; });
  assert.throws(() => { result.frames[0].term = 'changed'; });
});

test('Compiled lambdas work with both strategies, including a discarded self-application', () => {
  const finite = compileLambda('(\\x. x) feather');
  for (const strategy of ['normal', 'applicative']) {
    const result = run(finite, { strategy });
    assert.equal(result.status, 'normal');
    assert.equal(result.frames.at(-1).term, 'feather');
  }
  const discarded = compileLambda('(\\unused. sun) ((\\x. x x) (\\x. x x))');
  assert.equal(run(discarded).frames.at(-1).term, 'sun');
  assert.equal(run(discarded, { strategy: 'applicative', maxSteps: 12 }).status, 'steps');
});

test('Innermost traversal and context rebuilding avoid recursion on deep inputs', () => {
  const suffix = Array(1500).fill('y').join(' ');
  const term = parse(`I x ${suffix}`, { maxNodes: 4096 });
  const result = step(term, { strategy: 'applicative' });
  assert.equal(result.path, 'f'.repeat(1500));
  assert.equal(print(result.term), `x ${suffix}`);
  assert.equal(step(result.term, { strategy: 'applicative' }), null);
  for (const strategy of ['', 'lazy', 'Normal', null, 1, {}]) {
    assert.throws(() => step(parse('x'), { strategy }), /strategy/);
    assert.throws(() => run('x', { strategy }), /strategy/);
  }
});

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const invoke = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
test('CLI comparisons retain full independent receipts and report bounded runs with exit 2', () => {
  const expression = 'K sunshine (S I I (S I I))';
  const result = invoke(expression, '--compare', '--steps', '12', '--json');
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { comparison: [
    run(expression, { maxSteps: 12, strategy: 'normal' }),
    run(expression, { maxSteps: 12, strategy: 'applicative' }),
  ] });
  const finite = invoke('K (I sunshine) (I rain)', '--compare', '--trace');
  assert.equal(finite.status, 0, finite.stderr);
  assert.match(finite.stdout, /leftmost outermost reduction/);
  assert.match(finite.stdout, /leftmost innermost reduction/);
  assert.match(finite.stdout, /Normal form after 3 rewrites/);
  const single = invoke('I (I x)', '--strategy', 'applicative', '--json');
  assert.equal(single.status, 0);
  assert.deepEqual(JSON.parse(single.stdout), run('I (I x)', { strategy: 'applicative' }));
  const sized = invoke('K sunshine (S x y (z z))', '--compare', '--nodes', '13', '--json');
  assert.equal(sized.status, 2);
  assert.deepEqual(JSON.parse(sized.stdout).comparison.map(receipt => receipt.status), ['normal', 'size']);
  const lambda = '(\\x. x) feather';
  const compiled = invoke(lambda, '--lambda', '--compare', '--json');
  assert.equal(compiled.status, 0, compiled.stderr);
  for (const receipt of JSON.parse(compiled.stdout).comparison) {
    assert.equal(receipt.compilation.source, lambda);
    assert.equal(receipt.compilation.expression, print(compileLambda(lambda)));
    assert.equal(receipt.frames.at(-1).term, 'feather');
  }
});

test('Invalid or ambiguous strategy options fail before printing any receipt', () => {
  for (const args of [['--strategy'], ['--strategy', 'lazy'], ['--strategy', 'Normal'],
    ['--compare', '--strategy', 'normal'], ['--strategy', 'normal', '--strategy', 'applicative'],
    ['--compare', '--compare'], ['--compare', '--nodes', '0']]) {
    const result = invoke(...args);
    assert.equal(result.status, 1, args.join(' '));
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim());
  }
});
