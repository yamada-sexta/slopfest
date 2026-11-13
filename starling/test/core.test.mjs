import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, print, run, step } from '../core.mjs';

// The oracle represents application as arrays, gathers the left spine, and
// consumes a rule's arguments before reapplying any remaining arguments.
function reference(tree) {
  if (typeof tree === 'string') return null;
  const args = [];
  let head = tree;
  while (Array.isArray(head)) {
    args.unshift(head[1]);
    head = head[0];
  }
  let replacement;
  let used = 0;
  if (head === 'I' && args.length >= 1) {
    replacement = args[0]; used = 1;
  } else if (head === 'K' && args.length >= 2) {
    replacement = args[0]; used = 2;
  } else if (head === 'S' && args.length >= 3) {
    replacement = [[args[0], args[2]], [args[1], args[2]]]; used = 3;
  }
  if (used) {
    for (const arg of args.slice(used)) replacement = [replacement, arg];
    return replacement;
  }
  for (let i = 0; i < args.length; i++) {
    const reduced = reference(args[i]);
    if (reduced !== null) {
      const next = [...args]; next[i] = reduced;
      return next.reduce((fn, arg) => [fn, arg], head);
    }
  }
  return null;
}

function source(tree) {
  return typeof tree === 'string' ? tree : `(${source(tree[0])} ${source(tree[1])})`;
}

test('All 1,428 small terms agree with a separate spine-based reducer and round-trip printer', () => {
  const terms = [[], ['S', 'K', 'I', 'x']];
  let checked = 0;
  for (let leaves = 1; leaves <= 4; leaves++) {
    if (leaves > 1) {
      terms[leaves] = [];
      for (let left = 1; left < leaves; left++) {
        for (const fn of terms[left]) for (const arg of terms[leaves - left]) {
          terms[leaves].push([fn, arg]);
        }
      }
    }
    for (const tree of terms[leaves]) {
      const term = parse(source(tree)), canonical = print(term), expected = reference(tree);
      assert.deepEqual(parse(canonical), term);
      const actual = step(term);
      assert.equal(actual === null, expected === null, canonical);
      if (actual) assert.deepEqual(actual.term, parse(source(expected)), canonical);
      assert.equal(print(term), canonical, 'reducing preserves the original tree');
      checked++;
    }
  }
  assert.equal(checked, 1428);
});

test('Rule locations identify the exact leftmost outermost redex', () => {
  for (const [expression, term, rule, path] of [
    ['I x y', 'x y', 'I', 'f'],
    ['S x y z', 'x z (y z)', 'S', ''],
    ['x (I y) (I z)', 'x y (I z)', 'I', 'fa'],
    ['K (I x)', 'K x', 'I', 'a'],
    ['x (y (I z))', 'x (y z)', 'I', 'aa'],
  ]) {
    const actual = step(parse(expression));
    assert.deepEqual({ term: print(actual.term), rule: actual.rule, path: actual.path }, { term, rule, path });
  }
  assert.equal(print(parse('SKK feather')), 'S K K feather');
  assert.equal(print(parse('  ((x))\n(y z)\t')), 'x (y z)');
});

test('K can discard self-application before reducing it, and normal form can meet the exact budget', () => {
  const identity = run('S K K feather', { maxSteps: 2 });
  assert.equal(identity.status, 'normal');
  assert.deepEqual(identity.frames.map(frame => frame.term), ['S K K feather', 'K feather (K feather)', 'feather']);
  assert.deepEqual(identity.frames.map(frame => frame.nodes), [7, 7, 1]);
  const discarded = run('K sunshine (S I I (S I I))');
  assert.equal(discarded.status, 'normal');
  assert.equal(discarded.reductions, 1);
  assert.equal(discarded.frames.at(-1).term, 'sunshine');
  assert.equal(run('x', { maxSteps: 0 }).status, 'normal');
  assert.equal(run('I x', { maxSteps: 0 }).status, 'steps');
  assert.equal(run('S I I (S I I)', { maxSteps: 12 }).status, 'steps');
});

test('Size limits stop before an oversized rewrite and count duplicated subtrees', () => {
  const bounded = run('S x y (z z)', { maxNodes: 9 });
  assert.equal(bounded.status, 'size');
  assert.equal(bounded.reductions, 0);
  assert.equal(bounded.nextNodes, 11);
  assert.equal(bounded.nextRule, 'S');
  assert.equal(bounded.nextPath, '');
  assert.equal(bounded.frames[0].nodes, 9);
  assert.equal(run('S x y (z z)', { maxNodes: 11 }).status, 'normal');
  assert.equal(run('S x y (z z)', { maxNodes: 11 }).frames.at(-1).nodes, 11);
  assert.throws(() => parse('K (x y)', { maxNodes: 4 }), /exceeds/);
  assert.throws(() => parse('x y', { maxNodes: 2 }), /exceeds/);
});

test('Deep grouping and long application chains avoid the JavaScript call stack', () => {
  assert.equal(print(parse('('.repeat(3000) + 'x' + ')'.repeat(3000))), 'x');
  const long = Array(1500).fill('x').join(' ');
  const term = parse(long, { maxNodes: 4096 });
  assert.equal(step(term), null);
  assert.equal(print(term), long);
  assert.equal(run(long, { maxNodes: 4096 }).frames[0].nodes, 2999);
});

test('Malformed syntax, limits, and foreign trees fail clearly; results are frozen', () => {
  for (const expression of ['', ' ', '()', '(x', 'x)', '((x)', 'X', 'x + y', 'x-y', '123', 'é', 'x'.repeat(33), 'x'.repeat(8193)]) {
    assert.throws(() => parse(expression), expression);
  }
  for (const maxSteps of [-1, 501, 1.5, '2', null]) assert.throws(() => run('x', { maxSteps }));
  for (const maxNodes of [0, 4097, 1.5, '2', null]) assert.throws(() => parse('x', { maxNodes }));
  for (const value of [null, {}, { kind: 'atom', name: 'x' }]) {
    assert.throws(() => step(value)); assert.throws(() => print(value));
  }
  const term = parse('I x'), result = run('I x');
  assert.throws(() => { term.arg.name = 'y'; }, TypeError);
  assert.throws(() => { result.frames[0].nodes = 0; }, TypeError);
  assert.throws(() => result.frames.push({}), TypeError);
});
