export const REGISTERS = Object.freeze(['a', 'b', 'c', 'd']);
export const LIMITS = Object.freeze({ source: 16000, instructions: 4096, nesting: 4, repeat: 32 });
export class SpellError extends Error { constructor(message, line) { super(line ? `Line ${line}: ${message}` : message); this.name = 'SpellError'; } }
const fail = (message, line) => { throw new SpellError(message, line); };
const byte = value => Number.isInteger(value) && value >= 0 && value <= 255;
const register = value => REGISTERS.includes(value);
function instruction(text, line) {
  const parts = text.split(/\s+/), [op, target, operand] = parts;
  if (!register(target)) fail('Choose a target register: a, b, c, or d.', line);
  if (op === 'not' && parts.length === 2) return { op, target, line };
  if (parts.length !== 3) fail('Expected an instruction and its operands.', line);
  if (op === 'swap') {
    if (!register(operand) || operand === target) fail('Swap needs two different registers.', line);
    return { op, target, operand, line };
  }
  if (['rol', 'ror'].includes(op)) {
    if (!/^[0-7]$/.test(operand)) fail('Rotate by an integer from 0 to 7 bits.', line);
    return { op, target, operand: Number(operand), line };
  }
  if (!['add', 'sub', 'xor', 'mul'].includes(op)) fail('Unknown instruction. Use add, sub, xor, mul, swap, rol, ror, or not.', line);
  if (register(operand)) {
    if (op === 'mul') fail('Multiply by an odd literal byte, not a register.', line);
    if (operand === target) fail('The source register must differ from the target so the operation can be undone.', line);
    return { op, target, operand, line };
  }
  if (!/^(0|[1-9]\d{0,2})$/.test(operand) || !byte(Number(operand))) fail('Use a literal byte from 0 to 255 or another register.', line);
  if (op === 'mul' && Number(operand) % 2 !== 1) fail('Multipliers must be odd, so every byte has one predecessor.', line);
  return { op, target, operand: Number(operand), line };
}
export function parse(source) {
  if (typeof source !== 'string' || source.length > LIMITS.source) fail('Keep source to 16,000 characters.');
  const root = [], stack = [{ body: root, count: 1, line: 0 }];
  source.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.replace(/#.*/, '').trim(), line = index + 1; if (!text) return;
    const repeat = text.match(/^repeat\s+(0|[1-9]\d?)$/);
    if (repeat) {
      const count = Number(repeat[1]);
      if (count < 1 || count > LIMITS.repeat) fail('Repeat from 1 to 32 times.', line);
      if (stack.length > LIMITS.nesting) fail('Nest at most four repeats.', line);
      stack.push({ body: [], count, line }); return;
    }
    if (text === 'end') {
      if (stack.length === 1) fail('This end has no matching repeat.', line);
      const block = stack.pop();
      if (!block.body.length) fail('A repeat needs at least one instruction.', block.line);
      const parent = stack[stack.length - 1].body;
      if (parent.length + block.count * block.body.length > LIMITS.instructions) fail('A spell expands to at most 4,096 instructions.', block.line);
      for (let i = 0; i < block.count; i++) parent.push(...block.body.map(item => ({ ...item })));
      return;
    }
    const body = stack[stack.length - 1].body;
    if (body.length >= LIMITS.instructions) fail('A spell expands to at most 4,096 instructions.', line);
    body.push(instruction(text, line));
  });
  if (stack.length !== 1) fail('This repeat needs an end.', stack[stack.length - 1].line);
  if (!root.length) fail('A spell needs at least one instruction.');
  return root;
}
export function state(values = [0, 0, 0, 0]) {
  if (!Array.isArray(values) || values.length !== 4 || [...values].some(value => !byte(value))) fail('State needs four integer bytes from 0 to 255.');
  return values.slice();
}
function validateInstruction(item) {
  if (!item || !register(item.target)) fail('Invalid compiled target register.');
  const { op, target, operand } = item;
  const other = register(operand) && operand !== target;
  const valid = op === 'not' ? operand === undefined : op === 'swap' ? other
    : ['rol', 'ror'].includes(op) ? Number.isInteger(operand) && operand >= 0 && operand <= 7
    : op === 'mul' ? byte(operand) && operand % 2 === 1
    : ['add', 'sub', 'xor'].includes(op) && (other || byte(operand));
  if (!valid) fail('Invalid or irreversible compiled instruction.');
}
function validateProgram(instructions) {
  if (!Array.isArray(instructions) || !instructions.length || instructions.length > LIMITS.instructions) fail('Use 1–4,096 compiled instructions.');
  for (const item of instructions) validateInstruction(item);
}
const inverseOps = { add: 'sub', sub: 'add', xor: 'xor', swap: 'swap', rol: 'ror', ror: 'rol', not: 'not', mul: 'mul' };
export function invert(instructions) {
  validateProgram(instructions);
  return instructions.slice().reverse().map(item => {
    // The parser accepts only odd multipliers; their inverse is also an odd byte.
    let operand = item.operand;
    if (item.op === 'mul') { operand = 1; while ((operand * item.operand & 255) !== 1) operand += 2; }
    return { ...item, op: inverseOps[item.op], ...(operand === undefined ? {} : { operand }) };
  });
}
export const format = item => [item.op, item.target, item.operand].filter(value => value !== undefined).join(' ');
export function apply(values, item) {
  validateInstruction(item);
  const result = state(values), target = REGISTERS.indexOf(item.target), operand = typeof item.operand === 'string' ? values[REGISTERS.indexOf(item.operand)] : item.operand, value = values[target];
  // Instructions come from parse() or invert(); no source is evaluated as code.
  if (item.op === 'add') result[target] = (value + operand) & 255;
  else if (item.op === 'sub') result[target] = (value - operand) & 255;
  else if (item.op === 'xor') result[target] = value ^ operand;
  else if (item.op === 'mul') result[target] = (value * operand) & 255;
  else if (item.op === 'not') result[target] = value ^ 255;
  else if (item.op === 'rol') result[target] = ((value << operand) | (value >>> (8 - operand))) & 255;
  else if (item.op === 'ror') result[target] = ((value >>> operand) | (value << (8 - operand))) & 255;
  else if (item.op === 'swap') { const other = REGISTERS.indexOf(item.operand); result[target] = values[other]; result[other] = value; }
  else fail('Unknown compiled instruction.');
  return result;
}
export function run(instructions, values = [0, 0, 0, 0], { reverse = false, trace = false } = {}) {
  validateProgram(instructions);
  if (typeof reverse !== 'boolean' || typeof trace !== 'boolean') fail('Reverse and trace must be boolean.');
  let current = state(values); const steps = reverse ? invert(instructions) : instructions, history = trace ? [{ instruction: null, values: current.slice() }] : null;
  for (const item of steps) { current = apply(current, item); if (trace) history.push({ instruction: format(item), values: current.slice() }); }
  return { values: current, steps: steps.length, ...(trace ? { history } : {}) };
}
