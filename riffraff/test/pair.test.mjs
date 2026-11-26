import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deck, run, routePair, toSVG } from '../core.mjs';

// Enumerate actual decks, without the engine's arithmetic position transitions.
function zip(cards, side) {
  const halves = [cards.slice(0, cards.length / 2), cards.slice(cards.length / 2)];
  if (side === 'I') halves.reverse();
  return halves[0].flatMap((card, i) => [card, halves[1][i]]);
}
function orbit(cards) {
  const queue = [{ cards: [...cards], word: '' }], seen = new Set([cards.join(',')]);
  for (let head = 0; head < queue.length; head++) for (const side of ['O', 'I']) {
    const cards = zip(queue[head].cards, side), key = cards.join(',');
    if (!seen.has(key)) { seen.add(key); queue.push({ cards, word: queue[head].word + side }); }
    assert.ok(queue.length <= 100000, 'small-deck oracle stays bounded');
  }
  return queue;
}
function placements(cards, target) { return cards.map((card, i) => ({ card, target: target[i] })); }
function witness(state, result) {
  let cards = [...state.cards];
  assert.deepEqual(result.from, result.cards.map(card => cards.indexOf(card) + 1));
  const positions = [result.from];
  for (const side of result.word) { cards = zip(cards, side); positions.push(result.cards.map(card => cards.indexOf(card) + 1)); }
  assert.deepEqual(result.positions, positions);
  assert.deepEqual(positions.at(-1), result.target);
}

test('All 6142 small-deck pair goals agree with complete physical deck orbits, including shortest ties and impossibility', () => {
  let checked = 0, impossible = 0;
  for (const size of [2, 4, 6, 8, 10]) {
    const state = run('OIO', size).frames.at(-1), decks = orbit(state.cards);
    for (let a = 1; a <= size; a++) for (let b = a + 1; b <= size; b++) {
      const expected = new Map();
      for (const entry of decks) {
        const key = [entry.cards.indexOf(a) + 1, entry.cards.indexOf(b) + 1].join(',');
        if (!expected.has(key)) expected.set(key, entry.word);
      }
      for (let p = 1; p <= size; p++) for (let q = 1; q <= size; q++) {
        if (p === q) continue;
        const result = routePair(state, placements([a, b], [p, q])), word = expected.get(`${p},${q}`);
        assert.equal(result.reachable, word !== undefined, `${size}/${a},${b}/${p},${q}`);
        assert.equal(result.word, word ?? null);
        assert.ok(result.discovered <= size * (size - 1));
        if (result.reachable) witness(state, result);
        else { assert.deepEqual(result.positions, []); assert.equal(result.discovered, expected.size); impossible++; }
        checked++;
      }
    }
  }
  assert.equal(checked, 6142); assert.ok(impossible > 0);
});

test('All supported sizes preserve mirror partners; maximum decks produce physical two-card witnesses', () => {
  for (let size = 2; size <= 64; size += 2) {
    const state = run('IIOOI', size).frames.at(-1);
    for (let target = 1; target <= size; target++) {
      const result = routePair(state, placements([1, size], [target, size + 1 - target]));
      assert.equal(result.reachable, true); witness(state, result);
      assert.ok(result.discovered <= size);
    }
    if (size > 2) {
      const failed = routePair(state, placements([1, size], [1, 2]));
      assert.equal(failed.reachable, false); assert.equal(failed.discovered, size);
    }
  }
  for (const size of [62, 64]) {
    const state = run('IOIOI', size).frames.at(-1);
    // Every short physical word supplies a reachable goal; enumeration also
    // establishes the first shortest O-before-I word for each observed pair.
    let frontier = [{ cards: state.cards, word: '' }];
    const expected = new Map();
    for (let depth = 0; depth <= 9; depth++) {
      for (const entry of frontier) {
        const target = [entry.cards.indexOf(1) + 1, entry.cards.indexOf(2) + 1];
        if (!expected.has(target.join(','))) expected.set(target.join(','), entry.word);
      }
      frontier = frontier.flatMap(entry => ['O', 'I'].map(side => ({ cards: zip(entry.cards, side), word: entry.word + side })));
    }
    for (const [key, word] of expected) {
      const result = routePair(state, placements([1, 2], key.split(',').map(Number)));
      assert.equal(result.word, word); witness(state, result);
      const swapped = routePair(state, placements([2, 1], [...result.target].reverse()));
      assert.equal(swapped.word, word);
    }
  }
});

