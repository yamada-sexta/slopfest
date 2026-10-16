export const LIMITS = Object.freeze({ source: 12000, threads: 3, variables: 4, mutexes: 4, instructions: 12, states: 12000 });
const name = '[a-z][a-z0-9_]{0,15}';
export class ThreadjarError extends Error {
  constructor(message, line) { super(line ? `Line ${line}: ${message}` : message); this.name = 'ThreadjarError'; }
}
const integer = (text, line) => {
  if (!/^[+-]?\d+$/.test(text) || Math.abs(Number(text)) > 1000000) throw new ThreadjarError('Use an integer between -1000000 and 1000000.', line);
  return Number(text);
};

export function parse(source) {
  if (source.length > LIMITS.source) throw new ThreadjarError('Keep the program under 12,000 characters.');
  const program = { shared: {}, mutexes: [], threads: [] };
  let thread = null;
  source.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.split('#')[0].trim(), line = index + 1;
    if (!text) return;
    if (thread) {
      if (text === 'end') {
        if (!thread.instructions.length) throw new ThreadjarError('Give this worker at least one instruction.', line);
        program.threads.push(thread); thread = null; return;
      }
      const match = text.match(new RegExp(`^(load|add|store|lock|unlock)\\s+(${name}|[+-]?\\d+)$`));
      if (!match) throw new ThreadjarError('Expected load, add, store, lock, unlock, or end.', line);
      const [, op, value] = match;
      const arg = op === 'add' ? integer(value, line) : value;
      thread.instructions.push({ op, arg, line });
      if (thread.instructions.length > LIMITS.instructions) throw new ThreadjarError('A worker may have at most 12 instructions.', line);
      return;
    }
    let match;
    if ((match = text.match(new RegExp(`^shared\\s+(${name})\\s*=\\s*([+-]?\\d+)$`)))) {
      const [, id, value] = match;
      if (Object.hasOwn(program.shared, id) || program.mutexes.includes(id)) throw new ThreadjarError(`${id} is already declared.`, line);
      if (Object.keys(program.shared).length >= LIMITS.variables) throw new ThreadjarError('Use at most four shared jars.', line);
      program.shared[id] = integer(value, line);
    } else if ((match = text.match(new RegExp(`^mutex\\s+(${name})$`)))) {
      const id = match[1];
      if (Object.hasOwn(program.shared, id) || program.mutexes.includes(id)) throw new ThreadjarError(`${id} is already declared.`, line);
      if (program.mutexes.length >= LIMITS.mutexes) throw new ThreadjarError('Use at most four mutex keys.', line);
      program.mutexes.push(id);
    } else if ((match = text.match(new RegExp(`^thread\\s+(${name})$`)))) {
      if (program.threads.some(t => t.id === match[1])) throw new ThreadjarError(`Worker ${match[1]} is already declared.`, line);
      if (program.threads.length >= LIMITS.threads) throw new ThreadjarError('Use at most three workers.', line);
      thread = { id: match[1], instructions: [] };
    } else throw new ThreadjarError('Expected shared name = integer, mutex name, or thread name.', line);
  });
  if (thread) throw new ThreadjarError(`Worker ${thread.id} needs an end.`);
  if (!program.threads.length) throw new ThreadjarError('Add a worker: thread amber, then instructions, then end.');
  for (const t of program.threads) for (const instruction of t.instructions) {
    const { op, arg, line } = instruction;
    if ((op === 'load' || op === 'store') && !Object.hasOwn(program.shared, arg)) throw new ThreadjarError(`Shared jar ${arg} is not declared.`, line);
    if ((op === 'lock' || op === 'unlock') && !program.mutexes.includes(arg)) throw new ThreadjarError(`Mutex ${arg} is not declared.`, line);
  }
  return program;
}

