import { run, locate, toSVG } from './core.mjs';

const byId = id => document.getElementById(id);
let journey, selected = 1;
const current = () => journey.frames.at(-1);

function render() {
  const state = current(), packets = state.cells.length, layers = state.cells[0].length;
  byId('summary').textContent = `${packets} ${packets === 1 ? 'packet' : 'packets'}, ${layers} ${layers === 1 ? 'layer' : 'layers'} each. ${packets === 1 ? 'Fully folded.' : `${Math.log2(packets)} more ${packets === 2 ? 'fold' : 'folds'} possible.`}`;
  byId('word').textContent = journey.folds ? `Fold word: ${journey.folds}` : 'No folds yet.';
  byId('left').disabled = packets === 1;
  byId('right').disabled = packets === 1;
  byId('undo').disabled = journey.folds.length === 0;
  byId('flat').disabled = journey.folds.length === 0;
  byId('panel').max = journey.panels;
  byId('panel').value = selected;
  const found = locate(state, selected);
  byId('location').textContent = `Panel ${selected}: packet ${found.packet}, layer ${found.fromTop} from the top (${found.fromBottom} from the bottom), ${found.face} up.`;
  byId('packets').replaceChildren(...state.cells.map((stack, i) => {
    const packet = document.createElement('div'); packet.className = 'packet'; packet.dataset.packet = i + 1;
    const heading = document.createElement('h3'); heading.textContent = `Packet ${i + 1}`; packet.append(heading);
    const marker = label => { const item = document.createElement('p'); item.className = 'stack-label'; item.textContent = label; return item; };
    packet.append(marker('Top'));
    const list = document.createElement('div'); list.className = 'layers';
    [...stack].reverse().forEach((piece, depth) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'layer';
      button.dataset.panel = piece.panel; button.dataset.face = piece.face; button.dataset.fromTop = depth + 1;
      button.textContent = `${piece.panel} ${piece.face === 'front' ? 'F' : 'B'}`;
      button.setAttribute('aria-pressed', String(piece.panel === selected));
      button.setAttribute('aria-label', `Panel ${piece.panel}, ${piece.face} up, packet ${i + 1}, layer ${depth + 1} from the top`);
      list.append(button);
    });
    packet.append(list, marker('Bottom'));
    return packet;
  }));
}

function load(folds, panels, panel = selected) {
  const next = run(folds, panels), nextPanel = Math.min(panel, panels);
  locate(next.frames.at(-1), nextPanel); // Validate before replacing the loaded paper.
  journey = next; selected = nextPanel;
  byId('panels').value = String(panels);
  byId('recipe').value = folds;
  byId('recipe-error').textContent = '';
  byId('find-error').textContent = '';
  render();
}
function choose(panel) {
  locate(current(), panel);
  selected = panel;
  byId('find-error').textContent = '';
  render();
  const button = byId('packets').querySelector('[aria-pressed="true"]');
  button.focus({ preventScroll: true });
  button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}
for (const [id, side] of [['left', 'L'], ['right', 'R']]) byId(id).addEventListener('click', () => {
  if (current().cells.length > 1) load(journey.folds + side, journey.panels);
});
byId('undo').addEventListener('click', () => { if (journey.folds) load(journey.folds.slice(0, -1), journey.panels); });
byId('flat').addEventListener('click', () => load('', journey.panels));
byId('panels').addEventListener('change', event => load('', Number(event.target.value)));
byId('recipe-form').addEventListener('submit', event => {
  event.preventDefault();
  try { load(byId('recipe').value, journey.panels); }
  catch (error) { byId('recipe-error').textContent = error.message; }
});
byId('find-form').addEventListener('submit', event => {
  event.preventDefault();
  try { choose(byId('panel').valueAsNumber); }
  catch (error) { byId('find-error').textContent = error.message; }
});
byId('packets').addEventListener('click', event => {
  const button = event.target.closest('button[data-panel]');
  if (button) choose(Number(button.dataset.panel));
});
byId('save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([toSVG(journey, { highlight: selected })], { type: 'image/svg+xml' }));
  const link = document.createElement('a'); link.href = url; link.download = 'turnleaf-fold.svg'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
load('', 8);
