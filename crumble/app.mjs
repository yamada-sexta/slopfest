import { LIMITS, SIZE, PAD, GRAIN_COLORS, PRESETS, specimen, pour, inspect, wave, settle, compareOrders, positionAt, colorAt, toSVG } from './core.mjs';
const $ = id => document.getElementById(id), canvas = $('pile'), ctx = canvas.getContext('2d'), fmt = value => value.toLocaleString();
let state, selected, running = false, frameId, lastTime = null, budget = 0, lastPaint = 0;
PRESETS.forEach((item, i) => { const option = document.createElement('option'); option.value = i; option.textContent = item.name; $('preset').append(option); });
const message = text => { $('status').textContent = text; };
function pause() { running = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0; }
function clearProof() {
  $('proof-title').textContent = 'One pour. Two ways home.';
  $('proof-note').textContent = 'Run a comparison for this postcard. Your drawing stays where it is; both trial avalanches finish separately.';
  $('proof-work').textContent = '';
}
function draw(stats) {
  const unit = (SIZE - PAD * 2) / state.size, layer = $('layer').value;
  ctx.fillStyle = '#132427'; ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < state.cells.length; i++) {
    ctx.fillStyle = colorAt(state.cells[i], state.odometer[i], stats.busiest, layer);
    ctx.fillRect(PAD + i % state.size * unit, PAD + Math.floor(i / state.size) * unit, unit - .6, unit - .6);
  }
  ctx.strokeStyle = '#fff8e5'; ctx.lineWidth = 2;
  ctx.strokeRect(PAD + selected % state.size * unit - 1, PAD + Math.floor(selected / state.size) * unit - 1, unit + 1.4, unit + 1.4);
}
function render() {
  const stats = inspect(state), layer = $('layer').value, amount = Number($('amount').value);
  draw(stats);
  $('board-label').textContent = `${state.size} × ${state.size} / OPEN EDGES`;
  $('settled').textContent = stats.stable ? 'SETTLED' : `${fmt(stats.unstable)} READY TO SPILL`;
  $('selected').textContent = `CELL ${selected % state.size + 1}, ${Math.floor(selected / state.size) + 1}`;
  $('height').textContent = `${fmt(state.cells[selected])}`;
  $('cell-work').textContent = `${fmt(state.cells[selected])} ${state.cells[selected] === 1 ? 'grain' : 'grains'} here · toppled ${fmt(state.odometer[selected])} times`;
  $('added').value = fmt(state.added); $('here').value = fmt(stats.grains); $('escaped').value = fmt(state.escaped); $('topplings').value = fmt(state.topplings);
  $('run').textContent = running ? 'Ⅱ Pause avalanche' : '▶ Run avalanche'; $('run').disabled = stats.stable;
  $('step').disabled = $('finish').disabled = stats.stable;
  $('drop').textContent = `Drop ${amount} ${amount === 1 ? 'grain' : 'grains'}`;
  $('allowance').textContent = `${fmt(LIMITS.grains - state.added)} more grains can join this postcard.`;
  $('layer-note').textContent = layer === 'grains' ? 'Color counts 0, 1, 2, or 3 grains. Coral means four or more: ready to spill.' : `Warmer means more topplings, on a logarithmic scale. Busiest cell: ${fmt(stats.busiest)}. Counts include the original pour.`;
  $('legend').replaceChildren();
  const items = layer === 'grains' ? GRAIN_COLORS.map((color, i) => [color, i === 4 ? '4+ / ready' : String(i)]) : [[colorAt(0, 0, stats.busiest, 'work'), 'no topples'], [colorAt(0, Math.ceil(stats.busiest / 5), stats.busiest, 'work'), 'some work'], [colorAt(0, stats.busiest, stats.busiest, 'work'), `${fmt(stats.busiest)} / busiest`]];
  for (const [color, label] of items) { const item = document.createElement('span'), swatch = document.createElement('i'); swatch.style.setProperty('--swatch', color); item.append(swatch, document.createTextNode(label)); $('legend').append(item); }
  canvas.setAttribute('aria-label', `Sandpile, ${state.size} by ${state.size}, ${layer === 'grains' ? 'grain' : 'work'} layer. ${stats.grains} grains here, ${state.escaped} escaped, ${stats.unstable} cells ready to spill. Selected cell ${selected % state.size + 1}, ${Math.floor(selected / state.size) + 1}: ${state.cells[selected]} grains, ${state.odometer[selected]} topplings. Arrows select, Enter drops grains, Space runs or pauses, Home selects center.`);
}
function load({ replay = false } = {}) {
  pause(); const index = Number($('preset').value); state = specimen(index); if (!replay) state = settle(state).state;
  selected = Math.floor(state.cells.length / 2); $('preset-note').textContent = PRESETS[index].note; clearProof();
  if (replay) { message('Replaying the original pour. Fresh grains wait one wave before spilling again.'); start(); }
  else { render(); message('A settled postcard. Choose a cell and drop grains, or replay the original pour.'); }
}
function frame(time) {
  if (!running) return;
  if (lastTime === null) lastTime = time;
  budget += Math.min(100, time - lastTime) * .16; lastTime = time; // 160 waves per second.
  const count = Math.floor(budget); budget -= count;
  for (let i = 0; i < count; i++) { state = wave(state); if (inspect(state).stable) { pause(); break; } }
  if (time - lastPaint > 1000 / 30 || !running) { render(); lastPaint = time; }
  if (running) frameId = requestAnimationFrame(frame); else message(`Avalanche settled. ${fmt(state.added - state.escaped)} grains remain; ${fmt(state.escaped)} escaped at the open edges.`);
}
function start() {
  if (inspect(state).stable) return;
  running = true; lastTime = null; budget = 0; lastPaint = 0; render(); frameId = requestAnimationFrame(frame);
}
function run() {
  if (inspect(state).stable) { message('Already settled. Drop grains or replay the original pour to start an avalanche.'); return; }
  if (running) { pause(); render(); message('Avalanche paused. One wave or Settle now can take it from here.'); }
  else { message('Following the avalanche, 160 parallel waves per second. Pause for a closer look.'); start(); }
}
function drop() {
  pause();
  try { state = pour(state, selected, Number($('amount').value)); clearProof(); render(); message(`Dropped ${$('amount').value} ${Number($('amount').value) === 1 ? 'grain' : 'grains'} at cell ${selected % state.size + 1}, ${Math.floor(selected / state.size) + 1}. ${inspect(state).stable ? 'Everything is still settled.' : 'Run the avalanche, or take one wave.'}`); }
  catch (error) { render(); message(error.message); }
}
function choose(index) { pause(); selected = index; render(); message(`Cell ${index % state.size + 1}, ${Math.floor(index / state.size) + 1} selected. Drop grains here, or keep exploring.`); }
$('preset').addEventListener('change', () => load()); $('restore').addEventListener('click', () => load());
$('replay').addEventListener('click', () => load({ replay: true })); $('run').addEventListener('click', run);
$('step').addEventListener('click', () => { pause(); state = wave(state); render(); message(inspect(state).stable ? 'That wave settled the avalanche.' : 'One parallel wave. Newly ready cells wait for the next one.'); });
$('finish').addEventListener('click', () => { pause(); state = settle(state).state; render(); message('Avalanche settled. Every cell holds at most three grains. Edge losses are counted below.'); });
$('drop').addEventListener('click', drop); $('amount').addEventListener('change', render); $('layer').addEventListener('change', render);
$('compare').addEventListener('click', () => {
  pause(); render(); const proof = compareOrders(state), match = proof.sameCells && proof.sameOdometer && proof.sameEscape;
  $('proof-title').textContent = match ? 'Same destination. Same work.' : 'The orders disagree.';
  $('proof-note').textContent = `${state.cells.length} heights, ${state.cells.length} toppling counts, and all edge losses ${match ? 'agree' : 'were compared'}. Both finish with ${fmt(proof.grains)} grains here and ${fmt(proof.escaped)} escaped. The trials start from all recorded drops, including the original pour.`;
  $('proof-work').textContent = `${fmt(proof.fifoVisits)} oldest-first cell visits / ${fmt(proof.lifoVisits)} newest-first cell visits. A visit may fire a tall cell several times.`;
  message('Both orders checked. Your current drawing and selection stayed in place. The comparison appears below the grain counts.');
});
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return; const rect = canvas.getBoundingClientRect(), index = positionAt((event.clientX - rect.left) / rect.width * SIZE, (event.clientY - rect.top) / rect.height * SIZE, state.size);
  canvas.focus({ preventScroll: true }); if (index !== null) choose(index);
});
canvas.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const x = selected % state.size, y = Math.floor(selected / state.size), positions = { ArrowLeft: y * state.size + Math.max(0, x - 1), ArrowRight: y * state.size + Math.min(state.size - 1, x + 1), ArrowUp: Math.max(0, y - 1) * state.size + x, ArrowDown: Math.min(state.size - 1, y + 1) * state.size + x, Home: Math.floor(state.cells.length / 2) };
  if (Object.hasOwn(positions, event.key)) { event.preventDefault(); choose(positions[event.key]); }
  else if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); drop(); }
  else if (event.key === ' ' && !event.repeat) { event.preventDefault(); run(); }
});
$('save').addEventListener('click', () => {
  pause(); render(); const url = URL.createObjectURL(new Blob([toSVG(state, $('layer').value)], { type: 'image/svg+xml' })), link = document.createElement('a');
  link.href = url; link.download = `crumble-${$('layer').value}.svg`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Saved the current layer and counts as SVG. The selection box stays in the workbench.');
});
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); render(); message('Avalanche paused while this page was hidden. Run resumes when you choose.'); } });
load();
