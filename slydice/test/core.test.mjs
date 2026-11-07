import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, forge, match, toSVG } from '../core.mjs';

// A separate rank-word oracle: assign increasing labels to owners, accumulating
// wins against lower labels already seen. Restricted-growth words remove die
// renamings, with no combinations or face-pair loops from the production search.
function oracle(faces) {
  const seen = [0, 0, 0], won = Array.from({ length: 3 }, () => [0, 0, 0]);
  const histogram = Array(faces * faces + 1).fill(0);
  let partitions = 0, cycles = 0;
  function assign(rank, highest) {
    if (rank === faces * 3) {
      partitions++;
      for (const order of [[0, 1, 2], [0, 2, 1]]) {
        const weakest = Math.min(...order.map((owner, i) => won[owner][order[(i + 1) % 3]]));
        if (weakest * 2 > faces * faces) { cycles++; histogram[weakest]++; }
      }
      return;
    }
    for (let owner = 0; owner <= Math.min(2, highest + 1); owner++) {
      if (seen[owner] === faces) continue;
      for (let other = 0; other < 3; other++) if (other !== owner) won[owner][other] += seen[other];
      seen[owner]++; assign(rank + 1, Math.max(highest, owner)); seen[owner]--;
      for (let other = 0; other < 3; other++) if (other !== owner) won[owner][other] -= seen[other];
    }
  }
  assign(0, -1);
  const bestWins = histogram.findLastIndex(count => count !== 0);
  return { partitions, cycles, histogram, bestWins, bestCount: histogram[bestWins] };
}

test('Exhaustive forges agree with independent rank-word searches for all supported sizes', () => {
  for (const [faces, partitions, cycles, bestWins, bestCount] of [[3, 280, 5, 5, 5], [4, 5775, 13, 9, 13], [5, 126126, 1732, 15, 3]]) {
    const result = forge(faces), expected = oracle(faces);
    assert.deepEqual({ partitions, cycles, bestWins, bestCount }, { partitions: result.partitions, cycles: result.cycles, bestWins: result.bestWins, bestCount: result.bestCount });
    for (const key of ['partitions', 'cycles', 'histogram', 'bestWins', 'bestCount']) assert.deepEqual(result[key], expected[key], `${faces} faces: ${key}`);
    assert.equal(result.histogram.reduce((a, b) => a + b), cycles);
    assert.deepEqual(result.analysis.dice.flat().sort((a, b) => a - b), Array.from({ length: faces * 3 }, (_, i) => i + 1));
    assert.equal(result.analysis.dice[0][0], 1);
    assert.deepEqual(result.analysis.cycle, [0, 1, 2]);
    assert.equal(Math.min(...[0, 1, 2].map(i => result.analysis.matches[i][(i + 1) % 3].wins)), bestWins);
    assert.strictEqual(forge(faces), result, 'immutable cached result');
  }
  assert.deepEqual(forge().analysis.dice, [[1, 5, 9], [3, 4, 8], [2, 6, 7]]);
  assert.deepEqual(forge(5).analysis.dice, [[1, 2, 11, 12, 13], [6, 7, 8, 9, 10], [3, 4, 5, 14, 15]]);
});

test('Exact pair counts handle repeated labels, different sizes, ties, and both directions', () => {
  const dice = [];
  for (let length = 1; length <= 3; length++) {
    for (let code = 0; code < 3 ** length; code++) dice.push(Array.from({ length }, (_, place) => Math.floor(code / 3 ** place) % 3));
  }
  for (const a of dice) for (const b of dice) {
    const frequency = [0, 0, 0]; for (const value of b) frequency[value]++;
    const expected = { wins: 0, losses: 0, ties: 0, total: a.length * b.length };
    for (const value of a) {
      expected.wins += frequency.slice(0, value).reduce((x, y) => x + y, 0);
      expected.ties += frequency[value];
      expected.losses += frequency.slice(value + 1).reduce((x, y) => x + y, 0);
    }
    assert.deepEqual(match(a, b), expected);
    const reverse = match(b, a);
    assert.equal(reverse.wins, expected.losses); assert.equal(reverse.ties, expected.ties);
  }
  assert.deepEqual(match([99, 0, 99], [99, 0]), { wins: 2, losses: 1, ties: 3, total: 6 });
});

