export const LIMITS = Object.freeze({ source: 8192, side: 64, input: 1024, steps: 100000, output: 8192 });
export const DIRECTIONS = Object.freeze(['east', 'south', 'west', 'north']);
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const programs = new WeakSet(), executions = new WeakMap();
const fail = message => { throw new RangeError(message); };
const inside = (program, state) => state.x >= 0 && state.y >= 0 && state.x < program.width && state.y < program.height;
const checkProgram = program => { if (!programs.has(program)) fail('Use a map returned by parse().'); };
const checkInput = input => { if (!(input instanceof Uint8Array) || input.length > LIMITS.input) fail('Input must contain at most 1,024 bytes.'); };
export function parse(source) {
  if (typeof source !== 'string' || source.length > LIMITS.source) fail('Keep a map to 8,192 ASCII characters.');
  const normalized = source.replace(/\r\n/g, '\n').replace(/\n$/, ''), rows = normalized.split('\n');
  const width = Math.max(...rows.map(row => row.length)), height = rows.length;
  if (width < 1 || width > LIMITS.side || height > LIMITS.side) fail('Use a nonempty map no larger than 64 by 64 cells.');
  let start;
  rows.forEach((row, y) => {
    [...row].forEach((op, x) => {
      if (!' @#><^v/\\+-*?:.,0123456789'.includes(op)) fail(`Line ${y + 1}, column ${x + 1}: unknown map symbol ${JSON.stringify(op)}. Use spaces, not tabs; maps have no comments.`);
      if (op === '@') { if (start) fail('A map needs exactly one @ entrance.'); start = Object.freeze({ x, y }); }
    });
  });
  if (!start) fail('A map needs exactly one @ entrance.');
  const program = Object.freeze({ width, height, rows: Object.freeze(rows.map(row => row.padEnd(width))), start });
  programs.add(program); return program;
}
export function encodeInput(text) {
  if (typeof text !== 'string' || text.length > LIMITS.input) fail('Input must contain at most 1,024 UTF-8 bytes.');
  const bytes = new TextEncoder().encode(text); checkInput(bytes); return bytes;
}
export function initial(program) { checkProgram(program); return Object.freeze({ ...program.start, direction: 0, byte: 0, inputAt: 0 }); }
export function advance(program, state, input = new Uint8Array()) {
  checkProgram(program); checkInput(input);
  if (!state || !Number.isInteger(state.x) || !Number.isInteger(state.y) || !inside(program, state) || !Number.isInteger(state.direction) || state.direction < 0 || state.direction > 3 || !Number.isInteger(state.byte) || state.byte < 0 || state.byte > 255 || !Number.isInteger(state.inputAt) || state.inputAt < 0 || state.inputAt > input.length) fail('Use an in-bounds cursor, direction, byte, and input position.');
  const next = { ...state }, op = program.rows[state.y][state.x]; let emitted = [];
  if (op === '#') return { state: Object.freeze(next), emitted, terminal: 'halted', op };
  if (/\d/.test(op)) next.byte = Number(op);
  else if (op === '+') next.byte = (next.byte + 1) & 255;
  else if (op === '-') next.byte = (next.byte + 255) & 255;
  else if (op === '*') next.byte = (next.byte * 2) & 255;
  else if ('>v<^'.includes(op)) next.direction = '>v<^'.indexOf(op);
  else if (op === '/') next.direction = [3, 2, 1, 0][next.direction];
  else if (op === '\\') next.direction = [1, 0, 3, 2][next.direction];
  else if (op === '?') next.direction = (next.direction + (next.byte === 0 ? 1 : 3)) % 4;
  else if (op === ',') { next.byte = input[next.inputAt] ?? 0; next.inputAt = Math.min(input.length, next.inputAt + 1); }
  else if (op === '.') emitted = [next.byte];
  else if (op === ':') emitted = [...String(next.byte)].map(character => character.charCodeAt(0)).concat(32);
  next.x += DX[next.direction]; next.y += DY[next.direction];
  return { state: Object.freeze(next), emitted, terminal: inside(program, next) ? null : 'escaped', op };
}
export function run(program, { input = new Uint8Array(), steps = 20000, trace = false } = {}) {
  checkProgram(program); checkInput(input);
  if (!Number.isInteger(steps) || steps < 1 || steps > LIMITS.steps || typeof trace !== 'boolean') fail('Use a step budget from 1 to 100,000 and a boolean trace setting.');
  input = input.slice(); let cursor = initial(program), count = 0, status, cycle = null;
  const output = [], history = [], seen = new Map();
  for (;;) {
    // Output cannot affect future execution. Input position can, even on equal bytes.
    const key = `${cursor.x},${cursor.y},${cursor.direction},${cursor.byte},${cursor.inputAt}`;
    const previous = seen.get(key);
    if (previous) { status = 'cycle'; cycle = Object.freeze({ start: previous.step, period: count - previous.step, outputAt: previous.outputAt, output: Object.freeze(output.slice(previous.outputAt)) }); break; }
    if (count === steps) { status = 'step-limit'; break; }
    seen.set(key, { step: count, outputAt: output.length });
    const next = advance(program, cursor, input);
    if (output.length + next.emitted.length > LIMITS.output) { status = 'output-limit'; break; }
    count++; output.push(...next.emitted);
    if (trace) history.push(Object.freeze({ step: count, before: cursor, op: next.op, after: next.state, emitted: Object.freeze(next.emitted) }));
    cursor = next.state;
    if (next.terminal) { status = next.terminal; break; }
  }
  const result = Object.freeze({ status, steps: count, cursor, output: Object.freeze(output), cycle, history: trace ? Object.freeze(history) : null });
  executions.set(result, program); return result;
}
export function escapedBytes(bytes) {
  return Array.from(bytes, value => value === 10 ? '\\n' : value === 13 ? '\\r' : value === 9 ? '\\t' : value === 34 ? '\\"' : value === 92 ? '\\\\' : value >= 32 && value <= 126 ? String.fromCharCode(value) : `\\x${value.toString(16).padStart(2, '0')}`).join('');
}
const xml = value => String(value).replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]);
export function toSVG(program, result) {
  checkProgram(program);
  if (executions.get(result) !== program || result.history === null) fail('Export a run of this map with trace enabled.');
  const cell = 28, width = Math.max(360, program.width * cell + 72), height = Math.max(180, program.height * cell + 144), left = (width - program.width * cell) / 2, top = 53;
  const visits = new Uint32Array(program.width * program.height);
  for (const entry of result.history) visits[entry.before.y * program.width + entry.before.x]++;
  const center = point => `${left + point.x * cell + cell / 2},${top + point.y * cell + cell / 2}`;
  const points = result.history.map(entry => center(entry.before)); if (result.history.length) points.push(center(result.cursor));
  const labels = [];
  const cells = program.rows.flatMap((row, y) => [...row].map((op, x) => {
    const count = visits[y * program.width + x];
    if (op !== ' ') labels.push(`<text x="${left + x * cell + 14}" y="${top + y * cell + 19}" text-anchor="middle" font-family="monospace" font-size="17" paint-order="stroke" stroke="#1a2620" stroke-width="1.5" fill="${op === '@' || op === '#' ? '#f1bd83' : '#e2ebd6'}">${xml(op)}</text>`);
    return `<g data-cell="${x + 1},${y + 1}" data-visits="${count}"><rect x="${left + x * cell}" y="${top + y * cell}" width="27" height="27" rx="3" fill="${count ? '#304938' : '#1a2620'}"/></g>`;
  })).join('');
  const outputText = escapedBytes(result.output), preview = outputText.slice(0, 42) + (outputText.length > 42 ? '…' : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Detour execution route"><rect width="${width}" height="${height}" fill="#122018"/><text x="24" y="28" font-family="monospace" font-size="13" fill="#cce393">DETOUR / CODE TAKES A WALK</text>${cells}${points.length ? `<polyline points="${points.join(' ')}" fill="none" stroke="#b5d58a" stroke-width="3" opacity=".28" stroke-linecap="round" stroke-linejoin="round"/>${labels.join('')}<circle cx="${left + result.cursor.x * cell + cell / 2}" cy="${top + result.cursor.y * cell + cell / 2}" r="10" fill="none" stroke="#f1bd83" stroke-width="2"/>` : labels.join('')}<text x="24" y="${height - 53}" fill="#dce5cc" font-family="monospace" font-size="10">${xml(result.status)} / ${result.steps} steps / pocket ${result.cursor.byte}</text><text x="24" y="${height - 32}" fill="#b1c3aa" font-family="monospace" font-size="10">output: ${xml(preview)}</text><text x="24" y="${height - 13}" fill="#b1c3aa" font-family="monospace" font-size="9">${result.cycle ? `prefix: ${result.cycle.start} steps / cycle: ${result.cycle.period} steps` : 'one tile = one step / ring = final cursor'}</text></svg>`;
}