test('Pair receipts are immutable, start with an empty solution when done, and reject malformed placements', () => {
  const state = deck(8), input = placements([1, 8], [3, 6]);
  const result = routePair(state, input);
  assert.equal(result.word, 'IO'); assert.deepEqual(result.positions, [[1, 8], [2, 7], [3, 6]]);
  input[0].card = 2; input[1].target = 5;
  assert.deepEqual(result.cards, [1, 8]); assert.deepEqual(result.target, [3, 6]);
  for (const array of [result.cards, result.from, result.target, result.positions, ...result.positions]) assert.throws(() => array.pop());
  assert.throws(() => { result.word = 'I'; });
  const done = routePair(state, placements([7, 3], [7, 3]));
  assert.equal(done.word, ''); assert.equal(done.discovered, 1); assert.deepEqual(done.positions, [[7, 3]]);
  for (const bad of [null, {}, [], [null, null], [{}, {}], [1, 2], [...placements([1, 2], [3, 4]), {card:3,target:5}],
    placements([1, 1], [2, 3]), placements([1, 2], [3, 3])]) assert.throws(() => routePair(state, bad));
  for (const value of [0, 9, -1, 1.5, '1', NaN, Infinity, null, undefined]) {
    assert.throws(() => routePair(state, placements([value, 2], [3, 4])));
    assert.throws(() => routePair(state, placements([1, 2], [3, value])));
  }
  assert.throws(() => routePair({...state}, placements([1, 2], [3, 4])));
  assert.deepEqual(state.cards, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('Two-card SVGs distinguish both paths and mark the two original IDs in every frame', () => {
  const svg = toSVG(run('IO'), { card: 1, partner: 8 });
  assert.match(svg, /following 1 and 8/);
  assert.match(svg, /data-follow="1" points="90,104 160,128 230,152"/);
  assert.match(svg, /data-follow="8" points="90,272 160,248 230,224"/);
  assert.equal((svg.match(/fill="#efac87"/g) ?? []).length, 3);
  assert.equal((svg.match(/fill="#7bc9c9"/g) ?? []).length, 3);
  assert.match(svg, /stroke-dasharray="6 3"/);
  assert.equal((svg.match(/data-card=/g) ?? []).length, 24);
  assert.throws(() => toSVG(run(), { card: 1, partner: 1 }));
  assert.throws(() => toSVG(run(), { partner: 9 }));
  assert.match(toSVG(run('',64), {card:64,partner:63}), /following 64 and 63/);
});

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const invoke = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 });
test('CLI double reveals append after the given word, export both paths, and preserve files on failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'riffraff-pair-'));
  try {
    const file = join(directory, 'pair.svg');
    const result = invoke('OIO', '--pair', '2:3,7:6', '--json', '--svg', file);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(result.stdout), planned = routePair(run('OIO').frames.at(-1), placements([2, 7], [3, 6]));
    assert.deepEqual(receipt.pairRoute, planned); assert.equal(receipt.initialWord, 'OIO');
    assert.equal(receipt.word, 'OIO' + planned.word); assert.equal(receipt.card, 2); assert.equal(receipt.route, null);
    assert.equal(receipt.frames.at(-1).cards[2], 2); assert.equal(receipt.frames.at(-1).cards[5], 7);
    assert.equal(await readFile(file, 'utf8'), toSVG(run(receipt.word), {card:2,partner:7}));
    const text = invoke('', '--pair', '1:3,8:6', '--trace');
    assert.equal(text.status, 0, text.stderr); assert.match(text.stdout, /Append IO: place card 1 at position 3 and card 8 at position 6 together/);
    const absent = join(directory, 'absent.svg');
    const failed = invoke('', '--pair', '1:1,8:2', '--json', '--svg', absent);
    assert.equal(failed.status, 2, failed.stderr); assert.equal(failed.stderr, '');
    const failure = JSON.parse(failed.stdout);
    assert.equal(failure.word, ''); assert.deepEqual(failure.frames, run('').frames);
    assert.deepEqual(failure.pairRoute, routePair(deck(), placements([1, 8], [1, 2])));
    await assert.rejects(readFile(absent));
    assert.match(invoke('', '--pair', '1:1,8:2').stdout, /Unreachable:.*Searched 8 ordered position pairs/);
    await writeFile(file, 'keep');
    assert.equal(invoke('', '--pair', '1:3,8:6', '--svg', file).status, 1); assert.equal(await readFile(file, 'utf8'), 'keep');
    for (const args of [['--pair','1:1,8:2'], ['--pair','1:1,1:2']]) {
      invoke('', ...args, '--svg', file); assert.equal(await readFile(file, 'utf8'), 'keep');
    }
    const overlong = invoke('O'.repeat(128), '--pair', '1:3,8:6', '--svg', absent);
    assert.equal(overlong.status, 1); await assert.rejects(readFile(absent));
    const empty = invoke('O'.repeat(128), '--pair', '1:1,8:8', '--json');
    assert.equal(empty.status, 0, empty.stderr); assert.equal(JSON.parse(empty.stdout).pairRoute.word, '');
  } finally { await rm(directory, {recursive:true,force:true}); }
});

test('CLI rejects malformed, duplicate, and conflicting pair options before output', () => {
  for (const args of [['--pair'], ['--pair','1:3'], ['--pair','1:3,2:4,3:5'], ['--pair','01:3,2:4'],
    ['--pair','1:3, 2:4'], ['--pair','1:0,2:4'], ['--pair','1:9,2:4'], ['--pair','1:3,1:4'],
    ['--pair','1:3,2:3'], ['--pair','1:3,2:4','--to','3'], ['--pair','1:3,2:4','--card','1'],
    ['--pair','1:3,2:4','--pair','1:3,2:4']]) {
    const result = invoke(...args); assert.equal(result.status, 1, args.join(' '));
    assert.equal(result.stdout, ''); assert.ok(result.stderr.trim());
  }
});
