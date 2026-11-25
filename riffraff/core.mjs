const states = new WeakSet(), journeys = new WeakSet();
function check(state) {
  if (!states.has(state)) throw new Error('Make a deck before shuffling or inspecting it.');
}
function seal(cards) {
  const state = Object.freeze({ size: cards.length, cards: Object.freeze(cards) });
  states.add(state); return state;
}
function position(index, size, side) {
  const half = size / 2;
  return index < half ? 2 * index + (side === 'I' ? 1 : 0) : 2 * (index - half) + (side === 'O' ? 1 : 0);
}
function cardNumber(state, card) {
  check(state);
  if (!Number.isInteger(card) || card < 1 || card > state.size) throw new Error(`Choose a card or position from 1 to ${state.size}.`);
}

export function deck(size = 8) {
  if (!Number.isInteger(size) || size < 2 || size > 64 || size % 2) throw new Error('Use an even deck size from 2 to 64.');
  return seal(Array.from({ length: size }, (_, i) => i + 1));
}
export function shuffle(state, side) {
  check(state);
  if (side !== 'O' && side !== 'I') throw new Error('Use O for an out-shuffle or I for an in-shuffle.');
  const cards = Array(state.size);
  state.cards.forEach((card, i) => { cards[position(i, state.size, side)] = card; });
  return seal(cards);
}
export function run(word = 'OIO', size = 8) {
  const first = deck(size);
  if (typeof word !== 'string' || word.length > 128 || /[^OI]/.test(word)) throw new Error('Use at most 128 uppercase O/I shuffles, without spaces.');
  const frames = [first];
  for (const side of word) frames.push(shuffle(frames.at(-1), side));
  const journey = Object.freeze({ size, word, frames: Object.freeze(frames) });
  journeys.add(journey); return journey;
}
export function analyze(journey) {
  if (!journeys.has(journey)) throw new Error('Run a shuffle word before analyzing it.');
  const final = journey.frames.at(-1);
  const destinations = Array(final.size);
  final.cards.forEach((card, i) => { destinations[card - 1] = i + 1; });
  const visited = new Set(), cycles = [];
  let order = 1n;
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  for (let start = 1; start <= final.size; start++) {
    if (visited.has(start)) continue;
    const cycle = [];
    for (let at = start; !visited.has(at); at = destinations[at - 1]) { cycle.push(at); visited.add(at); }
    cycles.push(Object.freeze(cycle));
    const length = BigInt(cycle.length);
    order = order / gcd(order, length) * length;
  }
  return Object.freeze({ destinations: Object.freeze(destinations), cycles: Object.freeze(cycles), order: String(order) });
}

export function route(state, card, target) {
  cardNumber(state, card); cardNumber(state, target);
  const start = state.cards.indexOf(card), queue = [start], previous = new Map([[start, null]]);
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    if (at === target - 1) {
      let word = '', positions = [at + 1];
      for (let current = at; previous.get(current) !== null;) {
        const edge = previous.get(current);
        word = edge.side + word; current = edge.at; positions.push(current + 1);
      }
      return Object.freeze({ card, from: start + 1, target, word, positions: Object.freeze(positions.reverse()), discovered: previous.size });
    }
    // Stable tie breaking: try out before in.
    for (const side of ['O', 'I']) {
      const next = position(at, state.size, side);
      if (!previous.has(next)) { previous.set(next, { at, side }); queue.push(next); }
    }
  }
  throw new Error('No shuffle word reaches that position.');
}

export function toSVG(journey, { card = 1 } = {}) {
  if (!journeys.has(journey)) throw new Error('Run a shuffle word before drawing it.');
  cardNumber(journey.frames[0], card);
  const width = Math.max(600, 140 + journey.frames.length * 70), height = 160 + journey.size * 24;
  const x = i => 90 + i * 70, y = i => 94 + i * 24;
  const points = journey.frames.map((state, i) => `${x(i)},${y(state.cards.indexOf(card)) + 10}`).join(' ');
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Riffraff perfect-shuffle deck trace</title>',
    `<desc id="desc">${journey.size} cards, ${journey.word.length} shuffles. Columns read left to right in time. Each column reads top to bottom in deck order. The colored path follows card ${card}.</desc>`,
    '<rect width="100%" height="100%" fill="#182529"/>',
    `<g font-family="monospace"><text x="24" y="32" font-size="18" fill="#edf0df">RIFFRAFF / ${journey.size} cards / following ${card}</text>`,
    `<polyline points="${points}" fill="none" stroke="#7bc9c9" stroke-width="3"/>`];
  for (let i = 0; i < journey.size; i++) parts.push(`<text x="28" y="${y(i) + 15}" font-size="13" fill="#adbfbd">${i + 1}</text>`);
  journey.frames.forEach((state, step) => {
    parts.push(`<text x="${x(step)}" y="78" text-anchor="middle" font-size="14" fill="#edf0df">${step === 0 ? 'start' : journey.word[step - 1]}</text>`);
    state.cards.forEach((id, i) => parts.push(`<g data-step="${step}" data-card="${id}" data-position="${i + 1}"><rect x="${x(step) - 22}" y="${y(i)}" width="44" height="20" rx="3" fill="${id === card ? '#efac87' : '#d4dfd0'}"/><text x="${x(step)}" y="${y(i) + 15}" text-anchor="middle" font-size="14" fill="#182529">${id}</text></g>`));
  });
  parts.push(`<text x="24" y="${height - 42}" font-size="12" fill="#adbfbd">O: top half leads. I: bottom half leads.</text>`,
    `<text x="24" y="${height - 22}" font-size="12" fill="#adbfbd">Rows are positions; numbers are original card IDs.</text>`, '</g></svg>');
  return parts.join('\n');
}
