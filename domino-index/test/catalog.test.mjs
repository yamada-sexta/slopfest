import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalog, rectangle } from '../core.mjs';

function signature(pairs) {
  return pairs.map(pair => pair.toSorted((a, b) => a - b).join(',')).sort().join('|');
}

function brute(rows) {
  const width = rows[0].length;
  const result = new Set();
  // Work from the bottom right with a full set of free cells.
  const free = new Set();
  for (let y = rows.length - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      if (rows[y][x] === '.') free.add(y * width + x);
    }
  }
  function cover(open, pairs) {
    if (open.size === 0) {
      result.add(signature(pairs));
      return;
    }
    const cell = open.values().next().value;
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    for (const neighbor of neighbors) {
      if (!open.has(neighbor)) continue;
      const remaining = new Set(open);
      remaining.delete(cell);
      remaining.delete(neighbor);
      cover(remaining, [...pairs, [cell, neighbor]]);
    }
  }
  cover(free, []);
  return result;
}

function checkTiling(rows, tiles) {
  const width = rows[0].length;
  const pieces = new Map();
  assert.equal(tiles.length, rows.length);
  tiles.forEach((row, y) => {
    assert.equal(row.length, width);
    row.forEach((id, x) => {
      if (rows[y][x] === '#') {
        assert.equal(id, null);
      } else {
        assert.ok(Number.isInteger(id) && id > 0);
        if (!pieces.has(id)) pieces.set(id, []);
        pieces.get(id).push(y * width + x);
      }
    });
  });
  for (const pair of pieces.values()) {
    assert.equal(pair.length, 2);
    const [a, b] = pair;
    assert.equal(Math.abs(a % width - b % width) +
      Math.abs(Math.floor(a / width) - Math.floor(b / width)), 1);
  }
  return signature([...pieces.values()]);
}

test('Every hole pattern on a 3 × 4 board agrees with full-board enumeration', () => {
  for (let pattern = 0; pattern < 4096; pattern++) {
    const rows = Array.from({ length: 4 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => pattern & (1 << (y * 3 + x)) ? '#' : '.').join(''));
    const expected = brute(rows);
    const book = catalog(rows);
    assert.equal(book.count, BigInt(expected.size), rows.join('/'));
    const actual = new Set();
    for (let index = 1n; index <= book.count; index++) {
      actual.add(checkTiling(rows, book.at(index)));
    }
    assert.deepEqual(actual, expected, rows.join('/'));
  }
});

test('Ordering starts with a horizontal placement and preserves empty and impossible cases', () => {
  const book = catalog(rectangle(2, 2));
  assert.deepEqual(book.at(1n), [[1, 1], [2, 2]]);
  assert.deepEqual(book.at(2n), [[1, 2], [1, 2]]);
  assert.equal(catalog(rectangle(4, 4)).count, 36n);
  assert.equal(catalog(rectangle(1, 20)).count, 1n);
  assert.equal(catalog(rectangle(10, 1)).count, 1n);
  const empty = catalog(['##']);
  assert.equal(empty.count, 1n);
  assert.deepEqual(empty.at(1n), [[null, null]]);
  assert.equal(catalog(['.#', '#.']).count, 0n);
  assert.equal(catalog(['.']).count, 0n);
});

test('A maximum-size board supports exact indices above Number.MAX_SAFE_INTEGER', () => {
  const rows = rectangle(10, 20);
  const book = catalog(rows);
  assert.equal(book.count, 289415868852204573601981n);
  const first = checkTiling(rows, book.at(1n));
  const penultimate = checkTiling(rows, book.at(book.count - 1n));
  const last = checkTiling(rows, book.at(book.count));
  assert.notEqual(first, last);
  assert.notEqual(penultimate, last);
  assert.throws(() => book.at(book.count + 1n), RangeError);
  assert.throws(() => book.at(0n), RangeError);
  assert.throws(() => book.at(1), RangeError);
});

test('The CLI draws a tiling, emits exact JSON, and rejects malformed requests', () => {
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
  const ring = run('--board', '..../.##./.##./....', '--index', '2');
  assert.equal(ring.status, 0, ring.stderr);
  assert.match(ring.stdout, /Tiling 2 of 2\n\+---\+/);
  assert.equal(ring.stdout.match(/###/g).length, 4);
  const big = run('--size', '10x20', '--index', '289415868852204573601981', '--json');
  assert.equal(big.status, 0, big.stderr);
  const result = JSON.parse(big.stdout);
  assert.equal(result.index, result.count);
  assert.equal(result.count, '289415868852204573601981');
  checkTiling(result.board, result.tiles);
  const impossible = run('--board', '.#/#.', '--json');
  assert.equal(impossible.status, 0);
  assert.deepEqual(JSON.parse(impossible.stdout), { board: ['.#', '#.'], count: '0', index: null, tiles: null });
  for (const args of [
    ['--board', '.../..'], ['--board', '..a'], ['--board', '/'], ['--size', '11x4'],
    ['--index', '0'], ['--index', '37'], ['--index', '1.5'],
    ['--size', '2x2', '--board', '..'], ['--board', '.#/#.', '--index', '1'],
  ]) {
    const bad = run(...args);
    assert.equal(bad.status, 1, args.join(' '));
    assert.ok(bad.stderr);
    assert.equal(bad.stdout, '');
  }
});