export function createState(program) {
  return { program, shared: { ...program.shared }, locks: Object.fromEntries(program.mutexes.map(id => [id, null])),
    workers: program.threads.map(t => ({ id: t.id, pc: 0, pocket: 0 })), tick: 0, fault: null };
}
export const nextInstruction = (state, index) => state.program.threads[index].instructions[state.workers[index].pc];
export function runnable(state) {
  if (state.fault) return [];
  return state.workers.flatMap((worker, index) => {
    const instruction = nextInstruction(state, index);
    return instruction && (instruction.op !== 'lock' || state.locks[instruction.arg] === null) ? [worker.id] : [];
  });
}
export function status(state) {
  if (state.fault) return 'fault';
  if (state.workers.every((_, index) => !nextInstruction(state, index))) return 'finished';
  return runnable(state).length ? 'running' : 'deadlock';
}

export function step(state, id) {
  const index = state.workers.findIndex(t => t.id === id);
  if (index < 0) throw new ThreadjarError(`Unknown worker ${id}.`);
  if (status(state) !== 'running') return { ok: false, state, message: 'This run has ended. Undo a step or reset it.' };
  const instruction = nextInstruction(state, index);
  if (!instruction) return { ok: false, state, message: `${id} has finished.` };
  const { op, arg } = instruction;
  if (op === 'lock' && state.locks[arg] !== null) return { ok: false, state, message: `${id} is waiting for ${arg}, held by ${state.locks[arg]}.` };
  const next = { ...state, shared: { ...state.shared }, locks: { ...state.locks }, workers: state.workers.map(t => ({ ...t })), tick: state.tick + 1 };
  const worker = next.workers[index];
  let message;
  if (op === 'load') { worker.pocket = next.shared[arg]; message = `${id} reads ${arg} = ${worker.pocket} into its pocket.`; }
  else if (op === 'add') { worker.pocket += arg; message = `${id} adds ${arg} in its own pocket. Pocket = ${worker.pocket}.`; }
  else if (op === 'store') { next.shared[arg] = worker.pocket; message = `${id} writes its pocket (${worker.pocket}) into ${arg}.`; }
  else if (op === 'lock') { next.locks[arg] = id; message = `${id} takes the ${arg} key.`; }
  else {
    if (next.locks[arg] !== id) {
      next.fault = `${id} cannot unlock ${arg}: it does not hold that key (line ${instruction.line}).`;
      message = next.fault;
    } else { next.locks[arg] = null; message = `${id} returns the ${arg} key.`; }
  }
  worker.pc++; return { ok: true, state: next, message };
}

const key = state => JSON.stringify([Object.values(state.shared), Object.values(state.locks), state.workers.map(t => [t.pc, t.pocket]), state.fault]);
export function explore(program, { maxStates = LIMITS.states } = {}) {
  if (!Number.isInteger(maxStates) || maxStates < 1 || maxStates > 50000) throw new ThreadjarError('Search limit must be between 1 and 50000 states.');
  const initial = createState(program), nodes = [{ state: initial, parent: -1, via: null }];
  const seen = new Set([key(initial)]), endings = new Map();
  let complete = true;
  for (let head = 0; head < nodes.length; head++) {
    const { state } = nodes[head], kind = status(state);
    if (kind !== 'running') {
      const endingKey = JSON.stringify([kind, state.shared, state.fault]);
      if (!endings.has(endingKey)) {
        const schedule = []; let cursor = head;
        while (nodes[cursor].parent !== -1) { schedule.push(nodes[cursor].via); cursor = nodes[cursor].parent; }
        endings.set(endingKey, { kind, shared: { ...state.shared }, fault: state.fault, schedule: schedule.reverse() });
      }
      continue;
    }
    for (const id of runnable(state)) {
      const next = step(state, id).state, fingerprint = key(next);
      if (seen.has(fingerprint)) continue;
      if (seen.size >= maxStates) { complete = false; continue; }
      seen.add(fingerprint); nodes.push({ state: next, parent: head, via: id });
    }
  }
  return { complete, visited: seen.size, outcomes: [...endings.values()].sort((a, b) => JSON.stringify([a.kind, a.shared, a.fault]).localeCompare(JSON.stringify([b.kind, b.shared, b.fault]))) };
}
