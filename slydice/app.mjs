import { forge, toSVG } from './core.mjs';

const labels = ['A', 'B', 'C'];
const byId = id => document.getElementById(id);
const faceSelect = byId('faces');
const dice = byId('dice');
const grid = byId('grid');
const status = byId('status');
const clear = byId('clear');
const percent = (part, total) => `${(100 * part / total).toFixed(1)}%`;
let search = forge(Number(faceSelect.value));
let first = 0;
let firstWins = 0;
let counterWins = 0;
let latestCell = null;

// Keep the buttons in place as their faces change so selection keeps keyboard focus.
const picks = labels.map((label, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'die';
  button.innerHTML = `<span class="die-label mono">${label}</span><span class="die-faces mono"></span><span class="die-seat eyebrow"></span>`;
  button.addEventListener('click', () => {
    if (first === index) return;
    first = index;
    renderMatch();
  });
  dice.append(button);
  return button;
});

function renderTally() {
  const total = firstWins + counterWins;
  byId('first-wins').textContent = firstWins;
  byId('counter-wins').textContent = counterWins;
  byId('observed').textContent = total ? percent(counterWins, total) : '—';
  clear.disabled = total === 0;
}

function resetTally(message) {
  firstWins = 0;
  counterWins = 0;
  latestCell?.classList.remove('latest');
  latestCell = null;
  renderTally();
  status.textContent = message;
}

function renderMatch() {
  const { analysis, faces, partitions, cycles, bestWins, total } = search;
  const counter = analysis.counterpicks[first];
  const firstLabel = labels[first];
  const counterLabel = labels[counter];
  picks.forEach((button, index) => {
    const values = analysis.dice[index];
    const seat = index === first ? 'First seat' : index === counter ? 'Counter' : 'Available';
    button.setAttribute('aria-pressed', String(index === first));
    button.dataset.seat = seat;
    button.querySelector('.die-faces').textContent = values.join(' ');
    button.querySelector('.die-seat').textContent = seat;
    button.setAttribute('aria-label', `Choose die ${labels[index]} first. Faces ${values.join(', ')}. ${seat}.`);
  });
  const matchup = analysis.matches[counter][first];
  byId('counter-note').textContent = `Die ${counterLabel} counters die ${firstLabel}. Roll both dice to see how it plays out.`;
  byId('exact').textContent = `${counterLabel} wins ${matchup.wins}/${matchup.total} · ${percent(matchup.wins, matchup.total)}`;
  byId('forge-note').textContent = `The forge checked ${partitions.toLocaleString('en')} ways to divide 1–${faces * 3} among three dice. ${cycles.toLocaleString('en')} form a winning loop. In this trio, each favored die wins at least ${bestWins} of ${total} pairings. The forge picked the trio by maximizing that minimum.`;

  // Only engine-validated integers and fixed die labels enter the table markup.
  const columns = analysis.dice[counter];
  const rows = analysis.dice[first].map(a => {
    const outcomes = columns.map(b => b > a
      ? `<td class="counter-cell">${counterLabel}</td>`
      : `<td class="first-cell">${firstLabel}</td>`);
    return `<tr><th scope="row">${a}</th>${outcomes.join('')}</tr>`;
  });
  grid.innerHTML = `<table class="pairings mono"><caption>Rows ${firstLabel} · Columns ${counterLabel}</caption>
    <thead><tr><td></td>${columns.map(value => `<th scope="col">${value}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody></table>`;
  resetTally('Ready for the first roll.');
}

function roll(count) {
  const { faces, analysis } = search;
  const counter = analysis.counterpicks[first];
  let row, column, a, b;
  let batchWins = 0;
  for (let i = 0; i < count; i++) {
    row = Math.floor(Math.random() * faces);
    column = Math.floor(Math.random() * faces);
    a = analysis.dice[first][row];
    b = analysis.dice[counter][column];
    if (b > a) batchWins++;
  }
  // Forged sets use each face label once, so these two dice cannot tie.
  counterWins += batchWins;
  firstWins += count - batchWins;
  latestCell?.classList.remove('latest');
  latestCell = grid.querySelector('tbody').rows[row].cells[column + 1];
  latestCell.classList.add('latest');
  const winner = b > a ? counter : first;
  const result = `${labels[first]} rolled ${a}, ${labels[counter]} rolled ${b}. ${labels[winner]} wins.`;
  status.textContent = count === 1 ? result : `Counter won ${batchWins} of ${count}. Last roll: ${result}`;
  renderTally();
}

faceSelect.addEventListener('change', () => {
  search = forge(Number(faceSelect.value));
  renderMatch();
});
byId('roll').addEventListener('click', () => roll(1));
byId('batch').addEventListener('click', () => roll(20));
clear.addEventListener('click', () => {
  resetTally('Tally cleared. Ready for the next roll.');
  byId('roll').focus();
});
byId('save').addEventListener('click', () => {
  const svg = new Blob([toSVG(search.analysis)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svg);
  const link = document.createElement('a');
  link.href = url;
  link.download = `slydice-${search.faces}-faces.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
renderMatch();
