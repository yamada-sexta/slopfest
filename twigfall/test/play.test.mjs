import test from 'node:test';
import assert from 'node:assert/strict';
import { run, analyze, toSVG } from '../core.mjs';
import { start, move, undo } from '../play.mjs';

const source = '((()())(())) (()())';
const state = game => game.journey.frames.at(-1);

test('New games have immutable, independent histories and correct starting players', () => {
  const game = start(source);
  assert.equal(game.mode, 'gardener');
  assert.equal(game.next, 'you');
  assert.equal(game.winner, null);
  assert.equal(game.history.length, 1);
  assert.equal(game.journey, game.history[0]);
  assert.equal(start(source, { mode: 'friend' }).next, 'player1');
  assert.equal(start('').next, null);
  assert.equal(start('').winner, null);
  assert.throws(() => { game.history.pop(); });
  assert.throws(() => { game.next = 'gardener'; });
  assert.throws(() => start(source, { mode: 'random' }));
  assert.throws(() => start('('));
  assert.equal(start(source).history.length, 1);
});

test('The gardener uses the exact legal reply and the human can win a winning grove', () => {
  let game = start(source);
  while (game.next !== null) {
    const original = game;
    const human = analyze(state(game)).recommendation;
    const afterHuman = run(game.journey.source, [...game.journey.cuts, human]);
    const reply = analyze(afterHuman.frames.at(-1)).recommendation;
    game = move(game, human);
    assert.equal(game.history.length, original.history.length + 1);
    assert.deepEqual(game.journey.cuts.slice(original.journey.cuts.length), reply === null ? [human] : [human, reply]);
    assert.equal(original.history.at(-1), original.journey);
    if (game.next !== null) assert.equal(game.next, 'you');
  }
  assert.equal(game.winner, 'you');
  assert.equal(game.journey.cuts.length % 2, 1);
});

test('The gardener wins a losing starting grove against every human continuation', () => {
  const seen = new Set();
  function play(game) {
    if (game.next === null) { assert.equal(game.winner, 'gardener'); return; }
    const key = state(game).active.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    assert.equal(analyze(state(game)).nimber, 0);
    for (const id of state(game).active) play(move(game, id));
  }
  play(start('((()))(())()'));
  assert.ok(seen.size > 1);
});

test('Undo reverses a full gardener turn, including a terminal reply or a lone winning cut', () => {
  const before = start('()()');
  const ended = move(before, 1);
  assert.deepEqual(ended.journey.cuts, [1, 2]);
  assert.equal(ended.winner, 'gardener');
  const restored = undo(ended);
  assert.equal(restored.journey, before.journey);
  assert.equal(restored.next, 'you');
  assert.equal(restored.winner, null);
  assert.deepEqual(ended.journey.cuts, [1, 2]);
  const fork = start('(()())'), won = move(fork, 1);
  assert.deepEqual(won.journey.cuts, [1]);
  assert.equal(won.winner, 'you');
  assert.equal(undo(won).journey, fork.journey);
  assert.throws(() => undo(before), /no turn/);
  assert.throws(() => move(ended, 1), /cleared/);
});

test('Two people alternate single cuts and undo restores the previous player without mutation', () => {
  const initial = start('(()())', { mode: 'friend' });
  const first = move(initial, 2);
  assert.deepEqual(first.journey.cuts, [2]);
  assert.equal(first.next, 'player2');
  const ended = move(first, 1);
  assert.equal(ended.winner, 'player2');
  assert.equal(ended.next, null);
  const restored = undo(ended);
  assert.equal(restored.journey, first.journey);
  assert.equal(restored.next, 'player2');
  assert.equal(restored.winner, null);
  assert.throws(() => move(first, 2), /not standing/);
  assert.equal(first.history.length, 2);
  assert.throws(() => move({ ...first }, 1), /Start a Twigfall/);
  assert.throws(() => undo(null), /Start a Twigfall/);
  assert.equal(move(start('()'.repeat(24), { mode: 'friend' }), 24).journey.cuts[0], 24);
});

test('Hints can be hidden in SVG without exposing nimbers, outcomes, or winning rings', () => {
  const journey = run(source), plain = toSVG(journey, { hints: false });
  assert.doesNotMatch(plain, /nimber|winning|losing|peach|#f5b08b/i);
  assert.match(plain, /font-size="14"/);
  assert.equal((plain.match(/data-branch=/g) ?? []).length, 9);
  assert.match(toSVG(journey), /nimber 5/);
  assert.match(toSVG(journey), /#f5b08b/);
  assert.equal(toSVG(journey), toSVG(journey, { hints: true }));
  for (const hints of [null, 'false', 0]) assert.throws(() => toSVG(journey, { hints }), /Hints/);
});
