import { readFile, writeFile } from 'node:fs/promises';
import { compile, run, toSVG } from './core.mjs';
import { specimens } from './specimens.mjs';

const help = `Tailspin — a tiny queue language
Usage: node tailspin/cli.mjs [fall|orbit|bloom] [options]
  --program FILE  Read custom rules instead of a specimen; requires --seed
  --seed WORD     Initial lowercase queue; an empty string is allowed
  --delete N      Letters removed per step, from 1 to 8 (default 2)
  --steps N       Step budget, from 0 to 2000 (default 100)
  --limit N       Maximum queue length, from 1 to 512 (default 256)
  --trace         Print every frame and the rule used to reach it
  --json          Emit a full, exact run receipt
  --svg FILE      Save a diagram; never replace an existing file
  --help          Show this help on its own

Rules: a -> ab (append ab), or a -> - (append nothing). One rule per line.
Blank lines and # comments are allowed. Every emitted letter needs a rule.
Read the first letter, remove N letters, then append that first letter's rule.
Fewer than N letters halts. Exact queue repetition proves a cycle.
Default specimen: fall. SVGs show at most 32 frames, with an explicit gap.
Exit codes: 0 halted or proved a cycle; 2 reached a step or size limit;
1 invalid input or I/O failure. A limit is not a claim about eventual behavior.`;
function number(value, name) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${name} needs a nonnegative whole number.`);
  return Number(value);
}
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(help);
  else {
    const options = new Map(); let name;
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (!flag.startsWith('--')) { if (name !== undefined) throw new Error('Choose one specimen.'); name = flag; continue; }
      if (options.has(flag)) throw new Error(`Duplicate option ${flag}.`);
      if (['--trace','--json'].includes(flag)) { options.set(flag, true); continue; }
      if (!['--program','--seed','--delete','--steps','--limit','--svg'].includes(flag)) throw new Error(`Unknown option ${flag}. Use --help.`);
      const value = args[++i];
      if (value === undefined || value.startsWith('--') || (value === '' && flag !== '--seed')) throw new Error(`${flag} needs a value.`);
      options.set(flag, ['--delete','--steps','--limit'].includes(flag) ? number(value, flag) : value);
    }
    if (options.has('--program') && (name !== undefined || !options.has('--seed'))) throw new Error('Custom programs require --seed and replace the named specimen.');
    if (name !== undefined && !Object.hasOwn(specimens, name)) throw new Error('Choose fall, orbit, or bloom.');
    const specimen = specimens[name ?? 'fall'];
    const source = options.has('--program') ? await readFile(options.get('--program'), 'utf8') : specimen.source;
    const program = compile(source, { deleteCount: options.get('--delete') ?? 2 });
    const receipt = run(program, options.get('--seed') ?? specimen.seed, {
      maxSteps: options.get('--steps') ?? 100, maxLength: options.get('--limit') ?? 256
    });
    if (options.has('--svg')) await writeFile(options.get('--svg'), toSVG(receipt), {flag:'wx'});
    if (options.has('--json')) console.log(JSON.stringify(receipt, null, 2));
    else {
      console.log(`Tailspin · delete ${receipt.deleteCount} · ${receipt.status}`);
      console.log(`Rules: ${Object.entries(receipt.rules).map(([head, tail]) => `${head} -> ${tail || '-'}`).join('; ')}`);
      if (options.has('--trace')) for (const frame of receipt.frames) {
        console.log(`${frame.step}: ${frame.word || '(empty)'}${frame.read === null ? '' : `  [read ${frame.read}; remove ${frame.removed}; append ${frame.appended || '(empty)'}]`}`);
      }
      else console.log(`${receipt.seed || '(empty)'} -> ${receipt.frames.at(-1).word || '(empty)'} (${receipt.frames.length - 1} completed steps)`);
      if (receipt.cycle) console.log(`Queue repeats step ${receipt.cycle.start} with period ${receipt.cycle.period}.`);
      if (receipt.status === 'halted') console.log('Too few letters remain for another step.');
      if (receipt.status === 'steps') console.log('Step budget reached; eventual behavior is unresolved.');
      if (receipt.blocked) console.log(`Next queue would contain ${receipt.blocked.length} letters, beyond the ${receipt.maxLength}-letter limit. No part of that step was applied; eventual behavior is unresolved.`);
      if (options.has('--svg')) console.log('Saved the SVG queue trace.');
    }
    if (receipt.status === 'steps' || receipt.status === 'size') process.exitCode = 2;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
