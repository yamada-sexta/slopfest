import { writeFile } from 'node:fs/promises';
import { run, analyze, route, toSVG } from './core.mjs';

const help = `Riffraff — a perfect-shuffle deck lab
Usage: node riffraff/cli.mjs [WORD] [options]
  WORD          Uppercase O/I shuffles, up to 128 letters (default OIO)
  --cards N     Even deck size from 2 to 64 (default 8)
  --card N      Original card to follow (default 1)
  --to N        Append a shortest route taking that card to position N
  --trace       Print the deck after every shuffle
  --json        Emit all frames, cycle analysis, and the optional route
  --svg FILE    Save a card-path diagram; never overwrite an existing file
  --help        Show this help on its own

Split into equal halves. O interleaves with the top half first; I leads with
the bottom half. Cards and positions start at 1, at the top of the deck.
Routing tries O before I to break equal-length ties.
The given word plus any appended route must fit within 128 shuffles.
  node riffraff/cli.mjs O --cards 52
  node riffraff/cli.mjs '' --cards 8 --card 1 --to 8 --trace
Exit codes: 0 successful analysis, 1 invalid input or I/O failure.`;
function integer(value, flag) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`${flag} needs a positive whole number.`);
  return Number(value);
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(help);
  else {
    const options = new Map(); let word;
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (!flag.startsWith('--')) { if (word !== undefined) throw new Error('Use one shuffle word.'); word = flag; continue; }
      if (options.has(flag)) throw new Error(`Duplicate option ${flag}.`);
      if (flag === '--trace' || flag === '--json') { options.set(flag, true); continue; }
      if (!['--cards','--card','--to','--svg'].includes(flag)) throw new Error(`Unknown option ${flag}. Use --help.`);
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
      options.set(flag, flag === '--svg' ? value : integer(value, flag));
    }
    const size = options.get('--cards') ?? 8, card = options.get('--card') ?? 1;
    const initial = run(word ?? 'OIO', size);
    // Validate the followed card before planning a route or writing an export.
    if (card < 1 || card > size || !Number.isInteger(card)) throw new Error(`Choose a card from 1 to ${size}.`);
    const planned = options.has('--to') ? route(initial.frames.at(-1), card, options.get('--to')) : null;
    const applied = initial.word + (planned?.word ?? '');
    const journey = run(applied, size), analysis = analyze(journey);
    const receipt = { initialWord: initial.word, ...journey, card, analysis, route: planned };
    if (options.has('--svg')) await writeFile(options.get('--svg'), toSVG(journey, { card }), { flag: 'wx' });
    if (options.has('--json')) console.log(JSON.stringify(receipt, null, 2));
    else {
      console.log(`Riffraff · ${size} cards · top to bottom`);
      if (planned) console.log(`Append ${planned.word || '(empty)'}: card ${card} moves from position ${planned.from} to ${planned.target}.`);
      console.log(`Applied word: ${journey.word || '(empty)'}`);
      if (options.has('--trace')) journey.frames.forEach((state, i) => console.log(`  ${i === 0 ? 'start' : `${i} ${journey.word[i - 1]}`}  ${state.cards.join(' ')}`));
      else console.log(journey.frames.at(-1).cards.join(' '));
      console.log(`Card ${card} is at position ${journey.frames.at(-1).cards.indexOf(card) + 1}.`);
      console.log(`Position cycles: ${analysis.cycles.map(cycle => `(${cycle.join(' ')})`).join(' ')}`);
      console.log(`Repeat the applied word ${analysis.order} ${analysis.order === '1' ? 'time' : 'times'} to restore the starting deck.`);
      if (options.has('--svg')) console.log('Saved the SVG card trace.');
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
