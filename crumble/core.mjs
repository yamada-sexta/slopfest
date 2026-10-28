export const LIMITS = Object.freeze({ minSize: 5, maxSize: 41, grains: 8192 });
export const SIZE = 620, PAD = 22;
export const GRAIN_COLORS = ['#182a2c', '#528c8a', '#d0ac64', '#f0e1b5', '#f18a70'];
const HEAT = ['#182a2c', '#355c75', '#638b99', '#a8c0a5', '#dcc78c', '#f4b675', '#ed8269'];
const fail = message => { throw new RangeError(message); };
function checkSize(size) {
  if (!Number.isInteger(size) || size < LIMITS.minSize || size > LIMITS.maxSize || size % 2 !== 1) fail('Choose an odd board size from 5 to 41.');
}
function checkIndex(index, size) {
  if (!Number.isInteger(index) || index < 0 || index >= size * size) fail('Choose a cell inside the board.');
}
const sum = values => values.reduce((total, value) => total + value, 0);
function validate(state) {
  if (!state) fail('Use a sandpile state.'); checkSize(state.size);
  for (const key of ['cells', 'input', 'odometer']) if (!(state[key] instanceof Uint32Array) || state[key].length !== state.size ** 2) fail('The board, pour history, and odometer must fit the grid.');
  if (!Number.isInteger(state.added) || state.added < 0 || state.added > LIMITS.grains || !Number.isInteger(state.escaped) || state.escaped < 0 || state.escaped > state.added || !Number.isInteger(state.topplings) || state.topplings < 0 || state.topplings > state.added * (state.size + 1) ** 2 / 8) fail('Sandpile counters must stay inside the grain and work bounds.');
  if (sum(state.input) !== state.added || sum(state.cells) + state.escaped !== state.added || sum(state.odometer) !== state.topplings) fail('Grains and topplings must balance with their counters.');
}
function copy(state) {
  return { ...state, cells: state.cells.slice(), input: state.input.slice(), odometer: state.odometer.slice() };
}
export function create(size, input) {
  checkSize(size);
  if (input === undefined) input = new Uint32Array(size * size);
  if (!(input instanceof Uint32Array) || input.length !== size * size || sum(input) > LIMITS.grains) fail('A pour can contain at most 8,192 grains on this board.');
  return { size, cells: input.slice(), input: input.slice(), odometer: new Uint32Array(size * size), added: sum(input), escaped: 0, topplings: 0 };
}
export function pour(state, index, amount) {
  validate(state); checkIndex(index, state.size);
  if (!Number.isInteger(amount) || amount < 1 || amount > LIMITS.grains || state.added + amount > LIMITS.grains) fail('This postcard holds at most 8,192 poured grains. Restore a pour to start fresh.');
  const next = copy(state); next.cells[index] += amount; next.input[index] += amount; next.added += amount; return next;
}
export function inspect(state) {
  validate(state); let unstable = 0, peak = 0, busiest = 0;
  for (let i = 0; i < state.cells.length; i++) { if (state.cells[i] >= 4) unstable++; peak = Math.max(peak, state.cells[i]); busiest = Math.max(busiest, state.odometer[i]); }
  return { grains: state.added - state.escaped, unstable, peak, busiest, stable: unstable === 0 };
}
function neighbors(index, size) {
  const x = index % size, y = Math.floor(index / size);
  return [y > 0 ? index - size : -1, x + 1 < size ? index + 1 : -1, y + 1 < size ? index + size : -1, x > 0 ? index - 1 : -1];
}
function topple(next, index, count, schedule = () => {}) {
  next.cells[index] -= count * 4; next.odometer[index] += count; next.topplings += count;
  for (const neighbor of neighbors(index, next.size)) {
    if (neighbor === -1) next.escaped += count;
    else { next.cells[neighbor] += count; if (next.cells[neighbor] >= 4) schedule(neighbor); }
  }
}
// A wave reads the old heights: newly received grains wait until the next wave.
export function wave(state) {
  validate(state); const next = copy(state);
  for (let i = 0; i < state.cells.length; i++) {
    const count = Math.floor(state.cells[i] / 4); if (count) topple(next, i, count);
  }
  return next;
}
// At most one queue entry per cell. Bulk firings are still legal individual topples.
export function settle(state, order = 'fifo') {
  validate(state); if (!['fifo', 'lifo'].includes(order)) fail('Choose fifo or lifo toppling order.');
  const next = copy(state), capacity = state.cells.length + 1, queue = new Uint32Array(capacity), pending = new Uint8Array(state.cells.length);
  let head = 0, tail = 0, length = 0, visits = 0;
  const schedule = i => { if (!pending[i]) { queue[tail] = i; tail = (tail + 1) % capacity; length++; pending[i] = 1; } };
  for (let i = 0; i < state.cells.length; i++) if (state.cells[i] >= 4) schedule(i);
  while (length) {
    let index;
    if (order === 'fifo') { index = queue[head]; head = (head + 1) % capacity; }
    else { tail = (tail + capacity - 1) % capacity; index = queue[tail]; }
    length--; pending[index] = 0; visits++;
    const count = Math.floor(next.cells[index] / 4); if (count) topple(next, index, count, schedule);
  }
  return { state: next, visits };
}
export function compareOrders(state) {
  validate(state);
  const origin = create(state.size, state.input), first = settle(origin, 'fifo'), last = settle(origin, 'lifo');
  const equal = (a, b) => a.every((value, index) => value === b[index]);
  return { sameCells: equal(first.state.cells, last.state.cells), sameOdometer: equal(first.state.odometer, last.state.odometer), sameEscape: first.state.escaped === last.state.escaped, grains: first.state.added - first.state.escaped, escaped: first.state.escaped, topplings: first.state.topplings, fifoVisits: first.visits, lifoVisits: last.visits };
}
export const PRESETS = Object.freeze([
  { name: 'A small mountain', note: '4,096 grains in one place. A little square coastline catches what remains.', size: 31, kind: 'mountain' },
  { name: 'Two handsful', note: 'Two equal heaps meet in the middle. Neither gets the last word.', size: 31, kind: 'twins' },
  { name: 'One grain too many', note: 'Every cell holds three grains. Just one more in the center starts the conversation.', size: 25, kind: 'carpet' },
]);
export function specimen(index = 0) {
  if (!Number.isInteger(index) || index < 0 || index >= PRESETS.length) fail('Choose one of the three pours.');
  const { size, kind } = PRESETS[index], input = new Uint32Array(size * size), center = Math.floor(size / 2);
  if (kind === 'mountain') input[center * size + center] = 4096;
  else if (kind === 'twins') { input[center * size + center - 5] = 2048; input[center * size + center + 5] = 2048; }
  else { input.fill(3); input[center * size + center]++; }
  return create(size, input);
}
export function positionAt(x, y, size) {
  checkSize(size);
  if (!Number.isFinite(x) || !Number.isFinite(y)) fail('Pointer coordinates must be finite.');
  if (x < PAD || y < PAD || x >= SIZE - PAD || y >= SIZE - PAD) return null;
  const unit = (SIZE - PAD * 2) / size;
  return Math.floor((y - PAD) / unit) * size + Math.floor((x - PAD) / unit);
}
export function colorAt(grains, topplings, busiest, layer) {
  if (!['grains', 'work'].includes(layer)) fail('Choose grains or work as the drawing layer.');
  return layer === 'grains' ? GRAIN_COLORS[Math.min(4, grains)] : HEAT[topplings === 0 ? 0 : Math.max(1, Math.ceil(Math.log1p(topplings) / Math.log1p(Math.max(1, busiest)) * (HEAT.length - 1)))];
}
const number = value => Number(value.toFixed(3));
export function toSVG(state, layer = 'grains') {
  const stats = inspect(state), unit = (SIZE - PAD * 2) / state.size;
  const cells = Array.from(state.cells, (height, i) => `<rect data-cell="${i}" x="${number(PAD + i % state.size * unit)}" y="${number(PAD + Math.floor(i / state.size) * unit + 32)}" width="${number(unit - .6)}" height="${number(unit - .6)}" fill="${colorAt(height, state.odometer[i], stats.busiest, layer)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 686" role="img" aria-label="Crumble sandpile, ${layer === 'grains' ? 'grain heights' : 'toppling counts'}"><rect width="620" height="686" fill="#132427"/><text x="22" y="25" fill="#f0e1b5" font-family="monospace" font-size="12">CRUMBLE / ${layer === 'grains' ? 'GRAINS' : 'WORK'}</text>${cells}<text x="22" y="659" fill="#b9c8bf" font-family="monospace" font-size="10">${stats.grains} grains here / ${state.escaped} escaped / ${state.topplings} topplings</text><text x="22" y="676" fill="#b9c8bf" font-family="monospace" font-size="10">${stats.stable ? 'Settled' : `${stats.unstable} cells ready to spill`} / ${state.size} x ${state.size} / open edges</text></svg>`;
}
