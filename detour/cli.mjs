import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { LIMITS, DIRECTIONS, parse, run, encodeInput, escapedBytes, toSVG } from './core.mjs';
const usage = `Detour — code takes the long way home
Usage: node detour/cli.mjs map.tour [options]
  --input TEXT   Feed up to 1,024 UTF-8 bytes to comma instructions
  --steps N      Step budget, 1–100000 (default: 20000)
  --trace        Print every executed tile, cursor, byte, and emission
  --json         Emit structured results; --trace includes the full history
  --raw          Write emitted bytes unchanged, without a summary or newline
  --svg PATH     Save the execution route as SVG; never replaces an existing file
  --help         Show this help (use alone)
Examples:
  node detour/cli.mjs detour/examples/countdown.tour --trace
  node detour/cli.mjs detour/examples/echo.tour --input 'take the scenic route' --raw
  node detour/cli.mjs detour/examples/forever.tour --json
Exit status: 0 halted/escaped, 2 cycle/budget stop, 1 invalid source/options/I/O.`;
const required = (args, index, option) => {
  const value = args[index]; if (value === undefined || value.startsWith('--')) throw new Error(`${option} needs a value.`); return value;
};
export async function main(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) { console.log(usage); return 0; }
  let path, input = new Uint8Array(), steps = 20000, trace = false, json = false, raw = false, svg;
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) { if (path) throw new Error('Choose exactly one map file.'); path = arg; continue; }
    if (seen.has(arg)) throw new Error(`Option ${arg} was supplied twice.`); seen.add(arg);
    if (arg === '--input') {
      if (args[i + 1] === undefined) throw new Error('--input needs a value.');
      input = encodeInput(args[++i]);
    } else if (arg === '--steps') {
      const value = required(args, ++i, arg);
      if (!/^[1-9]\d{0,5}$/.test(value) || Number(value) > LIMITS.steps) throw new Error('Use --steps with a whole number from 1 to 100000.');
      steps = Number(value);
    } else if (arg === '--svg') svg = required(args, ++i, arg);
    else if (arg === '--trace') trace = true;
    else if (arg === '--json') json = true;
    else if (arg === '--raw') raw = true;
    else throw new Error(`Unknown option ${arg}. Use --help for instructions.`);
  }
  if (!path) throw new Error('Choose a map file.');
  if (raw && (trace || json)) throw new Error('--raw writes bytes; use it without --trace or --json.');
  const info = await stat(path);
  if (!info.isFile() || info.size > LIMITS.source) throw new Error('Choose a regular map file of at most 8,192 bytes.');
  const program = parse(await readFile(path, 'utf8')), result = run(program, { input, steps, trace: trace || Boolean(svg) });
  if (svg) await writeFile(svg, toSVG(program, result), { flag: 'wx' });
  const unfinished = !['halted', 'escaped'].includes(result.status);
  if (raw) {
    process.stdout.write(Buffer.from(result.output));
    if (unfinished) console.error(`Detour stopped: ${result.status} after ${result.steps} steps.${result.cycle ? ` Cycle prefix: ${result.cycle.start} steps; period ${result.cycle.period}.` : ''}`);
  } else if (json) {
    console.log(JSON.stringify({ width: program.width, height: program.height, ...result, history: trace ? result.history : undefined, text: new TextDecoder().decode(Uint8Array.from(result.output)) }, null, 2));
  } else {
    console.log(`Detour · ${program.width} × ${program.height} · ${result.status} · ${result.steps} steps`);
    console.log(`+${'-'.repeat(program.width)}+\n${program.rows.map(row => `|${row}|`).join('\n')}\n+${'-'.repeat(program.width)}+`);
    if (trace) for (const entry of result.history) {
      const point = state => `${state.x + 1},${state.y + 1} ${DIRECTIONS[state.direction][0].toUpperCase()}`;
      console.log(`${String(entry.step).padStart(5, '0')}  (${point(entry.before)}) ${entry.op === ' ' ? '·' : entry.op} → (${point(entry.after)})  byte ${entry.before.byte}→${entry.after.byte}  input ${entry.after.inputAt}  out "${escapedBytes(entry.emitted)}"`);
    }
    console.log(`Output: "${escapedBytes(result.output)}"\nPocket: ${result.cursor.byte} · input consumed: ${result.cursor.inputAt}/${input.length} bytes`);
    if (result.cycle) console.log(`Proven cycle: starts before step ${result.cycle.start + 1}, period ${result.cycle.period} steps. Each repeat emits "${escapedBytes(result.cycle.output)}".`);
    else if (result.status === 'step-limit') console.log('The step budget ran out. This is not a proof of a loop.');
    else if (result.status === 'output-limit') console.log('The next emission would exceed 8,192 output bytes. That tile has not executed.');
    else if (result.status === 'escaped') console.log('The cursor left the map. Nothing wraps around.');
    if (svg) console.log('Saved the execution route as SVG.');
  }
  return unfinished ? 2 : 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
