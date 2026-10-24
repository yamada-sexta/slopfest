import { parse, state, apply, invert, format, REGISTERS } from './core.mjs';

// Only the current bytes and instruction pointer are needed to travel backward.
// The initial bytes are a comparison label, never a source for undo.
export function createWorkbench(source, initial = [12, 34, 56, 78]) {
  const program = parse(source), values = state(initial);
  const freezeProgram = items => Object.freeze(items.map(item => Object.freeze(item)));
  return Object.freeze({
    program: freezeProgram(program), inverse: freezeProgram(invert(program)),
    initial: Object.freeze(values.slice()), values: Object.freeze(values), cursor: 0,
  });
}

export function seek(workbench, cursor) {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > workbench.program.length) {
    throw new RangeError('Choose an instruction position inside this spell.');
  }
  let values = workbench.values.slice(), position = workbench.cursor;
  while (position < cursor) values = apply(values, workbench.program[position++]);
  while (position > cursor) values = apply(values, workbench.inverse[workbench.program.length - position--]);
  return Object.freeze({ ...workbench, values: Object.freeze(values), cursor });
}

export function preview(workbench, direction = 1) {
  if (direction !== 1 && direction !== -1) throw new RangeError('Step forward or backward.');
  const { program, inverse, values, cursor } = workbench;
  if (direction === 1 ? cursor === program.length : cursor === 0) return null;
  const item = direction === 1 ? program[cursor] : inverse[program.length - cursor];
  const after = apply(values, item), index = REGISTERS.indexOf(item.target);
  const value = values[index], result = after[index];
  const operand = typeof item.operand === 'string' ? values[REGISTERS.indexOf(item.operand)] : item.operand;
  const source = typeof item.operand === 'string' ? ` (${item.operand})` : '';
  let explanation;
  if (item.op === 'swap') explanation = `${item.target} and ${item.operand} exchange ${value} and ${operand}.`;
  else if (item.op === 'not') explanation = `${item.target}: flip all eight bits, ${value} → ${result}.`;
  else if (item.op === 'rol' || item.op === 'ror') explanation = `${item.target}: rotate ${value} ${item.op === 'rol' ? 'left' : 'right'} by ${operand} bits → ${result}. Bits wrap around.`;
  else {
    const symbol = { add: '+', sub: '−', mul: '×', xor: 'XOR' }[item.op];
    explanation = `${item.target}: ${value} ${symbol} ${operand}${source} → ${result}.${item.op === 'xor' ? '' : ' Arithmetic wraps at 256.'}`;
  }
  return { instruction: format(item), explanation, after, line: item.line };
}

export function inverseSource(workbench) {
  return workbench.inverse.map(format).join('\n');
}
