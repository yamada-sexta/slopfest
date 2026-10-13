import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { grow } from './language.mjs';

export async function main(args) {
  if (!args.length || args.includes('--help')) {
    console.log('Sprig — grow drawings from rewrite rules\nUsage: node sprig/cli.mjs seed.sprig [drawing.svg]\nWithout an output path, SVG is printed to standard output.');
    return;
  }
  if (args.length > 2) throw new Error('Expected a seed file and optional SVG output path.');
  const source = await readFile(args[0], 'utf8');
  const { svg } = grow(source);
  if (args[1]) await writeFile(args[1], `${svg}\n`);
  else console.log(svg);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
