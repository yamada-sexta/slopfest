import { DIRECTIONS, parse, run, encodeInput, initial, advance, escapedBytes } from './core.mjs';
export const MAX_STEPS = 10000;
const records = new WeakMap();
function record(bench) { const found = records.get(bench); if (!found) throw new RangeError('Load a map before exploring its trace.'); return found; }
export function loadMap(source, text = '', steps = 2000) {
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) throw new RangeError('Choose a browser trace budget from 1 to 10,000 steps.');
  const program = parse(source), input = encodeInput(text), result = run(program, { input, steps, trace: true });
  const counts = new Uint32Array(result.steps + 1);
  result.history.forEach((entry, index) => { counts[index + 1] = counts[index] + entry.emitted.length; });
  const bench = Object.freeze({ program, result, input: Object.freeze([...input]) }); records.set(bench, { input, counts }); return bench;
}
export function frameAt(bench, position) {
  const data = record(bench);
  if (!Number.isInteger(position) || position < 0 || position > bench.result.steps) throw new RangeError('Choose a recorded step inside this trace.');
  return Object.freeze({ position, cursor: position === 0 ? initial(bench.program) : bench.result.history[position - 1].after, output: Object.freeze(bench.result.output.slice(0, data.counts[position])), complete: position === bench.result.steps, next: bench.result.history[position]?.op ?? null });
}
export function visitsAt(bench, position) {
  frameAt(bench, position);
  const visits = new Uint32Array(bench.program.width * bench.program.height);
  for (let index = 0; index < position; index++) { const { x, y } = bench.result.history[index].before; visits[y * bench.program.width + x]++; }
  return visits;
}
export function explain(bench, position) {
  const frame = frameAt(bench, position), { cursor } = frame, { result } = bench;
  if (frame.complete) {
    if (result.status === 'halted') return '# halted the cursor on its tile. The walk is complete.';
    if (result.status === 'escaped') return 'The cursor left the map. Edges do not wrap around.';
    if (result.status === 'cycle') {
      const text = escapedBytes(result.cycle.output), preview = text.length > 64 ? `${text.slice(0, 64)}…` : text;
      return `Proven loop: ${result.cycle.start} steps before a ${result.cycle.period}-step repeat. One repeat emits ${result.cycle.output.length} bytes; preview: "${preview}".`;
    }
    if (result.status === 'step-limit') return `The ${result.steps}-step budget ran out. No loop has been proved; the map might still halt.`;
    return 'The next emission would exceed 8,192 output bytes. That tile has not executed.';
  }
  const { state, op, emitted } = advance(bench.program, cursor, record(bench).input);
  const from = DIRECTIONS[cursor.direction], toward = DIRECTIONS[state.direction];
  if (op === '#') return 'Next: # halts here without moving. This still counts as a step.';
  if (op === '?') return `Next: pocket ${cursor.byte} turns ${cursor.byte === 0 ? 'right' : 'left'}, from ${from} to ${toward}.`;
  if (op === ',') return cursor.inputAt === bench.input.length ? 'Next: input is exhausted. Load zero; the input cursor stays at the end.' : `Next: read input byte ${cursor.inputAt + 1} (${state.byte}) into the pocket.`;
  if (emitted.length) return `Next: ${op} emits "${escapedBytes(emitted)}"; keep heading ${toward}.`;
  if (op === ' ' || op === '@') return `Next: ${op === '@' ? 'the entrance' : 'a space'} keeps the pocket at ${cursor.byte}. Move ${toward}.`;
  if (['/', '\\', '>', '<', '^', 'v'].includes(op)) return `Next: ${op} steers from ${from} to ${toward}. The pocket stays ${cursor.byte}.`;
  return `Next: ${op} changes the pocket from ${cursor.byte} to ${state.byte}. Move ${toward}.`;
}
