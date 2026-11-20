import { run, analyze } from './core.mjs';

const games = new WeakSet();
function check(game) {
  if (!games.has(game)) throw new Error('Start a Twigfall game first.');
}
function seal(mode, history) {
  const journey = history.at(-1), done = journey.frames.at(-1).active.length === 0;
  const players = mode === 'gardener' ? ['you', 'gardener'] : ['player1', 'player2'];
  const winner = done && journey.cuts.length ? players[(journey.cuts.length - 1) % 2] : null;
  const game = Object.freeze({
    mode, journey, history: Object.freeze(history),
    next: done ? null : players[journey.cuts.length % 2], winner,
  });
  games.add(game);
  return game;
}

export function start(source, { mode = 'gardener' } = {}) {
  if (mode !== 'gardener' && mode !== 'friend') throw new Error('Choose gardener or friend mode.');
  return seal(mode, [run(source)]);
}

export function move(game, id) {
  check(game);
  if (game.next === null) throw new Error('The grove is cleared. Undo or start again.');
  let journey = run(game.journey.source, [...game.journey.cuts, id]);
  const state = journey.frames.at(-1);
  if (game.mode === 'gardener' && state.active.length) {
    const reply = analyze(state).recommendation;
    journey = run(journey.source, [...journey.cuts, reply]);
  }
  return seal(game.mode, [...game.history, journey]);
}

export function undo(game) {
  check(game);
  if (game.history.length === 1) throw new Error('There is no turn to undo.');
  return seal(game.mode, game.history.slice(0, -1));
}
