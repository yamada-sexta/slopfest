export const SIZE = 720, CENTER = 360, RADIUS = 254;
export const COLORS = Object.freeze(['#edae89', '#a3d3bf', '#b9b9ed', '#e9d397']);
const fail = message => { throw new RangeError(message); };
export function validate(alphabet, order) {
  if (typeof alphabet !== 'string' || !/^[A-Z0-9]{2,4}$/.test(alphabet) || new Set(alphabet).size !== alphabet.length) fail('Choose 2–4 different uppercase letters or digits.');
  if (!Number.isInteger(order) || order < 1 || order > 5) fail('Word length must be an integer from 1 to 5.');
}
export function windowAt(tape, order, position) {
  if (typeof tape !== 'string' || tape.length < 2 || tape.length > 1024 || !/^[A-Z0-9]+$/.test(tape) || !Number.isInteger(order) || order < 1 || order > 5 || !Number.isInteger(position) || position < 0 || position >= tape.length) fail('Use a bounded ribbon, word length, and position inside it.');
  return readWindow(tape, order, position);
}
function readWindow(tape, order, position) {
  let word = '';
  for (let i = 0; i < order; i++) word += tape[(position + i) % tape.length];
  return word;
}
export function audit(tape, alphabet, order) {
  validate(alphabet, order);
  if (typeof tape !== 'string' || tape.length < 2 || tape.length > 1024 || [...tape].some(symbol => !alphabet.includes(symbol))) fail('The ribbon must contain 2–1,024 symbols from its alphabet.');
  const counts = new Map();
  for (let position = 0; position < tape.length; position++) {
    const word = readWindow(tape, order, position); counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const possible = alphabet.length ** order, distinct = counts.size;
  return { possible, positions: tape.length, distinct, missing: possible - distinct, repeats: tape.length - distinct, valid: tape.length === possible && distinct === possible };
}
export function makeLoop(alphabet = '01', order = 3) {
  validate(alphabet, order);
  const k = alphabet.length, vertices = k ** (order - 1), next = new Uint8Array(vertices);
  // A vertex is an (order−1)-symbol suffix. Each appended symbol is an edge.
  // Walk unused edges; close and splice circuits by unwinding the stack.
  const stack = [{ vertex: 0, symbol: null }], reversed = [];
  while (stack.length) {
    const tip = stack[stack.length - 1];
    if (next[tip.vertex] < k) {
      const symbol = next[tip.vertex]++;
      stack.push({ vertex: (tip.vertex * k + symbol) % vertices, symbol });
    } else {
      const item = stack.pop(); if (item.symbol !== null) reversed.push(alphabet[item.symbol]);
    }
  }
  const tape = (alphabet[0].repeat(order - 1) + reversed.reverse().join('')).slice(0, k ** order);
  const proof = audit(tape, alphabet, order);
  if (!proof.valid) throw new Error('The constructed ribbon failed its independent window audit.');
  const lookup = new Map();
  for (let i = 0; i < tape.length; i++) lookup.set(readWindow(tape, order, i), i);
  return { alphabet, order, tape, lookup, proof };
}
export function locate(loop, word) {
  validateLoop(loop);
  if (typeof word !== 'string' || word.length !== loop.order || [...word].some(symbol => !loop.alphabet.includes(symbol))) fail(`Enter ${loop.order} symbols using only ${loop.alphabet.split('').join(', ')}.`);
  const position = loop.lookup.get(word);
  if (position === undefined) fail('This word is missing from the ribbon lookup.');
  return position;
}
export function move(position, delta, length) {
  if (!Number.isInteger(length) || length < 2 || length > 1024 || !Number.isInteger(position) || position < 0 || position >= length || !Number.isSafeInteger(delta)) fail('Choose a position and a whole step inside this ring.');
  // Reduce the step first so even large safe integer steps retain precision.
  return (position + delta % length + length) % length;
}
export function bead(position, length) {
  move(position, 0, length);
  const angle = position / length * Math.PI * 2 - Math.PI / 2;
  return { x: CENTER + Math.cos(angle) * RADIUS, y: CENTER + Math.sin(angle) * RADIUS };
}
export function positionAt(x, y, length) {
  if (![x, y].every(Number.isFinite) || !Number.isInteger(length) || length < 2 || length > 1024) fail('Choose a finite point and a bounded ring.');
  const distance = Math.hypot(x - CENTER, y - CENTER);
  if (Math.abs(distance - RADIUS) > 40) return null;
  const angle = (Math.atan2(y - CENTER, x - CENTER) + Math.PI * 2.5) % (Math.PI * 2);
  return Math.round(angle / (Math.PI * 2) * length) % length;
}
export function selection(loop, position) {
  validateLoop(loop);
  return Array.from({ length: loop.order }, (_, i) => move(position, i, loop.tape.length));
}
function validateLoop(loop) {
  if (!loop) fail('Use a constructed word loop.');
  validate(loop.alphabet, loop.order);
  if (typeof loop.tape !== 'string' || loop.tape.length !== loop.alphabet.length ** loop.order || [...loop.tape].some(symbol => !loop.alphabet.includes(symbol))) fail('Use a complete ribbon from this alphabet.');
}
export function toSVG(loop, position = 0) {
  const active = new Set(selection(loop, position)), count = loop.tape.length, word = windowAt(loop.tape, loop.order, position);
  const dotRadius = Math.max(1.1, Math.min(13, 620 / count));
  const dots = [...loop.tape].map((symbol, i) => {
    const { x, y } = bead(i, count), color = COLORS[loop.alphabet.indexOf(symbol)];
    const label = count <= 64 ? `<text x="${x.toFixed(3)}" y="${(y + 4).toFixed(3)}" text-anchor="middle" font-family="monospace" font-size="${count <= 32 ? 12 : 9}" fill="${active.has(i) ? '#25232b' : '#e1d7d7'}">${symbol}</text>` : '';
    return `<g><circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${dotRadius.toFixed(3)}" fill="${color}" opacity="${active.has(i) ? 1 : .38}"/>${active.has(i) ? `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${(dotRadius + 5).toFixed(3)}" stroke="#f3d6b3" stroke-width="2" fill="none"/>` : ''}${label}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 780" role="img" aria-labelledby="title"><title id="title">Wordloop — every ${loop.order}-symbol word from ${loop.alphabet}</title><rect width="720" height="780" fill="#202129"/><circle cx="360" cy="360" r="254" stroke="#66616a" fill="none"/>${dots}<text x="360" y="366" text-anchor="middle" font-family="monospace" font-size="58" fill="#f3d6b3">${word}</text><text x="360" y="403" text-anchor="middle" font-family="monospace" font-size="12" fill="#beb5b4">READ CLOCKWISE / POSITION ${position + 1} OF ${count}</text><text x="32" y="746" font-family="monospace" font-size="12" fill="#beb5b4">WORDLOOP / ${count} WORDS, ${count} SYMBOLS / A CIRCULAR RIBBON</text></svg>`;
}
