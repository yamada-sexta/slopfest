// Fair, independent rolls. A win is a strict numerical >; ties are not rerolled.
const labels = ['A', 'B', 'C'];
const analyses = new WeakSet();
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
function die(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 8 || Array.from(values).some(n => !Number.isInteger(n) || n < 0 || n > 99)) {
    throw new Error('Each die needs 1–8 faces, numbered with whole numbers from 0 to 99.');
  }
  return [...values].sort((a, b) => a - b);
}
function wins(a, b) {
  let count = 0;
  for (const x of a) for (const y of b) if (x > y) count++;
  return count;
}
export function match(left, right) {
  const a = die(left), b = die(right), total = a.length * b.length;
  const won = wins(a, b), lost = wins(b, a);
  return Object.freeze({ wins: won, losses: lost, ties: total - won - lost, total });
}
export function analyze(values) {
  if (!Array.isArray(values) || values.length !== 3) throw new Error('Supply exactly three dice: A, B, and C.');
  const dice = Array.from(values, die), faces = dice[0].length;
  if (dice.some(d => d.length !== faces)) throw new Error('All three dice need the same number of faces.');
  const matches = dice.map(a => dice.map(b => match(a, b)));
  const beats = (a, b) => matches[a][b].wins * 2 > matches[a][b].total;
  const cycle = beats(0, 1) && beats(1, 2) && beats(2, 0) ? [0, 1, 2]
    : beats(0, 2) && beats(2, 1) && beats(1, 0) ? [0, 2, 1] : null;
  const counterpicks = dice.map((_, picked) => {
    let best = null;
    for (let other = 0; other < 3; other++) {
      if (other !== picked && beats(other, picked) && (best === null || matches[other][picked].wins > matches[best][picked].wins)) best = other;
    }
    return best;
  });
  const result = freeze({ dice, faces, matches, cycle, counterpicks });
  analyses.add(result);
  return result;
}

// Enumerate combinations, rather than permuting face order or renaming dice.
function combinations(pool, size, visit) {
  const chosen = [];
  function walk(start) {
    if (chosen.length === size) { visit([...chosen]); return; }
    for (let i = start; i <= pool.length - (size - chosen.length); i++) {
      chosen.push(pool[i]); walk(i + 1); chosen.pop();
    }
  }
  walk(0);
}
const cache = new Map();
export function forge(faces = 3) {
  if (![3, 4, 5].includes(faces)) throw new Error('The exhaustive forge supports 3, 4, or 5 faces per die.');
  if (cache.has(faces)) return cache.get(faces);
  const pool = Array.from({ length: faces * 3 - 1 }, (_, i) => i + 2), total = faces * faces;
  let partitions = 0, cycles = 0, bestWins = -1, bestCount = 0, best = null;
  const histogram = Array(total + 1).fill(0);
  combinations(pool, faces - 1, tail => {
    const a = [1, ...tail], remaining = pool.filter(x => !tail.includes(x));
    // A owns 1. B owns the smallest remaining number. Every unlabeled partition
    // appears exactly once. Orient the winning cycle only after classifying it.
    combinations(remaining.slice(1), faces - 1, middle => {
      const b = [remaining[0], ...middle], c = remaining.filter(x => !b.includes(x));
      partitions++;
      const ab = wins(a, b), bc = wins(b, c), ca = wins(c, a);
      let oriented, score;
      if (Math.min(ab, bc, ca) * 2 > total) { oriented = [a, b, c]; score = Math.min(ab, bc, ca); }
      else if (Math.max(ab, bc, ca) * 2 < total) { oriented = [a, c, b]; score = total - Math.max(ab, bc, ca); }
      else return;
      cycles++; histogram[score]++;
      if (score > bestWins) { bestWins = score; bestCount = 0; best = oriented; }
      if (score === bestWins) bestCount++;
    });
  });
  const result = freeze({ faces, partitions, cycles, total, bestWins, bestCount, histogram, analysis: analyze(best) });
  cache.set(faces, result);
  return result;
}

