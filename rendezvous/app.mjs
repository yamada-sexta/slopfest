import { clock, machine, follow, synchronize, toSVG } from './core.mjs';

const byId = id => document.getElementById(id);
const carousel = { a: [1, 2, 3, 0], b: [1, 0, 3, 2] };
let transitions, word = '', best;

function render() {
  const result = follow(transitions, word), states = result.frames.at(-1).states;
  const size = Object.values(transitions)[0].length;
  best = synchronize(transitions, { states });
  byId('status').textContent = states.length === 1
    ? `Together at state ${states[0]}. Every starting path meets here.`
    : `${states.length} of ${size} states are still possible. Make them meet.`;
  byId('states').replaceChildren(...Array.from({ length: size }, (_, state) => {
    const item = document.createElement('li');
    item.className = states.includes(state) ? 'possible' : '';
    item.append(String(state));
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = states.includes(state) ? ' — possible' : ' — ruled out';
    item.append(label);
    return item;
  }));
  byId('word-count').textContent = `${word.length} ${word.length === 1 ? 'button' : 'buttons'} pressed · ${size} starting paths`;
  byId('word').textContent = word || 'No buttons yet.';
  byId('best').textContent = states.length === 1 ? 'You found a meeting place. Undo to try another route.'
    : best.word === null ? 'No route can merge all these states. Try a different machine, or explore its buttons.'
      : `Shortest from here: ${best.word.length} ${best.word.length === 1 ? 'button' : 'buttons'}.`;
  byId('undo').disabled = word.length === 0;
  byId('restart').disabled = word.length === 0;
  byId('hint').disabled = best.word === null || best.word.length === 0 || word.length === 1023;
  byId('finish').disabled = best.word === null || best.word.length === 0 || word.length + best.word.length > 1023;
  byId('buttons').querySelectorAll('button').forEach(button => { button.disabled = word.length === 1023; });
  byId('play-error').textContent = word.length === 1023 ? 'This trace has reached its 1023-button limit. Undo or start over.' : '';
  // SVG is generated from validated numeric transitions and lowercase buttons.
  byId('drawing').innerHTML = toSVG(transitions, word);
}

function append(buttons) {
  if (word.length + buttons.length > 1023) {
    byId('play-error').textContent = 'This trace has reached its 1023-button limit. Undo or start over.';
    return;
  }
  word += buttons;
  byId('play-error').textContent = '';
  render();
}

function load(source, name) {
  const next = machine(source); // Validate before changing the loaded machine.
  transitions = next;
  word = '';
  const alphabet = Object.keys(transitions), size = transitions[alphabet[0]].length;
  byId('loaded').textContent = `${name} · ${size} ${size === 1 ? 'state' : 'states'}`;
  byId('machine-json').value = JSON.stringify(transitions, null, 2);
  byId('buttons').replaceChildren(...alphabet.map(letter => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = letter;
    button.dataset.letter = letter;
    button.setAttribute('aria-label', `Press ${letter}`);
    return button;
  }));
  // All interpolated values have been validated as single lowercase letters or integers.
  const headers = alphabet.map(letter => `<th scope="col">${letter}</th>`).join('');
  const rows = Array.from({ length: size }, (_, state) => `<tr><th scope="row">${state}</th>${alphabet.map(letter => `<td>${transitions[letter][state]}</td>`).join('')}</tr>`).join('');
  byId('transitions').innerHTML = `<table><caption>From state → destination</caption><thead><tr><th scope="col">State</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  byId('machine-error').textContent = '';
  byId('play-error').textContent = '';
  render();
}

byId('buttons').addEventListener('click', event => {
  const button = event.target.closest('button[data-letter]');
  if (button && !button.disabled) append(button.dataset.letter);
});
byId('undo').addEventListener('click', () => { word = word.slice(0, -1); byId('play-error').textContent = ''; render(); });
byId('restart').addEventListener('click', () => { word = ''; byId('play-error').textContent = ''; render(); });
byId('hint').addEventListener('click', () => { if (best.word) append(best.word[0]); });
byId('finish').addEventListener('click', () => { if (best.word) append(best.word); });
byId('preset').addEventListener('change', event => {
  const value = event.target.value;
  if (value === 'carousel') load(carousel, 'Carousel');
  else if (['3', '4', '7'].includes(value)) load(clock(Number(value)), `${value}-state clock`);
});
byId('custom-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    load(JSON.parse(byId('machine-json').value), 'Your machine');
    byId('preset').value = 'custom';
  } catch (error) { byId('machine-error').textContent = error.message; }
});
byId('save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([toSVG(transitions, word)], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rendezvous-trace.svg';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
load(clock(), '4-state clock');
