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

export function routePair(state, placements) {
  check(state);
  if (!Array.isArray(placements) || placements.length !== 2) throw new Error('Choose exactly two card/target placements.');
  for (const placement of placements) {
    if (!placement || typeof placement !== 'object') throw new Error('Each placement needs a card and target.');
    cardNumber(state, placement.card); cardNumber(state, placement.target);
  }
  const cards = placements.map(p => p.card), target = placements.map(p => p.target);
  if (cards[0] === cards[1] || target[0] === target[1]) throw new Error('Choose two distinct cards and two distinct target positions.');
  const size = state.size, from = cards.map(card => state.cards.indexOf(card) + 1);
  const encode = pair => (pair[0] - 1) * size + pair[1] - 1;
  const decode = key => [Math.floor(key / size) + 1, key % size + 1];
  const start = encode(from), goal = encode(target);
  // Track only the marked pair: all other cards are irrelevant to this goal.
  const previous = new Int32Array(size * size).fill(-1), moves = new Uint8Array(size * size);
  const queue = [start]; previous[start] = -2;
  let word = null, positions = [];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    if (at === goal) {
      word = ''; positions = [decode(at)];
      for (let current = at; previous[current] !== -2;) {
        word = (moves[current] === 0 ? 'O' : 'I') + word;
        current = previous[current]; positions.push(decode(current));
      }
      positions.reverse(); break;
    }
    const pair = decode(at);
    for (const [move, side] of ['O', 'I'].entries()) {
      const next = encode(pair.map(p => position(p - 1, size, side) + 1));
      if (previous[next] === -1) { previous[next] = at; moves[next] = move; queue.push(next); }
    }
  }
  return Object.freeze({ reachable: word !== null, cards: Object.freeze(cards), from: Object.freeze(from),
    target: Object.freeze(target), word, positions: Object.freeze(positions.map(Object.freeze)), discovered: queue.length });
}

export function toSVG(journey, { card = 1, partner = null } = {}) {
  if (!journeys.has(journey)) throw new Error('Run a shuffle word before drawing it.');
  cardNumber(journey.frames[0], card);
  if (partner !== null) {
    cardNumber(journey.frames[0], partner);
    if (partner === card) throw new Error('Follow two distinct cards.');
  }
  const width = Math.max(600, 140 + journey.frames.length * 70), height = 160 + journey.size * 24;
  const x = i => 90 + i * 70, y = i => 94 + i * 24;
  const points = id => journey.frames.map((state, i) => `${x(i)},${y(state.cards.indexOf(id)) + 10}`).join(' ');
  const followed = partner === null ? String(card) : `${card} and ${partner}`;
  const description = partner === null ? `The blue path follows card ${card}.`
    : `An orange solid path follows card ${card}; a teal dashed path follows card ${partner}.`;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Riffraff perfect-shuffle deck trace</title>',
    `<desc id="desc">${journey.size} cards, ${journey.word.length} shuffles. Columns read left to right in time. Each column reads top to bottom in deck order. ${description}</desc>`,
    '<rect width="100%" height="100%" fill="#182529"/>',
    `<g font-family="monospace"><text x="24" y="32" font-size="18" fill="#edf0df">RIFFRAFF / ${journey.size} cards / following ${followed}</text>`,
    `<polyline data-follow="${card}" points="${points(card)}" fill="none" stroke="${partner === null ? '#7bc9c9' : '#efac87'}" stroke-width="3"/>`];
  if (partner !== null) parts.push(`<polyline data-follow="${partner}" points="${points(partner)}" fill="none" stroke="#7bc9c9" stroke-width="3" stroke-dasharray="6 3"/>`,
    `<text x="24" y="54" font-size="12" fill="#adbfbd">Orange solid: card ${card}. Teal dashed: card ${partner}.</text>`);
  for (let i = 0; i < journey.size; i++) parts.push(`<text x="28" y="${y(i) + 15}" font-size="13" fill="#adbfbd">${i + 1}</text>`);
  journey.frames.forEach((state, step) => {
    parts.push(`<text x="${x(step)}" y="78" text-anchor="middle" font-size="14" fill="#edf0df">${step === 0 ? 'start' : journey.word[step - 1]}</text>`);
    state.cards.forEach((id, i) => parts.push(`<g data-step="${step}" data-card="${id}" data-position="${i + 1}"><rect x="${x(step) - 22}" y="${y(i)}" width="44" height="20" rx="3" fill="${id === card ? '#efac87' : id === partner ? '#7bc9c9' : '#d4dfd0'}"/><text x="${x(step)}" y="${y(i) + 15}" text-anchor="middle" font-size="14" fill="#182529">${id}</text></g>`));
  });
  parts.push(`<text x="24" y="${height - 42}" font-size="12" fill="#adbfbd">O: top half leads. I: bottom half leads.</text>`,
    `<text x="24" y="${height - 22}" font-size="12" fill="#adbfbd">Rows are positions; numbers are original card IDs.</text>`, '</g></svg>');
  return parts.join('\n');
}
