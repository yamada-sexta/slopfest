import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse, explore } from './core.mjs';

export async function main(args) {
  if (!args.length || args.includes('--help')) {
    console.log('Threadjar — explore the endings of a tiny concurrent program\nUsage: node threadjar/cli.mjs program.jar [--json]'); return;
  }
  if (args.length > 2 || (args[1] && args[1] !== '--json')) throw new Error('Expected a .jar source file and optional --json.');
  const result = explore(parse(await readFile(args[0], 'utf8')));
  if (args[1] === '--json') console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${result.complete ? 'Search complete' : 'Search limit reached'}: ${result.visited} states, ${result.outcomes.length} distinct endings.`);
    for (const outcome of result.outcomes) {
      console.log(`${outcome.kind}: ${JSON.stringify(outcome.shared)}\n  Schedule: ${outcome.schedule.join(' → ')}${outcome.fault ? `\n  ${outcome.fault}` : ''}`);
    }
  }
  if (!result.complete) process.exitCode = 2;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
