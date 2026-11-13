const sizes = new WeakMap();

function atom(name) {
  const term = Object.freeze({ kind: 'atom', name });
  sizes.set(term, 1);
  return term;
}

function apply(fn, arg) {
  const term = Object.freeze({ kind: 'app', fn, arg });
  sizes.set(term, 1 + sizes.get(fn) + sizes.get(arg));
  return term;
}

function check(term) {
  if (!sizes.has(term)) throw new Error('Parse a term before inspecting or reducing it.');
}

function nodeLimit(maxNodes) {
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 4096) {
    throw new Error('Use a node limit from 1 to 4096.');
  }
}

export function parse(source, { maxNodes = 1024 } = {}) {
  nodeLimit(maxNodes);
  if (typeof source !== 'string' || source.length > 8192) {
    throw new Error('Use an expression of at most 8192 characters.');
  }
  const groups = [];
  const token = /[a-z][a-z0-9_]*|[SKI]/y;
  let current = null;
  let cursor = 0;
  let nodes = 0;
  function append(term) {
    nodes += current === null ? 1 : 2;
    if (nodes > maxNodes) throw new Error(`The input exceeds ${maxNodes} nodes.`);
    current = current === null ? term : apply(current, term);
  }
  while (cursor < source.length) {
    const char = source[cursor];
    if (/\s/.test(char)) {
      cursor++;
      continue;
    }
    if (char === '(') {
      groups.push({ parent: current, offset: cursor });
      current = null;
      cursor++;
      continue;
    }
    if (char === ')') {
      if (groups.length === 0) throw new Error(`Unexpected ) at character ${cursor + 1}.`);
      if (current === null) throw new Error(`Empty group at character ${cursor + 1}.`);
      const { parent } = groups.pop();
      // The group's nodes have already been counted. Joining it adds one app.
      if (parent !== null) {
        nodes++;
        if (nodes > maxNodes) throw new Error(`The input exceeds ${maxNodes} nodes.`);
        current = apply(parent, current);
      }
      cursor++;
      continue;
    }
    token.lastIndex = cursor;
    const match = token.exec(source);
    if (!match) throw new Error(`Unexpected character at position ${cursor + 1}. Use S, K, I, lowercase names, and parentheses.`);
    if (match[0].length > 32) throw new Error('Keep each name to 32 characters.');
    append(atom(match[0]));
    cursor = token.lastIndex;
  }
  if (groups.length) throw new Error(`Unclosed group at character ${groups[0].offset + 1}.`);
  if (current === null) throw new Error('Enter a combinator expression.');
  return current;
}

export function print(term) {
  check(term);
  const pending = [term];
  const result = [];
  while (pending.length) {
    const item = pending.pop();
    if (typeof item === 'string') result.push(item);
    else if (item.kind === 'atom') result.push(item.name);
    else {
      if (item.arg.kind === 'app') pending.push(')', item.arg, '(');
      else pending.push(item.arg);
      pending.push(' ', item.fn);
    }
  }
  return result.join('');
}

function rewrite(term) {
  if (term.kind !== 'app') return null;
  const { fn, arg } = term;
  if (fn.kind === 'atom' && fn.name === 'I') return { term: arg, rule: 'I' };
  if (fn.kind !== 'app') return null;
  if (fn.fn.kind === 'atom' && fn.fn.name === 'K') return { term: fn.arg, rule: 'K' };
  if (fn.fn.kind === 'app' && fn.fn.fn.kind === 'atom' && fn.fn.fn.name === 'S') {
    return { term: apply(apply(fn.fn.arg, arg), apply(fn.arg, arg)), rule: 'S' };
  }
  return null;
}

export function step(term) {
  check(term);
  const pending = [{ term, context: null }];
  while (pending.length) {
    const current = pending.pop();
    const replacement = rewrite(current.term);
    if (replacement) {
      let rebuilt = replacement.term;
      const path = [];
      for (let context = current.context; context; context = context.outer) {
        path.push(context.side);
        rebuilt = context.side === 'f'
          ? apply(rebuilt, context.parent.arg)
          : apply(context.parent.fn, rebuilt);
      }
      return Object.freeze({
        term: rebuilt,
        rule: replacement.rule,
        path: path.reverse().join(''),
      });
    }
    if (current.term.kind === 'app') {
      const parent = current.term;
      pending.push(
        { term: parent.arg, context: { parent, side: 'a', outer: current.context } },
        { term: parent.fn, context: { parent, side: 'f', outer: current.context } },
      );
    }
  }
  return null;
}

export function run(source, { maxSteps = 100, maxNodes = 1024 } = {}) {
  if (!Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > 500) {
    throw new Error('Use a step limit from 0 to 500.');
  }
  let term = parse(source, { maxNodes });
  const initial = print(term);
  const frames = [Object.freeze({ term: initial, nodes: sizes.get(term), rule: null, path: null })];
  function finish(status, details = {}) {
    return Object.freeze({
      status, reductions: frames.length - 1, maxSteps, maxNodes,
      frames: Object.freeze(frames), ...details,
    });
  }
  while (true) {
    const next = step(term);
    if (next === null) return finish('normal');
    if (frames.length - 1 === maxSteps) return finish('steps');
    const nodes = sizes.get(next.term);
    if (nodes > maxNodes) {
      return finish('size', { nextNodes: nodes, nextRule: next.rule, nextPath: next.path });
    }
    term = next.term;
    const text = print(term);
    frames.push(Object.freeze({ term: text, nodes, rule: next.rule, path: next.path }));
  }
}
