import { catalog, rectangle } from './core.mjs';

const byId = id => document.getElementById(id);
const pattern = byId('pattern');
const preset = byId('preset');
const indexInput = byId('index');
const board = byId('board');
const boardError = byId('board-error');
const indexError = byId('index-error');
const colors = ['#d89076', '#97b9aa', '#b5a6c9', '#d8b76e', '#91aabe', '#c6b894'];
const navigation = ['first', 'previous', 'next', 'last'].map(byId);
let rows;
let book;
let current;

function square(x, y, className) {
  const element = document.createElement('span');
  element.className = className;
  element.style.gridColumn = String(x + 1);
  element.style.gridRow = String(y + 1);
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function render() {
  const width = rows[0].length;
  const height = rows.length;
  const tiles = current === null ? null : book.at(current);
  const pieces = new Map();
  board.replaceChildren();
  board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${height}, 1fr)`;
  board.style.aspectRatio = `${width} / ${height}`;
  board.style.width = `${Math.min(width * 52, 520 * width / height)}px`;
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === '#') {
      board.append(square(x, y, 'hole'));
    } else if (tiles === null) {
      board.append(square(x, y, 'blank'));
    } else {
      const id = tiles[y][x];
      if (!pieces.has(id)) pieces.set(id, []);
      pieces.get(id).push({ x, y });
    }
  }));
  for (const [id, [start, end]] of pieces) {
    const piece = square(start.x, start.y, 'domino');
    const horizontal = start.y === end.y;
    if (horizontal) piece.style.gridColumn = `${start.x + 1} / span 2`;
    else piece.style.gridRow = `${start.y + 1} / span 2`;
    piece.style.background = colors[(id - 1) % colors.length];
    piece.title = `Domino ${id}, row ${start.y + 1}, column ${start.x + 1}, ${horizontal ? 'horizontal' : 'vertical'}`;
    board.append(piece);
  }

  const message = current === null
    ? 'This board has no complete tilings.'
    : `Tiling ${current} of ${book.count}`;
  byId('count').textContent = String(book.count);
  byId('dimensions').textContent = `${width} × ${height}`;
  byId('position').textContent = message;
  board.setAttribute('aria-label', `${message} Board with ${width} columns and ${height} rows. ${pieces.size} dominoes.`);
  indexInput.value = current === null ? '' : String(current);
  indexInput.disabled = current === null;
  byId('index-form').querySelector('button').disabled = current === null;
  byId('first').disabled = current === null || current === 1n;
  byId('previous').disabled = current === null || current === 1n;
  byId('next').disabled = current === null || current === book.count;
  byId('last').disabled = current === null || current === book.count;
  indexError.textContent = '';
}

function load(nextRows) {
  const nextBook = catalog(nextRows);
  rows = [...nextRows];
  book = nextBook;
  current = book.count === 0n ? null : 1n;
  boardError.textContent = '';
  render();
}

byId('board-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    load(pattern.value.trim().split(/\r?\n/));
    preset.value = 'custom';
  } catch (error) {
    boardError.textContent = error.message;
  }
});

preset.addEventListener('change', () => {
  if (preset.value === 'custom') {
    pattern.focus();
    return;
  }
  const nextRows = preset.value === 'ring'
    ? ['....', '.##.', '.##.', '....']
    : rectangle(...preset.value.split('x').map(Number));
  load(nextRows);
  pattern.value = nextRows.join('\n');
});

byId('index-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!/^[1-9][0-9]*$/.test(indexInput.value)) {
    indexError.textContent = 'Enter a positive whole number.';
    return;
  }
  const requested = BigInt(indexInput.value);
  if (requested > book.count) {
    indexError.textContent = `Choose a number from 1 to ${book.count}.`;
    return;
  }
  current = requested;
  render();
});

navigation.forEach(button => button.addEventListener('click', () => {
  if (button.id === 'first') current = 1n;
  if (button.id === 'previous') current--;
  if (button.id === 'next') current++;
  if (button.id === 'last') current = book.count;
  render();
}));

load(rectangle(4, 4));
pattern.value = rows.join('\n');
