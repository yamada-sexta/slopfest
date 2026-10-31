export const COLORS = Object.freeze({ background: '#211c2b', wall: '#352e40', frame: '#7a6a80', lit: '#f2bd81', dark: '#1c2738', ink: '#f1e7db', muted: '#bcb0c3' });
const systems = new Map();
function system(size) {
  if (!Number.isInteger(size) || size < 3 || size > 5) throw new RangeError('Choose a square building of 3, 4, or 5 windows per side.');
  if (!systems.has(size)) {
    const count = size * size, full = 2 ** count - 1, moves = [];
    for (let i = 0; i < count; i++) {
      const x = i % size, y = Math.floor(i / size); let mask = 0;
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < size && ny >= 0 && ny < size) mask |= 1 << (ny * size + nx);
      }
      moves.push(mask);
    }
    systems.set(size, Object.freeze({ size, count, full, moves: Object.freeze(moves) }));
  }
  return systems.get(size);
}
function maskCheck(value, full) { if (!Number.isInteger(value) || value < 0 || value > full) throw new RangeError('Use a whole window pattern inside this building.'); }
export function countBits(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 0x1ffffff) throw new RangeError('Use a nonnegative pattern of at most 25 windows.');
  let count = 0; while (mask) { mask &= mask - 1; count++; } return count;
}
export function affected(size, index) {
  const grid = system(size);
  if (!Number.isInteger(index) || index < 0 || index >= grid.count) throw new RangeError('Choose a window inside the building.');
  return grid.moves[index];
}
export function knock(size, lights, index) { const grid = system(size); maskCheck(lights, grid.full); return lights ^ affected(size, index); }
export function applyPlan(size, lights, plan) {
  const grid = system(size); maskCheck(lights, grid.full); maskCheck(plan, grid.full);
  let result = lights;
  for (let i = 0; i < grid.count; i++) if (plan & (1 << i)) result ^= grid.moves[i];
  return result;
}
export function solve(size, lights) {
  const grid = system(size); maskCheck(lights, grid.full);
  const { count, full } = grid, rhs = 1 << count, rows = [], pivots = [];
  // One equation per lamp: which knocks toggle it, and must it change?
  for (let lamp = 0; lamp < count; lamp++) {
    let row = lights & (1 << lamp) ? rhs : 0;
    for (let button = 0; button < count; button++) if (grid.moves[button] & (1 << lamp)) row |= 1 << button;
    rows.push(row);
  }
  let rank = 0;
  for (let column = 0; column < count; column++) {
    const pivot = rows.findIndex((row, i) => i >= rank && (row & (1 << column)));
    if (pivot === -1) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    for (let row = 0; row < count; row++) if (row !== rank && (rows[row] & (1 << column))) rows[row] ^= rows[rank];
    pivots.push(column); rank++;
  }
  if (rows.some(row => !(row & full) && (row & rhs))) return null;
  let particular = 0; const basis = [];
  pivots.forEach((column, row) => { if (rows[row] & rhs) particular |= 1 << column; });
  for (let column = 0; column < count; column++) if (!pivots.includes(column)) {
    let vector = 1 << column;
    pivots.forEach((pivot, row) => { if (rows[row] & (1 << column)) vector |= 1 << pivot; });
    basis.push(vector);
  }
  // Only 1, 16, and 4 candidates on the supported 3x3, 4x4, and 5x5 boards.
  let minimum = count + 1, best = 0, shortest = 0;
  for (let choice = 0; choice < 2 ** basis.length; choice++) {
    let plan = particular; basis.forEach((vector, i) => { if (choice & (1 << i)) plan ^= vector; });
    const distance = countBits(plan);
    if (distance < minimum) { minimum = distance; best = plan; shortest = 1; }
    else if (distance === minimum) { shortest++; best = Math.min(best, plan); }
  }
  return Object.freeze({ mask: best, distance: minimum, rank, nullity: basis.length, solutions: 2 ** basis.length, shortest });
}
const definitions = [
  { name: 'Just one knock', size: 3, plan: [4], note: 'Five windows are awake. One knock in the center puts them all out.' },
  { name: 'Across the landing', size: 3, plan: [0, 8], note: 'A corner changes only three windows. Nothing wraps around the building.' },
  { name: 'Noisy neighbors', size: 4, plan: [1, 6, 8, 15], note: 'The landing gets wider. Each knock still changes only a little cross.' },
  { name: 'Hallway chorus', size: 4, plan: [2, 3, 5, 9, 12], note: 'Some neighbors share more than one way to say goodnight.' },
  { name: 'The wide landing', size: 5, plan: [0, 4, 7, 12, 20, 24], note: 'A bigger building, another quiet plan. Hints still find a shortest way home.' },
  { name: 'The last little chorus', size: 5, plan: [1, 5, 8, 12, 16, 19, 22, 24], note: 'Take your time. A quiet plan never needs to knock the same window twice.' },
];
export const ROOMS = Object.freeze(definitions.map(item => {
  const lights = applyPlan(item.size, 0, item.plan.reduce((mask, index) => mask | (1 << index), 0));
  return Object.freeze({ name: item.name, size: item.size, lights, note: item.note });
}));
const xml = text => text.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
export function toSVG(size, lights, { title = 'A little goodnight', moves = 0 } = {}) {
  const grid = system(size); maskCheck(lights, grid.full);
  if (typeof title !== 'string' || title.length > 60 || /[\u0000-\u001f\u007f]/.test(title) || !Number.isInteger(moves) || moves < 0 || moves > 1000000) throw new RangeError('Use a short postcard title and a bounded knock count.');
  const step = 480 / size, pane = step * .53, top = 150, solution = solve(size, lights);
  const windows = Array.from({ length: grid.count }, (_, index) => {
    const x = 80 + (index % size + .5) * step - pane / 2, y = top + Math.floor(index / size) * step + step * .13, lit = Boolean(lights & (1 << index));
    return `<g data-window="${index}" data-lit="${lit}"><rect x="${x}" y="${y}" width="${pane}" height="${pane * 1.2}" rx="5" fill="${lit ? COLORS.lit : COLORS.dark}" stroke="${COLORS.frame}" stroke-width="3"/><path d="M${x + pane / 2} ${y}v${pane * 1.2}M${x} ${y + pane * .6}h${pane}" stroke="${COLORS.wall}" stroke-width="3"/></g>`;
  }).join('');
  const quiet = lights === 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 740" role="img" aria-label="Knockturn window postcard"><rect width="640" height="740" fill="${COLORS.background}"/><text x="40" y="38" font-family="monospace" font-size="13" fill="${COLORS.muted}">KNOCKTURN / A SMALL GOODNIGHT</text><text x="40" y="77" font-family="serif" font-size="29" fill="${COLORS.ink}">${xml(title)}</text><path d="M64 148L320 101L576 148V638H64Z" fill="${COLORS.wall}"/>${windows}<text x="40" y="682" font-family="serif" font-size="24" fill="${COLORS.lit}">${quiet ? 'Every window is quiet.' : `${countBits(lights)} windows still awake.`}</text><text x="40" y="714" font-family="monospace" font-size="12" fill="${COLORS.muted}">${moves} knocks this attempt / ${solution ? `${solution.distance} shortest remaining` : 'no quiet plan for this pattern'}</text></svg>`;
}
