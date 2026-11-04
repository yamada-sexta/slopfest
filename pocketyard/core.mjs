// Each string runs from the buffer stop (left) to the exposed end (right).
const yards = new WeakMap();
function trackList(tracks, capacity) {
  if (!Array.isArray(tracks) || tracks.length !== 3 || Array.from(tracks).some(track => typeof track !== 'string' || /[^1-6]/.test(track) || track.length > capacity)) throw new Error('Use three tracks of wagon digits 1–6 within their capacity.');
  const wagons = tracks.join('');
  if (!wagons.length || wagons.length > 6 || new Set(wagons).size !== wagons.length) throw new Error('Use one through six distinct wagons.');
  return [...wagons].sort().join('');
}
const key = tracks => tracks.join('|');
const move = (from, to, wagon) => Object.freeze({ from, to, wagon });
function checkYard(yard) { if (!yards.has(yard)) throw new Error('Create a yard first.'); }
export function createYard(goal, capacity = 3) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 3) throw new Error('Track capacity must be a whole number from 1 to 3.');
  const wagons = trackList(goal, capacity);
  if (wagons.length >= capacity * 3) throw new Error('Leave at least one empty wagon space.');
  const yard = Object.freeze({ goal: Object.freeze([...goal]), capacity, wagons });
  yards.set(yard, null);
  return yard;
}
export function board(yard, tracks) {
  checkYard(yard);
  if (trackList(tracks, yard.capacity) !== yard.wagons) throw new Error('The board must contain exactly the goal wagons.');
  return Object.freeze([...tracks]);
}
function neighbors(state, capacity) {
  const result = [];
  for (let from = 0; from < 3; from++) if (state[from].length) {
    for (let to = 0; to < 3; to++) if (from !== to && state[to].length < capacity) {
      const wagon = state[from].at(-1), next = [...state];
      next[from] = next[from].slice(0, -1); next[to] += wagon;
      result.push({ state: Object.freeze(next), move: move(from, to, wagon) });
    }
  }
  return result;
}
export function legalMoves(yard, tracks) {
  const state = board(yard, tracks);
  return Object.freeze(neighbors(state, yard.capacity).map(entry => entry.move));
}
export function transfer(yard, tracks, from, to) {
  const state = board(yard, tracks);
  if (![from, to].every(index => Number.isInteger(index) && index >= 0 && index < 3)) throw new Error('Choose track 0, 1, or 2.');
  if (from === to || !state[from].length || state[to].length === yard.capacity) return null;
  const next = [...state], wagon = next[from].at(-1);
  next[from] = next[from].slice(0, -1); next[to] += wagon;
  return Object.freeze(next);
}
export function isSolved(yard, tracks) { return key(board(yard, tracks)) === key(yard.goal); }

function distances(yard) {
  let known = yards.get(yard);
  if (known) return known;
  known = new Map([[key(yard.goal), { distance: 0, move: null }]]);
  const queue = [yard.goal];
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head], distance = known.get(key(state)).distance + 1;
    for (const edge of neighbors(state, yard.capacity)) {
      const encoded = key(edge.state);
      if (known.has(encoded)) continue;
      // Every transfer has a legal inverse. Store the move back toward the goal.
      known.set(encoded, { distance, move: move(edge.move.to, edge.move.from, edge.move.wagon) });
      queue.push(edge.state);
    }
  }
  yards.set(yard, known);
  return known;
}
export function solve(yard, tracks) {
  let state = board(yard, tracks);
  const known = distances(yard), entry = known.get(key(state));
  if (!entry) return null;
  const route = [];
  while (known.get(key(state)).distance) {
    const next = known.get(key(state)).move;
    route.push(next); state = transfer(yard, state, next.from, next.to);
  }
  return Object.freeze({ distance: entry.distance, route: Object.freeze(route) });
}

