function gcd(a, b) {
  a = a < 0n ? -a : a;
  while (b) [a, b] = [b, a % b];
  return a;
}
function fraction(n, d = 1n) {
  if (d === 0n) throw new Error('A zero denominator cannot be divided.');
  if (d < 0n) { n = -n; d = -d; }
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}
const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const subtract = (a, b) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
const multiply = (a, b) => fraction(a.n * b.n, a.d * b.d);
const divide = (a, b) => fraction(a.n * b.d, a.d * b.n);
const text = value => value.d === 1n ? String(value.n) : `${value.n}/${value.d}`;
const zero = fraction(0n), one = fraction(1n);

function coin(heads) {
  if (typeof heads !== 'string' || !/^[1-9][0-9]?\/[1-9][0-9]?$/.test(heads)) {
    throw new Error('Heads must be a fraction such as 1/2, with denominator at most 32.');
  }
  const [n, d] = heads.split('/').map(BigInt);
  if (n >= d || d > 32n) throw new Error('Use a heads probability strictly between zero and one, with denominator at most 32.');
  return fraction(n, d);
}
function pattern(word) {
  if (typeof word !== 'string' || !/^[HT]{2,6}$/.test(word)) throw new Error('Patterns need 2 to 6 uppercase H/T letters.');
}

// Exact Gauss-Jordan elimination on all winner and waiting-time columns at once.
function solve(rows, size) {
  for (let column = 0; column < size; column++) {
    const pivot = rows.findIndex((row, i) => i >= column && row[column].n !== 0n);
    if (pivot === -1) throw new Error('The pattern equations are singular.');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let j = column; j < rows[column].length; j++) rows[column][j] = divide(rows[column][j], divisor);
    for (let i = 0; i < size; i++) {
      if (i === column || rows[i][column].n === 0n) continue;
      const factor = rows[i][column];
      for (let j = column; j < rows[i].length; j++) rows[i][j] = subtract(rows[i][j], multiply(factor, rows[column][j]));
    }
  }
  return rows.map(row => row.slice(size));
}

export function race(words = ['HHH', 'HTH'], { heads = '1/2' } = {}) {
  if (!Array.isArray(words) || words.length < 2 || words.length > 4) throw new Error('Race 2 to 4 distinct patterns.');
  Array.from(words).forEach(pattern);
  if (new Set(words).size !== words.length || words.some(word => word.length !== words[0].length)) {
    throw new Error('Patterns must be distinct and all the same length.');
  }
  const probability = coin(heads), weights = { H: probability, T: subtract(one, probability) };
  const prefixes = new Set(['']);
  for (const word of words) for (let length = 1; length < word.length; length++) prefixes.add(word.slice(0, length));
  const labels = [...prefixes].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  const index = new Map(labels.map((label, i) => [label, i]));
  const transitions = labels.map(prefix => Object.fromEntries(['H', 'T'].map(toss => {
    const extended = prefix + toss;
    const winner = words.find(word => extended.endsWith(word));
    if (winner) return [toss, winner];
    for (let length = extended.length; length >= 0; length--) {
      const suffix = extended.slice(extended.length - length);
      if (prefixes.has(suffix)) return [toss, suffix];
    }
    throw new Error('Every toss must have an empty-prefix fallback.');
  })));
  const size = labels.length;
  const rows = labels.map((_, i) => {
    const row = Array.from({ length: size + words.length + 1 }, () => zero);
    row[i] = one;
    // The final right-hand column counts the next toss.
    row[row.length - 1] = one;
    for (const toss of ['H', 'T']) {
      const target = transitions[i][toss], winner = words.indexOf(target);
      if (winner >= 0) row[size + winner] = add(row[size + winner], weights[toss]);
      else row[index.get(target)] = subtract(row[index.get(target)], weights[toss]);
    }
    return row;
  });
  const solution = solve(rows, size);
  const states = labels.map((prefix, i) => Object.freeze({
    prefix, ...transitions[i],
    probabilities: Object.freeze(solution[i].slice(0, words.length).map(text)),
    expectedTosses: text(solution[i].at(-1)),
  }));
  return Object.freeze({
    patterns: Object.freeze([...words]), heads: text(probability),
    outcomes: Object.freeze(words.map((word, i) => Object.freeze({ pattern: word, probability: states[0].probabilities[i] }))),
    expectedTosses: states[0].expectedTosses, states: Object.freeze(states),
  });
}

function readFraction(value) {
  const [n, d = '1'] = value.split('/');
  return fraction(BigInt(n), BigInt(d));
}

export function counterpick(first, { heads = '1/2' } = {}) {
  pattern(first);
  const probability = coin(heads), choices = [];
  let bestValue = null, best = [];
  for (let bits = 0; bits < 2 ** first.length; bits++) {
    const word = bits.toString(2).padStart(first.length, '0').replaceAll('0', 'H').replaceAll('1', 'T');
    if (word === first) continue;
    const result = race([first, word], { heads: text(probability) });
    const chance = readFraction(result.outcomes[1].probability);
    const choice = Object.freeze({ pattern: word, probability: text(chance), expectedTosses: result.expectedTosses });
    choices.push(choice);
    const comparison = bestValue === null ? 1n : chance.n * bestValue.d - bestValue.n * chance.d;
    if (comparison > 0n) { bestValue = chance; best = [word]; }
    else if (comparison === 0n) best.push(word);
  }
  return Object.freeze({ first, heads: text(probability), probability: text(bestValue), best: Object.freeze(best), choices: Object.freeze(choices) });
}
