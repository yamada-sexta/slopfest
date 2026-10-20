import { WIDTH, HEIGHT, SCENES, scene, advance, clearWaves, line, pixels } from './core.mjs';
const $ = id => document.getElementById(id), canvas = $('water'), context = canvas.getContext('2d');
const field = document.createElement('canvas'); field.width = WIDTH; field.height = HEIGHT; const fieldContext = field.getContext('2d');
const notes = ['A steady source meets a two-slit barrier. Watch the openings become two new ways for the wave to spread.', 'Two sources share a period. Reverse the second to move the quiet places between their waves.', 'A long barrier leaves a path around its lower edge. Wait for the wave to find its way through.'];
let world, playing = false, frameId, lastTime = null, budget = 0, tool = 'ripple', cursor = { x: 24, y: 32 }, keyboardCursor = false, pointer = null, lastPoint = null;
const options = () => ({ driven: $('driven').checked, period: Number($('period').value), opposite: $('opposite').checked });
function message(text) { $('status').textContent = text; }
function draw(target = context, showCursor = keyboardCursor) {
  fieldContext.putImageData(new ImageData(pixels(world), WIDTH, HEIGHT), 0, 0);
  target.imageSmoothingEnabled = false; target.drawImage(field, 0, 0, 960, 640);
  for (const [index, source] of world.sources.entries()) {
    const active = $('driven').checked && !world.walls[source.y * WIDTH + source.x];
    target.strokeStyle = active ? '#eff8cf' : '#60796a'; target.lineWidth = 2;
    const x = source.x * 10 + 5, y = source.y * 10 + 5;
    target.beginPath(); target.arc(x, y, 7, 0, Math.PI * 2); target.moveTo(x - 11, y); target.lineTo(x + 11, y);
    if (!(index === 1 && $('opposite').checked)) { target.moveTo(x, y - 11); target.lineTo(x, y + 11); }
    target.stroke();
  }
  if (showCursor) { target.strokeStyle = '#d9efb1'; target.lineWidth = 2; target.strokeRect(cursor.x * 10 - 2, cursor.y * 10 - 2, 14, 14); }
}
function render() {
  draw(); $('tick').textContent = String(world.tick).padStart(4, '0'); $('motion').textContent = playing ? 'WATER IN MOTION' : 'WATER PAUSED'; $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Run';
  canvas.setAttribute('aria-label', `Wave tank at tick ${world.tick}. ${tool} brush at column ${cursor.x + 1}, row ${cursor.y + 1}. Arrow keys move the brush; Enter applies it; Space runs or pauses.`);
}
function pause(text) { playing = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0; if (text) message(text); render(); }
function frame(time) {
  if (!playing) return;
  if (lastTime === null) lastTime = time;
  budget += Math.min(100, time - lastTime) * 0.06; lastTime = time;
  const count = Math.min(4, Math.floor(budget)); budget -= count;
  for (let i = 0; i < count; i++) advance(world, options());
  render(); frameId = requestAnimationFrame(frame);
}
function toggle() {
  if (playing) { pause('Paused. Draw a barrier, drop a ripple, or inspect one tick at a time.'); return; }
  playing = true; lastTime = null; budget = 0; message('Waves running. Drawing pauses the water; hiding this page pauses it too.'); render(); frameId = requestAnimationFrame(frame);
}
function load() {
  playing = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0; pointer = null; lastPoint = null; keyboardCursor = false;
  world = scene(Number($('scene').value)); $('driven').checked = true; $('opposite').checked = false; $('period').value = 24; $('period-value').textContent = '24 ticks';
  $('opposite').disabled = world.sources.length < 2; $('phase-label').classList.toggle('unavailable', world.sources.length < 2); $('scene-note').textContent = notes[Number($('scene').value)];
  message('Prepared 360 ticks of waves, paused. Press Run to continue, or click the water to drop a ripple.'); render();
}
SCENES.forEach((title, index) => { const option = document.createElement('option'); option.value = index; option.textContent = title; $('scene').append(option); });
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
  tool = button.dataset.tool; document.querySelectorAll('[data-tool]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  message(`${button.textContent} brush selected. Draw in the tank, or focus it and use arrows plus Enter.`); render();
}));
function brush(point, from = point) {
  pause(); const changed = line(world, from, point, tool); cursor = point;
  message(!changed ? 'This spot is dry. Ripples need open water, and the outer rim stays closed.' : tool === 'ripple' ? 'Ripple dropped. Press Run to watch it travel. Barriers stay dry.' : tool === 'wall' ? 'Barrier drawn. Waves reflect from pale cells; source cells under barriers are silent.' : 'Barrier erased. Press Run to let waves through the opening.'); render();
}
function pointAt(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(WIDTH - 1, Math.floor((event.clientX - bounds.left) / bounds.width * WIDTH))), y: Math.max(0, Math.min(HEIGHT - 1, Math.floor((event.clientY - bounds.top) / bounds.height * HEIGHT))) };
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointer !== null) return;
  event.preventDefault(); canvas.focus({ preventScroll: true }); pointer = event.pointerId; canvas.setPointerCapture(pointer); keyboardCursor = false;
  const point = pointAt(event); brush(point); lastPoint = point;
});
canvas.addEventListener('pointermove', event => { if (event.pointerId === pointer) { const point = pointAt(event); if (point.x !== lastPoint.x || point.y !== lastPoint.y) { brush(point, lastPoint); lastPoint = point; } } });
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(eventName, event => { if (event.pointerId === pointer) { pointer = null; lastPoint = null; } });
canvas.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (direction) { event.preventDefault(); const distance = event.shiftKey ? 8 : 1; cursor = { x: Math.max(1, Math.min(WIDTH - 2, cursor.x + direction[0] * distance)), y: Math.max(1, Math.min(HEIGHT - 2, cursor.y + direction[1] * distance)) }; keyboardCursor = true; render(); }
  else if (event.key === 'Enter') { event.preventDefault(); keyboardCursor = true; brush(cursor); }
  else if (event.key === ' ' && !event.repeat) { event.preventDefault(); toggle(); }
});
canvas.addEventListener('blur', () => { keyboardCursor = false; render(); });
$('play').addEventListener('click', toggle);
$('step').addEventListener('click', () => { pause(); advance(world, options()); message('One tick forward. Watch a crest become a trough and spread to its neighbors.'); render(); });
$('clear').addEventListener('click', () => { pause(); clearWaves(world); message('Waves cleared; barriers and source settings remain. Run wakes any enabled sources.'); render(); });
$('reset').addEventListener('click', load); $('scene').addEventListener('change', load);
for (const id of ['driven', 'opposite']) $(id).addEventListener('change', () => { pause('Source setting changed. Existing waves remain; Run lets the new waves join them.'); });
$('period').addEventListener('input', () => { $('period-value').textContent = `${$('period').value} ticks`; pause('Period changed. Existing waves remain; Run sends the new spacing into the tank.'); });
$('save').addEventListener('click', () => {
  const snapshot = document.createElement('canvas'); snapshot.width = 960; snapshot.height = 640; draw(snapshot.getContext('2d'), false);
  snapshot.toBlob(blob => {
    if (!blob) { message('This browser could not create the PNG.'); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'ripplefax.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Saved this tank frame as a PNG, with source markers and without the brush cursor.');
  }, 'image/png');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pointer = null; lastPoint = null; if (playing) pause('Paused while this page was hidden. Press Run when you return.'); } });
load();
