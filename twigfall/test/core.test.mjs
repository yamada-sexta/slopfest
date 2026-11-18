import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, cut, analyze, run, toSVG } from '../core.mjs';

// An independent game tree. A branch falls iff its ancestors include the cut.
// Compute mex of every reachable successor, without the tree XOR formula.
function oracle(branches) {
  const removal = branches.map(branch => branches.reduce((mask, candidate) => {
    let ancestor = candidate.id;
    while (ancestor && ancestor !== branch.id) ancestor = branches[ancestor - 1].parent;
    return ancestor === branch.id ? mask | (1 << (candidate.id - 1)) : mask;
  }, 0));
  const memo = new Map([[0, 0]]);
  function grundy(mask) {
    if (memo.has(mask)) return memo.get(mask);
    const options = new Set();
    removal.forEach((fallen, i) => { if (mask & (1 << i)) options.add(grundy(mask & ~fallen)); });
    let mex = 0;
    while (options.has(mex)) mex++;
    memo.set(mask, mex);
    return mex;
  }
  return { removal, grundy };
}

test('All 2056 ordered groves through eight branches match an independent mex game tree', () => {
  const groves = [['']];
  let checked = 0;
  for (let n = 0; n <= 8; n++) {
    if (n) {
      groves[n] = [];
      for (let inside = 0; inside < n; inside++) for (const a of groves[inside]) for (const b of groves[n - 1 - inside]) groves[n].push(`(${a})${b}`);
    }
    for (const source of groves[n]) {
      const initial = parse(source), reference = oracle(initial.branches), seen = new Set();
      function visit(state) {
        const mask = state.active.reduce((sum, id) => sum | (1 << (id - 1)), 0);
        if (seen.has(mask)) return;
        seen.add(mask);
        const report = analyze(state);
        assert.equal(report.nimber, reference.grundy(mask), `${source} / ${mask}`);
        const winning = state.active.filter(id => reference.grundy(mask & ~reference.removal[id - 1]) === 0);
        assert.deepEqual(report.winningCuts, winning);
        assert.equal(report.outcome, mask === 0 ? 'finished' : report.nimber === 0 ? 'losing' : 'winning');
        assert.equal(report.recommendation, winning[0] ?? state.active[0] ?? null);
        for (const id of state.active) {
          const next = cut(state, id);
          assert.deepEqual(next.active, state.active.filter(candidate => !(reference.removal[id - 1] & (1 << (candidate - 1)))));
          visit(next);
        }
      }
      visit(initial);
      checked++;
    }
  }
  assert.equal(groves[8].length, 1430);
  assert.equal(checked, 2056);
});

test('Hand-played forks, stems, independent branches, and stable IDs', () => {
  assert.deepEqual(parse(' ( () () ) ').branches, [{id:1,parent:0},{id:2,parent:1},{id:3,parent:1}]);
  assert.equal(parse(' ( () () ) ').source, '(()())');
  assert.equal(analyze(parse('(()())')).nimber, 1);
  assert.deepEqual(analyze(parse('(()())')).winningCuts, [1]);
  assert.equal(analyze(parse('()()')).nimber, 0);
  assert.equal(analyze(parse('((()))')).nimber, 3);
  const journey = run('(()())(())', [2, 4]);
  assert.deepEqual(journey.frames.map(frame => frame.active), [[1,2,3,4,5],[1,3,4,5],[1,3]]);
  assert.deepEqual(journey.cuts, [2,4]);
  assert.equal(journey.frames[0].source, journey.frames.at(-1).source);
  assert.throws(() => cut(journey.frames.at(-1), 5), /not standing/);
});

test('The maximum chain and maximum forest stay bounded and have known nimbers', () => {
  const chain = parse('('.repeat(24) + ')'.repeat(24));
  assert.equal(analyze(chain).nimber, 24);
  assert.deepEqual(analyze(chain).winningCuts, [1]);
  assert.equal(analyze(parse('()'.repeat(24))).nimber, 0);
  assert.deepEqual(cut(chain, 13).active, Array.from({length:12}, (_, i) => i + 1));
  assert.equal(analyze(cut(chain, 13)).nimber, 12);
  assert.equal(analyze(parse('')).outcome, 'finished');
  assert.equal(analyze(parse('')).recommendation, null);
});

