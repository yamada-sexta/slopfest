import { readFile, writeFile } from 'node:fs/promises';
import { clock, machine, follow, synchronize, toSVG } from './core.mjs';

const help = `Rendezvous — make every possible starting state meet
Usage: node rendezvous/cli.mjs [options]
  --states N       Clock-and-gate machine, 2 to 10 states (default 4)
  --machine FILE   Read a JSON object of button destination arrays
  --word WORD      Follow this word instead of finding a shortest reset
  --trace          Show the remaining states after every button
  --svg FILE       Save a wrapped SVG of every starting state's path
  --json           Emit the complete receipt
  --help           Show this help on its own

Button a advances the clock; b sends its last state to zero.
Custom example: {"a":[1,2,0],"b":[0,1,0]}
Buttons are single lowercase letters; use 1–10 states and 1–4 buttons.
Words contain at most 1023 buttons. Equal-length answers use alphabetic order.
Exit codes: 0 synchronized, 1 invalid input, 2 no reset / word does not reset.
SVG writes refuse to overwrite an existing file.`;

async function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(help); return 0; }
  const options = new Map();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (options.has(flag)) throw new Error(`Duplicate option ${flag}.`);
    if (flag === '--trace' || flag === '--json') { options.set(flag, true); continue; }
    if (!['--states', '--machine', '--word', '--svg'].includes(flag)) throw new Error(`Unknown option ${flag}. Use --help.`);
    const value = args[++i];
    if (value === undefined || value.startsWith('--') || (value === '' && flag !== '--word')) throw new Error(`${flag} needs a value.`);
    options.set(flag, value);
  }
  if (options.has('--states') && options.has('--machine')) throw new Error('Choose --states or --machine.');
  const size = options.get('--states') ?? '4';
  if (!/^(?:[2-9]|10)$/.test(size)) throw new Error('--states must be an integer from 2 to 10.');
  const transitions = options.has('--machine') ? machine(JSON.parse(await readFile(options.get('--machine'), 'utf8'))) : clock(Number(size));
  const result = options.has('--word') ? { status: 'followed', explored: null, ...follow(transitions, options.get('--word')) } : synchronize(transitions);
  const receipt = { machine: transitions, ...result };
  if (options.has('--svg')) {
    if (result.word === null) throw new Error('No reset word exists to draw. Use --word to draw a chosen route.');
    await writeFile(options.get('--svg'), toSVG(transitions, result.word), { flag: 'wx' });
  }
  if (options.has('--json')) console.log(JSON.stringify(receipt, null, 2));
  else {
    console.log('Rendezvous · every possible starting state');
    if (result.word === null) console.log('No reset word exists. Every reachable nonempty subset was searched.');
    else {
      console.log(`${options.has('--word') ? 'Your word' : 'Shortest reset'}: ${result.word || '(empty)'} (${result.word.length} buttons)`);
      if (options.has('--trace')) result.frames.forEach((frame, i) => console.log(`  ${i}  ${frame.button ?? 'start'}  {${frame.states.join(', ')}}`));
      console.log(`Destination${result.frames.at(-1).states.length === 1 ? '' : 's'}: {${result.frames.at(-1).states.join(', ')}}`);
    }
    if (result.explored !== null) console.log(`Discovered ${result.explored} subsets.`);
    if (options.has('--svg')) console.log('Saved the SVG trace.');
  }
  return result.word !== null && result.frames.at(-1).states.length === 1 ? 0 : 2;
}

try { process.exitCode = await main(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
