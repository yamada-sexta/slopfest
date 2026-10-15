import { createWorld, WIDTH, HEIGHT } from './core.mjs';

export const pours = [
  { id: 'spills', name: 'Three little spills', note: 'Three puddles meet at the edge of a small universe.' },
  { id: 'word', name: 'A word to remember', note: 'A four-letter promise, written in little squares.' },
  { id: 'border', name: 'A quiet border', note: 'A frame comes apart. Its corners know how to find each other again.' }
];
const letters = {
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110']
};

export function pour(id = 'spills') {
  if (!pours.some(p => p.id === id)) throw new Error('Unknown starting picture.');
  const world = createWorld();
  const put = (x, y, ink) => { world.cells[y * WIDTH + x] = ink; };
  if (id === 'spills') {
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const circles = [[35, 27, 12], [58, 27, 12], [47, 43, 12]];
      circles.forEach(([cx, cy, r], i) => { if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, i + 1); });
    }
  } else if (id === 'word') {
    [...'UNDO'].forEach((letter, n) => {
      letters[letter].forEach((row, y) => [...row].forEach((pixel, x) => {
        if (pixel === '1') for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
          put(13 + n * 18 + x * 3 + dx, 21 + y * 3 + dy, n % 3 + 1);
        }
      }));
    });
  } else {
    for (let y = 15; y < 49; y++) for (let x = 20; x < 76; x++) {
      if (x < 24 || x >= 72 || y < 19 || y >= 45) put(x, y, (Math.floor(x / 8) + Math.floor(y / 8)) % 3 + 1);
    }
  }
  return world;
}
