// Cells run left to right. Each cell's layers run from bottom to top.
const states = new WeakSet(), journeys = new WeakSet();
export const MAX_PANELS = 64;
const layer = (panel, face) => Object.freeze({ panel, face });
function seal(panels, cells) {
  const state = Object.freeze({ panels, cells: Object.freeze(cells.map(cell => Object.freeze(cell))) });
  states.add(state); return state;
}
function check(state) { if (!states.has(state)) throw new Error('Make a strip before folding or inspecting it.'); }
export function strip(panels = 16) {
  if (!Number.isInteger(panels) || panels < 1 || panels > MAX_PANELS || (panels & (panels - 1))) throw new Error('Use 1, 2, 4, 8, 16, 32, or 64 panels.');
  return seal(panels, Array.from({ length: panels }, (_, i) => [layer(i + 1, 'front')]));
}
export function fold(state, side) {
  check(state);
  if (side !== 'L' && side !== 'R') throw new Error('Fold L (left over right) or R (right over left).');
  const width = state.cells.length, half = width / 2;
  if (width === 1) throw new Error('The strip is already one packet wide.');
  const flip = cell => [...cell].reverse().map(piece => layer(piece.panel, piece.face === 'front' ? 'back' : 'front'));
  const cells = Array.from({ length: half }, (_, i) => {
    const still = side === 'L' ? state.cells[half + i] : state.cells[i];
    const moving = side === 'L' ? state.cells[half - 1 - i] : state.cells[width - 1 - i];
    return [...still, ...flip(moving)];
  });
  return seal(state.panels, cells);
}
export function run(folds = 'LRR', panels = 16) {
  const first = strip(panels);
  if (typeof folds !== 'string' || /[^LR]/.test(folds) || folds.length > Math.log2(panels)) throw new Error(`Use at most ${Math.log2(panels)} uppercase L/R folds for ${panels} panels.`);
  const frames = [first];
  for (const side of folds) frames.push(fold(frames.at(-1), side));
  const journey = Object.freeze({ panels, folds, frames: Object.freeze(frames) });
  journeys.add(journey); return journey;
}
export function locate(state, panel) {
  check(state);
  if (!Number.isInteger(panel) || panel < 1 || panel > state.panels) throw new Error(`Choose a panel from 1 to ${state.panels}.`);
  for (let i = 0; i < state.cells.length; i++) {
    const stack = state.cells[i], depth = stack.findIndex(piece => piece.panel === panel);
    if (depth !== -1) return Object.freeze({ packet: i + 1, fromTop: stack.length - depth, fromBottom: depth + 1, face: stack[depth].face });
  }
  throw new Error('The panel is missing.');
}

export function toSVG(journey, { highlight = null } = {}) {
  if (!journeys.has(journey)) throw new Error('Run a folding sequence before exporting it.');
  const state = journey.frames.at(-1), position = highlight === null ? null : locate(state, highlight);
  const packets = state.cells.length, layers = state.cells[0].length;
  const width = Math.max(1000, 128 + packets * 96), height = 378 + layers * 25;
  const pitch = (width - 128) / packets, cardWidth = Math.min(240, pitch - 10), top = 199;
  const stacks = state.cells.map((stack, cell) => {
    const x = 64 + cell * pitch + (pitch - cardWidth) / 2;
    return `<g data-packet="${cell + 1}"><text x="${x + cardWidth / 2}" y="175" text-anchor="middle" font-size="12" fill="#b6c6bd">PACKET ${cell + 1}</text>${[...stack].reverse().map((piece, fromTop) => {
      const y = top + fromTop * 25, marked = piece.panel === highlight;
      return `<g data-panel="${piece.panel}" data-face="${piece.face}" data-from-top="${fromTop + 1}"${marked ? ' data-highlight="true"' : ''}><rect x="${x}" y="${y}" width="${cardWidth}" height="21" rx="3" fill="${piece.face === 'front' ? '#f0c184' : '#9dcfc4'}"${marked ? ' stroke="#f89c84" stroke-width="3"' : ''}/><text x="${x + cardWidth / 2}" y="${y + 15}" text-anchor="middle" font-size="13" fill="#233c38">${piece.panel}${piece.face === 'front' ? 'F' : 'B'}</text></g>`;
    }).join('')}</g>`;
  }).join('');
  const bottom = top + layers * 25;
  const lookup = position ? `Panel ${highlight}: packet ${position.packet}, layer ${position.fromTop} from top, ${position.face} up.` : 'Each number keeps its original panel identity, even when its back faces up.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">Turnleaf — ${journey.panels} panels, ${journey.folds || 'no'} folds</title>
<desc id="desc">${packets} packets from left to right, each ${layers} layers deep. The diagram reads each packet from top to bottom. F means front faces up; B means back faces up.</desc>
<rect width="${width}" height="${height}" fill="#20362f"/><g font-family="monospace" fill="#f1edda">
<text x="64" y="43" font-size="11" letter-spacing="3" fill="#f0c184">A LITTLE PAPER, TAKING SIDES</text><text x="64" y="91" font-size="38">Turnleaf</text>
<text x="64" y="121" font-size="13" fill="#b6c6bd">${journey.panels} PANELS / ${journey.folds ? `FOLD ${[...journey.folds].join(' · ')}` : 'NO FOLDS'} / ${packets} PACKET${packets === 1 ? '' : 'S'} × ${layers} LAYER${layers === 1 ? '' : 'S'}</text>
${stacks}
<text x="64" y="${bottom + 26}" font-size="12" fill="#f0c184">READ DOWN THE PAGE: TOP LAYER → BOTTOM LAYER</text>
<text x="64" y="${bottom + 53}" font-size="12" fill="#b6c6bd">F · FRONT UP / B · BACK UP / L · LEFT OVER RIGHT / R · RIGHT OVER LEFT</text>
<text x="64" y="${bottom + 80}" font-size="12">${lookup}</text>
<text x="64" y="${bottom + 109}" font-size="11" fill="#b6c6bd">The moving half flips over and lands on top. Turnleaf ignores crease thickness.</text>
<text x="64" y="${bottom + 136}" font-size="11" fill="#b6c6bd">STARTING STRIP: PANELS 1–${journey.panels} FROM LEFT TO RIGHT, ALL FRONTS UP.</text>
</g></svg>\n`;
}
