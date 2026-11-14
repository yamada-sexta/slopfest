import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { application, parse, print, run } from '../core.mjs';
import { compileLambda } from '../lambda.mjs';

function source(tree) {
  return typeof tree === 'string' ? tree : `(${source(tree[0])} ${source(tree[1])})`;
}

function substitute(tree, binder) {
  if (typeof tree === 'string') return tree === binder ? 'z' : tree;
  return tree.map(child => substitute(child, binder));
}

test('Compiled abstraction matches direct substitution for 1,100 inert bodies', () => {
  const bodies = [[], ['x', 'y']];
  let checked = 0;
  for (let leaves = 1; leaves <= 5; leaves++) {
    if (leaves > 1) {
      bodies[leaves] = [];
      for (let left = 1; left < leaves; left++) {
        for (const fn of bodies[left]) for (const arg of bodies[leaves - left]) {
          bodies[leaves].push([fn, arg]);
        }
      }
    }
    for (const body of bodies[leaves]) for (const binder of ['x', 'y']) {
      const compiled = compileLambda(`\\${binder}. ${source(body)}`);
      const applied = application(compiled, parse('z'));
      const result = run(applied, { maxSteps: 500 });
      assert.equal(result.status, 'normal');
      assert.equal(result.frames.at(-1).term, print(parse(source(substitute(body, binder)))));
      checked++;
    }
  }
  assert.equal(checked, 1100);
});

test('Translation rules, shadowing, and free names preserve lexical scope', () => {
  for (const [lambda, ski] of [
    ['\\x. x', 'I'],
    ['λx. sun', 'K sun'],
    ['\\x. x x', 'S I I'],
    ['\\x. y z', 'K (y z)'],
    ['\\x. \\x. x', 'K I'],
  ]) assert.equal(print(compileLambda(lambda)), ski);

  for (const [lambda, expected] of [
    ['(\\x. \\y. x) y z', 'y'],
    ['(\\x. \\x. x) sun rain', 'rain'],
    ['(\\x. (\\x. x) x) sun', 'sun'],
    ['(\\x y. x) sun rain', 'sun'],
    ['(\\x y. y) sun rain', 'rain'],
    ['(\\unused. sun) ((\\x. x x) (\\x. x x))', 'sun'],
    ['(\\p. p (\\x y. x)) (\\f. f sun rain)', 'sun'],
    ['(\\f x. f (f x)) chirp silence', 'chirp (chirp silence)'],
  ]) {
    const result = run(compileLambda(lambda), { maxSteps: 500 });
    assert.equal(result.status, 'normal', lambda);
    assert.equal(result.frames.at(-1).term, expected, lambda);
  }
  const addition = '(\\m n f x. m f (n f x)) (\\f x. f (f x)) (\\f x. f (f (f x))) chirp silence';
  const sum = run(compileLambda(addition), { maxSteps: 500 });
  assert.equal(sum.status, 'normal');
  assert.equal(sum.frames.at(-1).term, 'chirp (chirp (chirp (chirp (chirp silence))))');
});

test('Construction bounds, nested syntax, long chains, and immutable engine terms', () => {
  assert.throws(() => compileLambda('\\x y. x', { maxNodes: 5 }), /exceeds/);
  assert.throws(() => compileLambda('\\x. x', { maxNodes: 1 }), /input exceeds/);
  assert.throws(() => compileLambda('('.repeat(129) + 'x' + ')'.repeat(129)), /nesting/);
  const expression = Array(600).fill('x').join(' ');
  assert.equal(print(compileLambda(expression, { maxNodes: 2048 })), expression);
  const compiled = compileLambda('\\x. x x');
  assert.throws(() => { compiled.fn = parse('K'); }, TypeError);
  assert.throws(() => application({}, parse('x')));
  assert.throws(() => application(parse('x'), parse('y'), { maxNodes: 2 }), /exceeds/);
  assert.throws(() => run(compiled, { maxNodes: 4 }), /exceeds/);

  // A constructed AST can have a printed form longer than the source parser's
  // character limit. Running the AST must preserve its valid node budget.
  const name = parse('x'.repeat(32));
  let term = name;
  for (let i = 1; i < 300; i++) term = application(term, name);
  assert.ok(print(term).length > 8192);
  assert.equal(run(term).status, 'normal');
});

test('Malformed lambdas and invalid compiler limits fail before reduction', () => {
  for (const expression of [
    '', '\\', '\\.', '\\x', '\\x.', '\\S. S', '\\x y x', 'x \\y. y',
    '(\\x. x', '\\x. x)', 'x # y', 'x'.repeat(33), 'x'.repeat(8193),
  ]) assert.throws(() => compileLambda(expression), expression);
  for (const maxNodes of [0, -1, 4097, 1.5, '10', null]) {
    assert.throws(() => compileLambda('x', { maxNodes }));
  }
});

test('The real CLI compiles lambdas and preserves the plain SKI receipt format', () => {
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const invoke = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
  const plain = invoke(['I feather', '--json']);
  assert.deepEqual(JSON.parse(plain.stdout), run('I feather'));
  const identity = invoke(['--lambda', '--trace']);
  assert.equal(identity.status, 0, identity.stderr);
  assert.match(identity.stdout, /Compiled to I/);
  const lambda = '(\\x. x) feather';
  const json = invoke([lambda, '--lambda', '--json']);
  assert.equal(json.status, 0, json.stderr);
  const term = compileLambda(lambda);
  assert.deepEqual(JSON.parse(json.stdout), {
    ...run(term), compilation: { source: lambda, expression: print(term) },
  });
  const stopped = invoke([lambda, '--lambda', '--steps', '0']);
  assert.equal(stopped.status, 2);
  for (const args of [['\\x.', '--lambda'], ['--lambda', '--lambda'], ['\\x y. x', '--lambda', '--nodes', '5']]) {
    const bad = invoke(args);
    assert.equal(bad.status, 1);
    assert.equal(bad.stdout, '');
    assert.ok(bad.stderr);
  }
});
