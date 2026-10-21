// Each tile contains two arcs; ports are north, east, south, west.
const PAIRS = [[[0, 1], [2, 3]], [[0, 3], [1, 2]]];
export const PRESETS = [
  { name: 'A loose conversation', width: 12, height: 10, pattern: 'scatter', seed: 42 },
  { name: 'Many little promises', width: 8, height: 6, pattern: 'check', seed: 7 },
  { name: 'The long way home', width: 20, height: 14, pattern: 'same', seed: 23 }
];
function validate(world) {
  const { width, height, tiles } = world;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 4 || width > 24 || height > 24 || tiles.length !== width * height || !tiles.every(value => value === 0 || value === 1)) throw new RangeError('Use a 4–24 cell loom of binary tiles.');
}
export function cloth(width, height, seed = 42, pattern = 'scatter') {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !['scatter', 'check', 'same'].includes(pattern)) throw new RangeError('Choose a 32-bit seed and a known pattern.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 4 || width > 24 || height > 24) throw new RangeError('Use 4–24 cells per side.');
  let random = seed;
  const tiles = Array.from({ length: width * height }, (_, cell) => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return pattern === 'same' ? 0 : pattern === 'check' ? (cell % width + Math.floor(cell / width)) % 2 : random >>> 31;
  });
  return { width, height, tiles };
}
export function turn(world, cell) {
  validate(world);
  if (!Number.isInteger(cell) || cell < 0 || cell >= world.tiles.length) throw new RangeError('Choose a tile inside the cloth.');
  const tiles = world.tiles.slice(); tiles[cell] ^= 1;
  return { ...world, tiles };
}
export function loops(world) {
  validate(world);
  const { width, height, tiles } = world, owners = new Int32Array(tiles.length * 2).fill(-1), threads = [];
  for (let start = 0; start < owners.length; start++) {
    if (owners[start] !== -1) continue;
    let cell = Math.floor(start / 2), arc = start % 2, entry = PAIRS[tiles[cell]][arc][0], horizontal = 0, vertical = 0;
    const firstEntry = entry, pieces = [];
    do {
      const id = cell * 2 + arc;
      if (owners[id] !== -1) throw new Error('A thread met a previously traced arc.');
      owners[id] = threads.length; pieces.push(id);
      const pair = PAIRS[tiles[cell]][arc], exit = pair[0] === entry ? pair[1] : pair[0];
      let x = cell % width, y = Math.floor(cell / width);
      if (exit === 0) { if (y === 0) vertical--; y = (y + height - 1) % height; }
      if (exit === 1) { if (x === width - 1) horizontal++; x = (x + 1) % width; }
      if (exit === 2) { if (y === height - 1) vertical++; y = (y + 1) % height; }
      if (exit === 3) { if (x === 0) horizontal--; x = (x + width - 1) % width; }
      cell = y * width + x; entry = (exit + 2) % 4;
      arc = PAIRS[tiles[cell]][0].includes(entry) ? 0 : 1;
    } while (cell * 2 + arc !== start || entry !== firstEntry);
    threads.push({ pieces, horizontal, vertical });
  }
  return { threads, owners };
}
export function arcPath(tile, arc) {
  if (![0, 1].includes(tile) || ![0, 1].includes(arc)) throw new RangeError('Choose one of two tile arcs.');
  return tile === 0 ? ['M 0.5 0 A 0.5 0.5 0 0 0 1 0.5', 'M 0.5 1 A 0.5 0.5 0 0 0 0 0.5'][arc]
    : ['M 0.5 0 A 0.5 0.5 0 0 1 0 0.5', 'M 1 0.5 A 0.5 0.5 0 0 1 0.5 1'][arc];
}
export const threadColor = thread => `hsl(${(thread.pieces[0] * 137.508 + 18) % 360} 58% 67%)`;
export function svg(world, { selected = null, grid = true } = {}) {
  const { threads, owners } = loops(world), { width, height, tiles } = world;
  if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected >= threads.length)) throw new RangeError('Choose an existing loop.');
  const paths = tiles.flatMap((tile, cell) => [0, 1].map(arc => {
    const id = cell * 2 + arc, owner = owners[id], opacity = selected === null || selected === owner ? 1 : 0.14;
    return `<path data-cell="${cell}" data-arc="${arc}" transform="translate(${cell % width} ${Math.floor(cell / width)})" d="${arcPath(tile, arc)}" stroke="${threadColor(threads[owner])}" opacity="${opacity}"/>`;
  })).join('');
  const lines = grid ? `<path d="${Array.from({ length: width + 1 }, (_, x) => `M${x} 0V${height}`).join(' ')} ${Array.from({ length: height + 1 }, (_, y) => `M0 ${y}H${width}`).join(' ')}" fill="none" stroke="#38424a" stroke-width=".012"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 64}" height="${height * 64}"><title>Looploom — ${threads.length} closed threads</title><rect width="${width}" height="${height}" fill="#17212b"/>${lines}<g fill="none" stroke-width=".095" stroke-linecap="round">${paths}</g></svg>`;
}
