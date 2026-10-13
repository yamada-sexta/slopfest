export const LIMITS = Object.freeze({ source: 20000, symbols: 100000, segments: 30000, depth: 8 });
const alphabet = /^[A-Z+\-\[\]|.]*$/;
export class SprigError extends Error {
  constructor(message, line) { super(line ? `Line ${line}: ${message}` : message); this.name = 'SprigError'; this.line = line; }
}

function word(value, line) {
  if (!alphabet.test(value)) throw new SprigError('Use uppercase symbols and + - [ ] | . only.', line);
  let balance = 0;
  for (const symbol of value) {
    if (symbol === '[') balance++;
    if (symbol === ']' && --balance < 0) throw new SprigError('A closing ] needs an opening [.', line);
  }
  if (balance) throw new SprigError('Every opening [ needs a closing ].', line);
  return value;
}

export function parse(source) {
  if (source.length > LIMITS.source) throw new SprigError('This seed packet is too long (20,000 characters maximum).');
  const program = { seed: null, angle: 25, depth: 5, step: 8, rules: new Map() };
  const assigned = new Set();
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1, text = raw.split('#')[0].trim();
    if (!text) return;
    if (text.startsWith('rule ')) {
      const match = text.match(/^rule\s+([A-Z])\s*->\s*([^\s]*)$/);
      if (!match) throw new SprigError('A rule looks like: rule X -> F[+X][-X]FX', line);
      if (program.rules.has(match[1])) throw new SprigError(`Rule ${match[1]} is already planted.`, line);
      program.rules.set(match[1], word(match[2], line)); return;
    }
    const match = text.match(/^(seed|angle|depth|step)\s+(\S+)$/);
    if (!match) throw new SprigError('Expected seed, angle, depth, step, or rule.', line);
    const [, key, value] = match;
    if (assigned.has(key)) throw new SprigError(`${key} is already set.`, line);
    assigned.add(key);
    if (key === 'seed') { program.seed = word(value, line); return; }
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) throw new SprigError(`${key} must be a positive number.`, line);
    const number = Number(value);
    const valid = key === 'depth' ? Number.isInteger(number) && number <= LIMITS.depth
      : key === 'angle' ? number <= 180 : number > 0 && number <= 50;
    if (!valid) throw new SprigError(key === 'depth' ? 'Depth must be an integer from 0 to 8.'
      : key === 'angle' ? 'Angle must be between 0 and 180.' : 'Step must be greater than 0 and at most 50.', line);
    program[key] = number;
  });
  if (!program.seed) throw new SprigError('Plant a seed first. Try: seed X');
  return program;
}

export function expand(program, depth = program.depth) {
  if (!Number.isInteger(depth) || depth < 0 || depth > LIMITS.depth) throw new SprigError('Depth must be an integer from 0 to 8.');
  let current = program.seed;
  if (current.length > LIMITS.symbols) throw new SprigError('Growth exceeds 100,000 symbols. Try a smaller depth.');
  for (let generation = 0; generation < depth; generation++) {
    const parts = []; let size = 0;
    for (const symbol of current) {
      const replacement = program.rules.get(symbol) ?? symbol;
      size += replacement.length;
      if (size > LIMITS.symbols) throw new SprigError('Growth exceeds 100,000 symbols. Try a smaller depth.');
      parts.push(replacement);
    }
    current = parts.join('');
  }
  return current;
}

export function trace(symbols, { angle, step }) {
  let x = 0, y = 0, heading = -90;
  const stack = [], segments = [], buds = [];
  const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const include = (px, py) => { bounds.minX = Math.min(bounds.minX, px); bounds.maxX = Math.max(bounds.maxX, px); bounds.minY = Math.min(bounds.minY, py); bounds.maxY = Math.max(bounds.maxY, py); };
  for (const symbol of symbols) {
    if (symbol === 'F' || symbol === 'M') {
      const rad = heading * Math.PI / 180;
      const nx = x + Math.cos(rad) * step, ny = y + Math.sin(rad) * step;
      if (symbol === 'F') {
        if (segments.length >= LIMITS.segments) throw new SprigError('Growth exceeds 30,000 strokes. Try a smaller depth.');
        segments.push({ x1: x, y1: y, x2: nx, y2: ny, branch: stack.length });
        include(x, y); include(nx, ny);
      }
      x = nx; y = ny;
    } else if (symbol === '+') heading = (heading + angle) % 360;
    else if (symbol === '-') heading = (heading - angle) % 360;
    else if (symbol === '|') heading = (heading + 180) % 360;
    else if (symbol === '[') stack.push({ x, y, heading });
    else if (symbol === ']') {
      if (!stack.length) throw new SprigError('A closing ] needs an opening [.');
      ({ x, y, heading } = stack.pop());
    } else if (symbol === '.') { buds.push({ x, y }); include(x, y); }
    else if (!/[A-Z]/.test(symbol)) throw new SprigError(`Unknown drawing symbol: ${symbol}`);
  }
  if (stack.length) throw new SprigError('Every opening [ needs a closing ].');
  return { segments, buds, bounds };
}

const palettes = { moss: ['#14201a', '#c6e494', '#f0b689'], blueprint: ['#152a3b', '#9fd9ec', '#f0d792'], ink: ['#eee9dc', '#304239', '#af5939'] };
const num = n => Number(n.toFixed(3));
export function toSVG(drawing, { palette = 'moss' } = {}) {
  const [background, stroke, bud] = palettes[palette] || palettes.moss;
  const { minX, minY, maxX, maxY } = drawing.bounds;
  const span = Math.max(maxX - minX, maxY - minY, 1), pad = span * .09 + 3;
  const width = maxX - minX + pad * 2, height = maxY - minY + pad * 2;
  const thickness = Math.max(span / 450, .3), radius = Math.max(span / 180, .7);
  const paths = drawing.segments.map(s => `M${num(s.x1)},${num(s.y1)}L${num(s.x2)},${num(s.y2)}`).join('');
  const dots = drawing.buds.map(p => `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(radius)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(minX - pad)} ${num(minY - pad)} ${num(width)} ${num(height)}" role="img" aria-label="A drawing grown from Sprig rewrite rules"><rect x="${num(minX - pad)}" y="${num(minY - pad)}" width="${num(width)}" height="${num(height)}" fill="${background}"/><path d="${paths}" fill="none" stroke="${stroke}" stroke-width="${num(thickness)}" stroke-linecap="round" stroke-linejoin="round"/><g fill="${bud}">${dots}</g></svg>`;
}

export function grow(source, options = {}) {
  const program = parse(source), symbols = expand(program, options.depth ?? program.depth);
  const drawing = trace(symbols, { ...program, angle: options.angle ?? program.angle });
  return { program, symbols, drawing, svg: toSVG(drawing, options) };
}
