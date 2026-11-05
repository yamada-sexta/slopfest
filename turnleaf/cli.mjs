import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { run, locate, toSVG } from './core.mjs';

const usage = `Turnleaf — a little paper, taking sides
Usage: node turnleaf/cli.mjs [FOLDS] [options]
  FOLDS         L = left half over right; R = right half over left
                Default: as many of LRR as fit; use '' for no folds
  --panels N    1, 2, 4, 8, 16, 32, or 64 numbered panels (default: 16)
  --find N      Locate and highlight an original panel in the final packets
  --trace       Include every folding frame
  --json        Emit structured JSON instead of text
  --svg PATH    Save a layer diagram; never replaces an existing file
  --help        Show this help (use alone)
Examples:
  node turnleaf/cli.mjs LRR --panels 16 --find 1
  node turnleaf/cli.mjs LR --panels 8 --trace
  node turnleaf/cli.mjs LLRR --panels 32 --svg folded.svg
All core stacks are bottom-to-top; the text and SVG read top-to-bottom.
Exit status: 0 success, 1 invalid input or I/O. No packages or network needed.`;
function integer(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || String(parsed) !== value || parsed < 1 || parsed > 64) throw new Error(`${name} needs a whole number from 1 to 64.`);
  return parsed;
}
export async function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return 0; }
  const options = {}, seen = new Set(); let folds;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      if (folds !== undefined) throw new Error('Choose exactly one L/R folding sequence.');
      folds = arg; continue;
    }
    if (!['--panels','--find','--trace','--json','--svg'].includes(arg)) throw new Error(`Unknown option ${arg}. Use --help.`);
    if (seen.has(arg)) throw new Error(`${arg} was supplied twice.`); seen.add(arg);
    if (arg === '--trace' || arg === '--json') { options[arg.slice(2)] = true; continue; }
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} needs a value.`);
    options[arg.slice(2)] = args[++i];
  }
  const panels = options.panels === undefined ? 16 : integer(options.panels, '--panels');
  // run() validates the power-of-two width as well as the folding budget.
  const journey = run(folds ?? 'LRR'.slice(0, Math.floor(Math.log2(panels))), panels);
  const state = journey.frames.at(-1), highlight = options.find === undefined ? null : integer(options.find, '--find');
  const found = highlight === null ? null : locate(state, highlight);
  if (options.svg) await writeFile(options.svg, toSVG(journey, { highlight }), { flag: 'wx' });
  if (options.json) {
    console.log(JSON.stringify({ panels, folds: journey.folds, packets: state.cells.length, layers: state.cells[0].length, cells: state.cells, found: found && { panel: highlight, ...found }, frames: options.trace ? journey.frames : undefined }, null, 2));
  } else {
    console.log(`Turnleaf · ${panels} panels · ${journey.folds || 'no folds'} · ${state.cells.length} packets × ${state.cells[0].length} layers`);
    console.log('Number = original panel; F = front up; B = back up. Rows read TOP → BOTTOM.');
    const print = frame => frame.cells.forEach((stack, i) => console.log(`  Packet ${i + 1}: ${[...stack].reverse().map(piece => `${piece.panel}${piece.face === 'front' ? 'F' : 'B'}`).join(' ')}`));
    if (options.trace) journey.frames.forEach((frame, i) => { console.log(`\n${i === 0 ? 'Start' : `After fold ${i}: ${journey.folds[i - 1]}`}`); print(frame); });
    else print(state);
    if (found) console.log(`Panel ${highlight}: packet ${found.packet}, layer ${found.fromTop} from top (${found.fromBottom} from bottom), ${found.face} up.`);
    if (options.svg) console.log('Saved the final layer diagram as SVG.');
  }
  return 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
