import { writeFile } from 'node:fs/promises';
import { run, analyze, toSVG } from './core.mjs';

const specimen = '((()())(())) (()())';
const help = `Twigfall — the last branch wins
Usage: node twigfall/cli.mjs [GROVE] [options]
  GROVE           Parenthesis pairs are branches; nested pairs grow above them
                  Default: ${specimen}
  --cuts IDS      Play a comma-separated list of branch IDs, in order
  --trace         Show each cut and all the branches that fall with it
  --json          Emit the grove, frames, and exact strategy as JSON
  --svg FILE      Save a diagram, refusing to overwrite an existing file
  --help          Show this help on its own

Two players alternate cutting one standing branch. Its descendants fall too.
The last player to cut wins. IDs are assigned to opening parentheses, starting
at 1, and never change after cuts. Use up to 24 branches.
  node twigfall/cli.mjs '(()())' --cuts 2 --trace
  node twigfall/cli.mjs '()()' --json
An empty grove is allowed. Exit codes: 0 success, 1 invalid input or I/O error.`;

function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(help); return null; }
  const options = new Map();
  let source;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!flag.startsWith('--')) {
      if (source !== undefined) throw new Error('Quote the grove as one argument.');
      source = flag; continue;
    }
    if (options.has(flag)) throw new Error(`Duplicate option ${flag}.`);
    if (flag === '--trace' || flag === '--json') { options.set(flag, true); continue; }
    if (!['--cuts', '--svg'].includes(flag)) throw new Error(`Unknown option ${flag}. Use --help.`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
    options.set(flag, value);
  }
  const cutText = options.get('--cuts');
  if (cutText !== undefined && !/^[1-9][0-9]*(?:,[1-9][0-9]*)*$/.test(cutText)) throw new Error('--cuts needs comma-separated positive integers.');
  const journey = run(source ?? specimen, cutText === undefined ? [] : cutText.split(',').map(Number));
  const final = journey.frames.at(-1), report = analyze(final);
  const receipt = { ...journey, strategy: report };
  return { journey, options, receipt };
}

try {
  const result = main(process.argv.slice(2));
  if (result) {
    const { journey, options, receipt } = result;
    if (options.has('--svg')) await writeFile(options.get('--svg'), toSVG(journey), { flag: 'wx' });
    if (options.has('--json')) console.log(JSON.stringify(receipt, null, 2));
    else {
      const final = journey.frames.at(-1), report = receipt.strategy;
      console.log('Twigfall · the last branch wins');
      console.log(`Grove: ${journey.source || '(empty)'}`);
      console.log('IDs follow the opening parentheses from left to right.');
      if (options.has('--trace')) journey.cuts.forEach((id, i) => {
        const after = journey.frames[i + 1];
        const fallen = journey.frames[i].active.filter(branch => !after.active.includes(branch));
        console.log(`  ${i + 1}. Cut ${id}: fallen {${fallen.join(', ')}}; ${after.active.length} standing.`);
      });
      console.log('Standing grove:');
      if (!final.active.length) console.log('  (empty)');
      for (const id of final.active) {
        let depth = 0, parent = final.branches[id - 1].parent;
        while (parent) { depth++; parent = final.branches[parent - 1].parent; }
        console.log(`  ${'  '.repeat(depth)}${id}`);
      }
      console.log(`Position: ${report.outcome}; nimber ${report.nimber}.`);
      if (report.outcome === 'winning') console.log(`Winning cuts: ${report.winningCuts.join(', ')}. Suggested cut: ${report.recommendation}.`);
      if (report.outcome === 'losing') console.log(`No winning cut against perfect play. Suggested legal cut: ${report.recommendation}.`);
      if (report.outcome === 'finished') console.log('No branches remain. The player to move loses.');
      if (options.has('--svg')) console.log('Saved the SVG grove.');
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
