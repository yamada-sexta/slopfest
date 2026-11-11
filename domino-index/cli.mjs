import { catalog, rectangle } from './core.mjs';

const usage = `Domino Index
Usage: node domino-index/cli.mjs [options]
  --size WxH       Fill a rectangle (default 4x4)
  --board PATTERN  Custom rows separated by /, with . for open and # for holes
  --index N        Show tiling N, counted from 1 (default: first available)
  --json           Emit exact counts and tile IDs as JSON
  --help           Show this help on its own

Boards can be 1–10 columns wide and 1–20 rows tall. Use --size or --board.
  node domino-index/cli.mjs --size 4x4 --index 17
  node domino-index/cli.mjs --board '..../.##./.##./....' --index 2`;

function draw(tiles) {
  const lines = [];
  const width = tiles[0].length;
  lines.push('+' + '---+'.repeat(width));
  tiles.forEach((row, y) => {
    const body = row.map((id, x) => {
      const edge = id !== null && id === row[x + 1] ? ' ' : '|';
      return (id === null ? '###' : '   ') + edge;
    });
    const floor = row.map((id, x) => id !== null && id === tiles[y + 1]?.[x] ? '   ' : '---');
    lines.push('|' + body.join(''), '+' + floor.join('+') + '+');
  });
  return lines.join('\n');
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage);
    return;
  }
  const options = new Map();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (options.has(flag)) throw new Error(`${flag} was supplied twice.`);
    if (flag === '--json') {
      options.set(flag, true);
      continue;
    }
    if (!['--size', '--board', '--index'].includes(flag)) {
      throw new Error(`Unknown option ${flag}. Use --help.`);
    }
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
    options.set(flag, value);
  }
  if (options.has('--size') && options.has('--board')) {
    throw new Error('Choose either --size or --board.');
  }
  let rows;
  if (options.has('--board')) {
    rows = options.get('--board').split('/');
  } else {
    const size = options.get('--size') ?? '4x4';
    if (!/^[1-9][0-9]?x[1-9][0-9]?$/.test(size)) throw new Error('--size needs dimensions such as 4x4.');
    rows = rectangle(...size.split('x').map(Number));
  }
  const { count, at } = catalog(rows);
  const requested = options.get('--index');
  if (requested !== undefined && !/^[1-9][0-9]*$/.test(requested)) {
    throw new Error('--index needs a positive decimal integer.');
  }
  const index = requested === undefined ? (count > 0n ? 1n : null) : BigInt(requested);
  if (index !== null && index > count) {
    throw new Error(count === 0n ? 'This board has no complete tilings.' : `Choose a tiling number from 1 to ${count}.`);
  }
  const tiles = index === null ? null : at(index);
  if (options.has('--json')) {
    console.log(JSON.stringify({
      board: rows,
      count: String(count),
      index: index === null ? null : String(index),
      tiles,
    }, null, 2));
    return;
  }
  console.log(`Domino Index · ${rows[0].length} × ${rows.length} · ${count} ${count === 1n ? 'tiling' : 'tilings'}`);
  if (tiles === null) {
    console.log('This board has no complete tilings.');
  } else {
    console.log(`Tiling ${index} of ${count}\n${draw(tiles)}`);
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
