const states = new WeakSet();
const journeys = new WeakSet();

function seal(branches, active, source) {
  const state = Object.freeze({ branches, active: Object.freeze(active), source });
  states.add(state);
  return state;
}

function check(state) {
  if (!states.has(state)) throw new Error('Use a Twigfall engine-created state.');
}

// Each parenthesis pair is one edge; its contents are branches at its tip.
export function parse(source) {
  if (typeof source !== 'string' || source.length > 2048) throw new Error('A grove must be a string of at most 2048 characters.');
  const branches = [], parents = [0];
  let canonical = '';
  for (const symbol of source) {
    if (/\s/.test(symbol)) continue;
    if (symbol === '(') {
      if (branches.length === 24) throw new Error('A grove can have at most 24 branches.');
      const id = branches.length + 1;
      branches.push(Object.freeze({ id, parent: parents.at(-1) }));
      parents.push(id);
    } else if (symbol === ')') {
      if (parents.length === 1) throw new Error('A closing parenthesis has no branch to close.');
      parents.pop();
    } else throw new Error('Use only parentheses and whitespace for the grove.');
    canonical += symbol;
  }
  if (parents.length !== 1) throw new Error('Every branch needs a closing parenthesis.');
  return seal(Object.freeze(branches), branches.map(branch => branch.id), canonical);
}

export function cut(state, id) {
  check(state);
  if (!Number.isInteger(id) || !state.active.includes(id)) throw new Error(`Branch ${id} is not standing.`);
  const fallen = new Set([id]);
  for (const branch of state.branches) if (fallen.has(branch.parent)) fallen.add(branch.id);
  return seal(state.branches, state.active.filter(branch => !fallen.has(branch)), state.source);
}

function value(state) {
  const values = Array(state.branches.length + 1).fill(0), active = new Set(state.active);
  for (let i = state.branches.length - 1; i >= 0; i--) {
    const { id, parent } = state.branches[i];
    if (active.has(id)) values[parent] ^= values[id] + 1;
  }
  return values[0];
}

export function analyze(state) {
  check(state);
  const nimber = value(state);
  const winningCuts = state.active.filter(id => value(cut(state, id)) === 0);
  return Object.freeze({
    nimber,
    outcome: state.active.length === 0 ? 'finished' : nimber === 0 ? 'losing' : 'winning',
    winningCuts: Object.freeze(winningCuts),
    recommendation: winningCuts[0] ?? state.active[0] ?? null,
  });
}

export function run(source, cuts = []) {
  if (!Array.isArray(cuts) || cuts.length > 24) throw new Error('Supply an array of at most 24 cuts.');
  const frames = [parse(source)];
  for (const id of cuts) frames.push(cut(frames.at(-1), id));
  const journey = Object.freeze({ source: frames[0].source, cuts: Object.freeze([...cuts]), frames: Object.freeze(frames) });
  journeys.add(journey);
  return journey;
}

export function toSVG(journey, { hints = true } = {}) {
  if (!journeys.has(journey)) throw new Error('Use an engine-created journey.');
  if (typeof hints !== 'boolean') throw new Error('Hints must be true or false.');
  const state = journey.frames.at(-1), { branches, active } = state;
  const report = analyze(state), children = Array.from({ length: branches.length + 1 }, () => []);
  for (const branch of branches) children[branch.parent].push(branch.id);
  const x = [], depth = [0];
  let leaves = 0;
  function place(id) {
    for (const child of children[id]) { depth[child] = depth[id] + 1; place(child); }
    x[id] = children[id].length ? children[id].reduce((sum, child) => sum + x[child], 0) / children[id].length : leaves++ * 76 + 65;
  }
  place(0);
  const width = Math.max(520, leaves * 76 + 54), height = Math.max(300, Math.max(...depth) * 72 + 160);
  const offset = (width - (leaves * 76 + 54)) / 2;
  const y = id => height - 74 - depth[id] * 72;
  const standing = new Set(active), winning = new Set(hints ? report.winningCuts : []);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Twigfall branch-cutting grove</title>',
    `<desc id="desc">${active.length} branches standing. ${hints ? `${report.outcome} position. Peach rings mark winning cuts.` : 'Choose a standing branch to cut.'} Faint dashed branches have fallen.</desc>`,
    '<rect width="100%" height="100%" fill="#17231d"/>',
    `<g font-family="monospace" fill="#e8eddf"><text x="25" y="30" font-size="18">TWIGFALL / ${active.length} standing${hints ? ` / nimber ${report.nimber}` : ''}</text>`,
    `<path d="M 25 ${height - 74} H ${width - 25}" stroke="#789780" stroke-width="2"/>`];
  for (const { id, parent } of branches) {
    const live = standing.has(id), px = x[parent] + offset, cx = x[id] + offset;
    const mx = (px + cx) / 2, my = (y(parent) + y(id)) / 2;
    parts.push(`<path data-branch="${id}" d="M ${px} ${y(parent)} L ${cx} ${y(id)}" stroke="${live ? '#b5db99' : '#5b7060'}" stroke-width="${live ? 4 : 1}"${live ? '' : ' stroke-dasharray="3 5"'}/>`);
    parts.push(`<circle cx="${cx}" cy="${y(id)}" r="4" fill="${live ? '#b5db99' : '#5b7060'}"/>`);
    parts.push(`<circle cx="${mx}" cy="${my}" r="13" fill="#17231d" stroke="${winning.has(id) ? '#f5b08b' : live ? '#789780' : '#405347'}" stroke-width="${winning.has(id) ? 3 : 1}"/>`);
    parts.push(`<text x="${mx}" y="${my + 5}" text-anchor="middle" font-size="14" fill="${live ? '#e8eddf' : '#789780'}">${id}</text>`);
  }
  parts.push(`<text x="25" y="${height - 32}" font-size="12">${report.outcome === 'finished' ? 'Grove cleared. No move remains.' : hints ? 'Peach rings: winning cuts. Dashed: fallen branches.' : 'Cut a branch. Everything above it falls.'}</text>`, '</g></svg>');
  return parts.join('\n');
}
