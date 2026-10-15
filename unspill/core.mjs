export const WIDTH = 96;
export const HEIGHT = 64;
export const COLORS = Object.freeze(['#14211c', '#9ddbd8', '#f3ad80', '#bca5e8']);

export function createWorld(width = WIDTH, height = HEIGHT, cells) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 2 && n <= 160 && n % 2 === 0)) {
    throw new Error('World dimensions must be even integers from 2 to 160.');
  }
  const values = cells === undefined ? null : Array.from(cells);
  if (values && (values.length !== width * height || values.some(n => !Number.isInteger(n) || n < 0 || n >= COLORS.length))) {
    throw new Error('A world needs one ink value (0–3) per cell.');
  }
  const data = values ? Uint8Array.from(values) : new Uint8Array(width * height);
  return { width, height, cells: data, scratch: new Uint8Array(data.length), tick: 0 };
}

// Count is unchanged by rotation. The same position + count therefore selects
// the same turn in either time direction, without remembering previous grids.
function turns(x, y, count) {
  if (count === 0) return 0;
  if (count === 2) return 2;
  const hash = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(count, 83492791);
  return (hash >>> 5) & 1 ? 1 : 3;
}

export function step(world, direction = 1) {
  if (direction !== 1 && direction !== -1) throw new Error('Time direction must be 1 or -1.');
  if (direction === -1 && world.tick === 0) return false;
  if (!Number.isSafeInteger(world.tick + direction)) throw new Error('The step counter is full. Return to the origin.');
  const phase = (direction === 1 ? world.tick : world.tick - 1) % 2;
  const { width, height, cells, scratch } = world;
  for (let y = phase; y < height; y += 2) {
    const below = (y + 1) % height;
    for (let x = phase; x < width; x += 2) {
      const right = (x + 1) % width;
      const indices = [y * width + x, y * width + right, below * width + right, below * width + x];
      const count = indices.reduce((sum, index) => sum + Number(cells[index] !== 0), 0);
      const turn = turns(x, y, count);
      const shift = direction === 1 ? turn : (4 - turn) % 4;
      for (let i = 0; i < 4; i++) scratch[indices[(i + shift) % 4]] = cells[indices[i]];
    }
  }
  world.cells = scratch;
  world.scratch = cells;
  world.tick += direction;
  return true;
}

export function inventory(cells) {
  const counts = [0, 0, 0, 0];
  for (const cell of cells) counts[cell]++;
  return counts;
}

// Editing establishes a new time origin. Unspill then returns to this new image.
export function paint(world, x, y, color, radius = 1) {
  if (![x, y, color, radius].every(Number.isInteger) || color < 0 || color > 3 || radius < 0 || radius > 6) {
    throw new Error('Use integer coordinates, ink 0–3, and a brush radius from 0 to 6.');
  }
  let changed = false;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const px = x + dx, py = y + dy;
    if (dx * dx + dy * dy > radius * radius || px < 0 || px >= world.width || py < 0 || py >= world.height) continue;
    const index = py * world.width + px;
    if (world.cells[index] !== color) { world.cells[index] = color; changed = true; }
  }
  if (changed) world.tick = 0;
  return changed;
}

export function samePicture(a, b) {
  return a.length === b.length && a.every((cell, index) => cell === b[index]);
}

export function toSVG(world) {
  const paths = COLORS.slice(1).map((color, index) => {
    let path = '';
    world.cells.forEach((cell, i) => {
      if (cell === index + 1) path += `M${i % world.width},${Math.floor(i / world.width)}h1v1h-1z`;
    });
    return `<path fill="${color}" d="${path}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${world.width} ${world.height}" shape-rendering="crispEdges"><title>Unspill at step ${world.tick}</title><rect width="${world.width}" height="${world.height}" fill="${COLORS[0]}"/>${paths}</svg>`;
}
