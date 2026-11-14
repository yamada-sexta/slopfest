import { application, parse } from './core.mjs';

function lambdaTree(source, maxNodes) {
  if (typeof source !== 'string' || source.length > 8192) {
    throw new Error('Use a lambda expression of at most 8192 characters.');
  }
  const tokens = [];
  const name = /[a-z][a-z0-9_]*|[SKI]/y;
  for (let cursor = 0; cursor < source.length;) {
    const char = source[cursor];
    if (/\s/.test(char)) { cursor++; continue; }
    if ('\\λ.()'.includes(char)) {
      tokens.push({ kind: char === 'λ' ? '\\' : char, offset: cursor });
      cursor++;
      continue;
    }
    name.lastIndex = cursor;
    const match = name.exec(source);
    if (!match) throw new Error(`Unexpected character at position ${cursor + 1}.`);
    if (match[0].length > 32) throw new Error('Keep each name to 32 characters.');
    tokens.push({ kind: 'name', name: match[0], offset: cursor });
    cursor = name.lastIndex;
  }
  let cursor = 0;
  let nodes = 0;
  function node(kind, fields) {
    if (++nodes > maxNodes) throw new Error(`The lambda input exceeds ${maxNodes} nodes.`);
    return { kind, ...fields };
  }
  function primary(depth) {
    const token = tokens[cursor++];
    if (token?.kind === 'name') return node('name', { name: token.name });
    if (token?.kind === '(') {
      const term = expression(depth + 1);
      if (tokens[cursor++]?.kind !== ')') throw new Error(`Unclosed group at character ${token.offset + 1}.`);
      return term;
    }
    throw new Error('Expected a name or a parenthesized expression.');
  }
  function expression(depth) {
    if (depth > 128) throw new Error('Keep lambda and parenthesis nesting to 128 levels.');
    if (tokens[cursor]?.kind === '\\') {
      cursor++;
      const binders = [];
      while (tokens[cursor]?.kind === 'name') {
        const binder = tokens[cursor++].name;
        if (!/^[a-z]/.test(binder)) throw new Error('Bind lowercase names. S, K, and I are constants.');
        binders.push(binder);
      }
      if (!binders.length || tokens[cursor++]?.kind !== '.') {
        throw new Error('Write a lambda as \\x. body, with at least one lowercase binder.');
      }
      let body = expression(depth + 1);
      for (const binder of binders.reverse()) body = node('lambda', { binder, body });
      return body;
    }
    let term = primary(depth);
    while (tokens[cursor]?.kind === 'name' || tokens[cursor]?.kind === '(') {
      term = node('app', { fn: term, arg: primary(depth) });
    }
    return term;
  }
  const result = expression(0);
  if (cursor !== tokens.length) throw new Error(`Unexpected token at character ${tokens[cursor].offset + 1}.`);
  return result;
}

function occurs(name, term) {
  const pending = [term];
  while (pending.length) {
    const next = pending.pop();
    if (next.kind === 'atom') {
      if (next.name === name) return true;
    } else pending.push(next.fn, next.arg);
  }
  return false;
}

export function compileLambda(source, { maxNodes = 1024 } = {}) {
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 4096) {
    throw new Error('Use a node limit from 1 to 4096.');
  }
  const tree = lambdaTree(source, maxNodes);
  const names = new Map();
  function named(name) {
    if (!names.has(name)) names.set(name, parse(name));
    return names.get(name);
  }
  const app = (fn, arg) => application(fn, arg, { maxNodes });

  function abstract(binder, body) {
    const pending = [{ term: body, combine: false }];
    const values = [];
    while (pending.length) {
      const { term, combine } = pending.pop();
      if (combine) {
        const right = values.pop(), left = values.pop();
        values.push(app(app(named('S'), left), right));
      } else if (term.kind === 'atom' && term.name === binder) {
        values.push(named('I'));
      } else if (!occurs(binder, term)) {
        values.push(app(named('K'), term));
      } else {
        pending.push(
          { term, combine: true },
          { term: term.arg, combine: false },
          { term: term.fn, combine: false },
        );
      }
    }
    return values[0];
  }

  const pending = [{ term: tree, combine: false }];
  const values = [];
  while (pending.length) {
    const { term, combine } = pending.pop();
    if (term.kind === 'name') values.push(named(term.name));
    else if (combine) {
      if (term.kind === 'lambda') values.push(abstract(term.binder, values.pop()));
      else {
        const right = values.pop(), left = values.pop();
        values.push(app(left, right));
      }
    } else {
      pending.push({ term, combine: true });
      if (term.kind === 'lambda') pending.push({ term: term.body, combine: false });
      else pending.push({ term: term.arg, combine: false }, { term: term.fn, combine: false });
    }
  }
  return values[0];
}
