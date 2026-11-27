const programs = new WeakSet(), receipts = new WeakSet();
function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
}

export function compile(source, { deleteCount = 2 } = {}) {
  integer(deleteCount, 1, 8, 'Delete count');
  if (typeof source !== 'string' || source.length > 4096) throw new Error('Use at most 4096 characters of rule source.');
  const entries = new Map();
  source.split('\n').forEach((line, i) => {
    const text = line.split('#')[0].trim();
    if (!text) return;
    const match = /^([a-z])\s*->\s*([a-z]{1,32}|-)$/.exec(text);
    if (!match) throw new Error(`Line ${i + 1}: use a -> word, or a -> - for an empty append (at most 32 letters).`);
    if (entries.has(match[1])) throw new Error(`Line ${i + 1}: duplicate rule for ${match[1]}.`);
    entries.set(match[1], match[2] === '-' ? '' : match[2]);
  });
  if (!entries.size) throw new Error('Define at least one rule.');
  for (const [head, tail] of entries) for (const symbol of tail) {
    if (!entries.has(symbol)) throw new Error(`Rule ${head} emits ${symbol}, which has no rule.`);
  }
  const program = Object.freeze({ deleteCount, rules: Object.freeze(Object.fromEntries(entries)) });
  programs.add(program); return program;
}

export function run(program, seed, { maxSteps = 100, maxLength = 256 } = {}) {
  if (!programs.has(program)) throw new Error('Compile a program before running it.');
  integer(maxSteps, 0, 2000, 'Step budget'); integer(maxLength, 1, 512, 'Queue limit');
  if (typeof seed !== 'string' || /[^a-z]/.test(seed) || seed.length > maxLength) throw new Error('Use a lowercase seed no longer than the queue limit; an empty seed is allowed.');
  for (const letter of seed) if (!Object.hasOwn(program.rules, letter)) throw new Error(`Seed letter ${letter} has no rule.`);
  const frames = [{ step: 0, word: seed, read: null, removed: '', appended: '' }], seen = new Map();
  let status, cycle = null, blocked = null;
  for (;;) {
    const { word, step } = frames.at(-1);
    if (word.length < program.deleteCount) { status = 'halted'; break; }
    if (seen.has(word)) { status = 'cycle'; cycle = Object.freeze({ start: seen.get(word), period: step - seen.get(word) }); break; }
    seen.set(word, step);
    if (step === maxSteps) { status = 'steps'; break; }
    const read = word[0], removed = word.slice(0, program.deleteCount), appended = program.rules[read];
    const next = word.slice(program.deleteCount) + appended;
    if (next.length > maxLength) {
      status = 'size'; blocked = Object.freeze({ read, removed, appended, length: next.length }); break;
    }
    frames.push({ step: step + 1, word: next, read, removed, appended });
  }
  const receipt = Object.freeze({ ...program, seed, maxSteps, maxLength, status, cycle, blocked,
    frames: Object.freeze(frames.map(Object.freeze)) });
  receipts.add(receipt); return receipt;
}

export function toSVG(receipt, { maxFrames = 32 } = {}) {
  if (!receipts.has(receipt)) throw new Error('Run a program before drawing it.');
  integer(maxFrames, 2, 64, 'Diagram frame limit');
  const { frames, status, deleteCount, cycle } = receipt;
  const front = Math.ceil(maxFrames / 2), back = Math.floor(maxFrames / 2);
  const shown = frames.length <= maxFrames ? frames : [...frames.slice(0, front), null, ...frames.slice(-back)];
  const omitted = frames.length - maxFrames;
  const width = Math.max(680, 144 + Math.max(...shown.filter(Boolean).map(frame => frame.word.length)) * 24);
  const height = 148 + shown.length * 32;
  const ending = status === 'cycle' ? `cycle: step ${cycle.start}, period ${cycle.period}` : status;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Tailspin queue trace</title>',
    `<desc id="desc">Delete ${deleteCount} letters per step. Status ${ending}. Orange marks the next removed prefix; its first letter chooses the append rule. ${Math.max(0, omitted)} middle frames omitted.</desc>`,
    '<rect width="100%" height="100%" fill="#1c252c"/>',
    '<g font-family="monospace">',
    `<text x="24" y="32" font-size="18" fill="#ede9dd">TAILSPIN / delete ${deleteCount} / ${ending}</text>`,
    '<text x="24" y="57" font-size="12" fill="#bbc7c9">Orange: next removed prefix. Its first letter chooses the append rule.</text>'];
  shown.forEach((frame, row) => {
    const y = 84 + row * 32;
    if (!frame) { parts.push(`<text x="24" y="${y + 17}" font-size="13" fill="#bbc7c9">... ${omitted} middle frames omitted ...</text>`); return; }
    parts.push(`<g data-step="${frame.step}" data-word="${frame.word}"><text x="24" y="${y + 17}" font-size="14" fill="#bbc7c9">${frame.step}</text>`);
    if (!frame.word) parts.push(`<text x="96" y="${y + 17}" font-size="16" fill="#ede9dd">∅</text>`);
    for (let i = 0; i < frame.word.length; i++) {
      // A short final queue cannot take a step, so no prefix is marked there.
      const cut = frame.word.length >= deleteCount && i < deleteCount;
      parts.push(`<rect x="${96 + i * 24}" y="${y}" width="21" height="24" rx="3" fill="${cut ? '#eeb084' : '#b9d5c9'}"/><text x="${106 + i * 24}" y="${y + 17}" text-anchor="middle" font-size="15" fill="#1c252c">${frame.word[i]}</text>`);
    }
    parts.push('</g>');
  });
  const completed = frames.length - 1, length = frames.at(-1).word.length;
  parts.push(`<text x="24" y="${height - 35}" font-size="13" fill="#ede9dd">${completed} completed ${completed === 1 ? 'step' : 'steps'} / ${length} ${length === 1 ? 'letter' : 'letters'} in the final queue</text>`,
    '<text x="24" y="' + (height - 14) + '" font-size="12" fill="#bbc7c9">Read the first letter, remove a prefix, append its rule at the tail.</text>', '</g></svg>');
  return parts.join('\n');
}