test('The suggested strategy wins the default nine-branch game against every reply', () => {
  const initial = parse('((()())(())) (()())'), seen = new Set();
  function play(state, player) {
    if (!state.active.length) { assert.equal(player, 1, 'the opponent must be the player without a move'); return; }
    const key = `${state.active.join(',')}/${player}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (player === 0) {
      assert.equal(analyze(state).outcome, 'winning');
      play(cut(state, analyze(state).recommendation), 1);
    } else for (const id of state.active) play(cut(state, id), 0);
  }
  play(initial, 0);
});

test('Frozen states, journeys, reports, and rejection of malformed or forged data', () => {
  const initial = parse('(()())'), journey = run('(()())', [2]);
  assert.throws(() => { initial.active.pop(); });
  assert.throws(() => { initial.branches[0].parent = 99; });
  assert.throws(() => { journey.frames.pop(); });
  assert.throws(() => { analyze(initial).winningCuts.push(9); });
  assert.deepEqual(initial.active, [1,2,3]);
  for (const source of [null, 5, ')(', '(', '())', '(x)', '()'.repeat(25), ' '.repeat(2049)]) assert.throws(() => parse(source));
  for (const id of [0, -1, 4, '1', 1.5, NaN]) assert.throws(() => cut(initial, id));
  for (const cuts of [null, '1', Array(25).fill(1), [1,2], [2,2], Array(1)]) assert.throws(() => run('(()())', cuts));
  assert.throws(() => analyze({...initial}), /engine-created/);
  assert.throws(() => cut({}, 1), /engine-created/);
  assert.throws(() => toSVG({...journey}), /engine-created/);
});

test('SVG retains original branches, marks fallen wood and winning cuts, and handles extremes', () => {
  const svg = toSVG(run('(()())', [2]));
  assert.equal((svg.match(/data-branch=/g) ?? []).length, 3);
  assert.equal((svg.match(/stroke-dasharray=/g) ?? []).length, 1);
  assert.match(svg, /2 branches standing/);
  assert.match(svg, /stroke="#f5b08b"/);
  assert.match(toSVG(run('')), /Grove cleared/);
  assert.match(toSVG(run('()'.repeat(24))), /width="1878"/);
  assert.match(toSVG(run('('.repeat(24) + ')'.repeat(24))), /height="1888"/);
});

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const execute = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
test('Real CLI receipts, traces, empty positions, and exclusive SVG exports', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'twigfall-'));
  try {
    const file = join(dir, 'grove.svg');
    const result = execute('(()())(())', '--cuts', '2,4', '--trace', '--json', '--svg', file);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(result.stdout);
    assert.deepEqual(receipt.frames.at(-1).active, [1,3]);
    assert.deepEqual(receipt.strategy, analyze(run('(()())(())', [2,4]).frames.at(-1)));
    assert.equal(await readFile(file, 'utf8'), toSVG(run('(()())(())', [2,4])));
    const text = execute('(()())(())', '--cuts', '2,4', '--trace').stdout;
    assert.match(text, /Cut 4: fallen \{4, 5\}/);
    assert.match(text, /Standing grove:\n  1\n    3/);
    assert.match(execute('()()').stdout, /No winning cut/);
    assert.match(execute('').stdout, /player to move loses/);
    assert.equal(execute('--svg', file).status, 1);
    await writeFile(file, 'keep');
    assert.equal(execute('--svg', file).status, 1);
    assert.equal(await readFile(file, 'utf8'), 'keep');
    const absent = join(dir, 'absent.svg');
    assert.equal(execute('(', '--svg', absent).status, 1);
    await assert.rejects(readFile(absent));
    assert.equal(execute('--json').status, 0);
    assert.equal(execute('--help').status, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI rejects bad and duplicate options, malformed cuts, and fallen branch IDs', () => {
  for (const args of [['--help','--json'], ['--bogus'], ['--svg'], ['--cuts',''], ['--cuts','0'],
    ['--cuts','01'], ['--cuts','1,'], ['--cuts','1, 2'], ['--cuts','1,2'], ['--cuts','2,2'],
    ['--trace','--trace'], ['--json','--json'], ['()','()'], ['--cuts','3','--cuts','2']]) {
    assert.equal(execute(...args).status, 1, args.join(' '));
  }
});
