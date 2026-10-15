import { COLORS, WIDTH, HEIGHT, createWorld, step, inventory, paint, samePicture, toSVG } from './core.mjs';
import { pours, pour } from './pours.mjs';
const $ = id => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d');
const originCanvas = $('origin'), originCtx = originCanvas.getContext('2d');
let world, origin, mode = 0, raf = 0, previousTime = null, budget = 0;
let ink = 1, radius = 3, speed = 24, pointer = null, lastPoint = null;
let cursor = { x: WIDTH / 2, y: HEIGHT / 2 }, showCursor = false;

for (const p of pours) {
  const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; $('pour').append(option);
}

function status(message) { if ($('status').textContent !== message) $('status').textContent = message; }
function stop() {
  mode = 0; cancelAnimationFrame(raf); raf = 0; previousTime = null; budget = 0;
}
function start(direction) {
  stop();
  if (direction === -1 && !world.tick) { status('Already at the origin. Press Stir to give time somewhere to go.'); render(); return; }
  mode = direction;
  status(direction === 1 ? 'Stirring. Each step rearranges the ink. Press Unspill whenever you are ready to bring it back.'
    : 'Unspilling. The same rules are running backward, one exact step at a time.');
  render(); raf = requestAnimationFrame(frame);
}
function pause() { stop(); status('Paused. Step in either direction, keep stirring, or paint a new starting picture.'); render(); }
function toggle() { mode ? pause() : start(1); }

function frame(time) {
  if (!mode) return;
  if (previousTime === null) previousTime = time;
  budget += Math.min(time - previousTime, 200) * speed / 1000;
  previousTime = time;
  const count = Math.min(Math.floor(budget), 12);
  budget -= count;
  for (let i = 0; i < count; i++) {
    step(world, mode);
    if (mode === -1 && world.tick === 0) { stop(); status('Every pixel is home. The picture was recovered by reversing the rules.'); break; }
  }
  render();
  if (mode) raf = requestAnimationFrame(frame);
}

function paintPicture(context, cells, cellSize, gaps) {
  context.fillStyle = COLORS[0]; context.fillRect(0, 0, WIDTH * cellSize, HEIGHT * cellSize);
  const inset = gaps ? cellSize * .09 : 0;
  cells.forEach((cell, i) => {
    if (!cell) return;
    context.fillStyle = COLORS[cell];
    context.fillRect((i % WIDTH) * cellSize + inset, Math.floor(i / WIDTH) * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2);
  });
}

function render() {
  paintPicture(ctx, world.cells, 10, true);
  if (showCursor) {
    ctx.strokeStyle = '#e8eddf'; ctx.lineWidth = 1.5;
    ctx.strokeRect((cursor.x - radius) * 10 - 1, (cursor.y - radius) * 10 - 1, (radius * 2 + 1) * 10 + 2, (radius * 2 + 1) * 10 + 2);
  }
  $('tick').textContent = String(world.tick).padStart(4, '0');
  const playLabel = mode ? 'Ⅱ Pause <kbd>SPACE</kbd>' : '▶ Stir <kbd>SPACE</kbd>';
  if ($('play').innerHTML !== playLabel) $('play').innerHTML = playLabel;
  $('reverse').disabled = $('back').disabled = world.tick === 0;
  $('reverse').setAttribute('aria-pressed', String(mode === -1));
  $('direction').textContent = world.tick === 0 ? 'AT THE ORIGIN' : mode === 1 ? 'TIME → FORWARD' : mode === -1 ? 'TIME ← BACKWARD' : 'TIME PAUSED';
  $('origin-state').textContent = samePicture(world.cells, origin) ? 'EXACT MATCH' : 'SCATTERED';
  canvas.setAttribute('aria-label', `Ink picture at step ${world.tick}. Brush column ${cursor.x + 1}, row ${cursor.y + 1}. Arrow keys move the brush; Enter paints.`);
}

function refreshOrigin(note) {
  origin = world.cells.slice();
  paintPicture(originCtx, origin, 3, false);
  const counts = inventory(origin);
  for (const [index, name] of [[1, 'cyan'], [2, 'peach'], [3, 'violet']]) $(name + '-count').textContent = counts[index].toLocaleString();
  if (note) $('pour-note').textContent = note;
}

