const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const directions = ['N', 'E', 'S', 'W'];
const masks = { a: 1, b: 2, x: 3 };
export function parseCard(card) {
  const rows = card.rows, width = rows?.[0]?.length, height = rows?.length;
  if (!Array.isArray(rows) || !width || width > 8 || height > 8 || rows.some(row => typeof row !== 'string' || row.length !== width || /[^.#/\\abxAB]/.test(row))) throw new Error('Use a rectangular card up to 8 × 8 with known tiles.');
  const mirrors = [], stamps = [], lamps = [], cells = rows.join('');
  [...cells].forEach((tile, index) => {
    const x = index % width, y = Math.floor(index / width);
    if (tile === '/' || tile === '\\') mirrors.push({ x, y, index, slash: tile === '/' });
    if (masks[tile]) stamps.push({ x, y, index, mask: masks[tile] });
    if (tile === 'A' || tile === 'B') {
      const dir = directions.indexOf(card.directions?.[tile]);
      if (dir < 0 || lamps.some(lamp => lamp.id === tile)) throw new Error('Each lamp needs one unique id and a compass direction.');
      lamps.push({ id: tile, x, y, dir, mask: tile === 'A' ? 1 : 2 });
    }
  });
  if (!mirrors.length || mirrors.length > 10 || !stamps.length || !lamps.length) throw new Error('A card needs 1–10 mirrors, stamps, and at least one lamp.');
  if (stamps.some(stamp => (lamps.reduce((mask, lamp) => mask | lamp.mask, 0) & stamp.mask) !== stamp.mask)) throw new Error('A stamp needs an available lamp color.');
  return { ...card, width, height, cells, mirrors, stamps, lamps, initial: mirrors.map(mirror => mirror.slash) };
}
function checkTurns(card, turns) {
  if (!Array.isArray(turns) || turns.length !== card.mirrors.length || [...turns].some(turn => typeof turn !== 'boolean')) throw new Error('Give every mirror a slash or backslash orientation.');
}
export function turnMirror(card, turns, index) {
  checkTurns(card, turns);
  if (!Number.isInteger(index) || index < 0 || index >= turns.length) throw new Error('Choose a mirror on this card.');
  return turns.map((turn, i) => i === index ? !turn : turn);
}
export function trace(card, turns = card.initial) {
  checkTurns(card, turns);
  const received = Array(card.cells.length).fill(0), mirrorAt = new Map(card.mirrors.map((mirror, i) => [mirror.index, i]));
  const rays = card.lamps.map(lamp => {
    let { x, y, dir } = lamp;
    const seen = new Set(), points = [{ x: x + 0.5, y: y + 0.5 }];
    let ending;
    for (;;) {
      const key = `${x},${y},${dir}`;
      if (seen.has(key)) { ending = 'loop'; break; }
      seen.add(key); received[y * card.width + x] |= lamp.mask;
      const [dx, dy] = vectors[dir], nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= card.width || ny < 0 || ny >= card.height || card.cells[ny * card.width + nx] === '#') {
        points.push({ x: x + 0.5 + dx * 0.5, y: y + 0.5 + dy * 0.5 }); ending = 'edge'; break;
      }
      x = nx; y = ny; points.push({ x: x + 0.5, y: y + 0.5 });
      const mirror = mirrorAt.get(y * card.width + x);
      if (mirror !== undefined) dir = turns[mirror] ? [1, 0, 3, 2][dir] : [3, 2, 1, 0][dir];
    }
    return { ...lamp, points, ending, visited: seen.size };
  });
  const stamps = card.stamps.map(stamp => ({ ...stamp, received: received[stamp.index], lit: (received[stamp.index] & stamp.mask) === stamp.mask }));
  return { rays, stamps, lit: stamps.filter(stamp => stamp.lit).length, solved: stamps.every(stamp => stamp.lit) };
}
export function solve(card, turns = card.initial) {
  checkTurns(card, turns);
  let best = null, solutions = 0;
  for (let bits = 0; bits < 2 ** turns.length; bits++) {
    const candidate = turns.map((_, i) => Boolean(bits & (1 << i)));
    if (!trace(card, candidate).solved) continue;
    solutions++;
    const flips = candidate.flatMap((turn, i) => turn !== turns[i] ? [i] : []);
    if (!best || flips.length < best.flips.length) best = { turns: candidate, flips };
  }
  return best ? { ...best, solutions } : null;
}
