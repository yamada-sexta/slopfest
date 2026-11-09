import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fraction, shoot, toSVG } from './core.mjs';

const usage = `Bankshot — one ball, four rails
Usage: node bankshot/cli.mjs [options]
  --table WxH       Table dimensions, each 2–24 (default 12x9)
  --from X,Y        Integer start strictly inside the table
                    Default: one quarter of each side, rounded down to at least 1
  --velocity X,Y    Integer components from -12 to 12 (default 2,1)
  --trace           Print every event and its exact coordinates
  --json            Emit the full trace as integers with a common scale
  --svg PATH        Save a diagram to a new file
  --help            Show this help (use alone)

X increases east, Y south. The shot stops at a corner or a full return.
Examples:
  node bankshot/cli.mjs --trace
  node bankshot/cli.mjs --from 4,2 --svg pocket.svg
  node bankshot/cli.mjs --table 8x6 --velocity -1,0 --json`;

function pair(value, separator, flag) {
  const parts = value.split(separator);
  if (parts.length !== 2 || parts.some(part => String(Number(part)) !== part || !Number.isInteger(Number(part)))) {
    throw new Error(`${flag} needs two integers separated by "${separator}".`);
  }
  return parts.map(Number);
}

export async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage);
    return;
  }
  const options = new Map();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (options.has(flag)) throw new Error(`${flag} was supplied twice.`);
    if (flag === '--json' || flag === '--trace') {
      options.set(flag, true);
      continue;
    }
    if (!['--table', '--from', '--velocity', '--svg'].includes(flag)) {
      throw new Error(`Unknown option ${flag}. Use --help.`);
    }
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
    options.set(flag, value);
  }

  const [width, height] = options.has('--table') ? pair(options.get('--table'), 'x', '--table') : [];
  const start = options.has('--from') ? pair(options.get('--from'), ',', '--from') : undefined;
  const velocity = options.has('--velocity') ? pair(options.get('--velocity'), ',', '--velocity') : undefined;
  const shot = shoot({ width, height, start, velocity });
  if (options.has('--svg')) await writeFile(options.get('--svg'), toSVG(shot), { flag: 'wx' });
  if (options.has('--json')) {
    console.log(JSON.stringify(shot, null, 2));
    return;
  }

  const { scale, banks, points } = shot;
  const last = points.at(-1);
  const show = n => fraction(n, scale);
  console.log(`Bankshot · ${shot.width} × ${shot.height} · start (${shot.start.join(', ')}) · velocity (${shot.velocity.join(', ')})`);
  const ending = shot.end === 'return'
    ? 'Returns with the original heading'
    : `Drops into the ${last.walls.join('-')} pocket`;
  console.log(`${ending} at t=${show(last.tick)} after ${banks} ${banks === 1 ? 'bank' : 'banks'}.`);
  if (options.has('--trace')) {
    for (const [i, point] of points.entries()) {
      const event = point.walls.join('-') || (i === 0 ? 'start' : 'return');
      console.log(`  t=${show(point.tick)}  (${show(point.x)}, ${show(point.y)})  ${event}`);
    }
  }
  if (options.has('--svg')) console.log('Saved the shot diagram as SVG.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
