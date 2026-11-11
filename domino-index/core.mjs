function checkSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || width > 10 || height < 1 || height > 20) {
    throw new Error('Use a board 1–10 columns wide and 1–20 rows tall.');
  }
}

export function rectangle(width, height) {
  checkSize(width, height);
  return Array(height).fill('.'.repeat(width));
}

export function catalog(rows) {
  if (!Array.isArray(rows) || typeof rows[0] !== 'string') {
    throw new Error('Supply a board as an array of rows.');
  }
  const width = rows[0].length;
  const height = rows.length;
  checkSize(width, height);
  if (Array.from(rows).some(row => typeof row !== 'string' || row.length !== width || /[^.#]/.test(row))) {
    throw new Error('Rows must have equal length and contain only . and #.');
  }
  const blocked = Array.from(rows.join(''), cell => cell === '#');
  const area = blocked.length;
  const memo = Array.from({ length: area }, () => new Map());

  // The mask covers the next width cells. Bit zero refers to the current cell.
  // A move advances by one cell and marks its partner in the shifted mask.
  function placements(cell, mask) {
    const moves = [];
    if (cell % width < width - 1 && !blocked[cell + 1] && (mask & 2) === 0) {
      moves.push({ partner: cell + 1, nextMask: (mask >> 1) | 1 });
    }
    if (cell + width < area && !blocked[cell + width]) {
      moves.push({ partner: cell + width, nextMask: (mask >> 1) | (1 << (width - 1)) });
    }
    return moves;
  }

  function ways(cell, mask) {
    if (cell === area) return 1n;
    const cache = memo[cell];
    if (cache.has(mask)) return cache.get(mask);
    let count = 0n;
    if (blocked[cell] || (mask & 1) !== 0) {
      count = ways(cell + 1, mask >> 1);
    } else {
      for (const { nextMask } of placements(cell, mask)) {
        count += ways(cell + 1, nextMask);
      }
    }
    cache.set(mask, count);
    return count;
  }

  const count = ways(0, 0);
  function at(index) {
    if (typeof index !== 'bigint' || index < 1n || index > count) {
      throw new RangeError(`Choose a tiling number from 1 to ${count}, using BigInt.`);
    }
    const tiles = Array(area).fill(null);
    let mask = 0;
    let id = 0;
    for (let cell = 0; cell < area; cell++) {
      if (blocked[cell] || (mask & 1) !== 0) {
        mask >>= 1;
        continue;
      }
      for (const { partner, nextMask } of placements(cell, mask)) {
        const branch = ways(cell + 1, nextMask);
        if (index <= branch) {
          id++;
          tiles[cell] = id;
          tiles[partner] = id;
          mask = nextMask;
          break;
        }
        index -= branch;
      }
    }
    return Object.freeze(Array.from({ length: height }, (_, row) =>
      Object.freeze(tiles.slice(row * width, (row + 1) * width))));
  }
  return Object.freeze({ count, at });
}