export function toSVG(analysis) {
  if (!analyses.has(analysis)) throw new Error('Analyze three dice before exporting them.');
  const { dice, faces, matches, cycle } = analysis;
  const width = 1080, gridTop = 375, pitch = 28, bottom = gridTop + faces * pitch, height = bottom + 155;
  const order = cycle ?? [0, 1, 2];
  const colors = { win: '#eeaa8a', loss: '#414b65', tie: '#d8c27e' };
  const cards = dice.map((d, i) => {
    const x = 48 + i * 336;
    return `<g data-die="${labels[i]}"><rect x="${x}" y="150" width="312" height="132" rx="14" fill="#252c41"/><text x="${x + 22}" y="181" fill="#eeaa8a" font-size="12">DIE ${labels[i]}</text><text x="${x + 22}" y="218" font-size="${faces > 6 ? 14 : faces > 4 ? 17 : 23}">${d.join('  ')}</text><text x="${x + 22}" y="254" font-size="12" fill="#bdc3d3">MEAN ${(d.reduce((a, b) => a + b, 0) / faces).toFixed(2)}</text></g>`;
  }).join('');
  const grids = order.map((left, i) => {
    const right = order[(i + 1) % 3], x = 48 + i * 336, gridX = x + (312 - faces * pitch) / 2;
    const m = matches[left][right];
    const cells = dice[left].map((a, row) => dice[right].map((b, col) => {
      const outcome = a > b ? 'win' : a < b ? 'loss' : 'tie';
      return `<rect data-row="${row + 1}" data-column="${col + 1}" data-outcome="${outcome}" x="${gridX + col * pitch}" y="${gridTop + row * pitch}" width="25" height="25" rx="4" fill="${colors[outcome]}"><title>${labels[left]} rolls ${a}; ${labels[right]} rolls ${b}: ${outcome}</title></rect>`;
    }).join('')).join('');
    const headings = dice[left].map((a, row) => `<text x="${gridX - 10}" y="${gridTop + row * pitch + 17}" text-anchor="end" font-size="11" fill="#bdc3d3">${a}</text>`).join('')
      + dice[right].map((b, col) => `<text x="${gridX + col * pitch + 12}" y="${gridTop - 12}" text-anchor="middle" font-size="11" fill="#bdc3d3">${b}</text>`).join('');
    return `<g data-left="${labels[left]}" data-right="${labels[right]}"><text x="${x + 156}" y="325" text-anchor="middle" font-size="19">${labels[left]} vs ${labels[right]}</text>${headings}${cells}<text x="${x + 156}" y="${bottom + 28}" text-anchor="middle" font-size="17" fill="#eeaa8a">${m.wins}/${m.total} WINS · ${(100 * m.wins / m.total).toFixed(1)}%</text><text x="${x + 156}" y="${bottom + 51}" text-anchor="middle" font-size="11" fill="#bdc3d3">${m.losses} LOSSES / ${m.ties} TIES</text></g>`;
  }).join('');
  const title = cycle ? `${order.map(i => labels[i]).join(' beats ')} beats A` : 'No strict-majority cycle';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">Slydice — ${title}</title><desc id="desc">Three fair dice and every possible pairing. Rows belong to the left die, columns to the right. Coral is a win for the left die, slate a loss, gold a tie. Each square is equally likely.</desc>
<rect width="${width}" height="${height}" fill="#191e30"/><g fill="#f1ecdf" font-family="monospace">
<text x="48" y="37" font-size="11" letter-spacing="3" fill="#eeaa8a">THE ADVANTAGE OF CHOOSING SECOND</text><text x="48" y="87" font-size="40">Slydice</text><text x="48" y="117" font-size="15" fill="#bdc3d3">${title} · ${faces} face${faces === 1 ? '' : 's'} per die</text>
${cards}${grids}
<text x="48" y="${bottom + 93}" font-size="12">ROWS = LEFT DIE / COLUMNS = RIGHT DIE / ONE SQUARE = ONE EQUALLY LIKELY PAIR</text>
<text x="48" y="${bottom + 122}" font-size="12" fill="#bdc3d3">CORAL · WIN / SLATE · LOSS / GOLD · TIE / TIES ARE NOT REROLLED</text>
</g></svg>\n`;
}
