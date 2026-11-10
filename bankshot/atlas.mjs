import { fraction, shoot } from './core.mjs';

const surveys = new WeakSet();
const swatches = {
  loop: { text: '··', label: 'Loop', fill: '#2b443c', ink: '#b8d2c7' },
  NW: { text: 'NW', label: 'North-west', fill: '#8dcdb8', ink: '#172522' },
  NE: { text: 'NE', label: 'North-east', fill: '#f1a089', ink: '#172522' },
  SW: { text: 'SW', label: 'South-west', fill: '#bfb8e6', ink: '#172522' },
  SE: { text: 'SE', label: 'South-east', fill: '#edc88f', ink: '#172522' },
};

export function survey({ width, height, velocity } = {}) {
  const first = shoot({ width, height, start: [1, 1], velocity });
  const table = { width: first.width, height: first.height, velocity: first.velocity };
  const counts = { loop: 0, NW: 0, NE: 0, SW: 0, SE: 0 };
  const rows = [];
  for (let y = 1; y < table.height; y++) {
    const row = [];
    for (let x = 1; x < table.width; x++) {
      const shot = x === 1 && y === 1 ? first : shoot({ ...table, start: [x, y] });
      const { tick, walls } = shot.points.at(-1);
      const outcome = shot.end === 'return'
        ? 'loop'
        : walls.map(wall => wall[0].toUpperCase()).join('');
      counts[outcome]++;
      row.push(Object.freeze({ outcome, tick, banks: shot.banks }));
    }
    rows.push(Object.freeze(row));
  }
  const atlas = Object.freeze({
    ...table,
    scale: first.scale,
    counts: Object.freeze(counts),
    rows: Object.freeze(rows),
  });
  surveys.add(atlas);
  return atlas;
}

export function atlasSVG(atlas) {
  if (!surveys.has(atlas)) throw new Error('Survey a table before exporting an atlas.');
  const { width, height, velocity, rows, counts, scale } = atlas;
  const columns = width - 1;
  const pitch = Math.min(48, Math.floor(744 / columns), Math.floor(555 / rows.length));
  const left = (920 - columns * pitch) / 2;
  const top = 178;
  const bottom = top + rows.length * pitch;
  const canvasHeight = bottom + 120;
  const total = columns * rows.length;
  const centerX = column => left + (column + .5) * pitch;
  const centerY = row => top + (row + .5) * pitch;

  const xLabels = Array.from({ length: columns }, (_, i) =>
    `<text x="${centerX(i)}" y="${top - 11}" text-anchor="middle">${i + 1}</text>`).join('');
  const yLabels = rows.map((_, i) =>
    `<text x="${left - 12}" y="${centerY(i) + 4}" text-anchor="end">${i + 1}</text>`).join('');
  const cells = rows.map((row, i) => row.map(({ outcome, tick, banks }, j) => {
    const { text, label, fill, ink } = swatches[outcome];
    const ending = outcome === 'loop' ? 'Full return' : `${label} pocket`;
    return `<g data-start="${j + 1},${i + 1}" data-outcome="${outcome}">
<title>Start (${j + 1}, ${i + 1}). ${ending} at t=${fraction(tick, scale)} after ${banks} ${banks === 1 ? 'bank' : 'banks'}.</title>
<rect x="${left + j * pitch + 1}" y="${top + i * pitch + 1}" width="${pitch - 2}" height="${pitch - 2}" rx="4" fill="${fill}"/>
<text x="${centerX(j)}" y="${centerY(i) + 4}" fill="${ink}" font-size="${pitch < 30 ? 10 : 12}" text-anchor="middle">${text}</text>
</g>`;
  }).join('')).join('\n');
  const legend = Object.entries(swatches).map(([key, { label, fill }], i) => {
    const x = 48 + i * 166;
    return `<rect x="${x}" y="${bottom + 38}" width="13" height="13" rx="3" fill="${fill}"/>
<text x="${x + 20}" y="${bottom + 49}" font-size="12">${label} · ${counts[key]}</text>`;
  }).join('\n');
  const summary = Object.entries(swatches).map(([key, { label }]) => `${label} ${counts[key]}`).join(', ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="${canvasHeight}" viewBox="0 0 920 ${canvasHeight}" role="img" aria-labelledby="title desc">
<title id="title">Bankshot pocket atlas</title>
<desc id="desc">${width} by ${height} table with velocity (${velocity.join(', ')}). ${total} starting points. ${summary}. Coordinates increase east and south.</desc>
<rect width="920" height="${canvasHeight}" fill="#172522"/>
<g fill="#efeadc" font-family="monospace">
<text x="48" y="39" font-size="11" letter-spacing="3" fill="#a8ddca">BANKSHOT / ONE VELOCITY, MANY STARTS</text>
<text x="48" y="86" font-size="40">Pocket atlas</text>
<text x="48" y="115" font-size="13" fill="#a8ddca">${width} × ${height} TABLE   ·   VELOCITY (${velocity.join(', ')})   ·   ${total} STARTS</text>
<text x="460" y="145" font-size="11" fill="#a8ddca" text-anchor="middle">X → EAST</text>
<g fill="#a8ddca" font-size="11">${xLabels}${yLabels}</g>
${cells}
${legend}
<text x="48" y="${bottom + 81}" font-size="12" fill="#a8ddca">Y INCREASES SOUTH. EACH TILE IS A START. HOVER FOR EXACT TIME AND BANKS.</text>
</g></svg>\n`;
}
