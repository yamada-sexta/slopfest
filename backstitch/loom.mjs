import { pair, centered, step, LIMITS } from './core.mjs';

const looms = new WeakSet();
function seal(value) { const loom = Object.freeze(value); looms.add(loom); return loom; }
function check(loom) { if (!looms.has(loom)) throw new Error('Create a loom first.'); }
const record = (time, state) => Object.freeze({ time, current: state.current });
export function createLoom({ state = centered(65), rule = 110, depth = 64 } = {}) {
  const origin = pair(state?.past, state?.current);
  if (!Number.isInteger(rule) || rule < 0 || rule > 255) throw new Error('Rule must be a whole number from 0 to 255.');
  if (!Number.isInteger(depth) || depth < 1 || depth > LIMITS.steps) throw new Error('Cloth depth must be a whole number from 1 to 256.');
  return seal({ origin, state: origin, rule, depth, time: 0, hasMoved: false, trail: Object.freeze([record(0, origin)]) });
}
export function advance(loom, direction) {
  check(loom);
  if (direction !== 1 && direction !== -1) throw new Error('Direction must be 1 or -1.');
  const time = loom.time + direction;
  if (time < 0 || time > loom.depth) return loom;
  // This is the entire evolution. The drawing trail is never read by the rule.
  const state = step(loom.state, loom.rule, direction);
  const trail = Object.freeze([...loom.trail.filter(row => row.time !== time), record(time, state)].sort((a, b) => a.time - b.time));
  return seal({ ...loom, state, time, hasMoved: true, trail });
}
export function forgetTrail(loom) {
  check(loom);
  return seal({ ...loom, trail: Object.freeze([record(loom.time, loom.state)]) });
}
export function resetLoom(loom) { check(loom); return createLoom({ state: loom.origin, rule: loom.rule, depth: loom.depth }); }
export function atHome(loom) {
  check(loom);
  return loom.time === 0 && loom.state.past === loom.origin.past && loom.state.current === loom.origin.current;
}

// The same serializer paints the browser cloth and the downloaded postcard.
// Missing trail rows stay empty; export never silently rebuilds forgotten marks.
export function clothSVG(loom) {
  check(loom);
  const { state, rule, time, depth, trail } = loom, width = state.current.length;
  const cell = 800 / width, rowHeight = Math.max(2, Math.min(7, 448 / (depth + 1)));
  const startY = 130, bottom = startY + (depth + 1) * rowHeight, height = bottom + 143;
  const paths = (bits, y, h, color) => {
    let d = '';
    for (let i = 0; i < width;) {
      if (bits[i] === '0') { i++; continue; }
      const start = i; while (i < width && bits[i] === '1') i++;
      const x = (64 + start * cell).toFixed(3), w = ((i - start) * cell).toFixed(3);
      d += `M${x},${y.toFixed(3)}h${w}v${h.toFixed(3)}h-${w}z`;
    }
    return `<path d="${d}" fill="${color}"/>`;
  };
  const rows = trail.map(row => {
    const y = startY + row.time * rowHeight;
    return `<g data-time="${row.time}" data-bits="${row.current}"><rect x="64" y="${y.toFixed(3)}" width="800" height="${Math.max(1, rowHeight - 1).toFixed(3)}" fill="#263b48"/>${paths(row.current, y, Math.max(1, rowHeight - 1), '#9bdeca')}</g>`;
  }).join('');
  const liveY = startY + time * rowHeight;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 928 ${height.toFixed(3)}" width="928" height="${height.toFixed(3)}" role="img" aria-labelledby="cloth-title cloth-desc">
<title id="cloth-title">Backstitch — rule ${rule}, time ${time} of ${depth}</title>
<desc id="cloth-desc">${trail.length} recorded row${trail.length === 1 ? '' : 's'} on a ${width}-cell ring. Blank rows are unrecorded. The amber line marks time ${time}. Both live rows are shown below the cloth.</desc>
<rect width="928" height="${height.toFixed(3)}" fill="#142630"/>
<g fill="#edf3e7" font-family="monospace">
<text x="64" y="44" font-size="22">Every stitch has a way home.</text>
<text x="64" y="72" font-size="12" fill="#a1b8c2">RULE ${rule} / ${width} CELLS / TIME ${time} OF ${depth} / RING EDGES</text>
<text x="64" y="109" font-size="11" fill="#9bdeca">THE CLOTH · ${trail.length} RECORDED ROW${trail.length === 1 ? '' : 'S'}</text>
<rect x="64" y="${startY}" width="800" height="${((depth + 1) * rowHeight).toFixed(3)}" fill="#192f3b"/>
${rows}
<path d="M52,${(liveY + rowHeight / 2).toFixed(3)}h-10m10,0-4-3m4,3-4,3" fill="none" stroke="#fac583" stroke-width="2"/>
<rect x="62" y="${(liveY - 1).toFixed(3)}" width="804" height="${(rowHeight + 1).toFixed(3)}" fill="none" stroke="#fac583"/>
<text x="64" y="${(bottom + 29).toFixed(3)}" font-size="11" fill="#fac583">THE MACHINE · TWO LIVE ROWS</text>
<g data-memory="past" data-bits="${state.past}"><rect x="64" y="${(bottom + 42).toFixed(3)}" width="800" height="10" fill="#263b48"/>${paths(state.past, bottom + 42, 10, '#b4b5df')}</g>
<g data-memory="current" data-bits="${state.current}"><rect x="64" y="${(bottom + 58).toFixed(3)}" width="800" height="10" fill="#263b48"/>${paths(state.current, bottom + 58, 10, '#fac583')}</g>
<text x="64" y="${(bottom + 95).toFixed(3)}" font-size="12" fill="#a1b8c2">${atHome(loom) ? 'Both rows match the starting pair.' : 'The rule needs these two rows to reverse. The cloth is only a drawing.'}</text>
<text x="64" y="${(bottom + 121).toFixed(3)}" font-size="11" fill="#a1b8c2">PAST · LAVENDER / CURRENT · AMBER / MARKS · MINT / GAPS · UNRECORDED</text>
</g></svg>\n`;
}
