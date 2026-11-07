import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, forge, toSVG } from './core.mjs';

const labels = ['A', 'B', 'C'];
const usage = `Slydice — the advantage of choosing second
Usage: node slydice/cli.mjs [options]
  --faces N      Exhaustively forge 3, 4, or 5 faces per die (default: 3)
                 Partition numbers 1 through 3N; maximize the weakest cycle edge
  --dice SPEC    Analyze your own dice instead: '2,4,9;1,6,8;3,5,7'
                 Three equally sized dice, 1–8 faces each, integers 0–99
                 Repeated numbers allowed. Mutually exclusive with --faces
  --pick A|B|C   Find the strongest >50% counterpick to this die
  --json        Emit exact counts and structured data instead of text
  --svg PATH    Save every face pairing as SVG; never replaces an existing file
  --help        Show this help (use alone)
Examples:
  node slydice/cli.mjs --pick A
  node slydice/cli.mjs --faces 5 --svg slydice.svg
  node slydice/cli.mjs --dice '2,4,9;1,6,8;3,5,7' --json
Fair independent rolls, higher number wins. Ties are counted, never rerolled.
Each face is equally likely, including repeated labels. Counts are exact.
Exit status: 0 success, 1 invalid input or I/O. Node.js 20+, no packages needed.`;

function parseDice(spec) {
  if (spec.length > 100 || !/^[0-9,;]+$/.test(spec)) throw new Error('Use three semicolon-separated dice with comma-separated face numbers.');
  return spec.split(';').map(part => part.split(',').map(value => {
    if (!/^(0|[1-9][0-9]?)$/.test(value)) throw new Error('Face labels must be whole numbers 0–99, without leading zeroes.');
    return Number(value);
  }));
}
export async function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return 0; }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!['--faces', '--dice', '--pick', '--json', '--svg'].includes(arg)) throw new Error(`Unknown option ${arg}. Use --help.`);
    const key = arg.slice(2);
    if (Object.hasOwn(options, key)) throw new Error(`${arg} was supplied twice.`);
    if (arg === '--json') { options.json = true; continue; }
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} needs a value.`);
    options[key] = args[++i];
  }
  if (options.dice !== undefined && options.faces !== undefined) throw new Error('Choose --dice or --faces, not both.');
  if (options.faces !== undefined && !/^[345]$/.test(options.faces)) throw new Error('--faces must be 3, 4, or 5.');
  if (options.pick !== undefined && !labels.includes(options.pick)) throw new Error('--pick must be A, B, or C.');
  const search = options.dice === undefined ? forge(Number(options.faces ?? 3)) : null;
  const analysis = search ? search.analysis : analyze(parseDice(options.dice));
  const selected = options.pick === undefined ? null : labels.indexOf(options.pick);
  const counter = selected === null ? null : analysis.counterpicks[selected];
  const recommendation = selected === null ? null : { picked: options.pick, counter: counter === null ? null : labels[counter], match: counter === null ? null : analysis.matches[counter][selected] };
  if (options.svg) await writeFile(options.svg, toSVG(analysis), { flag: 'wx' });
  if (options.json) {
    console.log(JSON.stringify({ mode: search ? 'forge' : 'custom', search: search && { ...search, analysis: undefined }, analysis, recommendation }, null, 2));
  } else {
    console.log(`Slydice · ${analysis.faces} face${analysis.faces === 1 ? '' : 's'} per die · exact counts, no simulation`);
    if (search) {
      console.log(`Checked ${search.partitions} unlabeled partitions of 1–${analysis.faces * 3}; ${search.cycles} have a strict-majority cycle.`);
      console.log(`Best weakest edge: ${search.bestWins}/${search.total}; ${search.bestCount} partitions achieve it. Showing the first in canonical search order.`);
    }
    analysis.dice.forEach((die, i) => console.log(`  ${labels[i]}: ${die.join(' ')}  (mean ${(die.reduce((a, b) => a + b, 0) / die.length).toFixed(2)})`));
    console.log('\nWin counts: row die rolls higher than column die. Same face counts = same denominators.');
    console.log('          A       B       C');
    analysis.matches.forEach((row, i) => console.log(`  ${labels[i]}  ${row.map((m, j) => (i === j ? '—' : `${m.wins}/${m.total}`).padStart(8)).join('')}`));
    const cycle = analysis.cycle;
    console.log(cycle ? `\n${[...cycle, cycle[0]].map(i => labels[i]).join(' beats ')}. Every edge wins more than half of all pairings.` : '\nNo strict-majority cycle. A cycle requires >50% wins on all three edges.');
    if (recommendation) console.log(counter === null ? `You picked ${options.pick}: no other die wins more than 50% of all pairings against it.` : `You picked ${options.pick}: choose ${labels[counter]}, which wins ${recommendation.match.wins}/${recommendation.match.total} pairings (${(100 * recommendation.match.wins / recommendation.match.total).toFixed(1)}%).`);
    console.log('Fair, independent rolls. Higher number wins; ties are counted and never rerolled.');
    if (options.svg) console.log('Saved the pairing diagram as SVG.');
  }
  return 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
