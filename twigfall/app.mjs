import { analyze, toSVG } from './core.mjs';
import { start, move, undo } from './play.mjs';

const byId = id => document.getElementById(id);
const specimens = { nine: '((()())(())) (()())', fork: '(()())', stalks: '((()))(())()', bushes: '()()()()' };
const names = { nine: 'The little grove', fork: 'One fork', stalks: 'Three stalks', bushes: 'Four twigs' };
const actors = { you: 'You', gardener: 'The gardener', player1: 'Player 1', player2: 'Player 2' };
let game, groveName;

function render() {
  const journey = game.journey, state = journey.frames.at(-1);
  const hints = byId('hints').checked, report = hints ? analyze(state) : null;
  byId('turn-title').textContent = game.next === 'you' ? 'Your turn' : game.next ? `${actors[game.next]}’s turn` : 'Grove cleared';
  byId('status').textContent = game.winner ? `${actors[game.winner]} ${game.winner === 'you' ? 'win' : 'wins'}! The last branch is gone.`
    : game.next ? `${state.active.length} ${state.active.length === 1 ? 'branch stands' : 'branches stand'}. Choose one to cut.`
      : 'An empty grove. Plant another, or choose a preset.';
  byId('loaded').textContent = `${groveName} · ${journey.cuts.length} ${journey.cuts.length === 1 ? 'cut' : 'cuts'}`;
  byId('branches').replaceChildren(...state.branches.map(({ id }) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = id; button.dataset.id = id;
    button.disabled = !state.active.includes(id);
    button.setAttribute('aria-label', button.disabled ? `Branch ${id} has fallen` : `Cut branch ${id}`);
    button.dataset.winning = String(hints && report.winningCuts.includes(id));
    return button;
  }));
  byId('undo').disabled = game.history.length === 1;
  byId('undo-help').textContent = game.mode === 'gardener' ? 'Undo takes back your cut and any gardener reply.' : 'Undo takes back the previous player’s cut.';
  byId('hint-result').textContent = !hints ? '' : report.outcome === 'finished' ? 'No cut remains.'
    : report.winningCuts.length ? `Winning cuts this turn: ${report.winningCuts.join(', ')}. Peach rings mark them.`
      : 'No winning cut against perfect play. Every standing branch is still a legal move.';
  // The SVG engine interpolates only validated numbers and fixed labels.
  byId('drawing').innerHTML = toSVG(journey, { hints });
  byId('history').replaceChildren(...journey.cuts.map((id, i) => {
    const before = journey.frames[i], after = journey.frames[i + 1];
    const fallen = before.active.filter(branch => !after.active.includes(branch));
    const actor = game.mode === 'gardener' ? ['You', 'Gardener'][i % 2] : ['Player 1', 'Player 2'][i % 2];
    const item = document.createElement('li');
    item.textContent = `${actor} cut ${id}. Fell: ${fallen.join(', ')}.`;
    return item;
  }));
  byId('no-cuts').hidden = journey.cuts.length !== 0;
  byId('play-error').textContent = '';
}

function load(source, name) {
  const next = start(source, { mode: byId('mode').value });
  game = next; groveName = name;
  byId('source').value = source;
  byId('source-error').textContent = '';
  render();
}
function focusBranch() {
  (byId('branches').querySelector('button:not(:disabled)') ?? byId('restart')).focus({ preventScroll: true });
}
byId('branches').addEventListener('click', event => {
  const button = event.target.closest('button[data-id]');
  if (!button || button.disabled) return;
  try { game = move(game, Number(button.dataset.id)); render(); focusBranch(); }
  catch (error) { byId('play-error').textContent = error.message; }
});
byId('undo').addEventListener('click', () => { if (game.history.length > 1) { game = undo(game); render(); focusBranch(); } });
byId('restart').addEventListener('click', () => load(game.journey.source, groveName));
byId('hints').addEventListener('change', render);
byId('grove').addEventListener('change', event => {
  if (Object.hasOwn(specimens, event.target.value)) load(specimens[event.target.value], names[event.target.value]);
});
byId('mode').addEventListener('change', () => load(game.journey.source, groveName));
byId('grove-form').addEventListener('submit', event => {
  event.preventDefault();
  try { load(byId('source').value, 'Your grove'); byId('grove').value = 'custom'; }
  catch (error) { byId('source-error').textContent = error.message; }
});
byId('save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([toSVG(game.journey, { hints: byId('hints').checked })], { type: 'image/svg+xml' }));
  const link = document.createElement('a'); link.href = url; link.download = 'twigfall-grove.svg'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
load(specimens.nine, names.nine);
