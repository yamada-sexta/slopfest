import { DIRECTIONS, escapedBytes, toSVG } from './core.mjs';
import { loadMap, frameAt, visitsAt, explain } from './workbench.mjs';
import { specimens } from './specimens.mjs';
const $ = id => document.getElementById(id), canvas = $('map'), ctx = canvas.getContext('2d'), arrows = ['→', '↓', '←', '↑'];
let bench, position = 0, valid = false, walking = false, frameId, lastTime = null, lastPaint = 0, budget = 0;
specimens.forEach((item, i) => { const option = document.createElement('option'); option.value = i; option.textContent = item.name; $('specimen').append(option); });
const message = text => { $('status').textContent = text; };
function pause() { walking = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0; }
function draw(frame) {
  const { program, result } = bench, visits = visitsAt(bench, position), cell = Math.min(160, (canvas.width - 110) / program.width, (canvas.height - 100) / program.height);
  const left = (canvas.width - program.width * cell) / 2, top = (canvas.height - program.height * cell) / 2;
  const center = cursor => [left + (cursor.x + .5) * cell, top + (cursor.y + .5) * cell];
  const loop = new Set();
  if (frame.complete && result.cycle) for (let i = result.cycle.start; i < result.steps; i++) { const c = result.history[i].before; loop.add(c.y * program.width + c.x); }
  ctx.fillStyle = '#122018'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < program.height; y++) for (let x = 0; x < program.width; x++) {
    const at = y * program.width + x;
    ctx.fillStyle = visits[at] ? '#304938' : '#1a2b20'; ctx.fillRect(left + x * cell + 1, top + y * cell + 1, cell - 2, cell - 2);
    if (loop.has(at)) { ctx.strokeStyle = '#c3b3ed'; ctx.lineWidth = 2; ctx.strokeRect(left + x * cell + 3, top + y * cell + 3, cell - 6, cell - 6); }
  }
  ctx.strokeStyle = '#b5d58a'; ctx.lineWidth = Math.max(2, cell / 14); ctx.globalAlpha = .3; ctx.beginPath();
  if (position) {
    const first = center(result.history[0].before); ctx.moveTo(...first);
    for (let i = 1; i < position; i++) ctx.lineTo(...center(result.history[i].before));
    ctx.lineTo(...center(frame.cursor)); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${cell * .47}px ui-monospace, monospace`;
  for (let y = 0; y < program.height; y++) for (let x = 0; x < program.width; x++) {
    const op = program.rows[y][x]; if (op === ' ') continue;
    const point = center({ x, y }); ctx.strokeStyle = '#1a2b20'; ctx.lineWidth = 3; ctx.strokeText(op, ...point);
    ctx.fillStyle = op === '@' || op === '#' ? '#f1bd83' : '#e2ebd6'; ctx.fillText(op, ...point);
  }
  const point = center(frame.cursor); ctx.strokeStyle = '#f1bd83'; ctx.lineWidth = Math.max(2, cell / 22);
  ctx.strokeRect(point[0] - cell * .45, point[1] - cell * .45, cell * .9, cell * .9);
  ctx.fillStyle = '#f1bd83'; ctx.font = `${Math.max(11, cell * .27)}px ui-monospace, monospace`; ctx.fillText(arrows[frame.cursor.direction], point[0], point[1] - cell * .66);
}
function render() {
  if (!bench) return;
  const frame = frameAt(bench, position), cursor = frame.cursor, total = bench.result.steps;
  draw(frame); $('map-size').textContent = `${bench.program.width} × ${bench.program.height} / THE MAP ROOM`;
  $('state-label').textContent = !valid ? 'DRAFT NOT LOADED' : walking ? 'WALKING' : frame.complete ? bench.result.status.toUpperCase() : position ? 'PAUSED' : 'READY';
  $('byte').value = String(cursor.byte).padStart(3, '0'); $('bits').textContent = `${cursor.byte.toString(2).padStart(8, '0')} · 0x${cursor.byte.toString(16).padStart(2, '0').toUpperCase()}`;
  $('heading').textContent = `${arrows[cursor.direction]} ${DIRECTIONS[cursor.direction]}`; $('coordinates').textContent = `COL ${cursor.x + 1} / ROW ${cursor.y + 1}`;
  $('consumed').textContent = `${cursor.inputAt} / ${bench.input.length}`; $('input-next').textContent = cursor.inputAt === bench.input.length ? 'NEXT: EOF → 0' : `NEXT BYTE: ${bench.input[cursor.inputAt]}`;
  $('tile').textContent = frame.complete ? '■' : frame.next === ' ' ? '·' : frame.next;
  $('next').textContent = explain(bench, position); $('output').textContent = escapedBytes(frame.output); $('output-count').textContent = `${frame.output.length.toLocaleString()} BYTES`;
  $('position').value = `${position.toLocaleString()} / ${total.toLocaleString()}`; $('progress').max = total; $('progress').value = position;
  $('progress').setAttribute('aria-valuetext', `${position} of ${total} recorded steps`); $('progress').disabled = !valid;
  $('start').disabled = $('back').disabled = !valid || position === 0; $('step').disabled = $('finish').disabled = !valid || frame.complete;
  $('walk').disabled = $('save').disabled = !valid; $('walk').textContent = walking ? 'Ⅱ Pause' : '▶ Walk';
  $('cycle').hidden = !frame.complete || !bench.result.cycle;
  if (bench.result.cycle) $('cycle-note').textContent = `This cursor, direction, pocket, and input position already occurred after ${bench.result.cycle.start} steps. The next ${bench.result.cycle.period} steps repeat, emitting ${bench.result.cycle.output.length} output bytes each time.`;
  $('loop-start').disabled = !valid;
  canvas.setAttribute('aria-label', `Detour map, step ${position} of ${total}. Cursor column ${cursor.x + 1}, row ${cursor.y + 1}, heading ${DIRECTIONS[cursor.direction]}, pocket ${cursor.byte}. ${frame.output.length} output bytes. Left and right step; Home and End jump; Space walks or pauses.`);
}
function load() {
  pause();
  try {
    const next = loadMap($('source').value, $('input').value, Number($('budget').value));
    bench = next; position = 0; valid = true; canvas.width = Math.max(900, bench.program.width * 24 + 120); canvas.height = Math.max(460, bench.program.height * 24 + 120);
    $('error').hidden = true; message(`Map loaded. ${bench.result.steps.toLocaleString()} steps recorded; the trace ends with ${bench.result.status}. Step or Walk to follow it.`);
  } catch (error) { valid = false; $('error').textContent = error.message; $('error').hidden = false; message('Load failed. The last loaded map and cursor stay here. Fix the draft and load again.'); }
  render();
}
function specimen() {
  const item = specimens[Number($('specimen').value)]; $('source').value = item.source; $('input').value = item.input; $('specimen-note').textContent = item.note; load();
}
function seek(next) { if (!valid) return; pause(); position = next; render(); message(position === bench.result.steps ? explain(bench, position) : `At recorded step ${position}. ${explain(bench, position)}`); }
function frame(time) {
  if (!walking) return;
  if (lastTime === null) lastTime = time;
  budget += Math.min(100, time - lastTime) / 1000 * Math.max(5, bench.result.steps / 20); lastTime = time;
  if (time - lastPaint >= 1000 / 30) {
    const count = Math.floor(budget); budget -= count; position = Math.min(bench.result.steps, position + count); lastPaint = time;
    if (position === bench.result.steps) { pause(); message(explain(bench, position)); }
    render();
  }
  if (walking) frameId = requestAnimationFrame(frame);
}
function walk() {
  if (!valid) return;
  if (walking) { pause(); render(); message('Walk paused. Scrub or step to inspect a tile.'); return; }
  if (position === bench.result.steps) position = 0;
  walking = true; lastTime = null; budget = 0; lastPaint = 0; render(); message('Following the recorded walk. Pause for a closer look.'); frameId = requestAnimationFrame(frame);
}
function dirty() { pause(); valid = false; $('error').hidden = true; render(); message('Draft changed. Load map restarts the cursor with this source, input, and budget.'); }
$('editor').addEventListener('submit', event => { event.preventDefault(); load(); });
$('specimen').addEventListener('change', specimen); $('restore').addEventListener('click', specimen);
$('source').addEventListener('input', dirty); $('input').addEventListener('input', dirty); $('budget').addEventListener('change', dirty);
$('start').addEventListener('click', () => seek(0)); $('back').addEventListener('click', () => seek(position - 1)); $('step').addEventListener('click', () => seek(position + 1)); $('finish').addEventListener('click', () => seek(bench.result.steps));
$('progress').addEventListener('input', event => seek(Number(event.target.value))); $('walk').addEventListener('click', walk);
$('loop-start').addEventListener('click', () => seek(bench.result.cycle.start));
canvas.addEventListener('click', () => canvas.focus({ preventScroll: true }));
canvas.addEventListener('keydown', event => {
  if (!valid || event.ctrlKey || event.metaKey || event.altKey) return;
  const positions = { ArrowLeft: Math.max(0, position - 1), ArrowRight: Math.min(bench.result.steps, position + 1), Home: 0, End: bench.result.steps };
  if (Object.hasOwn(positions, event.key)) { event.preventDefault(); seek(positions[event.key]); }
  else if (event.key === ' ' && !event.repeat) { event.preventDefault(); walk(); }
});
$('save').addEventListener('click', () => {
  if (!valid) return; pause(); render(); const svg = toSVG(bench.program, bench.result, { position });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), link = document.createElement('a'); link.href = url; link.download = 'detour-route.svg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  message(`Saved the map and its first ${position} steps as SVG, with the current cursor and output.`);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && walking) { pause(); render(); message('Walk paused while this page was hidden. Walk continues when you choose.'); } });
specimen();
