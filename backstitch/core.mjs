// A second-order cellular automaton: the extra row is a memory, not a log.
export const LIMITS = Object.freeze({ width: 160, steps: 256 });
const trips = new WeakSet();

function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
}
function row(value) {
  if (typeof value !== 'string' || !value.length || /[^01]/.test(value) || value.length > LIMITS.width) throw new Error(`Rows must contain 1–${LIMITS.width} binary digits.`);
}
export function pair(past, current) {
  row(past); row(current);
  if (past.length !== current.length) throw new Error('The past and current rows must have equal widths.');
  return Object.freeze({ past, current });
}
function checked(state) {
  if (!state || typeof state !== 'object') throw new Error('Supply a past/current row pair.');
  return pair(state.past, state.current);
}
export function centered(width = 65) {
  integer(width, 1, LIMITS.width, 'Width');
  return pair('0'.repeat(width), '0'.repeat(Math.floor(width / 2)) + '1' + '0'.repeat(width - Math.floor(width / 2) - 1));
}

// Rule bit 0 is neighborhood 000; bit 7 is 111. Ends meet on a ring.
export function elementary(current, rule) {
  row(current); integer(rule, 0, 255, 'Rule');
  const n = current.length;
  return Array.from({ length: n }, (_, i) => {
    const neighborhood = Number(current[(i + n - 1) % n]) * 4 + Number(current[i]) * 2 + Number(current[(i + 1) % n]);
    return String((rule >> neighborhood) & 1);
  }).join('');
}
const xor = (a, b) => Array.from(a, (bit, i) => bit === b[i] ? '0' : '1').join('');

export function step(state, rule, direction = 1) {
  const { past, current } = checked(state);
  integer(rule, 0, 255, 'Rule');
  if (direction !== 1 && direction !== -1) throw new Error('Direction must be 1 or -1.');
  return direction === 1
    ? pair(current, xor(past, elementary(current, rule)))
    : pair(xor(current, elementary(past, rule)), past);
}
export function walk(state, { rule = 90, steps = 48, direction = 1 } = {}) {
  integer(steps, 0, LIMITS.steps, 'Steps'); integer(rule, 0, 255, 'Rule');
  if (direction !== 1 && direction !== -1) throw new Error('Direction must be 1 or -1.');
  const states = [checked(state)];
  for (let i = 0; i < steps; i++) states.push(step(states.at(-1), rule, direction));
  return Object.freeze(states);
}
export function roundTrip(state, { rule = 90, steps = 48 } = {}) {
  const outward = walk(state, { rule, steps });
  const homeward = walk(outward.at(-1), { rule, steps, direction: -1 });
  const recovered = homeward.at(-1).past === outward[0].past && homeward.at(-1).current === outward[0].current;
  const result = Object.freeze({ rule, steps, width: outward[0].current.length, outward, homeward, recovered });
  trips.add(result);
  return result;
}

// Only engine-produced, immutable trips may enter the serializer.
export function toSVG(trip) {
  if (!trips.has(trip)) throw new Error('Make a roundTrip before exporting it.');
  const { width, steps, rule, outward, homeward, recovered } = trip;
  const cell = 448 / width, height = 300 + (steps + 1) * 8;
  const panel = (states, x, reverse) => states.map((state, i) => {
    const y = 186 + i * 8, time = reverse ? steps - i : i;
    let path = '';
    for (let j = 0; j < width;) {
      if (state.current[j] === '0') { j++; continue; }
      const start = j;
      while (j < width && state.current[j] === '1') j++;
      const a = (x + start * cell).toFixed(3), length = ((j - start) * cell).toFixed(3);
      path += `M${a},${y}h${length}v6h-${length}z`;
    }
    return `<g data-panel="${reverse ? 'homeward' : 'outward'}" data-time="${time}" data-bits="${state.current}"><rect x="${x}" y="${y}" width="448" height="6" fill="#263b48"/><path d="${path}" fill="${reverse ? '#fac583' : '#9bdeca'}"/>${i % 8 === 0 || i === steps ? `<text x="${x - 10}" y="${y + 6}" text-anchor="end" font-size="9" fill="#a1b8c2">${time}</text>` : ''}</g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${height}" viewBox="0 0 1120 ${height}" role="img" aria-labelledby="title desc">
<title id="title">Backstitch — rule ${rule}, ${steps} steps out and home</title>
<desc id="desc">Two tapestries of current rows on a ${width}-cell ring. The right panel runs backward from the left panel's final pair. Both starting rows ${recovered ? 'are recovered exactly' : 'differ'}.</desc>
<rect width="1120" height="${height}" fill="#142630"/>
<g font-family="monospace" fill="#edf3e7">
<text x="64" y="49" font-size="12" letter-spacing="3" fill="#9bdeca">A SMALL MACHINE FOR COMING HOME</text>
<text x="64" y="96" font-size="40">Backstitch</text>
<text x="64" y="125" font-size="13" fill="#a1b8c2">RULE ${rule} / ${width} CELLS / ${steps} STEPS / RING EDGES</text>
<text x="64" y="168" font-size="13" fill="#9bdeca">01 / OUTWARD →</text>
<text x="608" y="168" font-size="13" fill="#fac583">02 / HOMEWARD ←</text>
${panel(outward, 64, false)}
${panel(homeward, 608, true)}
<text x="64" y="${height - 69}" font-size="17">${recovered ? 'Every stitch came home.' : 'The rows differ.'}</text>
<text x="64" y="${height - 43}" font-size="12" fill="#a1b8c2">The past row and current row both match the starting pair. No history is used to reverse.</text>
<text x="64" y="${height - 23}" font-size="11" fill="#a1b8c2">next = past XOR F(current) / previous = current XOR F(past)</text>
</g></svg>\n`;
}
