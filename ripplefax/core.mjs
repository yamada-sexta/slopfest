export const WIDTH = 96, HEIGHT = 64;
export const SCENES = ['A letter through two slits', 'Two pebbles in company', 'Around the corner'];
const at = (world, x, y) => y * world.width + x;
function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || width > 128 || height > 128) throw new RangeError('Use a tank from 8 to 128 cells on each side.');
}
export function tank(width = WIDTH, height = HEIGHT) {
  dimensions(width, height);
  const world = { width, height, tick: 0, current: new Float64Array(width * height), previous: new Float64Array(width * height), scratch: new Float64Array(width * height), walls: new Uint8Array(width * height), sources: [] };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!x || !y || x === width - 1 || y === height - 1) world.walls[at(world, x, y)] = 1;
  return world;
}
export function paint(world, x, y, tool = 'ripple') {
  if (!['ripple', 'wall', 'erase'].includes(tool)) throw new RangeError('Choose ripple, wall, or erase.');
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || y < 1 || x >= world.width - 1 || y >= world.height - 1) return false;
  if (tool !== 'ripple') {
    const i = at(world, x, y); world.walls[i] = tool === 'wall' ? 1 : 0; world.current[i] = 0; world.previous[i] = 0; world.scratch[i] = 0; return true;
  }
  if (world.walls[at(world, x, y)]) return false;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const px = x + dx, py = y + dy;
    if (px < 1 || py < 1 || px >= world.width - 1 || py >= world.height - 1 || dx * dx + dy * dy > 4) continue;
    const i = at(world, px, py); if (world.walls[i]) continue;
    // A bounded displacement, with no artificial initial velocity.
    const value = Math.min(2, world.current[i] + Math.exp(-(dx * dx + dy * dy) / 2));
    const shift = value - world.current[i]; world.current[i] = value; world.previous[i] += shift;
  }
  return true;
}
export function line(world, from, to, tool) {
  if (![from.x, from.y, to.x, to.y].every(Number.isInteger) || [from, to].some(p => p.x < 0 || p.y < 0 || p.x >= world.width || p.y >= world.height)) throw new RangeError('Keep brush endpoints inside the tank.');
  let { x, y } = from;
  const dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y), sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
  let error = dx + dy, changed = false;
  for (;;) {
    changed = paint(world, x, y, tool) || changed; if (x === to.x && y === to.y) break;
    const twice = 2 * error; if (twice >= dy) { error += dy; x += sx; } if (twice <= dx) { error += dx; y += sy; }
  }
  return changed;
}
export function clearWaves(world) { world.current.fill(0); world.previous.fill(0); world.scratch.fill(0); world.tick = 0; }
export function advance(world, { driven = true, period = 24, opposite = false } = {}) {
  if (!Number.isInteger(period) || period < 12 || period > 60 || typeof driven !== 'boolean' || typeof opposite !== 'boolean') throw new RangeError('Use a 12–60 tick period and boolean source switches.');
  const { width: w, height: h, current, previous, scratch, walls } = world;
  scratch.fill(0);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (walls[i]) continue;
    const laplacian = current[i - 1] + current[i + 1] + current[i - w] + current[i + w] - 4 * current[i];
    scratch[i] = 1.982 * current[i] - 0.982 * previous[i] + 0.18 * laplacian;
  }
  if (driven) world.sources.forEach((source, index) => {
    const i = at(world, source.x, source.y);
    if (!walls[i]) scratch[i] += 0.09 * Math.sin(2 * Math.PI * world.tick / period) * (index === 1 && opposite ? -1 : 1);
  });
  world.previous = current; world.current = scratch; world.scratch = previous; world.tick++;
  return world;
}
export function scene(index) {
  if (!Number.isInteger(index) || index < 0 || index >= SCENES.length) throw new RangeError('Choose one of the three scenes.');
  const world = tank();
  if (index === 0) {
    for (let y = 1; y < HEIGHT - 1; y++) if (Math.abs(y - 23) > 2 && Math.abs(y - 41) > 2) for (let x = 47; x <= 48; x++) paint(world, x, y, 'wall');
    world.sources = [{ x: 22, y: 32 }];
  } else if (index === 1) world.sources = [{ x: 34, y: 23 }, { x: 34, y: 41 }];
  else {
    for (let y = 1; y <= 48; y++) paint(world, 46, y, 'wall');
    for (let x = 46; x < WIDTH - 1; x++) paint(world, x, 18, 'wall');
    world.sources = [{ x: 22, y: 32 }];
  }
  for (let tick = 0; tick < 360; tick++) advance(world);
  return world;
}
export function pixels(world) {
  const data = new Uint8ClampedArray(world.width * world.height * 4), zero = [20, 33, 30], warm = [245, 187, 127], cool = [126, 200, 210], barrier = [165, 181, 151];
  for (let i = 0; i < world.current.length; i++) {
    const value = world.current[i], tint = value >= 0 ? warm : cool, amount = Math.pow(1 - Math.exp(-Math.abs(value) * 8), 0.45);
    for (let channel = 0; channel < 3; channel++) data[i * 4 + channel] = world.walls[i] ? barrier[channel] : zero[channel] + (tint[channel] - zero[channel]) * amount;
    data[i * 4 + 3] = 255;
  }
  return data;
}
