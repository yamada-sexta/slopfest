import { race, counterpick } from './core.mjs';

const help = `Coinwake — which coin word arrives first?
Usage: node coinwake/cli.mjs [PATTERN PATTERN ...] [options]
  PATTERN          2–6 uppercase H/T letters; race 2–4 distinct equal-length words
                   Default: HHH HTH
  --heads N/D      Exact chance of heads, strictly between 0 and 1 (default 1/2)
                   Denominator at most 32
  --counter WORD   Search every other equal-length word for the best counterpick
  --states         Print matched-prefix transitions and exact waiting times
  --json           Emit the complete exact receipt
  --help           Show this help on its own

All contestants watch the same toss stream. The first complete word wins.
Overlaps count. Waiting time starts before the first toss.
  node coinwake/cli.mjs HHH THH --states
  node coinwake/cli.mjs --counter HTH
  node coinwake/cli.mjs HH HT TH TT --heads 2/3 --json
Exit codes: 0 successful analysis, 1 invalid input.`;

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(help);
  else {
    const words = [], options = new Map();
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (!flag.startsWith('--')) { words.push(flag); continue; }
      if (options.has(flag)) throw new Error(`Duplicate option ${flag}.`);
      if (flag === '--json' || flag === '--states') { options.set(flag, true); continue; }
      if (flag !== '--heads' && flag !== '--counter') throw new Error(`Unknown option ${flag}. Use --help.`);
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
      options.set(flag, value);
    }
    if (options.has('--counter') && (words.length || options.has('--states'))) throw new Error('Use --counter on its own, with optional --heads and --json.');
    const settings = { heads: options.get('--heads') };
    const counter = options.has('--counter');
    const result = counter ? counterpick(options.get('--counter'), settings) : race(words.length ? words : undefined, settings);
    if (options.has('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`Coinwake · heads ${result.heads}`);
      if (counter) {
        console.log(`First pick: ${result.first}`);
        console.log(`Best replies: ${result.best.join(', ')} · win probability ${result.probability}`);
        console.log(`Searched all ${result.choices.length} other words. Tied replies are listed alphabetically.`);
        for (const word of result.best) {
          const choice = result.choices.find(candidate => candidate.pattern === word);
          console.log(`  ${word}: expected tosses until either word ${choice.expectedTosses}`);
        }
      } else {
        for (const outcome of result.outcomes) console.log(`  ${outcome.pattern} wins: ${outcome.probability}`);
        console.log(`Expected tosses until a winner: ${result.expectedTosses}`);
        if (options.has('--states')) {
          console.log('Matched prefix | after H | after T | expected tosses remaining');
          for (const state of result.states) {
            const label = value => result.patterns.includes(value) ? `win:${value}` : value || 'empty';
            console.log(`  ${state.prefix || 'empty'} | ${label(state.H)} | ${label(state.T)} | ${state.expectedTosses}`);
          }
        }
      }
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
