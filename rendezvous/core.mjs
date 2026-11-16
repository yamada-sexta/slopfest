// Complete deterministic machines, with states numbered from zero.
export function machine(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('A machine must be an object of button arrays.');
  const alphabet = Object.keys(source).sort();
  if (alphabet.length < 1 || alphabet.length > 4 || alphabet.some(key => !/^[a-z]$/.test(key))) {
    throw new Error('Use one to four buttons, each named with one lowercase letter.');
  }
  const size = source[alphabet[0]]?.length;
  if (!Number.isInteger(size) || size < 1 || size > 10) throw new Error('Use 1 to 10 states.');
  const transitions = {};
  for (const button of alphabet) {
    const row = source[button];
    if (!Array.isArray(row) || row.length !== size || Array.from(row).some(to => !Number.isInteger(to) || to < 0 || to >= size)) {
      throw new Error(`Button ${button} must list one destination from 0 to ${size - 1} for every state.`);
    }
    transitions[button] = Object.freeze([...row]);
  }
  return Object.freeze(transitions);
}

export function clock(size = 4) {
  if (!Number.isInteger(size) || size < 2 || size > 10) throw new Error('Clock size must be from 2 to 10.');
  return machine({
    a: Array.from({ length: size }, (_, i) => (i + 1) % size),
    b: Array.from({ length: size }, (_, i) => i === size - 1 ? 0 : i),
  });
}

function trace(transitions, word) {
  let positions = Array.from({ length: Object.values(transitions)[0].length }, (_, i) => i);
  const frames = [{ button: null, positions, states: [...positions] }];
  for (const button of word) {
    positions = positions.map(state => transitions[button][state]);
    frames.push({ button, positions, states: [...new Set(positions)].sort((a, b) => a - b) });
  }
  return frames;
}

export function follow(source, word) {
  const transitions = machine(source);
  if (typeof word !== 'string' || word.length > 1023 || [...word].some(button => !Object.hasOwn(transitions, button))) {
    throw new Error('A word must contain at most 1023 buttons from this machine.');
  }
  const frames = trace(transitions, word);
  return { word, frames, synchronized: frames.at(-1).states.length === 1 };
}

export function synchronize(source) {
  const transitions = machine(source);
  const alphabet = Object.keys(transitions), size = transitions[alphabet[0]].length;
  const full = (1 << size) - 1;
  const queue = [full], previous = new Map([[full, null]]);
  let target = null;
  for (let head = 0; head < queue.length; head++) {
    const mask = queue[head];
    if ((mask & (mask - 1)) === 0) { target = mask; break; }
    for (const button of alphabet) {
      let next = 0;
      for (let state = 0; state < size; state++) if (mask & (1 << state)) next |= 1 << transitions[button][state];
      if (!previous.has(next)) {
        previous.set(next, { mask, button });
        queue.push(next);
      }
    }
  }
  if (target === null) return { status: 'impossible', word: null, explored: previous.size, frames: [] };
  let word = '';
  for (let at = target; previous.get(at) !== null;) {
    const edge = previous.get(at);
    word = edge.button + word;
    at = edge.mask;
  }
  return { status: 'synchronized', word, explored: previous.size, frames: trace(transitions, word) };
}

export function toSVG(source, word) {
  const transitions = machine(source), result = follow(transitions, word);
  const size = transitions[Object.keys(transitions)[0]].length;
  const panels = Math.max(1, Math.ceil(word.length / 12)), panelHeight = 86 + size * 24;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="920" height="${panels * panelHeight + 70}" viewBox="0 0 920 ${panels * panelHeight + 70}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Rendezvous button trace</title>',
    `<desc id="desc">${size} possible starting states, ${word.length} buttons. ${result.synchronized ? 'All paths meet.' : 'Multiple destinations remain.'} Each line follows one starting state.</desc>`,
    '<rect width="100%" height="100%" fill="#10201b"/>',
    `<g font-family="monospace" fill="#e6eddc"><text x="28" y="30" font-size="19">RENDEZVOUS / ${word.length} buttons / ${result.frames.at(-1).states.length} destination${result.synchronized ? '' : 's'}</text>`];
  const colors = ['#d4f38d', '#7ed8d0', '#ffae85', '#bfaff5', '#f7d471', '#ef9ac3', '#97bfef', '#b0d5ae', '#e7ba94', '#d0cfed'];
  for (let panel = 0; panel < panels; panel++) {
    const start = panel * 12, end = Math.min(word.length, start + 12), top = 70 + panel * panelHeight;
    parts.push(`<text x="28" y="${top}" font-size="12">Steps ${start}–${end}</text>`);
    for (let state = 0; state < size; state++) {
      const y = top + 36 + state * 24;
      parts.push(`<text x="28" y="${y + 4}" font-size="12">${state}</text><path d="M 64 ${y} H 886" stroke="#30463b"/>`);
    }
    for (let step = start; step <= end; step++) {
      const x = 76 + (step - start) * 66;
      parts.push(`<text x="${x}" y="${top + 16}" text-anchor="middle" font-size="11">${step === start ? '·' : word[step - 1]}</text>`);
    }
    for (let origin = 0; origin < size; origin++) {
      const points = result.frames.slice(start, end + 1).map((frame, i) => `${76 + i * 66},${top + 36 + frame.positions[origin] * 24}`).join(' ');
      parts.push(`<polyline points="${points}" fill="none" stroke="${colors[origin]}" stroke-width="2" opacity="0.65"/>`);
    }
    for (let step = start; step <= end; step++) for (const state of result.frames[step].states) {
      parts.push(`<circle cx="${76 + (step - start) * 66}" cy="${top + 36 + state * 24}" r="4" fill="#e6eddc"/>`);
    }
  }
  parts.push('</g></svg>');
  return parts.join('\n');
}