export function yardStats(yard) {
  checkYard(yard);
  const known = distances(yard), counts = [];
  for (const entry of known.values()) counts[entry.distance] = (counts[entry.distance] ?? 0) + 1;
  return Object.freeze({ states: known.size, maxDistance: counts.length - 1, counts: Object.freeze(counts) });
}
// Choose from a complete distance layer, rather than counting random moves.
// Choice cycles deterministically through that layer in search order.
export function scramble(yard, distance, choice = 0) {
  checkYard(yard);
  if (!Number.isInteger(distance) || distance < 0 || !Number.isInteger(choice) || choice < 0 || choice > 0xffffffff) throw new Error('Use a nonnegative whole distance and a 32-bit choice.');
  const candidates = [];
  for (const [encoded, entry] of distances(yard)) if (entry.distance === distance) candidates.push(encoded);
  if (!candidates.length) throw new Error('No arrangement exists at that distance from this goal.');
  return board(yard, candidates[choice % candidates.length].split('|'));
}

const COLORS = Object.freeze(['#e9b37e', '#8fcac5', '#d3b6da', '#b5ce86', '#e29c94', '#acc5e0']);
export function toSVG(yard, tracks, { title = 'A small dispatch', moves = 0 } = {}) {
  const state = board(yard, tracks), solution = solve(yard, state);
  if (typeof title !== 'string' || title.length > 60 || /[\u0000-\u001f\u007f]/.test(title) || !Number.isInteger(moves) || moves < 0 || moves > 1000000) throw new Error('Use a short single-line title and a whole move count from 0 to 1000000.');
  const titleSize = Math.min(36, 872 / (Math.max(1, title.length) * .62));
  const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
  const wagons = (rows, x, y, size, target) => rows.map((track, row) => {
    const top = y + row * 126;
    const cars = Array.from({ length: yard.capacity }, (_, column) => {
      const left = x + column * (size + 12), wagon = track[column];
      return wagon ? `<g data-wagon="${wagon}" data-slot="${column}"><rect x="${left}" y="${top}" width="${size}" height="${size * .65}" rx="5" fill="${COLORS[Number(wagon) - 1]}"/><text x="${left + size / 2}" y="${top + size * .43}" text-anchor="middle" font-size="${size * .32}" fill="#183333">${wagon}</text>${target ? '' : `<circle cx="${left + size * .22}" cy="${top + size * .68}" r="4" fill="#102728"/><circle cx="${left + size * .78}" cy="${top + size * .68}" r="4" fill="#102728"/>`}</g>` : `<rect x="${left}" y="${top}" width="${size}" height="${size * .65}" rx="5" fill="none" stroke="#486363" stroke-dasharray="3 5"/>`;
    }).join('');
    return `<g data-panel="${target ? 'goal' : 'yard'}" data-track="${row}" data-wagons="${track}"><text x="${x - 33}" y="${top + 25}" font-size="15" fill="#b5c8bd">${'ABC'[row]}</text><path d="M${x - 10},${top - 3}v${size * .8}m-5,0h${yard.capacity * (size + 12)}" fill="none" stroke="#5f7a72" stroke-width="2"/>${cars}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640" viewBox="0 0 1000 640" role="img" aria-labelledby="title desc">
<title id="title">Pocketyard — ${escape(title)}</title><desc id="desc">The current wagons and dispatch order, read left to right on tracks A, B, and C. Only rightmost wagons can move.</desc>
<rect width="1000" height="640" fill="#183333"/><g font-family="monospace" fill="#edf1db">
<text x="64" y="48" font-size="11" letter-spacing="3" fill="#e9b37e">LITTLE FREIGHT. A LITTLE ORDER.</text><text x="64" y="96" font-size="${titleSize}">${escape(title)}</text>
<text x="64" y="127" font-size="12" fill="#b5c8bd">${moves} TRANSFERS / ${solution ? `${solution.distance} SHORTEST REMAINING` : 'NO ROUTE TO DISPATCH'} / CAPACITY ${yard.capacity}</text>
<text x="98" y="177" font-size="13" fill="#e9b37e">THE YARD →</text><text x="585" y="177" font-size="13" fill="#b5c8bd">DISPATCH ORDER →</text>
${wagons(state, 98, 205, 94, false)}${wagons(yard.goal, 585, 205, 82, true)}
<text x="64" y="602" font-size="12" fill="#b5c8bd">The buffers stay on the left. A wagon leaves or arrives only at the right end.</text>
</g></svg>\n`;
}
