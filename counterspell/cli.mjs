import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse, state, run, invert, format, LIMITS } from './core.mjs';
const usage = `Counterspell — four bytes, nothing lost
Usage: node counterspell/cli.mjs spell.spell [options]
  --state a,b,c,d   Four decimal bytes (default: 0,0,0,0)
  --reverse         Run the inverse spell
  --trace           Show each operation and its resulting state
  --json            Emit machine-readable results (including trace if requested)
  --inverse         Print an executable inverse spell instead of running
  --help            Show this help
Examples:
  node counterspell/cli.mjs counterspell/examples/carousel.spell --state 1,2,4,8 --trace
  node counterspell/cli.mjs counterspell/examples/mixer.spell --inverse`;
export async function main(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) { console.log(usage); return; }
  let path, values = [0, 0, 0, 0], reverse = false, trace = false, json = false, inverse = false;
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) { if (path) throw new Error('Choose exactly one spell file.'); path = arg; continue; }
    if (seen.has(arg)) throw new Error(`Option ${arg} was supplied twice.`); seen.add(arg);
    if (arg === '--state') {
      const text = args[++i]; if (!/^(0|[1-9]\d{0,2})(,(0|[1-9]\d{0,2})){3}$/.test(text ?? '')) throw new Error('Use --state a,b,c,d with four decimal bytes.');
      values = state(text.split(',').map(Number));
    } else if (arg === '--reverse') reverse = true;
    else if (arg === '--trace') trace = true;
    else if (arg === '--json') json = true;
    else if (arg === '--inverse') inverse = true;
    else throw new Error(`Unknown option ${arg}. Use --help for instructions.`);
  }
  if (!path) throw new Error('Choose a spell file.');
  if (inverse && (reverse || trace || json || seen.has('--state'))) throw new Error('--inverse prints source; use it without execution options.');
  if ((await stat(path)).size > LIMITS.source) throw new Error('Keep source to 16,000 bytes.');
  const instructions = parse(await readFile(path, 'utf8'));
  if (inverse) { console.log(invert(instructions).map(format).join('\n')); return; }
  const result = run(instructions, values, { reverse, trace });
  if (json) { console.log(JSON.stringify({ direction: reverse ? 'reverse' : 'forward', initial: values, ...result }, null, 2)); return; }
  const row = bytes => bytes.map(value => String(value).padStart(3)).join('  ');
  console.log(`Counterspell · ${reverse ? 'reverse' : 'forward'} · ${result.steps} operations\n                         a    b    c    d`);
  if (trace) result.history.forEach((entry, i) => console.log(`${String(i).padStart(4)}  ${(entry.instruction ?? 'start').padEnd(17)}${row(entry.values)}`));
  else { console.log(`      ${'before'.padEnd(17)}${row(values)}`); console.log(`      ${'after'.padEnd(17)}${row(result.values)}`); }
  console.log(`\nFinal state: ${result.values.join(',')}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
