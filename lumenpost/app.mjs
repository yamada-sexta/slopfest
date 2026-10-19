import { parseCard, trace, solve, turnMirror } from './core.mjs';
import { cards } from './cards.mjs';
const $ = id => document.getElementById(id);
const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
const svg = (tag, attrs) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; };
const names = { 1: 'Amber', 2: 'Blue', 3: 'Both-color' }, arrows = ['↑', '→', '↓', '←'];
const completed = new Set();
let cardIndex = 0, card, turns, history = [], hinted = -1, mirrorButtons = [], stampViews = [], beams;
cards.forEach((card, i) => { const option = node('option', '', `${String(i + 1).padStart(2, '0')} / ${card.title}`); option.value = i; $('card').append(option); });
function buildBoard() {
  const board = $('board'); board.replaceChildren(); board.style.setProperty('--columns', card.width); board.style.setProperty('--ratio', `${card.width}/${card.height}`);
  mirrorButtons = []; stampViews = [];
  for (let index = 0; index < card.cells.length; index++) {
    const mirror = card.mirrors.findIndex(m => m.index === index), stamp = card.stamps.find(s => s.index === index), lamp = card.lamps.find(l => l.y * card.width + l.x === index);
    const cell = node(mirror >= 0 ? 'button' : 'div', 'cell');
    if (mirror >= 0) {
      cell.classList.add('mirror'); cell.setAttribute('aria-label', `Turn mirror row ${card.mirrors[mirror].y + 1} column ${card.mirrors[mirror].x + 1}`);
      cell.append(node('span', 'mirror-line')); cell.addEventListener('click', () => { history.push(turns); turns = turnMirror(card, turns, mirror); hinted = -1; render(); }); mirrorButtons[mirror] = cell;
    } else if (stamp) {
      const label = node('span', `stamp ${stamp.mask === 2 ? 'blue' : stamp.mask === 3 ? 'both' : ''}`, stamp.mask === 3 ? 'AB' : stamp.mask === 1 ? 'A' : 'B');
      cell.append(label); stampViews.push({ cell, label, stamp });
    } else if (lamp) {
      cell.setAttribute('role', 'img'); cell.setAttribute('aria-label', `${names[lamp.mask]} lamp pointing ${['north', 'east', 'south', 'west'][lamp.dir]}`);
      const label = node('span', `lamp ${lamp.mask === 2 ? 'blue' : ''}`, arrows[lamp.dir]); label.setAttribute('aria-hidden', 'true'); cell.append(label);
    } else if (card.cells[index] === '#') { cell.classList.add('wall'); cell.setAttribute('aria-hidden', 'true'); }
    else cell.setAttribute('aria-hidden', 'true');
    board.append(cell);
  }
  beams = svg('svg', { viewBox: `0 0 ${card.width * 100} ${card.height * 100}`, class: 'beams', 'aria-hidden': 'true' }); board.append(beams);
}
function render(message) {
  const result = trace(card, turns); beams.replaceChildren();
  for (const ray of result.rays) {
    const points = ray.points.map(point => `${point.x * 100},${point.y * 100}`).join(' '), color = ray.mask === 1 ? 'amber' : 'blue';
    beams.append(svg('polyline', { points, class: `beam beam-${color} beam-halo` }), svg('polyline', { points, class: `beam beam-${color}` }));
  }
  mirrorButtons.forEach((button, i) => { button.classList.toggle('backslash', !turns[i]); button.classList.toggle('hinted', hinted === i); button.setAttribute('aria-pressed', String(!turns[i])); button.title = turns[i] ? 'Slash mirror (/). Click to turn.' : 'Backslash mirror. Click to turn.'; });
  stampViews.forEach(({ cell, label, stamp }) => {
    const current = result.stamps.find(s => s.index === stamp.index); label.classList.toggle('lit', current.lit);
    cell.setAttribute('role', 'img'); cell.setAttribute('aria-label', `${names[stamp.mask]} stamp row ${stamp.y + 1} column ${stamp.x + 1}: ${current.lit ? 'delivered' : 'waiting'}`);
  });
  if (result.solved) completed.add(cardIndex);
  $('turns').textContent = `${String(history.length).padStart(2, '0')} ${history.length === 1 ? 'TURN' : 'TURNS'}`;
  $('delivery').textContent = `${result.lit} / ${result.stamps.length} STAMPS DELIVERED`;
  $('undo').disabled = !history.length; $('next').hidden = !result.solved || cardIndex === cards.length - 1;
  $('session').textContent = `${completed.size} / ${cards.length} POSTCARDS DELIVERED THIS VISIT`;
  $('status').textContent = result.solved ? (cardIndex === cards.length - 1 ? 'Every stamp on this card has its light. The last letter is home. Revisit any postcard to try another route.' : 'Delivered. Every stamp has its light. Your next postcard is ready below.')
    : message || (result.rays.some(ray => ray.ending === 'loop') ? 'The light is looping. Turn a mirror to open a way out; loops do not cost extra turns.' : `Waiting for ${result.stamps.length - result.lit} ${result.stamps.length - result.lit === 1 ? 'stamp' : 'stamps'}. Turn a mirror and follow where the light goes.`);
}
function load(index) {
  cardIndex = index; card = parseCard(cards[index]); turns = [...card.initial]; history = []; hinted = -1; $('card').value = index;
  $('number').textContent = `POSTCARD ${String(index + 1).padStart(2, '0')} / 05`; $('title').textContent = card.title; $('note').textContent = card.note;
  buildBoard(); render();
}
$('card').addEventListener('change', () => load(Number($('card').value)));
$('reset').addEventListener('click', () => { turns = [...card.initial]; history = []; hinted = -1; render('Card reset. Turn a mirror to send the light a different way.'); });
$('undo').addEventListener('click', () => { if (history.length) { turns = history.pop(); hinted = -1; render('One turn undone. The light has retraced its route.'); } });
$('hint').addEventListener('click', () => {
  const solution = solve(card, turns);
  if (!solution || !solution.flips.length) { render(); return; }
  hinted = solution.flips[0]; const mirror = card.mirrors[hinted];
  render(`Try turning the highlighted mirror: row ${mirror.y + 1}, column ${mirror.x + 1}. ${solution.flips.length} ${solution.flips.length === 1 ? 'turn remains' : 'turns remain'} on a shortest route from here.`);
});
$('next').addEventListener('click', () => { if (cardIndex < cards.length - 1 && trace(card, turns).solved) { load(cardIndex + 1); mirrorButtons[0].focus(); } });
load(0);