test('Both cycle orientations and counterpicks are exact; the mean does not rank win chances', () => {
  const first = analyze([[2, 4, 9], [1, 6, 8], [3, 5, 7]]);
  assert.deepEqual(first.cycle, [0, 1, 2]); assert.deepEqual(first.counterpicks, [2, 0, 1]);
  for (let i = 0; i < 3; i++) assert.equal(first.matches[i][(i + 1) % 3].wins, 5);
  const swapped = analyze([first.dice[0], first.dice[2], first.dice[1]]);
  assert.deepEqual(swapped.cycle, [0, 2, 1]); assert.deepEqual(swapped.counterpicks, [1, 2, 0]);
  assert.deepEqual(analyze([[1], [2], [3]]).counterpicks, [1, 2, null]);
  assert.equal(analyze([[1], [2], [3]]).cycle, null);
  const ties = analyze([[0, 1], [1, 1], [1, 1]]);
  assert.deepEqual(ties.counterpicks, [null, null, null], '50% wins with 50% ties does not clear the strict threshold');
  assert.equal(ties.cycle, null);
  const tieBreak = analyze([[0], [2], [1]]); assert.equal(tieBreak.counterpicks[0], 1, 'lowest die index breaks equal winning probabilities');
  const uneven = forge(5).analysis;
  assert.ok(uneven.dice[0].reduce((a, b) => a + b) < uneven.dice[1].reduce((a, b) => a + b));
  assert.equal(uneven.matches[0][1].wins, 15, 'lower mean still wins 60%');
});

test('Analysis copies input, sorts labels, and deeply freezes every exposed result', () => {
  const values = [[9, 2, 4], [8, 1, 6], [7, 3, 5]], before = structuredClone(values), result = analyze(values);
  assert.deepEqual(values, before); values[0][0] = 0;
  assert.deepEqual(result.dice[0], [2, 4, 9]);
  function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child); } }
  frozen(result); frozen(forge(5)); frozen(match([1], [2]));
  assert.throws(() => result.dice[0].push(8), TypeError);
  assert.throws(() => forge().histogram.fill(0), TypeError);
});

test('SVG grids enumerate every outcome in cycle order, including ties and repeated faces', () => {
  for (const values of [forge().analysis.dice, [[2, 4, 9], [3, 5, 7], [1, 6, 8]], [[0, 1], [1, 1], [1, 1]], [Array(8).fill(99), Array(8).fill(0), Array(8).fill(50)]]) {
    const result = analyze(values), svg = toSVG(result), groups = [...svg.matchAll(/<g data-left="([ABC])" data-right="([ABC])">(.*?)<\/g>/g)];
    assert.equal(groups.length, 3);
    for (let i = 0; i < groups.length; i++) {
      const [, left, right, content] = groups[i], a = 'ABC'.indexOf(left), b = 'ABC'.indexOf(right);
      const order = result.cycle ?? [0, 1, 2]; assert.equal(a, order[i]); assert.equal(b, order[(i + 1) % 3]);
      const cells = [...content.matchAll(/data-row="(\d+)" data-column="(\d+)" data-outcome="(win|loss|tie)"/g)];
      assert.equal(cells.length, result.faces ** 2);
      for (const [, row, col, outcome] of cells) {
        const x = result.dice[a][row - 1], y = result.dice[b][col - 1];
        assert.equal(outcome, x > y ? 'win' : x < y ? 'loss' : 'tie');
      }
      for (const outcome of ['win', 'loss', 'tie']) assert.equal(cells.filter(cell => cell[3] === outcome).length, result.matches[a][b][{ win: 'wins', loss: 'losses', tie: 'ties' }[outcome]]);
    }
    assert.match(svg, /TIES ARE NOT REROLLED/); assert.doesNotMatch(svg, /undefined|NaN|<script|https?:\/\/(?!www.w3.org)/);
  }
  assert.match(toSVG(analyze([[2, 4, 9], [3, 5, 7], [1, 6, 8]])), /A beats C beats B beats A/);
  assert.match(toSVG(analyze([[1], [2], [3]])), /No strict-majority cycle/);
});

test('Malformed, sparse, oversized, fractional, or nonnumeric inputs are rejected', () => {
  for (const faces of [0, 1, 2, 6, 5.5, '3', null, NaN, Infinity]) assert.throws(() => forge(faces));
  for (const value of [null, [], [1, 2], [[1], [2]], Array(3), [[1], [2], [3], [4]], [[1], [1, 2], [2]]]) assert.throws(() => analyze(value));
  for (const value of [null, [], Array(2), Array(9).fill(1), [-1], [100], [1.1], ['1'], [NaN], [Infinity], [true]]) assert.throws(() => match(value, [1]));
  for (const value of [null, {}, { ...forge().analysis }, JSON.parse(JSON.stringify(forge().analysis))]) assert.throws(() => toSVG(value));
});
