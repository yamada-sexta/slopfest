import { print, run } from './core.mjs';
import { compileLambda } from './lambda.mjs';

const usage = `Starling — a small combinator lab
Usage: node starling/cli.mjs [EXPRESSION] [options]
  EXPRESSION     S, K, I, lowercase names, and parentheses (default S K K feather)
  --lambda       Compile lambda syntax first (default expression: \\x. x)
  --strategy S   normal (outside first, default) or applicative (inside first)
  --compare      Run both strategies, each with its own full limits
  --trace        Show every accepted rewrite with its rule and location
  --steps N      Maximum rewrites, from 0 to 500 (default 100)
  --nodes N      Maximum term size, from 1 to 4096 (default 1024)
  --json         Emit the complete receipt as JSON
  --help         Show this help on its own

Rules:
  I x       → x
  K x y     → x
  S f g x   → f x (g x)

Application associates left. Normal order chooses the leftmost outermost redex.
Applicative order chooses the leftmost innermost redex.
Names are inert. The reducer also works inside partially applied terms.
Quote an expression that contains spaces.
Lambda mode accepts \\x y. body or λx y. body, with lowercase binders.
  node starling/cli.mjs 'S K K feather' --trace
  node starling/cli.mjs 'K sunshine (S I I (S I I))' --trace
  node starling/cli.mjs 'S I I (S I I)' --json
  node starling/cli.mjs '(\\x. x) feather' --lambda --trace
  node starling/cli.mjs 'K sunshine (S I I (S I I))' --compare --steps 12
Exit codes: 0 normal form, 1 invalid input, 2 step or size limit.`;

function integer(text, flag) {
  if (!/^(0|[1-9][0-9]*)$/.test(text)) throw new Error(`${flag} needs a whole number.`);
  return Number(text);
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage);
    return 0;
  }
  const options = new Map();
  let expression;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!flag.startsWith('--')) {
      if (expression !== undefined) throw new Error('Quote a single expression as one argument.');
      expression = flag;
      continue;
    }
    if (options.has(flag)) throw new Error(`${flag} was supplied twice.`);
    if (flag === '--trace' || flag === '--json' || flag === '--lambda' || flag === '--compare') {
      options.set(flag, true);
      continue;
    }
    if (!['--steps', '--nodes', '--strategy'].includes(flag)) throw new Error(`Unknown option ${flag}. Use --help.`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
    options.set(flag, flag === '--strategy' ? value : integer(value, flag));
  }
  if (options.has('--compare') && options.has('--strategy')) throw new Error('Use --compare or --strategy, not both.');
  const source = expression ?? (options.has('--lambda') ? '\\x. x' : 'S K K feather');
  const compiled = options.has('--lambda') ? compileLambda(source, { maxNodes: options.get('--nodes') }) : null;
  const strategies = options.has('--compare') ? ['normal', 'applicative'] : [options.get('--strategy') ?? 'normal'];
  const results = strategies.map(strategy => {
    const result = run(compiled ?? source, {
      maxSteps: options.get('--steps'),
      maxNodes: options.get('--nodes'),
      strategy,
    });
    return compiled ? { ...result, compilation: { source, expression: print(compiled) } } : result;
  });
  if (options.has('--json')) console.log(JSON.stringify(options.has('--compare') ? { comparison: results } : results[0], null, 2));
  else for (const result of results) {
    console.log(`Starling · leftmost ${result.strategy === 'normal' ? 'outermost' : 'innermost'} reduction`);
    if (compiled) console.log(`Compiled to ${result.compilation.expression}`);
    if (options.has('--trace')) {
      result.frames.forEach((frame, i) => {
        const label = i === 0 ? 'start' : `${frame.rule} at ${frame.path || 'root'}`;
        console.log(`  ${i}  ${frame.term}  [${label}]`);
      });
    } else console.log(result.frames.at(-1).term);
    if (result.status === 'normal') console.log(`Normal form after ${result.reductions} rewrites.`);
    if (result.status === 'steps') console.log(`Stopped at the ${result.maxSteps}-rewrite limit.`);
    if (result.status === 'size') console.log(`Stopped before ${result.nextRule}: the next term needs ${result.nextNodes} nodes, above the ${result.maxNodes}-node limit.`);
    if (options.has('--trace')) console.log('Locations follow f (function) and a (argument) from the root.');
  }
  return results.every(result => result.status === 'normal') ? 0 : 2;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
