import { writeFile } from 'node:fs/promises';
import { run, analyze, route, routePair, toSVG } from './core.mjs';

const help = `Riffraff — a perfect-shuffle deck lab
Usage: node riffraff/cli.mjs [WORD] [options]
  WORD          Uppercase O/I shuffles, up to 128 letters (default OIO)
  --cards N     Even deck size from 2 to 64 (default 8)
  --card N      Original card to follow (default 1)
  --to N        Append a shortest route taking that card to position N
  --pair A:P,B:Q Place original cards A and B at positions P and Q together
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
  node riffraff/cli.mjs '' --pair 1:3,8:6 --trace
Use --pair instead of --card/--to. An unreachable pair leaves the given word
unchanged and writes no SVG. JSON includes the failed search receipt.
Exit codes: 0 successful analysis, 1 invalid input or I/O failure,
2 unreachable pair of placements.`;
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
      if (!['--cards','--card','--to','--pair','--svg'].includes(flag)) throw new Error(`Unknown option ${flag}. Use --help.`);
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
      if (flag === '--pair') {
        if (!/^[1-9][0-9]*:[1-9][0-9]*,[1-9][0-9]*:[1-9][0-9]*$/.test(value)) throw new Error('--pair needs A:P,B:Q, with positive card and position numbers.');
        options.set(flag, value.split(',').map(item => { const [card, target] = item.split(':').map(Number); return { card, target }; }));
      } else options.set(flag, flag === '--svg' ? value : integer(value, flag));
    }
    if (options.has('--pair') && (options.has('--card') || options.has('--to'))) throw new Error('Use --pair instead of --card/--to.');
    const size = options.get('--cards') ?? 8;
    const initial = run(word ?? 'OIO', size);
    const paired = options.has('--pair') ? routePair(initial.frames.at(-1), options.get('--pair')) : null;
    const card = options.get('--card') ?? paired?.cards[0] ?? 1;
    // Validate the followed card before planning a route or writing an export.
    if (card < 1 || card > size || !Number.isInteger(card)) throw new Error(`Choose a card from 1 to ${size}.`);
    const planned = options.has('--to') ? route(initial.frames.at(-1), card, options.get('--to')) : null;
    const applied = initial.word + (paired?.word ?? planned?.word ?? '');
    const journey = run(applied, size), analysis = analyze(journey);
    const receipt = { initialWord: initial.word, ...journey, card, analysis, route: planned, ...(paired ? { pairRoute: paired } : {}) };
    const unreachable = paired?.reachable === false;
    if (options.has('--svg') && !unreachable) await writeFile(options.get('--svg'), toSVG(journey, { card, partner: paired?.cards[1] ?? null }), { flag: 'wx' });
    if (options.has('--json')) console.log(JSON.stringify(receipt, null, 2));
    else {
      console.log(`Riffraff · ${size} cards · top to bottom`);
      if (planned) console.log(`Append ${planned.word || '(empty)'}: card ${card} moves from position ${planned.from} to ${planned.target}.`);
      if (paired) {
        const placements = paired.cards.map((id, i) => `card ${id} at position ${paired.target[i]}`).join(' and ');
        console.log(unreachable ? `Unreachable: ${placements} together. Searched ${paired.discovered} ordered position pairs.`
          : `Append ${paired.word || '(empty)'}: place ${placements} together.`);
      }
      console.log(`Applied word: ${journey.word || '(empty)'}`);
      if (options.has('--trace')) journey.frames.forEach((state, i) => console.log(`  ${i === 0 ? 'start' : `${i} ${journey.word[i - 1]}`}  ${state.cards.join(' ')}`));
      else console.log(journey.frames.at(-1).cards.join(' '));
      console.log(`Card ${card} is at position ${journey.frames.at(-1).cards.indexOf(card) + 1}.`);
      console.log(`Position cycles: ${analysis.cycles.map(cycle => `(${cycle.join(' ')})`).join(' ')}`);
      console.log(`Repeat the applied word ${analysis.order} ${analysis.order === '1' ? 'time' : 'times'} to restore the starting deck.`);
      if (options.has('--svg')) console.log(unreachable ? 'No SVG written for an unreachable pair.' : 'Saved the SVG card trace.');
    }
    if (unreachable) process.exitCode = 2;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