function loadPour() {
  stop(); pointer = null; lastPoint = null; showCursor = false;
  const p = pours.find(p => p.id === $('pour').value);
  world = pour(p.id); refreshOrigin(p.note);
  status('Press Stir to scatter the picture. Then Unspill to bring every pixel home.'); render();
}

function manual(direction) {
  stop(); const moved = step(world, direction);
  status(!moved ? 'Already at the origin. Take a forward step first.' : world.tick === 0
    ? 'Every pixel is home. The picture was recovered by reversing the rules.'
    : `One step ${direction === 1 ? 'forward' : 'backward'}. Each color keeps exactly the same number of cells.`);
  render();
}

function applyBrush(point, from = point) {
  stop();
  const distance = Math.max(Math.abs(point.x - from.x), Math.abs(point.y - from.y));
  let changed = false;
  for (let i = 0; i <= distance; i++) {
    const t = distance ? i / distance : 0;
    changed = paint(world, Math.round(from.x + (point.x - from.x) * t), Math.round(from.y + (point.y - from.y) * t), ink, radius) || changed;
  }
  if (changed) {
    refreshOrigin('Your own mark. Painting made this picture the new time origin.');
    status('New origin set. Stir your drawing, then Unspill to recover it.');
  } else status('Paused. This stroke changed no pixels, so your existing origin is unchanged.');
  render();
}

function pointAt(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(WIDTH - 1, Math.floor((event.clientX - bounds.left) / bounds.width * WIDTH))),
    y: Math.max(0, Math.min(HEIGHT - 1, Math.floor((event.clientY - bounds.top) / bounds.height * HEIGHT))) };
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointer !== null) return;
  event.preventDefault(); canvas.focus({ preventScroll: true });
  pointer = event.pointerId; canvas.setPointerCapture(pointer); showCursor = false;
  cursor = pointAt(event); applyBrush(cursor); lastPoint = cursor;
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== pointer) return;
  cursor = pointAt(event); applyBrush(cursor, lastPoint); lastPoint = cursor;
});
function endStroke(event) { if (event.pointerId === pointer) { pointer = null; lastPoint = null; } }
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, endStroke);
canvas.addEventListener('blur', () => { showCursor = false; render(); });

$('play').addEventListener('click', toggle);
$('reverse').addEventListener('click', () => mode === -1 ? pause() : start(-1));
$('back').addEventListener('click', () => manual(-1));
$('forward').addEventListener('click', () => manual(1));
$('pour').addEventListener('change', loadPour);
$('restore').addEventListener('click', () => {
  stop(); world = createWorld(WIDTH, HEIGHT, origin); showCursor = false;
  status('Origin restored. Press Stir to start another journey.'); render();
});
document.querySelectorAll('[data-ink]').forEach(button => button.addEventListener('click', () => {
  ink = Number(button.dataset.ink);
  document.querySelectorAll('[data-ink]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
$('brush').addEventListener('change', event => { radius = Number(event.target.value); render(); });
$('speed').addEventListener('input', event => { speed = Number(event.target.value); $('speed-value').value = speed; });
$('save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([toSVG(world)], { type: 'image/svg+xml' }));
  const link = document.createElement('a'); link.href = url; link.download = 'unspill-drawing.svg'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pointer = null; lastPoint = null; if (mode) pause(); }
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input,select,textarea')) return;
  const key = event.key.toLowerCase();
  if (event.target === canvas) {
    const movement = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
    if (movement) {
      event.preventDefault(); showCursor = true;
      cursor = { x: Math.max(0, Math.min(WIDTH - 1, cursor.x + movement[0])), y: Math.max(0, Math.min(HEIGHT - 1, cursor.y + movement[1])) };
      render(); return;
    }
    if (key === 'enter') { event.preventDefault(); showCursor = true; applyBrush(cursor); return; }
  }
  if (event.repeat) return;
  if (key === ' ' && !event.target.matches('button,a,summary')) { event.preventDefault(); toggle(); }
  else if (key === 'r') { event.preventDefault(); start(-1); }
  else if (key === '[' || key === ']') { event.preventDefault(); manual(key === '[' ? -1 : 1); }
  else if (key === 'escape' && mode) { event.preventDefault(); pause(); }
});
loadPour();
