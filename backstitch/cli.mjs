import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { pair, centered, roundTrip, toSVG, LIMITS } from './core.mjs';

const usage = `Backstitch — a small machine for coming home
Usage: node backstitch/cli.mjs [options]
  --rule N       Elementary rule, 0–255 (default: 90)
  --width N      Ring width, 1–160 (default: 65; inferred from --seed)
  --steps N      Steps outward, then the same number home, 0–256 (default: 48)
  --seed BITS    Current row, binary digits; default is one centered stitch
  --past BITS    Previous row, same width; default is all zeroes
  --json         Print both complete journeys as structured JSON
  --svg PATH     Save a two-panel tapestry; never replaces an existing file
  --help         Show this help (use alone)
Examples:
  node backstitch/cli.mjs --rule 110 --width 79 --steps 64
  node backstitch/cli.mjs --seed 0010100 --past 1000001 --steps 16 --json
  node backstitch/cli.mjs --svg tapestry.svg
The return journey uses only the final two rows and the rule, not the outward log.
Exit status: 0 success, 1 invalid options or I/O. No terminal escape sequences.`;

function number(value, max, name, min = 0) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || String(parsed) !== value || parsed < min || parsed > max) throw new Error(`${name} needs a whole number from ${min} to ${max}.`);
  return parsed;
}
export async function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return 0; }
  const options = {}, seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!['--rule', '--width', '--steps', '--seed', '--past', '--json', '--svg'].includes(arg)) throw new Error(`Unknown option ${arg}. Use --help for instructions.`);
    if (seen.has(arg)) throw new Error(`${arg} was supplied twice.`);
    seen.add(arg);
    if (arg === '--json') { options.json = true; continue; }
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} needs a value.`);
    options[arg.slice(2)] = args[++i];
  }
  const width = options.width === undefined ? options.seed?.length ?? 65 : number(options.width, LIMITS.width, '--width', 1);
  const initial = centered(width);
  const state = pair(options.past ?? initial.past, options.seed ?? initial.current);
  if (state.current.length !== width) throw new Error('--seed must match --width.');
  const rule = options.rule === undefined ? 90 : number(options.rule, 255, '--rule');
  const steps = options.steps === undefined ? 48 : number(options.steps, LIMITS.steps, '--steps');
  const trip = roundTrip(state, { rule, steps });
  if (options.svg) await writeFile(options.svg, toSVG(trip), { flag: 'wx' });
  if (options.json) console.log(JSON.stringify(trip, null, 2));
  else {
    console.log(`Backstitch · rule ${rule} · ${width} cells · ${steps} steps out and home`);
    console.log('Time   Outward' + ' '.repeat(Math.max(1, width - 7)) + '  Homeward   Time');
    for (let i = 0; i <= steps; i++) {
      const ink = row => row.replaceAll('0', '.').replaceAll('1', '#');
      console.log(`${String(i).padStart(4)}   ${ink(trip.outward[i].current)}  ${ink(trip.homeward[i].current)}   ${String(steps - i).padStart(4)}`);
    }
    console.log(`Both starting rows recovered: ${trip.recovered ? 'YES' : 'NO'}. The return used only two rows and the rule.`);
    if (options.svg) console.log('Saved the two-panel SVG tapestry.');
  }
  return 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
