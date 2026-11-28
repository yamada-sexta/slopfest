import { run } from './core.mjs';
const censuses = new WeakSet();
const quantity = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function census(program, length, options = {}) {
  // Let the interpreter authenticate the program and validate shared budgets.
  const checked = run(program, '', options);
  if (!Number.isInteger(length) || length < 0 || length > 12) throw new Error('Census length must be a whole number from 0 to 12.');
  if (length > checked.maxLength) throw new Error('Census seeds must fit within the queue limit.');
  const alphabet = Object.keys(program.rules).sort();
  const total = alphabet.length ** length;
  if (total > 1024) throw new Error('A census may contain at most 1024 seeds; choose a shorter length.');
  let seeds = [''];
  for (let i = 0; i < length; i++) seeds = seeds.flatMap(seed => alphabet.map(letter => seed + letter));
  const counts = { halted: 0, cycle: 0, steps: 0, size: 0 }, groups = new Map();
  const outcomes = seeds.map(seed => {
    const receipt = run(program, seed, { maxSteps: checked.maxSteps, maxLength: checked.maxLength });
    counts[receipt.status]++;
    let representative = null;
    if (receipt.cycle) {
      // A deterministic cycle has one lexically smallest queue, regardless of
      // where the seed enters it. The repeated final frame is excluded.
      representative = receipt.frames.slice(receipt.cycle.start, -1).map(frame => frame.word).reduce((a, b) => a < b ? a : b);
      if (!groups.has(representative)) groups.set(representative, { representative, period: receipt.cycle.period, seeds: 0 });
      groups.get(representative).seeds++;
    }
    return { seed, status: receipt.status, steps: receipt.frames.length - 1, final: receipt.frames.at(-1).word,
      cycle: receipt.cycle, blockedLength: receipt.blocked?.length ?? null, representative };
  });
  const sorted = [...groups.values()].sort((a, b) => a.representative < b.representative ? -1 : 1);
  const ids = new Map(sorted.map((group, i) => [group.representative, i + 1]));
  const result = Object.freeze({ kind: 'census', length, alphabet: Object.freeze(alphabet), rules: program.rules,
    deleteCount: program.deleteCount, maxSteps: checked.maxSteps, maxLength: checked.maxLength, total,
    status: counts.steps || counts.size ? 'limited' : 'complete', counts: Object.freeze(counts),
    orbits: Object.freeze(sorted.map((group, i) => Object.freeze({ id: i + 1, ...group }))),
    outcomes: Object.freeze(outcomes.map(({ representative, ...row }) => Object.freeze({ ...row, orbit: ids.get(representative) ?? null }))) });
  censuses.add(result); return result;
}

export function censusToSVG(receipt, { maxSeeds = 64 } = {}) {
  if (!censuses.has(receipt)) throw new Error('Make a census before drawing it.');
  if (!Number.isInteger(maxSeeds) || maxSeeds < 2 || maxSeeds > 128) throw new Error('Diagram seed limit must be a whole number from 2 to 128.');
  const rows = [], columns = 4, width = 740;
  const add = items => { for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns)); };
  const omitted = Math.max(0, receipt.total - maxSeeds);
  if (!omitted) add(receipt.outcomes);
  else {
    add(receipt.outcomes.slice(0, Math.ceil(maxSeeds / 2))); rows.push(null);
    add(receipt.outcomes.slice(-Math.floor(maxSeeds / 2)));
  }
  const height = 180 + rows.reduce((sum, row) => sum + (row ? 80 : 32), 0);
  const colors = { halted: '#b9d5c9', cycle: '#a9c7ea', steps: '#eeb084', size: '#d8b5dd' };
  const summary = Object.entries(receipt.counts).map(([status, count]) => `${status}: ${count}`).join(' / ');
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Tailspin seed census</title>',
    `<desc id="desc">All ${receipt.total} seeds of length ${receipt.length} over ${receipt.alphabet.join('')}. ${summary}. ${omitted} middle seeds omitted from the diagram. Labels distinguish proved halts and cycles from unresolved step or size limits.</desc>`,
    '<rect width="100%" height="100%" fill="#1c252c"/><g font-family="monospace">',
    `<text x="24" y="32" font-size="18" fill="#ede9dd">TAILSPIN / census / length ${receipt.length} / ${quantity(receipt.total, 'seed')}</text>`,
    `<text x="24" y="56" font-size="13" fill="#bbc7c9">${summary}</text>`,
    `<text x="24" y="78" font-size="12" fill="#bbc7c9">Delete ${receipt.deleteCount} / ${receipt.maxSteps}-step budget per seed / ${receipt.maxLength}-letter limit / ${quantity(receipt.orbits.length, 'loop group')}</text>`,
    `<text x="24" y="100" font-size="12" fill="#bbc7c9">Alphabet: ${receipt.alphabet.join('')} / limited seeds remain unresolved</text>`];
  let y = 120;
  for (const row of rows) {
    if (!row) { parts.push(`<text x="24" y="${y + 18}" font-size="13" fill="#bbc7c9">... ${omitted} middle seeds omitted ...</text>`); y += 32; continue; }
    row.forEach((outcome, column) => {
      const x = 24 + column * 176;
      const label = outcome.orbit ? `cycle C${outcome.orbit} / p${outcome.cycle.period}` : outcome.status === 'halted' ? 'halted' : `${outcome.status} limit`;
      const detail = outcome.cycle ? `${quantity(outcome.steps, 'step')} / in ${outcome.cycle.start}` : quantity(outcome.steps, 'completed step');
      parts.push(`<g data-seed="${outcome.seed}" data-status="${outcome.status}" data-orbit="${outcome.orbit ?? ''}"><rect x="${x}" y="${y}" width="164" height="70" rx="5" fill="${colors[outcome.status]}"/>`,
        `<text x="${x + 10}" y="${y + 20}" font-size="15" fill="#1c252c">${outcome.seed || '∅'}</text>`,
        `<text x="${x + 10}" y="${y + 40}" font-size="12" fill="#1c252c">${label}</text>`,
        `<text x="${x + 10}" y="${y + 58}" font-size="12" fill="#1c252c">${detail}</text></g>`);
    });
    y += 80;
  }
  parts.push(`<text x="24" y="${height - 44}" font-size="12" fill="#bbc7c9">C: loop group / p: period / in: entry step / limits remain unresolved</text>`,
    `<text x="24" y="${height - 24}" font-size="12" fill="#bbc7c9">Seeds read alphabetically. Summary counts include omitted seeds.</text>`, '</g></svg>');
  return parts.join('\n');
}
