const shots = new WeakSet();

function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function lcm(a, b) {
  return a / gcd(a, b) * b;
}

export function fraction(numerator, denominator) {
  const divisor = gcd(Math.abs(numerator), denominator);
  const bottom = denominator / divisor;
  return bottom === 1 ? String(numerator / divisor) : `${numerator / divisor}/${bottom}`;
}

function axis(length, position, velocity, scale) {
  if (velocity === 0) return { first: Infinity, interval: Infinity, period: 1 };
  const ticksPerUnit = scale / Math.abs(velocity);
  const distanceToWall = velocity > 0 ? length - position : position;
  const interval = length * ticksPerUnit;
  return { first: distanceToWall * ticksPerUnit, interval, period: 2 * interval };
}

function reflect(coordinate, extent) {
  const period = 2 * extent;
  const wrapped = ((coordinate % period) + period) % period;
  return Math.min(wrapped, period - wrapped);
}

export function shoot({
  width = 12,
  height = 9,
  start = [Math.max(1, Math.floor(width / 4)), Math.max(1, Math.floor(height / 4))],
  velocity = [2, 1],
} = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 2 && n <= 24)) {
    throw new Error('Table width and height must be integers from 2 to 24.');
  }
  if (!Array.isArray(start) || start.length !== 2) throw new Error('Give two starting coordinates.');
  const [x, y] = start;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x <= 0 || x >= width || y <= 0 || y >= height) {
    throw new Error('Start at an integer point strictly inside the table.');
  }
  if (!Array.isArray(velocity) || velocity.length !== 2) throw new Error('Give two velocity components.');
  const [vx, vy] = velocity;
  if (![vx, vy].every(n => Number.isInteger(n) && Math.abs(n) <= 12) || (vx === 0 && vy === 0)) {
    throw new Error('Use integer velocity components from -12 to 12, with at least one nonzero.');
  }

  // In the unfolded table, every wall crossing lands on an integer tick.
  const scale = lcm(Math.abs(vx) || 1, Math.abs(vy) || 1);
  const horizontal = axis(width, x, vx, scale);
  const vertical = axis(height, y, vy, scale);
  const returnTicks = lcm(horizontal.period, vertical.period);
  const points = [];
  const point = (tick, walls = []) => {
    points.push(Object.freeze({
      tick,
      x: reflect(x * scale + vx * tick, width * scale),
      y: reflect(y * scale + vy * tick, height * scale),
      walls: Object.freeze(walls),
    }));
  };
  function finish(end, banks) {
    const result = Object.freeze({
      width, height, start: Object.freeze([x, y]), velocity: Object.freeze([vx, vy]),
      scale, returnTicks, end, banks, points: Object.freeze(points),
    });
    shots.add(result);
    return result;
  }

  point(0);
  let nextX = horizontal.first;
  let nextY = vertical.first;
  let banks = 0;
  while (Math.min(nextX, nextY) < returnTicks) {
    const tick = Math.min(nextX, nextY);
    const walls = [];
    if (nextY === tick) {
      const position = reflect(y * scale + vy * tick, height * scale);
      walls.push(position === 0 ? 'north' : 'south');
      nextY += vertical.interval;
    }
    if (nextX === tick) {
      const position = reflect(x * scale + vx * tick, width * scale);
      walls.push(position === 0 ? 'west' : 'east');
      nextX += horizontal.interval;
    }
    point(tick, walls);
    if (walls.length === 2) return finish('pocket', banks);
    banks++;
  }
  point(returnTicks);
  return finish('return', banks);
}

export function toSVG(shot) {
  if (!shots.has(shot)) throw new Error('Trace a shot before exporting it.');
  const { width, height, start, velocity, scale, points, end, banks } = shot;
  const unit = Math.min(740 / width, 430 / height);
  const left = (920 - width * unit) / 2;
  const top = 140 + (430 - height * unit) / 2;
  const sx = x => (left + x / scale * unit).toFixed(3);
  const sy = y => (top + y / scale * unit).toFixed(3);
  const marker = (p, radius, fill) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${radius}" fill="${fill}"/>`;
  const corners = [0, width * scale].flatMap(x => [0, height * scale].map(y => marker({ x, y }, 7, '#14201e'))).join('');
  const path = points.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const last = points.at(-1);
  const result = end === 'return' ? 'Returned with the original heading' : `Pocketed at the ${last.walls.join('-')} corner`;
  const bankMarks = banks <= 24 ? points.slice(1, 1 + banks).map(p => marker(p, 3, '#a8ddca')).join('') : '';
  const pocketMark = end === 'pocket' ? marker(last, 6, '#f1a089') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="686" viewBox="0 0 920 686" role="img" aria-labelledby="title desc">
<title id="title">Bankshot — ${result}</title>
<desc id="desc">A ${width} by ${height} table. From (${start.join(', ')}) with velocity (${velocity.join(', ')}), the shot banks ${banks} times. ${result} at time ${fraction(last.tick, scale)}.</desc>
<rect width="920" height="686" fill="#172522"/>
<g fill="#efeadc" font-family="monospace">
<text x="48" y="39" font-size="11" letter-spacing="3" fill="#a8ddca">ONE BALL / FOUR RAILS</text>
<text x="48" y="86" font-size="40">Bankshot</text>
<text x="48" y="115" font-size="13" fill="#a8ddca">${width} × ${height} TABLE   ·   START (${start.join(', ')})   ·   VELOCITY (${velocity.join(', ')})</text>
<rect x="${left}" y="${top}" width="${width * unit}" height="${height * unit}" rx="4" fill="#203a32" stroke="#7ca295" stroke-width="2"/>
${corners}
<polyline points="${path}" fill="none" stroke="#a8ddca" stroke-opacity="${banks > 24 ? '.42' : '.88'}" stroke-width="1.8" stroke-linejoin="round"/>
<line x1="${sx(points[0].x)}" y1="${sy(points[0].y)}" x2="${sx(points[1].x)}" y2="${sy(points[1].y)}" stroke="#edc88f" stroke-width="2.2"/>
${bankMarks}${marker(points[0], 5, '#edc88f')}${pocketMark}
<text x="48" y="617" font-size="19">${result}</text>
<text x="48" y="648" font-size="12" fill="#a8ddca">TIME ${fraction(last.tick, scale)}   ·   ${banks} ${banks === 1 ? 'BANK' : 'BANKS'}   ·   GOLD MARKS THE START AND FIRST LEG</text>
</g></svg>\n`;
}
